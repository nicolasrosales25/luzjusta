const https = require('https');
const crypto = require('crypto');

// =====================================================
// LuzJusta — Proxy Tuya IoT API
// =====================================================
// Maneja autenticación HMAC-SHA256 y consulta de dispositivos.
// El frontend envía clientId, clientSecret y deviceId.
// Esta función obtiene el token y lee el estado del medidor.
// =====================================================

/** Firma HMAC-SHA256 para Tuya API */
function calcularFirma(str, secret) {
  return crypto.createHmac('sha256', secret).update(str).digest('hex').toUpperCase();
}

/** Hace una request HTTPS y devuelve el JSON */
function httpsRequest(opciones, body) {
  return new Promise(function(resolve, reject) {
    const req = https.request(opciones, function(res) {
      let datos = '';
      res.on('data', function(chunk) { datos += chunk; });
      res.on('end', function() {
        try { resolve(JSON.parse(datos)); }
        catch (e) { reject(new Error('Respuesta no es JSON: ' + datos.substring(0, 200))); }
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

/** Obtiene un token de acceso de Tuya */
async function obtenerToken(clientId, clientSecret) {
  const t = Date.now().toString();
  const strToSign = clientId + t;
  const sign = calcularFirma(strToSign, clientSecret);

  const resultado = await httpsRequest({
    hostname: 'openapi.tuyaus.com',
    path: '/v1.0/token?grant_type=1',
    method: 'GET',
    headers: {
      'client_id': clientId,
      't': t,
      'sign': sign,
      'sign_method': 'HMAC-SHA256',
    },
  });

  if (!resultado.success) {
    throw new Error('Error de autenticación Tuya: ' + (resultado.msg || JSON.stringify(resultado)));
  }

  return resultado.result.access_token;
}

/** Lee el estado de un dispositivo */
async function leerDispositivo(clientId, clientSecret, token, deviceId) {
  const t = Date.now().toString();
  const strToSign = clientId + token + t;
  const sign = calcularFirma(strToSign, clientSecret);

  const resultado = await httpsRequest({
    hostname: 'openapi.tuyaus.com',
    path: '/v1.0/devices/' + deviceId + '/status',
    method: 'GET',
    headers: {
      'client_id': clientId,
      'access_token': token,
      't': t,
      'sign': sign,
      'sign_method': 'HMAC-SHA256',
    },
  });

  return resultado;
}

exports.handler = async function(event) {
  // CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' },
      body: '',
    };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Método no permitido' }) };
  }

  try {
    const body = JSON.parse(event.body);
    const { clientId, clientSecret, deviceIds } = body;

    if (!clientId || !clientSecret || !deviceIds || !deviceIds.length) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Faltan clientId, clientSecret o deviceIds' }),
      };
    }

    // Obtener token
    const token = await obtenerToken(clientId, clientSecret);

    // Leer cada dispositivo
    const resultados = {};
    for (const item of deviceIds) {
      try {
        const estado = await leerDispositivo(clientId, clientSecret, token, item.deviceId);
        if (estado.success && estado.result) {
          // Parsear los Data Points del Peacefair PZIOT-E01
          const dps = {};
          estado.result.forEach(function(dp) { dps[dp.code] = dp.value; });

          resultados[item.casaId] = {
            online: true,
            kwhTotal: (dps['add_ele'] || dps['cur_electricity'] || 0) / 100,
            watt: (dps['cur_power'] || 0) / 10,
            voltage: (dps['cur_voltage'] || 0) / 10,
            corriente: (dps['cur_current'] || 0) / 1000,
            ultimaSync: new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }),
          };
        } else {
          resultados[item.casaId] = {
            online: false, kwhTotal: 0, watt: 0, voltage: 0, corriente: 0,
            ultimaSync: 'Error: ' + (estado.msg || 'desconocido'),
          };
        }
      } catch (deviceError) {
        resultados[item.casaId] = {
          online: false, kwhTotal: 0, watt: 0, voltage: 0, corriente: 0,
          ultimaSync: 'Error: ' + deviceError.message,
        };
      }
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ success: true, medidores: resultados }),
    };

  } catch (error) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: error.message }),
    };
  }
};
