// =====================================================
// LuzJusta — Service de Facturas
// =====================================================

/** Carga las facturas desde Firestore */
async function cargarFacturas() {
  const db = getDB();
  if (db) {
    try {
      const snap = await db.collection('facturas')
        .orderBy('hasta', 'desc')
        .limit(24)
        .get();
      S.facturas = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      console.log('[Facturas] Cargadas:', S.facturas.length);
      return S.facturas;
    } catch (e) {
      console.warn('[Facturas] Error:', e.message);
    }
  }
  S.facturas = [];
  return S.facturas;
}

/** Guarda una nueva factura con su distribución */
async function guardarFactura(factura) {
  const datos = {
    periodo:    factura.periodo || '',
    desde:      factura.desde,
    hasta:      factura.hasta,
    total:      parseFloat(factura.total),
    casas:      factura.casas,
    total_kwh:  factura.total_kwh || 0,
    created_at: new Date().toISOString(),
  };

  const db = getDB();
  if (db) {
    try {
      const ref = await db.collection('facturas').add(datos);
      datos.id = ref.id;
      console.log('[Facturas] Guardada:', datos.id);
    } catch (e) {
      console.warn('[Facturas] Error guardando:', e.message);
      datos.id = 'local_' + Date.now();
    }
  } else {
    datos.id = 'local_' + Date.now();
  }

  S.facturas.unshift(datos);
  return datos;
}
