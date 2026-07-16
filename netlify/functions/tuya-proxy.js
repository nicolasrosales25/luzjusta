const https = require('https');
const crypto = require('crypto');

// =====================================================
// LuzJusta — Proxy Tuya IoT API v2.0
// Prueba múltiples endpoints para máxima compatibilidad
// =====================================================

const TUYA_HOST = 'openapi.tuyaus.com';

function sha256(str) {
  return crypto.createHash('sha256').update(str || '').digest('hex');
}

function hmacSha256(message, secret) {
  return crypto.createHmac('sha256', secret).update(message).digest('hex').toUpperCase();
}

function buildSign(clientId, secret, t, accessToken, method, path, body) {
  var contentHash = sha256(body || '');
  var stringToSign = method + '\n' + contentHash + '\n' + '\n' + path;
  var str = clientId;
  if (accessToken) str += accessToken;
  str += t + stringToSign;
  return hmacSha256(str, secret);
}

function tuyaRequest(options) {
  return new Promise(function(resolve, reject) {
    var req = https.request(options, function(res) {
      var data = '';
      res.on('data', function(chunk) { data += chunk; });
      res.on('end', function() {
        try { resolve(JSON.parse(data)); }
        catch(e) { reject(new Error('No JSON: ' + data.substring(0, 200))); }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function getToken(clientId, clientSecret) {
  var t = Date.now().toString();
  var path = '/v1.0/token?grant_type=1';
  var sign = buildSign(clientId, clientSecret, t, '', 'GET', path, '');

  var result = await tuyaRequest({
    hostname: TUYA_HOST, path: path, method: 'GET',
    headers: { 'client_id': clientId, 't': t, 'sign': sign, 'sign_method': 'HMAC-SHA256' },
  });

  if (!result.success) throw new Error('Auth: ' + (result.msg || JSON.stringify(result)));
  return result.result.access_token;
}

/** Intenta leer el estado del dispositivo con múltiples endpoints */
async function getDeviceStatus(clientId, clientSecret, token, deviceId) {
  // Endpoints a probar en orden
  var endpoints = [
    '/v1.0/iot-03/devices/' + deviceId + '/status',
    '/v1.0/devices/' + deviceId + '/status',
    '/v2.0/cloud/thing/' + deviceId + '/shadow/properties',
  ];

  var lastError = null;

  for (var i = 0; i < endpoints.length; i++) {
    var path = endpoints[i];
    var t = Date.now().toString();
    var sign = buildSign(clientId, clientSecret, t, token, 'GET', path, '');

    try {
      var result = await tuyaRequest({
        hostname: TUYA_HOST, path: path, method: 'GET',
        headers: {
          'client_id': clientId, 'access_token': token,
          't': t, 'sign': sign, 'sign_method': 'HMAC-SHA256',
        },
      });

      if (result.success && result.result) {
        return { success: true, result: result.result, endpoint: path };
      }

      lastError = result.msg || 'sin datos';
    } catch(e) {
      lastError = e.message;
    }
  }

  // Ningún endpoint funcionó — intentar obtener info del dispositivo para debug
  var debugPath = '/v1.0/devices/' + deviceId;
  var debugT = Date.now().toString();
  var debugSign = buildSign(clientId, clientSecret, debugT, token, 'GET', debugPath, '');
  var debugInfo = null;

  try {
    debugInfo = await tuyaRequest({
      hostname: TUYA_HOST, path: debugPath, method: 'GET',
      headers: {
        'client_id': clientId, 'access_token': token,
        't': debugT, 'sign': debugSign, 'sign_method': 'HMAC-SHA256',
      },
    });
  } catch(e) {}

  return { success: false, msg: lastError, debug: debugInfo };
}

/** Parsea los data points del medidor */
function parseDPs(result, endpoint) {
  var dps = {};

  // El formato varía según el endpoint
  if (Array.isArray(result)) {
    // v1.0 status retorna array de {code, value}
    result.forEach(function(dp) { dps[dp.code] = dp.value; });
  } else if (result.properties) {
    // v2.0 shadow retorna {properties: [{code, value}]}
    result.properties.forEach(function(dp) { dps[dp.code] = dp.value; });
  }

  return dps;
}

exports.handler = async function(event) {
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
    var body = JSON.parse(event.body);
    var clientId = body.clientId;
    var clientSecret = body.clientSecret;
    var deviceIds = body.deviceIds;

    if (!clientId || !clientSecret || !deviceIds || !deviceIds.length) {
      return { statusCode: 400, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Faltan parámetros' }) };
    }

    var token = await getToken(clientId, clientSecret);
    var resultados = {};

    for (var i = 0; i < deviceIds.length; i++) {
      var item = deviceIds[i];
      try {
        var estado = await getDeviceStatus(clientId, clientSecret, token, item.deviceId);

        if (estado.success) {
          var dps = parseDPs(estado.result, estado.endpoint);

          resultados[item.casaId] = {
            online: true,
            kwhTotal: (dps['add_ele'] || dps['cur_electricity'] || dps['total_forward_energy'] || 0) / 100,
            watt: (dps['cur_power'] || dps['phase_a'] && JSON.parse(dps['phase_a']).power || 0) / 10,
            voltage: (dps['cur_voltage'] || 0) / 10,
            corriente: (dps['cur_current'] || 0) / 1000,
            ultimaSync: new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Argentina/Buenos_Aires' }),
            endpoint: estado.endpoint,
            raw: dps,
          };
        } else {
          resultados[item.casaId] = {
            online: false, kwhTotal: 0, watt: 0, voltage: 0, corriente: 0,
            ultimaSync: 'Error: ' + (estado.msg || 'sin datos'),
            debug: estado.debug,
          };
        }
      } catch(devErr) {
        resultados[item.casaId] = {
          online: false, kwhTotal: 0, watt: 0, voltage: 0, corriente: 0,
          ultimaSync: 'Error: ' + devErr.message.substring(0, 50),
        };
      }
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ success: true, medidores: resultados }),
    };

  } catch(error) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: error.message }),
    };
  }
};
