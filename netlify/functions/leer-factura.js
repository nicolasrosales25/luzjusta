const https = require('https');

exports.handler = async function(event) {
  // Manejar preflight CORS
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
      },
      body: '',
    };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Método no permitido' }) };
  }

  try {
    const body = JSON.parse(event.body);
    const apiKey = body.apiKey;
    const mensajes = body.messages;
    const sistema = body.system || '';

    if (!apiKey || !mensajes) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Faltan apiKey o messages' }),
      };
    }

    // Armar el body para Anthropic
    const anthropicBody = JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 800,
      system: sistema,
      messages: mensajes,
    });

    // Llamar a Anthropic API usando https nativo
    const resultado = await new Promise(function(resolve, reject) {
      const opciones = {
        hostname: 'api.anthropic.com',
        path: '/v1/messages',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'Content-Length': Buffer.byteLength(anthropicBody),
        },
      };

      const req = https.request(opciones, function(res) {
        let datos = '';
        res.on('data', function(chunk) { datos += chunk; });
        res.on('end', function() {
          resolve({ statusCode: res.statusCode, body: datos });
        });
      });

      req.on('error', function(err) { reject(err); });
      req.write(anthropicBody);
      req.end();
    });

    return {
      statusCode: resultado.statusCode,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: resultado.body,
    };

  } catch (error) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Error del servidor: ' + error.message }),
    };
  }
};
