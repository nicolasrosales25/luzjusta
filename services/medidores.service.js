// =====================================================
// LuzJusta — Service de Medidores
// =====================================================
// Conecta con los Peacefair PZIOT-E01 via Tuya IoT API.
// Si no hay credenciales configuradas, muestra "Sin medidor".
// =====================================================

/** Sincroniza el estado real de los medidores via Tuya API */
async function sincronizarMedidores() {
  const cfg = S.configuracion;
  const clientId = cfg.tuya_client_id;
  const clientSecret = cfg.tuya_client_secret;
  const devices = cfg.tuya_devices || {};

  // Verificar que hay credenciales Tuya configuradas
  if (!clientId || !clientSecret) {
    console.log('[Medidores] Sin credenciales Tuya configuradas');
    // Mostrar todas las casas sin medidor
    S.medidores = {};
    S.casas.forEach(function(casa) {
      S.medidores[casa.id] = {
        online: false, kwhTotal: 0, watt: 0, voltage: 0, corriente: 0,
        ultimaSync: 'Sin configurar',
      };
    });
    return S.medidores;
  }

  // Armar lista de dispositivos que tienen Device ID
  const deviceIds = [];
  S.casas.forEach(function(casa) {
    if (devices[casa.id]) {
      deviceIds.push({ casaId: casa.id, deviceId: devices[casa.id] });
    }
  });

  if (!deviceIds.length) {
    console.log('[Medidores] Sin Device IDs configurados');
    S.medidores = {};
    S.casas.forEach(function(casa) {
      S.medidores[casa.id] = {
        online: false, kwhTotal: 0, watt: 0, voltage: 0, corriente: 0,
        ultimaSync: 'Sin Device ID',
      };
    });
    return S.medidores;
  }

  try {
    console.log('[Medidores] Sincronizando', deviceIds.length, 'medidores...');

    const respuesta = await fetch('/.netlify/functions/tuya-proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId, clientSecret, deviceIds }),
    });

    if (!respuesta.ok) {
      const error = await respuesta.json().catch(function() { return {}; });
      throw new Error(error.error || 'Error ' + respuesta.status);
    }

    const data = await respuesta.json();

    if (data.success && data.medidores) {
      S.medidores = {};
      S.casas.forEach(function(casa) {
        if (data.medidores[casa.id]) {
          S.medidores[casa.id] = data.medidores[casa.id];
        } else {
          S.medidores[casa.id] = {
            online: false, kwhTotal: 0, watt: 0, voltage: 0, corriente: 0,
            ultimaSync: devices[casa.id] ? 'Sin respuesta' : 'Sin medidor',
          };
        }
      });
      console.log('[Medidores] Sincronizados ✓', S.medidores);

      // Guardar lecturas automáticas en Firestore
      for (const casaId of Object.keys(data.medidores)) {
        const m = data.medidores[casaId];
        if (m.online && m.kwhTotal > 0) {
          await guardarLectura({
            casa: casaId,
            fecha: new Date().toISOString().split('T')[0],
            kwh: m.kwhTotal,
            watt: m.watt,
            voltage: m.voltage,
            fuente: 'tuya_auto',
          });
        }
      }

      return S.medidores;
    }

    throw new Error(data.error || 'Respuesta inesperada');

  } catch (error) {
    console.error('[Medidores] Error:', error.message);
    mostrarNotificacion('⚠ Error sincronizando: ' + error.message);

    S.medidores = {};
    S.casas.forEach(function(casa) {
      S.medidores[casa.id] = {
        online: false, kwhTotal: 0, watt: 0, voltage: 0, corriente: 0,
        ultimaSync: 'Error: ' + error.message.substring(0, 50),
      };
    });
    return S.medidores;
  }
}

/** Devuelve la potencia total actual */
function getPotenciaTotal() {
  return Object.values(S.medidores)
    .filter(function(m) { return m.online; })
    .reduce(function(total, m) { return total + (m.watt || 0); }, 0);
}

/** Cuenta medidores online */
function getMedidoresOnline() {
  const valores = Object.values(S.medidores);
  return {
    online: valores.filter(function(m) { return m.online; }).length,
    total: valores.length,
  };
}
