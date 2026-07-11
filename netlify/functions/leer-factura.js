// =====================================================
// LuzJusta — Proxy serverless para Anthropic API
// Netlify Function que evita el problema de CORS
// =====================================================

exports.handler = async function(event) {
  // Solo aceptar POST
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Método no permitido' }) };
  }

  try {
    const body = JSON.parse(event.body);
    const apiKey = body.apiKey;
    const mensajes = body.messages;
    const sistema = body.system;

    if (!apiKey || !mensajes) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Faltan apiKey o messages' }) };
    }

    // Llamar a Anthropic API desde el servidor (sin CORS)
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 800,
        system: sistema || '',
        messages: mensajes,
      }),
    });

    const data = await response.json();

    return {
      statusCode: response.status,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify(data),
    };

  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Error del servidor: ' + error.message }),
    };
  }
};
