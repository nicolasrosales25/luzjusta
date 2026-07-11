// =====================================================
// LuzJusta — Service de Lecturas
// =====================================================
// Cada lectura es un documento independiente en Firestore.
// La colección puede crecer sin límite.
// =====================================================

/** Lecturas demo (solo se usan si Firestore no está disponible) */
const LECTURAS_DEMO = [
  { id: 'l01', casa: 'nico',      fecha: '2026-05-08', kwh: 893.15,  watt: 420, voltage: 219, fuente: 'wifi_auto' },
  { id: 'l02', casa: 'nico',      fecha: '2026-04-24', kwh: 844.80,  watt: 350, voltage: 220, fuente: 'wifi_auto' },
  { id: 'l03', casa: 'nico',      fecha: '2026-04-10', kwh: 695.15,  watt: 390, voltage: 219, fuente: 'wifi_auto' },
  { id: 'l04', casa: 'muluk',     fecha: '2026-05-08', kwh: 1044.80, watt: 640, voltage: 220, fuente: 'wifi_auto' },
  { id: 'l05', casa: 'muluk',     fecha: '2026-04-24', kwh: 976.20,  watt: 590, voltage: 220, fuente: 'wifi_auto' },
  { id: 'l06', casa: 'muluk',     fecha: '2026-04-10', kwh: 813.80,  watt: 620, voltage: 221, fuente: 'wifi_auto' },
  { id: 'l07', casa: 'raul_tina', fecha: '2026-05-08', kwh: 1247.30, watt: 890, voltage: 221, fuente: 'wifi_auto' },
  { id: 'l08', casa: 'raul_tina', fecha: '2026-04-24', kwh: 1178.20, watt: 760, voltage: 220, fuente: 'wifi_auto' },
  { id: 'l09', casa: 'raul_tina', fecha: '2026-04-10', kwh: 935.30,  watt: 810, voltage: 221, fuente: 'wifi_auto' },
];

/** Carga las lecturas desde Firestore al estado global */
async function cargarLecturas() {
  const db = getDB();
  if (db) {
    try {
      const snap = await db.collection('lecturas')
        .orderBy('fecha', 'desc')
        .limit(200)
        .get();
      if (!snap.empty) {
        S.lecturas = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        console.log('[Lecturas] Cargadas desde Firestore:', S.lecturas.length);
        return S.lecturas;
      }
      // Firestore vacío: sembrar datos demo
      for (const lec of LECTURAS_DEMO) {
        const { id, ...datos } = lec;
        await db.collection('lecturas').add(datos);
      }
      console.log('[Lecturas] Sembradas en Firestore ✓');
      // Releer para obtener los IDs reales de Firestore
      const snap2 = await db.collection('lecturas').orderBy('fecha', 'desc').get();
      S.lecturas = snap2.docs.map(d => ({ id: d.id, ...d.data() }));
      return S.lecturas;
    } catch (e) {
      console.warn('[Lecturas] Error Firestore, usando demo:', e.message);
    }
  }
  S.lecturas = [...LECTURAS_DEMO];
  return S.lecturas;
}

/** Guarda una nueva lectura en Firestore */
async function guardarLectura(lectura) {
  const datos = {
    casa:    lectura.casa,
    fecha:   lectura.fecha,
    kwh:     parseFloat(lectura.kwh),
    watt:    lectura.watt || 0,
    voltage: lectura.voltage || 0,
    fuente:  lectura.fuente || 'manual',
    nota:    lectura.nota || '',
    ts:      new Date().toISOString(),
  };

  const db = getDB();
  if (db) {
    try {
      const ref = await db.collection('lecturas').add(datos);
      datos.id = ref.id;
      console.log('[Lecturas] Guardada en Firestore:', datos.id);
    } catch (e) {
      console.warn('[Lecturas] Error guardando:', e.message);
      datos.id = 'local_' + Date.now();
    }
  } else {
    datos.id = 'demo_' + Date.now();
  }

  S.lecturas.unshift(datos);
  return datos;
}

/** Elimina una lectura por ID */
async function eliminarLectura(lecturaId) {
  const db = getDB();
  if (db && !lecturaId.startsWith('demo_') && !lecturaId.startsWith('local_')) {
    try {
      await db.collection('lecturas').doc(lecturaId).delete();
      console.log('[Lecturas] Eliminada de Firestore:', lecturaId);
    } catch (e) {
      console.warn('[Lecturas] Error eliminando:', e.message);
    }
  }
  S.lecturas = S.lecturas.filter(l => l.id !== lecturaId);
}
