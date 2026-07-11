// =====================================================
// LuzJusta — Router de navegación
// =====================================================
// Controla qué pantalla se muestra:
//   - login / admin / tenant (shells)
//   - páginas internas del admin (dashboard, medidores, etc.)
//   - tabs de configuración
// NO accede a Firestore. NO modifica el estado de negocio.
// =====================================================

/** Muestra uno de los tres shells principales y oculta los demás */
function mostrarShell(shell) {
  document.getElementById('login-screen').classList.toggle('hidden', shell !== 'login');
  document.getElementById('app-shell').classList.toggle('hidden', shell !== 'admin');
  document.getElementById('tenant-shell').classList.toggle('hidden', shell !== 'tenant');
}

/** Navega a una página interna del panel admin.
 *  paginaId: 'dashboard' | 'medidores' | 'historial' | 'facturas' | 'planilla' | 'config'
 *  elemento: el item del sidebar que se clickeó (para marcarlo activo)
 *  filtroCasa: opcional, para pre-filtrar el historial */
function irAPagina(paginaId, elemento, filtroCasa) {
  // Ocultar todas las páginas y desmarcar sidebar
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.sidebar-item').forEach(i => i.classList.remove('active'));

  // Mostrar la página pedida
  const pagina = document.getElementById('page-' + paginaId);
  if (pagina) pagina.classList.add('active');

  // Marcar el item del sidebar
  if (elemento) {
    elemento.classList.add('active');
  } else {
    // Si no vino el elemento (navegación programática), buscarlo por atributo
    const item = document.querySelector(`.sidebar-item[data-page="${paginaId}"]`);
    if (item) item.classList.add('active');
  }

  // Pre-filtrar historial si corresponde
  if (paginaId === 'historial' && filtroCasa) {
    const filtro = document.getElementById('filter-house');
    if (filtro) {
      filtro.value = filtroCasa;
      renderHistorial();
    }
  }

  // Los gráficos necesitan que el canvas esté visible para dibujarse
  if (paginaId === 'dashboard') {
    setTimeout(inicializarGraficosDashboard, 100);
  }
}

/** Cambia de tab dentro de la página de configuración */
function irATab(tabId, elemento) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  elemento.classList.add('active');
  const contenido = document.getElementById('tab-' + tabId);
  if (contenido) contenido.classList.add('active');
}
