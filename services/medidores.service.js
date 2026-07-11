// =====================================================
// LuzJusta — Service de Medidores
// =====================================================
// Estado en vivo de los medidores Peacefair PZIOT-E01.
// ETAPA 2: datos demo simulados.
// ETAPA 5: se conecta a Tuya IoT API.
// Los medidores se generan dinámicamente según las casas
// que existan en el estado.
// =====================================================

/** Datos demo de los medidores (se usa hasta que haya Tuya) */
const MEDIDORES_DEMO = {
  nico:      { online: true,  kwhTotal: 893.15,  watt: 420, voltage: 219, corriente: 1.9, ultimaSync: 'hace 3 min' },
  muluk:     { online: true,  kwhTotal: 1044.80, watt: 640, voltage: 220, corriente: 2.9, ultimaSync: 'hace 3 min' },
  raul_tina: { online: true,  kwhTotal: 1247.30, watt: 890, voltage: 221, corriente: 4.0, ultimaSync: 'hace 3 min' },
};

/** Sincroniza el estado de los medidores.
 *  Genera un medidor demo por cada casa que exista en S.casas.
 *  Etapa 5: acá va la llamada real a Tuya IoT API. */
async function sincronizarMedidores() {
  // Generar estado para cada casa registrada
  S.medidores = {};
  S.casas.forEach(casa => {
    if (MEDIDORES_DEMO[casa.id]) {
      S.medidores[casa.id] = { ...MEDIDORES_DEMO[casa.id] };
    } else {
      // Casa nueva sin datos demo: mostrar como sin datos
      S.medidores[casa.id] = {
        online: false, kwhTotal: 0, watt: 0,
        voltage: 0, corriente: 0, ultimaSync: 'Sin medidor',
      };
    }
  });
  return S.medidores;
}

/** Devuelve la potencia total actual (suma de casas online) */
function getPotenciaTotal() {
  return Object.values(S.medidores)
    .filter(m => m.online)
    .reduce((total, m) => total + (m.watt || 0), 0);
}

/** Cuenta cuántos medidores están online */
function getMedidoresOnline() {
  const valores = Object.values(S.medidores);
  return {
    online: valores.filter(m => m.online).length,
    total: valores.length,
  };
}
