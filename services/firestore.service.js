// =====================================================
// LuzJusta — Service de Firestore (capa de acceso)
// =====================================================
// Funciones genéricas de lectura/escritura.
// Si Firestore no está listo, los demás services
// caen automáticamente a datos demo.
// =====================================================

/** Configuración por defecto (tarifas T1R Coop. Las Flores 05/2026) */
const CONFIGURACION_DEFAULT = {
  tarifa: {
    tramo1_hasta: 150,
    tramo1_precio: 131043,
    tramo2_hasta: 300,
    tramo2_precio: 216263,
    tramo3_precio: 216263,
    cargo_fijo: 24448,
    alumbrado: 30288,
    servicios_sociales: 15900,
    impuestos_factor: 1.365,
  },
  sync_intervalo_min: 15,
  admin_usuario: 'admin',
  admin_password: 'lasflores123',
};

/** Carga la configuración general en el estado.
 *  Si no existe en Firestore, la crea con los valores default. */
async function cargarConfiguracion() {
  const db = getDB();
  if (db) {
    try {
      const doc = await db.collection('configuracion').doc('general').get();
      if (doc.exists) {
        S.configuracion = doc.data();
        console.log('[Config] Cargada desde Firestore ✓');
        return S.configuracion;
      }
      // No existe: crear con valores default
      await db.collection('configuracion').doc('general').set(CONFIGURACION_DEFAULT);
      console.log('[Config] Creada en Firestore con valores default ✓');
    } catch (e) {
      console.warn('[Config] Error Firestore, usando default:', e.message);
    }
  }
  S.configuracion = { ...CONFIGURACION_DEFAULT };
  return S.configuracion;
}

/** Guarda cambios de configuración en Firestore */
async function guardarConfiguracion(cambios) {
  S.configuracion = { ...S.configuracion, ...cambios };
  const db = getDB();
  if (db) {
    try {
      await db.collection('configuracion').doc('general').set(S.configuracion);
      console.log('[Config] Guardada en Firestore ✓');
    } catch (e) {
      console.warn('[Config] Error guardando:', e.message);
    }
  }
  return S.configuracion;
}

/** Verifica si Firestore está disponible y conectado */
function firestoreDisponible() {
  return !!getDB();
}
