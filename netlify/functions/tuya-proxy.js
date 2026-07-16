const https = require('https');
const crypto = require('crypto');

// =====================================================
// LuzJusta — Proxy Tuya IoT API
// Usa Device Logs API para leer Peacefair PZIOT-E01
// (el endpoint status no funciona con este dispositivo)
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

function tuyaGet(host, path, clientId, secret, t, token) {
  var sign = buildSign(clientId, secret, t, token, 'GET', path, '');
  var headers = {
    'client_id': clientId,
    't': t,
    'sign': sign,
    'sign_method': 'HMAC-SHA256',
  };
  if (token) headers['access_token'] = token;

  return new Promise(function(resolve, reject) {
    var req = https.request({ hostname: host, path: path, method: 'GET', headers: headers }, function(res) {
      var data = '';
      res.on('data', function(chunk) { data += chunk; });
      res.on('end', function() {
        try { resolve(JSON.parse(data)); }
        catch(e) { reject(new Error('No JSON: ' + data.substring(0, 300))); }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function getToken(clientId, clientSecret) {
  var t = Date.now().toString();
  var result = await tuyaGet(TUYA_HOST, '/v1.0/token?grant_type=1', clientId, clientSecret, t, '');
  if (!result.success) throw new Error('Auth: ' + (result.msg || JSON.stringify(result)));
  return result.result.access_token;
}

/** Lee los logs recientes del dispositivo (últimos 30 min) */
async function getDeviceLogs(clientId, clientSecret, token, deviceId) {
  var t = Date.now().toString();
  var endTime = Date.now();
  var startTime = endTime - (30 * 60 * 1000); // 30 minutos atrás
  var path = '/v1.0/devices/' + deviceId + '/logs?type=7&start_time=' + startTime + '&end_time=' + endTime + '&size=20';

  var result = await tuyaGet(TUYA_HOST, path, clientId, clientSecret, t, token);
  return result;
}

/** Parsea los logs del Peacefair a valores útiles */
function parseDeviceLogs(logsResult) {
  var datos = {
    kwhTotal: 0,
    watt: 0,
    voltage: 0,
    corriente: 0,
    frecuencia: 0,
    factorPotencia: 0,
  };

  if (!logsResult.success || !logsResult.result || !logsResult.result.logs) {
    return datos;
  }

  var logs = logsResult.result.logs;

  // Tomar el valor más reciente de cada DP
  logs.forEach(function(log) {
    var val = log.value || '';
    // Eliminar unidades del valor (ej: "0.65kWh" → 0.65)
    var num = parseFloat(val.replace(/[^0-9.\-]/g, ''));
    if (isNaN(num)) return;

    var code = (log.code || '').toLowerCase();
    if (code === 'total energy' || code === 'total_energy' || code === 'add_ele') {
      if (!datos._gotKwh) { datos.kwhTotal = num; datos._gotKwh = true; }
    } else if (code === 'active energy' || code === 'active_energy') {
      if (!datos._gotKwh) { datos.kwhTotal = num; datos._gotKwh = true; }
    } else if (code === 'power' || code === 'cur_power') {
      if (!datos._gotWatt) { datos.watt = num; datos._gotWatt = true; }
    } else if (code === 'voltage' || code === 'cur_voltage') {
      if (!datos._gotVolt) { datos.voltage = num; datos._gotVolt = true; }
    } else if (code === 'current' || code === 'cur_current') {
      if (!datos._gotAmp) { datos.corriente = num; datos._gotAmp = true; }
    } else if (code === 'frequency') {
      datos.frecuencia = num;
    } else if (code === 'power factor' || code === 'power_factor') {
      datos.factorPotencia = num;
    }
  });

  return datos;
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
        // Usar Device Logs API en vez de Status API
        var logsResult = await getDeviceLogs(clientId, clientSecret, token, item.deviceId);
        var datos = parseDeviceLogs(logsResult);

        var tieneData = datos.kwhTotal > 0 || datos.watt > 0 || datos.voltage > 0;

        resultados[item.casaId] = {
          online: tieneData,
          kwhTotal: datos.kwhTotal,
          watt: datos.watt,
          voltage: datos.voltage,
          corriente: datos.corriente,
          ultimaSync: new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Argentina/Buenos_Aires' }),
          raw: logsResult.result ? logsResult.result.logs : [],
        };
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
