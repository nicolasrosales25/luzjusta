// =====================================================
// LuzJusta — Service de Facturas
// =====================================================
// Cada factura es un documento independiente en Firestore.
// Guarda el total real de la Cooperativa y la distribución
// proporcional calculada por la app.
// =====================================================

/** Facturas demo */
const FACTURAS_DEMO = [
  {
    id: 'f1', periodo: '04/2026', desde: '2026-03-10', hasta: '2026-04-10', total: 338916,
    casas: {
      nico:      { kwh: 185, pct: 26.7, monto: 90510 },
      muluk:     { kwh: 230, pct: 33.2, monto: 112520 },
      raul_tina: { kwh: 278, pct: 40.1, monto: 135886 },
    },
  },
  {
    id: 'f2', periodo: '03/2026', desde: '2026-02-13', hasta: '2026-03-10', total: 349605,
    casas: {
      nico:      { kwh: 195, pct: 26.7, monto: 93344 },
      muluk:     { kwh: 225, pct: 30.8, monto: 107678 },
      raul_tina: { kwh: 310, pct: 42.5, monto: 148583 },
    },
  },
];

/** Carga las facturas desde Firestore al estado global */
async function cargarFacturas() {
  const db = getDB();
  if (db) {
    try {
      const snap = await db.collection('facturas')
        .orderBy('hasta', 'desc')
        .limit(24)
        .get();
      if (!snap.empty) {
        S.facturas = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        console.log('[Facturas] Cargadas desde Firestore:', S.facturas.length);
        return S.facturas;
      }
      // Sembrar demo
      for (const fac of FACTURAS_DEMO) {
        const { id, ...datos } = fac;
        await db.collection('facturas').add(datos);
      }
      console.log('[Facturas] Sembradas en Firestore ✓');
      const snap2 = await db.collection('facturas').orderBy('hasta', 'desc').get();
      S.facturas = snap2.docs.map(d => ({ id: d.id, ...d.data() }));
      return S.facturas;
    } catch (e) {
      console.warn('[Facturas] Error Firestore, usando demo:', e.message);
    }
  }
  S.facturas = [...FACTURAS_DEMO];
  return S.facturas;
}

/** Guarda una nueva factura con su distribución */
async function guardarFactura(factura) {
  const datos = {
    periodo:   factura.periodo || '',
    desde:     factura.desde,
    hasta:     factura.hasta,
    total:     parseFloat(factura.total),
    casas:     factura.casas,
    total_kwh: factura.total_kwh || 0,
    created_at: new Date().toISOString(),
  };

  const db = getDB();
  if (db) {
    try {
      const ref = await db.collection('facturas').add(datos);
      datos.id = ref.id;
      console.log('[Facturas] Guardada en Firestore:', datos.id);
    } catch (e) {
      console.warn('[Facturas] Error guardando:', e.message);
      datos.id = 'local_' + Date.now();
    }
  } else {
    datos.id = 'demo_' + Date.now();
  }

  S.facturas.unshift(datos);
  return datos;
}
