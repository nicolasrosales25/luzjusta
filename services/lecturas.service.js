// =====================================================
// LuzJusta — Service de Lecturas
// =====================================================

/** Carga las lecturas desde Firestore al estado global */
async function cargarLecturas() {
  const db = getDB();
  if (db) {
    try {
      const snap = await db.collection('lecturas')
        .orderBy('fecha', 'desc')
        .limit(200)
        .get();
      S.lecturas = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      console.log('[Lecturas] Cargadas:', S.lecturas.length);
      return S.lecturas;
    } catch (e) {
      console.warn('[Lecturas] Error:', e.message);
    }
  }
  S.lecturas = [];
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
      console.log('[Lecturas] Guardada:', datos.id);
    } catch (e) {
      console.warn('[Lecturas] Error guardando:', e.message);
      datos.id = 'local_' + Date.now();
    }
  } else {
    datos.id = 'local_' + Date.now();
  }

  S.lecturas.unshift(datos);
  return datos;
}

/** Elimina una lectura por ID */
async function eliminarLectura(lecturaId) {
  const db = getDB();
  if (db) {
    try {
      await db.collection('lecturas').doc(lecturaId).delete();
    } catch (e) {
      console.warn('[Lecturas] Error eliminando:', e.message);
    }
  }
  S.lecturas = S.lecturas.filter(l => l.id !== lecturaId);
}
