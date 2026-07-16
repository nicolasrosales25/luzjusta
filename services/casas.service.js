// =====================================================
// LuzJusta — Service de Casas
// =====================================================

/** Casas iniciales (se crean solo la primera vez) */
const CASAS_INICIALES = [
  { id: 'nico',      nombre: 'Casa Nico',        color: '#2dd4bf', orden: 1 },
  { id: 'muluk',     nombre: 'Casa Muluk',       color: '#fb923c', orden: 2 },
  { id: 'raul_tina', nombre: 'Casa Raúl y Tina', color: '#818cf8', orden: 3 },
];

/** Carga las casas desde Firestore.
 *  Solo siembra si la colección NO existe (primera vez). */
async function cargarCasas() {
  const db = getDB();
  if (db) {
    try {
      const snap = await db.collection('casas').orderBy('orden').get();
      if (!snap.empty) {
        S.casas = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        console.log('[Casas] Cargadas desde Firestore:', S.casas.length);
        return S.casas;
      }
      // Primera vez: crear las casas iniciales
      for (const casa of CASAS_INICIALES) {
        const { id, ...datos } = casa;
        await db.collection('casas').doc(id).set(datos);
      }
      S.casas = [...CASAS_INICIALES];
      console.log('[Casas] Inicializadas en Firestore ✓');
      return S.casas;
    } catch (e) {
      console.warn('[Casas] Error:', e.message);
    }
  }
  S.casas = [...CASAS_INICIALES];
  return S.casas;
}

/** Actualiza el nombre de una casa */
async function actualizarNombreCasa(casaId, nuevoNombre) {
  const casa = getCasa(casaId);
  if (!casa) return null;
  casa.nombre = nuevoNombre;
  const db = getDB();
  if (db) {
    try { await db.collection('casas').doc(casaId).update({ nombre: nuevoNombre }); } catch (e) { console.warn(e.message); }
  }
  return casa;
}

/** Agrega una casa nueva */
async function agregarCasa(id, nombre, color) {
  const orden = S.casas.length + 1;
  const nueva = { id, nombre, color, orden };
  const db = getDB();
  if (db) {
    try { await db.collection('casas').doc(id).set({ nombre, color, orden }); } catch (e) { console.warn(e.message); }
  }
  S.casas.push(nueva);
  return nueva;
}

/** Elimina una casa */
async function eliminarCasa(casaId) {
  const db = getDB();
  if (db) {
    try { await db.collection('casas').doc(casaId).delete(); } catch (e) { console.warn(e.message); }
  }
  S.casas = S.casas.filter(c => c.id !== casaId);
}
