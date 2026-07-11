// =====================================================
// LuzJusta — Estado global de la aplicación
// =====================================================
// Toda la aplicación renderiza a partir de este estado.
// Los Services son los ÚNICOS que modifican este objeto.
// Los Renderers SOLO leen de acá.
// =====================================================

const S = {
  // Sesión actual
  usuario: null,      // 'admin' | null
  rol: null,          // 'admin' | 'tenant' | null
  casaActual: null,   // clave de casa si rol === 'tenant'

  // Datos de negocio
  casas: [],          // [{ id, nombre, color, orden }]
  lecturas: [],       // [{ id, casa, fecha, kwh, watt, voltage, fuente }]
  facturas: [],       // [{ id, periodo, desde, hasta, total, casas: {...} }]

  // Configuración general (tarifas, sync, credenciales)
  configuracion: {},

  // Estado en vivo de los medidores (se actualiza por sync)
  medidores: {},      // { raul: { online, kwhTotal, watt, voltage, ultimaSync } }
};

// =====================================================
// Helpers de acceso al estado
// =====================================================

/** Devuelve la casa por su id, o null */
function getCasa(id) {
  return S.casas.find(c => c.id === id) || null;
}

/** Devuelve las lecturas de una casa ordenadas por fecha descendente */
function getLecturasDeCasa(casaId) {
  return S.lecturas
    .filter(l => l.casa === casaId)
    .sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
}

/** Calcula el consumo del período actual de una casa
 *  (última lectura menos la anterior) */
function getConsumoPeriodo(casaId) {
  const lecturas = getLecturasDeCasa(casaId);
  if (lecturas.length < 2) return 0;
  const diff = parseFloat(lecturas[0].kwh) - parseFloat(lecturas[1].kwh);
  return diff < 0 ? parseFloat(lecturas[0].kwh) : diff; // maneja reset del medidor
}

/** Suma el consumo del período de todas las casas */
function getConsumoTotal() {
  return S.casas.reduce((total, casa) => total + getConsumoPeriodo(casa.id), 0);
}
