const https = require('https');
const crypto = require('crypto');

// =====================================================
// LuzJusta — Proxy Tuya IoT API v2.0
// Firma HMAC-SHA256 completa según documentación Tuya
// =====================================================

const TUYA_HOST = 'openapi.tuyaus.com';

/** SHA256 de un string */
function sha256(str) {
  return crypto.createHash('sha256').update(str || '').digest('hex');
}

/** HMAC-SHA256 */
function hmacSha256(message, secret) {
  return crypto.createHmac('sha256', secret).update(message).digest('hex').toUpperCase();
}

/** Construye la firma completa para Tuya API v2.0 */
function buildSign(clientId, secret, t, accessToken, method, path, body) {
  // SHA256 del body (vacío para GET)
  var contentHash = sha256(body || '');

  // String to sign según Tuya v2.0
  var stringToSign = method + '\n' + contentHash + '\n' + '\n' + path;

  // Concatenar: clientId + [accessToken] + t + stringToSign
  var str = clientId;
  if (accessToken) str += accessToken;
  str += t + stringToSign;

  return hmacSha256(str, secret);
}

/** Request HTTPS genérico */
function httpsRequest(options, body) {
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
    if (body) req.write(body);
    req.end();
  });
}

/** Obtener token de Tuya */
async function getToken(clientId, clientSecret) {
  var t = Date.now().toString();
  var path = '/v1.0/token?grant_type=1';
  var sign = buildSign(clientId, clientSecret, t, '', 'GET', path, '');

  var result = await httpsRequest({
    hostname: TUYA_HOST,
    path: path,
    method: 'GET',
    headers: {
      'client_id': clientId,
      't': t,
      'sign': sign,
      'sign_method': 'HMAC-SHA256',
    },
  });

  if (!result.success) {
    throw new Error('Auth Tuya: ' + (result.msg || JSON.stringify(result)));
  }

  return result.result.access_token;
}

/** Leer estado de un dispositivo */
async function getDeviceStatus(clientId, clientSecret, token, deviceId) {
  var t = Date.now().toString();
  var path = '/v1.0/devices/' + deviceId + '/status';
  var sign = buildSign(clientId, clientSecret, t, token, 'GET', path, '');

  var result = await httpsRequest({
    hostname: TUYA_HOST,
    path: path,
    method: 'GET',
    headers: {
      'client_id': clientId,
      'access_token': token,
      't': t,
      'sign': sign,
      'sign_method': 'HMAC-SHA256',
    },
  });

  return result;
}

/** Handler principal */
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
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Faltan clientId, clientSecret o deviceIds' }),
      };
    }

    // Obtener token
    var token = await getToken(clientId, clientSecret);

    // Leer cada dispositivo
    var resultados = {};
    for (var i = 0; i < deviceIds.length; i++) {
      var item = deviceIds[i];
      try {
        var estado = await getDeviceStatus(clientId, clientSecret, token, item.deviceId);
        if (estado.success && estado.result) {
          var dps = {};
          estado.result.forEach(function(dp) { dps[dp.code] = dp.value; });

          resultados[item.casaId] = {
            online: true,
            kwhTotal: (dps['add_ele'] || dps['cur_electricity'] || 0) / 100,
            watt: (dps['cur_power'] || 0) / 10,
            voltage: (dps['cur_voltage'] || 0) / 10,
            corriente: (dps['cur_current'] || 0) / 1000,
            ultimaSync: new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Argentina/Buenos_Aires' }),
            raw: dps,
          };
        } else {
          resultados[item.casaId] = {
            online: false, kwhTotal: 0, watt: 0, voltage: 0, corriente: 0,
            ultimaSync: 'Error: ' + (estado.msg || 'sin datos'),
          };
        }
      } catch(devErr) {
        resultados[item.casaId] = {
          online: false, kwhTotal: 0, watt: 0, voltage: 0, corriente: 0,
          ultimaSync: 'Error: ' + devErr.message.substring(0, 40),
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
