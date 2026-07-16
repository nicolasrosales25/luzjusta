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

/** Lee los logs recientes del dispositivo */
async function getDeviceLogs(clientId, clientSecret, token, deviceId) {
  var t = Date.now().toString();
  var endTime = Date.now();
  var startTime = endTime - (2 * 60 * 60 * 1000); // 2 horas atrás

  // Probar type=2 (DP Report) primero, luego type=7
  var types = [2, 7];
  
  for (var ti = 0; ti < types.length; ti++) {
    var path = '/v1.0/devices/' + deviceId + '/logs?type=' + types[ti] + '&start_time=' + startTime + '&end_time=' + endTime + '&size=50';
    var t2 = Date.now().toString();
    var result = await tuyaGet(TUYA_HOST, path, clientId, clientSecret, t2, token);
    
    if (result.success && result.result && result.result.logs && result.result.logs.length > 0) {
      return result;
    }
  }

  // Si ninguno funciona, intentar el endpoint de propiedades v2
  var t3 = Date.now().toString();
  var propPath = '/v2.0/cloud/thing/' + deviceId + '/shadow/properties';
  var propResult = await tuyaGet(TUYA_HOST, propPath, clientId, clientSecret, t3, token);
  
  if (propResult.success && propResult.result) {
    // Convertir formato de propiedades a formato de logs
    return {
      success: true,
      result: { logs: (propResult.result.properties || []).map(function(p) { return { code: p.code, value: String(p.value) }; }) },
      source: 'shadow'
    };
  }

  // Último intento: status con iot-03
  var t4 = Date.now().toString();
  var statusPath = '/v1.0/iot-03/devices/' + deviceId + '/status';
  var statusResult = await tuyaGet(TUYA_HOST, statusPath, clientId, clientSecret, t4, token);

  return {
    success: false,
    result: { logs: [] },
    debug: {
      type2: 'empty',
      type7: 'empty',
      shadow: propResult,
      status: statusResult
    }
  };
}

/** Parsea los datos del Peacefair PZIOT-E01
 *  Códigos reales: voltage(÷10), current(÷100), power(÷100),
 *  energy(÷100), energy_now(÷100), factor(÷100), frequency(÷10) */
function parseDeviceLogs(logsResult) {
  var datos = {
    kwhTotal: 0,
    watt: 0,
    voltage: 0,
    corriente: 0,
  };

  if (!logsResult.success || !logsResult.result || !logsResult.result.logs) {
    return datos;
  }

  var logs = logsResult.result.logs;

  logs.forEach(function(log) {
    var code = (log.code || '').toLowerCase();
    var val = parseFloat(log.value);
    if (isNaN(val)) return;

    if (code === 'energy' || code === 'add_ele') {
      datos.kwhTotal = val / 100;
    } else if (code === 'energy_now') {
      // Energía del período actual — usar si no hay energy total
      if (!datos.kwhTotal) datos.kwhTotal = val / 100;
    } else if (code === 'power' || code === 'cur_power') {
      datos.watt = val / 100;
    } else if (code === 'voltage' || code === 'cur_voltage') {
      datos.voltage = val / 10;
    } else if (code === 'current' || code === 'cur_current') {
      datos.corriente = val / 100;
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
