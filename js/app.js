// =====================================================
// LuzJusta — Aplicación principal
// =====================================================
// Orquesta: auth → carga de datos → renderizado.
// Espera a que Firebase esté listo antes de cargar.
// =====================================================

// Control de timeout para Firebase
let firebaseListo = false;

// -----------------------------------------------------
// AUTENTICACIÓN
// -----------------------------------------------------

/** Login del administrador */
async function loginAdmin() {
  const usuario = document.getElementById('login-user').value.trim();
  const password = document.getElementById('login-pass').value.trim();

  const credencialesOk =
    usuario === S.configuracion.admin_usuario &&
    password === S.configuracion.admin_password;

  if (!credencialesOk) {
    alert('Credenciales incorrectas. Demo: admin / lasflores123');
    return;
  }

  S.usuario = usuario;
  S.rol = 'admin';
  mostrarShell('admin');
  await iniciarPanelAdmin();
}

/** Acceso directo de un inquilino (solo lectura) */
async function loginInquilino(casaId) {
  S.usuario = casaId;
  S.rol = 'tenant';
  S.casaActual = casaId;
  mostrarShell('tenant');
  renderVistaInquilino(casaId);
}

/** Cierra la sesión */
function cerrarSesion() {
  S.usuario = null;
  S.rol = null;
  S.casaActual = null;
  destruirTodosLosGraficos();
  mostrarShell('login');
}

// -----------------------------------------------------
// PANEL ADMIN
// -----------------------------------------------------

/** Inicializa todas las vistas del panel admin */
async function iniciarPanelAdmin() {
  renderResumen();
  renderMeterCards();
  renderPaginaMedidores();
  renderHistorial();
  renderFacturas();
  cargarValoresConfig();
  setTimeout(inicializarGraficosDashboard, 100);
}

/** Carga los valores actuales de S.configuracion en el formulario de config */
function cargarValoresConfig() {
  const cfg = S.configuracion;
  // Admin
  const userEl = document.getElementById('cfg-admin-user');
  if (userEl && cfg.admin_usuario) userEl.value = cfg.admin_usuario;
  const keyEl = document.getElementById('cfg-anthropic-key');
  if (keyEl && cfg.anthropic_key) keyEl.value = cfg.anthropic_key;
  // Tarifas
  if (cfg.tarifa) {
    const t = cfg.tarifa;
    const setVal = function(id, val) { const el = document.getElementById(id); if (el && val) el.value = val; };
    setVal('cfg-t1', t.tramo1_precio);
    setVal('cfg-t2', t.tramo2_precio);
    setVal('cfg-t3', t.tramo3_precio);
    setVal('cfg-fijo', t.cargo_fijo);
    setVal('cfg-alum', t.alumbrado);
    setVal('cfg-ss', t.servicios_sociales);
  }
  // Nombres de casas
  S.casas.forEach(function(casa) {
    const el = document.getElementById('cfg-nombre-' + casa.id);
    if (el) el.value = casa.nombre;
  });
}

/** Sincronización manual */
async function sincronizarAhora() {
  mostrarNotificacion('Sincronizando con los medidores...');
  await sincronizarMedidores();
  renderResumen();
  renderMeterCards();
  renderPaginaMedidores();
  mostrarNotificacion('✓ Medidores sincronizados');
}

// -----------------------------------------------------
// CARGAR FACTURA
// -----------------------------------------------------

/** Preview de la foto/PDF subida */
document.addEventListener('DOMContentLoaded', function() {
  // Listener para preview de archivo
  setTimeout(function() {
    const input = document.getElementById('factura-archivo');
    if (input) {
      input.addEventListener('change', function() {
        const file = this.files[0];
        if (!file) return;
        const preview = document.getElementById('factura-preview');
        const placeholder = document.getElementById('factura-placeholder');
        if (file.type.startsWith('image/')) {
          const reader = new FileReader();
          reader.onload = function(e) {
            preview.src = e.target.result;
            preview.classList.remove('hidden');
            placeholder.classList.add('hidden');
          };
          reader.readAsDataURL(file);
        } else {
          placeholder.innerHTML = '<span style="font-size:32px">📄</span><span style="font-size:13px;color:var(--accent)">' + file.name + '</span>';
        }
      });
    }
  }, 500);
});

/** Lee la factura con IA (Claude API).
 *  Extrae: período, consumo kWh, total a pagar.
 *  Lee la API key desde Firebase (S.configuracion.anthropic_key). */
async function leerFacturaConIA() {
  const archivo = document.getElementById('factura-archivo').files[0];
  if (!archivo) {
    mostrarNotificacion('⚠ Primero subí una foto o PDF de la factura');
    return;
  }

  // Buscar API key: primero Firebase, después localStorage como fallback
  const apiKey = S.configuracion.anthropic_key || localStorage.getItem('mf_anthropic_key') || '';
  if (!apiKey) {
    mostrarNotificacion('⚠ Falta la API key — andá a ⚙ Configuración → Admin');
    return;
  }

  // Validar tamaño del archivo (máximo 10MB para la API)
  if (archivo.size > 10 * 1024 * 1024) {
    mostrarNotificacion('⚠ El archivo es muy grande. Máximo 10MB.');
    return;
  }

  const statusEl = document.getElementById('factura-ia-status');
  statusEl.textContent = '🤖 Leyendo factura con IA...';
  statusEl.style.color = 'var(--accent)';
  statusEl.classList.remove('hidden');

  const btn = document.getElementById('btn-leer-factura');
  btn.disabled = true;

  try {
    const base64 = await archivoABase64(archivo);
    const esPDF = archivo.type === 'application/pdf';

    // Construir el bloque de contenido según el tipo
    const bloque = esPDF
      ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } }
      : { type: 'image', source: { type: 'base64', media_type: archivo.type || 'image/jpeg', data: base64 } };

    const respuesta = await fetch('/.netlify/functions/leer-factura', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        apiKey: apiKey,
        model: 'claude-sonnet-4-20250514',
        max_tokens: 800,
        system: [
          'Sos un lector experto de facturas de electricidad de cooperativas argentinas.',
          'Buscá en la factura estos datos:',
          '- LECTURA ANTERIOR: la fecha y el valor del medidor',
          '- LECTURA ACTUAL: la fecha y el valor del medidor',
          '- CONSUMO: kWh del período',
          '- TOTAL A PAGAR: el monto final (el que dice "Total a pagar $...")',
          'NO incluyas deuda de períodos anteriores, solo el total actual.',
          'Respondé SOLO con JSON válido, sin backticks, sin texto adicional:',
          '{"fecha_desde":"YYYY-MM-DD","fecha_hasta":"YYYY-MM-DD","consumo_kwh":143,"total_pagar":34772.65,"lectura_anterior":113,"lectura_actual":257}',
        ].join(' '),
        messages: [{
          role: 'user',
          content: [
            bloque,
            { type: 'text', text: 'Leé esta factura de electricidad y devolvé los datos como JSON.' }
          ]
        }]
      })
    });

    // Verificar respuesta HTTP
    if (!respuesta.ok) {
      const errorData = await respuesta.json().catch(function() { return {}; });
      const errorMsg = errorData.error?.message || respuesta.statusText;
      throw new Error('API error ' + respuesta.status + ': ' + errorMsg);
    }

    const data = await respuesta.json();
    const texto = data.content?.map(function(b) { return b.text || ''; }).join('') || '';
    const limpio = texto.replace(/```json|```/g, '').trim();

    console.log('[IA] Respuesta:', limpio);
    const parsed = JSON.parse(limpio);

    // Llenar los campos con lo que extrajo la IA
    if (parsed.fecha_desde) document.getElementById('plan-desde').value = parsed.fecha_desde;
    if (parsed.fecha_hasta) document.getElementById('plan-hasta').value = parsed.fecha_hasta;
    if (parsed.consumo_kwh) document.getElementById('plan-kwh').value = parsed.consumo_kwh;
    if (parsed.total_pagar) document.getElementById('plan-total').value = Math.round(parsed.total_pagar);

    statusEl.textContent = '✓ Factura leída — verificá los datos antes de generar la planilla';
    statusEl.style.color = 'var(--accent)';

  } catch (error) {
    console.error('[IA] Error:', error);

    // Mensajes de error específicos
    let mensajeError = 'No se pudo leer la factura automáticamente.';
    if (error.message.includes('401')) {
      mensajeError = 'API key inválida o expirada. Revisá en ⚙ Configuración → Admin.';
    } else if (error.message.includes('429')) {
      mensajeError = 'Demasiadas solicitudes. Esperá un minuto y volvé a intentar.';
    } else if (error.message.includes('overloaded') || error.message.includes('529')) {
      mensajeError = 'El servidor de IA está sobrecargado. Intentá de nuevo en unos minutos.';
    } else if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
      mensajeError = 'Error de conexión. Verificá tu red o que el sitio esté en Netlify.';
    } else if (error.message.includes('404')) {
      mensajeError = 'Función de lectura no encontrada. Reasubí la carpeta a Netlify.';
    }

    statusEl.innerHTML = '✗ ' + mensajeError + '<br><span style="font-size:11px;color:var(--text3)">Podés ingresar los datos manualmente en los campos de abajo.</span>';
    statusEl.style.color = 'var(--warn)';
  } finally {
    btn.disabled = false;
  }
}

/** Convierte un archivo a base64 */
function archivoABase64(archivo) {
  return new Promise(function(resolve, reject) {
    const reader = new FileReader();
    reader.onload = function() { resolve(reader.result.split(',')[1]); };
    reader.onerror = reject;
    reader.readAsDataURL(archivo);
  });
}

/** Genera la planilla desde los campos de la factura */
function generarPlanillaDesdeFactura() {
  const desde = document.getElementById('plan-desde').value;
  const hasta = document.getElementById('plan-hasta').value;
  const total = parseFloat(document.getElementById('plan-total').value);

  if (!desde || !hasta) {
    mostrarNotificacion('⚠ Completá las fechas del período');
    return;
  }
  if (!total || total <= 0) {
    mostrarNotificacion('⚠ Ingresá el total a pagar de la factura');
    return;
  }

  renderPlanilla(total, desde, hasta);
  mostrarNotificacion('✓ Planilla generada');
}

/** Limpia el formulario de carga de factura */
function limpiarFactura() {
  document.getElementById('factura-archivo').value = '';
  document.getElementById('factura-preview').classList.add('hidden');
  document.getElementById('factura-placeholder').innerHTML =
    '<span style="font-size:32px">📷</span>' +
    '<span style="font-size:13px;color:var(--text2)">Tocá para sacar foto o subir archivo</span>' +
    '<span style="font-size:11px;color:var(--text3)">JPG, PNG o PDF</span>';
  document.getElementById('plan-desde').value = '';
  document.getElementById('plan-hasta').value = '';
  document.getElementById('plan-kwh').value = '';
  document.getElementById('plan-total').value = '';
  document.getElementById('planilla-result').classList.add('hidden');
  document.getElementById('factura-ia-status').classList.add('hidden');
}

/** Imprime la planilla actual */
function imprimirPlanilla() {
  window.print();
}

/** Copia la planilla como texto */
function copiarPlanilla() {
  const texto = document.getElementById('planilla-imprimible').innerText;
  if (navigator.clipboard) {
    navigator.clipboard.writeText(texto);
  }
  mostrarNotificacion('📋 Planilla copiada al portapapeles');
}

/** Comparte la planilla por WhatsApp */
function compartirPlanilla() {
  const texto = document.getElementById('planilla-imprimible').innerText;
  if (navigator.share) {
    navigator.share({ title: 'LuzJusta — Planilla de consumo', text: texto });
  } else {
    // Abrir WhatsApp web con el texto
    const encoded = encodeURIComponent(texto);
    window.open('https://wa.me/?text=' + encoded, '_blank');
  }
}

/** Guarda la factura actual en Firestore */
async function guardarFacturaActual() {
  if (!window._planillaActual) {
    mostrarNotificacion('⚠ Primero generá la planilla');
    return;
  }

  await guardarFactura(window._planillaActual);
  await cargarFacturas();
  renderFacturas();
  renderResumen();
  mostrarNotificacion('💾 Factura guardada correctamente');
  window._planillaActual = null;
}

// -----------------------------------------------------
// ACCIONES DE CONFIGURACIÓN
// -----------------------------------------------------

async function guardarConfigCasas() {
  const campos = document.querySelectorAll('[id^="cfg-nombre-"]');
  for (const campo of campos) {
    const casaId = campo.id.replace('cfg-nombre-', '');
    await actualizarNombreCasa(casaId, campo.value);
  }
  renderResumen();
  renderMeterCards();
  mostrarNotificacion('✓ Nombres guardados');
}

function guardarConfigTuya()    { mostrarNotificacion('✓ Configuración Tuya guardada'); }

async function guardarConfigTarifas() {
  const tarifa = {
    tramo1_hasta:       150,
    tramo1_precio:      parseInt(document.getElementById('cfg-t1').value),
    tramo2_hasta:       300,
    tramo2_precio:      parseInt(document.getElementById('cfg-t2').value),
    tramo3_precio:      parseInt(document.getElementById('cfg-t3').value),
    cargo_fijo:         parseInt(document.getElementById('cfg-fijo').value),
    alumbrado:          parseInt(document.getElementById('cfg-alum').value),
    servicios_sociales: parseInt(document.getElementById('cfg-ss').value),
    impuestos_factor:   1.365,
  };
  await guardarConfiguracion({ ...S.configuracion, tarifa });
  mostrarNotificacion('✓ Tarifas actualizadas');
}

async function guardarConfigAdmin() {
  const usuario = document.getElementById('cfg-admin-user').value.trim();
  const password = document.getElementById('cfg-admin-pass').value.trim();
  const apiKey = document.getElementById('cfg-anthropic-key').value.trim();
  const cambios = {};
  if (usuario) cambios.admin_usuario = usuario;
  if (password) cambios.admin_password = password;
  if (apiKey) cambios.anthropic_key = apiKey;
  if (Object.keys(cambios).length) {
    await guardarConfiguracion({ ...S.configuracion, ...cambios });
  }
  mostrarNotificacion('✓ Configuración guardada');
}

// -----------------------------------------------------
// CARGA DE DATOS
// -----------------------------------------------------

/** Carga todos los datos del sistema en el estado global */
async function cargarTodosLosDatos() {
  console.log('[App] Cargando datos...' + (firebaseListo ? ' (Firestore)' : ' (demo)'));
  await cargarConfiguracion();
  await cargarCasas();
  await cargarLecturas();
  await cargarFacturas();
  await sincronizarMedidores();
  console.log('[App] Datos cargados ✓ | Casas:', S.casas.length, '| Lecturas:', S.lecturas.length);
}

// -----------------------------------------------------
// INICIALIZACIÓN
// -----------------------------------------------------

/** Punto de entrada principal */
async function iniciarApp() {
  // Enter en contraseña dispara login
  document.getElementById('login-pass').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') loginAdmin();
  });

  // Mostrar login mientras carga
  mostrarShell('login');

  // Esperar Firebase (máximo 4 segundos, luego usa demo)
  const esperarFirebase = new Promise(resolve => {
    document.addEventListener('firebase-listo', () => {
      firebaseListo = true;
      resolve();
    });
    setTimeout(() => {
      if (!firebaseListo) {
        console.warn('[App] Firebase no respondió en 4s, usando modo demo');
        resolve();
      }
    }, 4000);
  });

  await esperarFirebase;
  await cargarTodosLosDatos();
}

// Arrancar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', iniciarApp);
