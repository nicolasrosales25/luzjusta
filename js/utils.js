// =====================================================
// LuzJusta — Utilidades generales
// =====================================================
// Funciones puras de formateo y cálculo.
// NO acceden al estado ni a Firestore.
// =====================================================

/** Formatea un número como pesos argentinos sin decimales */
function formatPesos(n) {
  if (n === null || n === undefined || isNaN(n)) return '$—';
  return '$' + Math.round(n).toLocaleString('es-AR');
}

/** Formatea kWh con 2 decimales */
function formatKwh(n) {
  if (n === null || n === undefined || isNaN(n)) return '—';
  return parseFloat(n).toFixed(2);
}

/** Formatea una fecha ISO (YYYY-MM-DD) a formato argentino corto */
function formatFecha(fechaIso, opciones) {
  const opts = opciones || { day: '2-digit', month: 'short', year: 'numeric' };
  // Se agrega T12:00 para evitar el corrimiento de zona horaria
  return new Date(fechaIso + 'T12:00:00').toLocaleDateString('es-AR', opts);
}

/** Formatea fecha larga (8 de mayo de 2026) */
function formatFechaLarga(fechaIso) {
  return formatFecha(fechaIso, { day: '2-digit', month: 'long', year: 'numeric' });
}

/** Devuelve la fecha de hoy en formato ISO YYYY-MM-DD */
function hoyIso() {
  return new Date().toISOString().split('T')[0];
}

/** Calcula el costo estimado según la tarifa configurada.
 *  Recibe kwh y el objeto tarifa de S.configuracion.tarifa */
function calcularCosto(kwh, tarifa) {
  if (!kwh || kwh <= 0 || !tarifa) return 0;

  let energia = 0;
  if (kwh <= tarifa.tramo1_hasta) {
    energia = kwh * tarifa.tramo1_precio;
  } else if (kwh <= tarifa.tramo2_hasta) {
    energia = tarifa.tramo1_hasta * tarifa.tramo1_precio
            + (kwh - tarifa.tramo1_hasta) * tarifa.tramo2_precio;
  } else {
    energia = tarifa.tramo1_hasta * tarifa.tramo1_precio
            + (tarifa.tramo2_hasta - tarifa.tramo1_hasta) * tarifa.tramo2_precio
            + (kwh - tarifa.tramo2_hasta) * tarifa.tramo3_precio;
  }

  const subtotal = energia + tarifa.cargo_fijo + tarifa.alumbrado + tarifa.servicios_sociales;
  return Math.round(subtotal * tarifa.impuestos_factor);
}

/** Distribuye un monto total proporcionalmente a los consumos.
 *  consumos = { raul: 312, nico: 198, ... }
 *  Devuelve { raul: { kwh, pct, monto }, ... } */
function distribuirFactura(totalFactura, consumos) {
  const totalKwh = Object.values(consumos).reduce((a, b) => a + b, 0);
  if (!totalKwh) return {};

  const resultado = {};
  Object.entries(consumos).forEach(([casaId, kwh]) => {
    resultado[casaId] = {
      kwh,
      pct: (kwh / totalKwh) * 100,
      monto: Math.round(totalFactura * kwh / totalKwh),
    };
  });
  return resultado;
}

/** Muestra una notificación toast temporal */
function mostrarNotificacion(mensaje) {
  const notif = document.getElementById('notif');
  if (!notif) return;
  notif.textContent = mensaje;
  notif.classList.add('show');
  setTimeout(() => notif.classList.remove('show'), 3000);
}
