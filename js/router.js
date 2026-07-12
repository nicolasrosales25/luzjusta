// =====================================================
// LuzJusta — Router de navegación
// =====================================================
// Controla shells, páginas internas y menú mobile.
// =====================================================

/** Muestra uno de los tres shells principales */
function mostrarShell(shell) {
  document.getElementById('login-screen').classList.toggle('hidden', shell !== 'login');
  document.getElementById('app-shell').classList.toggle('hidden', shell !== 'admin');
  document.getElementById('tenant-shell').classList.toggle('hidden', shell !== 'tenant');
}

/** Abre o cierra el menú lateral en mobile */
function toggleMenu() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  sidebar.classList.toggle('open');
  overlay.classList.toggle('open');
}

/** Cierra el menú lateral en mobile */
function cerrarMenu() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  if (sidebar) sidebar.classList.remove('open');
  if (overlay) overlay.classList.remove('open');
}

/** Navega a una página interna del panel admin */
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
    const item = document.querySelector(`.sidebar-item[data-page="${paginaId}"]`);
    if (item) item.classList.add('active');
  }

  // Cerrar menú mobile al navegar
  cerrarMenu();

  // Pre-filtrar historial si corresponde
  if (paginaId === 'historial' && filtroCasa) {
    const filtro = document.getElementById('filter-house');
    if (filtro) {
      filtro.value = filtroCasa;
      renderHistorial();
    }
  }

  // Los gráficos necesitan que el canvas esté visible
  if (paginaId === 'dashboard') {
    setTimeout(inicializarGraficosDashboard, 100);
  }
}

/** Cambia de tab dentro de configuración */
function irATab(tabId, elemento) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  elemento.classList.add('active');
  const contenido = document.getElementById('tab-' + tabId);
  if (contenido) contenido.classList.add('active');
}
