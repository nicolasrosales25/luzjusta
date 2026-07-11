// =====================================================
// LuzJusta — Service de Casas
// =====================================================
// Lee y escribe casas en Firestore.
// Si Firestore no está listo, usa datos demo.
// Las casas son documentos con ID fijo (nico, muluk, raul_tina).
// =====================================================

/** Casas iniciales (se crean en Firestore la primera vez) */
const CASAS_INICIALES = [
  { id: 'nico',      nombre: 'Casa Nico',          color: '#2dd4bf', orden: 1 },
  { id: 'muluk',     nombre: 'Casa Muluk',         color: '#fb923c', orden: 2 },
  { id: 'raul_tina', nombre: 'Casa Raúl y Tina',   color: '#818cf8', orden: 3 },
];

/** Carga las casas desde Firestore al estado global.
 *  Si la colección está vacía, la inicializa. */
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
      // Colección vacía: sembrar datos iniciales
      for (const casa of CASAS_INICIALES) {
        const { id, ...datos } = casa;
        await db.collection('casas').doc(id).set(datos);
      }
      S.casas = [...CASAS_INICIALES];
      console.log('[Casas] Sembradas en Firestore ✓');
      return S.casas;
    } catch (e) {
      console.warn('[Casas] Error Firestore, usando demo:', e.message);
    }
  }
  // Fallback demo
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
    try {
      await db.collection('casas').doc(casaId).update({ nombre: nuevoNombre });
      console.log('[Casas] Nombre actualizado:', casaId, '→', nuevoNombre);
    } catch (e) {
      console.warn('[Casas] Error actualizando nombre:', e.message);
    }
  }
  return casa;
}

/** Agrega una casa nueva (para cuando se agregue un medidor) */
async function agregarCasa(id, nombre, color) {
  const orden = S.casas.length + 1;
  const nueva = { id, nombre, color, orden };

  const db = getDB();
  if (db) {
    try {
      await db.collection('casas').doc(id).set({ nombre, color, orden });
      console.log('[Casas] Nueva casa agregada:', nombre);
    } catch (e) {
      console.warn('[Casas] Error agregando casa:', e.message);
    }
  }
  S.casas.push(nueva);
  return nueva;
}

/** Elimina una casa */
async function eliminarCasa(casaId) {
  const db = getDB();
  if (db) {
    try {
      await db.collection('casas').doc(casaId).delete();
      console.log('[Casas] Eliminada:', casaId);
    } catch (e) {
      console.warn('[Casas] Error eliminando:', e.message);
    }
  }
  S.casas = S.casas.filter(c => c.id !== casaId);
}
