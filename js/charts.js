// =====================================================
// LuzJusta — Gráficos (Chart.js)
// =====================================================
// Renderiza gráficos leyendo SOLO del estado global S.
// Nunca accede a Firestore ni a servicios externos.
// =====================================================

// Registro de instancias para poder destruirlas al re-renderizar
const graficos = {};

/** Configuración compartida de colores para todos los gráficos */
const ESTILO_GRAFICOS = {
  colorTexto: '#7d8aaa',
  colorGrilla: 'rgba(42, 48, 85, 0.8)',
};

/** Destruye un gráfico si existe (evita duplicados al re-renderizar) */
function destruirGrafico(clave) {
  if (graficos[clave]) {
    graficos[clave].destroy();
    delete graficos[clave];
  }
}

/** Destruye todos los gráficos (se usa al cerrar sesión) */
function destruirTodosLosGraficos() {
  Object.keys(graficos).forEach(destruirGrafico);
}

/** Gráfico de barras: consumo diario de los últimos 30 días.
 *  ETAPA 1: usa datos simulados fijos.
 *  ETAPA 3: se calculará desde S.lecturas reales. */
function renderGraficoDiario() {
  const canvas = document.getElementById('chart-daily');
  if (!canvas || typeof Chart === 'undefined') return;
  destruirGrafico('diario');

  // Datos demo de consumo diario (kWh por día)
  const datosDemo = [18, 22, 19, 25, 21, 28, 24, 20, 23, 19, 26, 22, 18, 24, 27, 21, 19, 23, 25, 22, 28, 24, 20, 26, 21, 19, 23, 27, 25, 22];

  const etiquetas = [];
  for (let i = 29; i >= 0; i--) {
    const dia = new Date();
    dia.setDate(dia.getDate() - i);
    etiquetas.push(dia.toLocaleDateString('es-AR', { day: '2-digit', month: 'short' }));
  }

  graficos.diario = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: etiquetas,
      datasets: [{
        label: 'kWh',
        data: datosDemo,
        backgroundColor: 'rgba(0, 229, 160, 0.2)',
        borderColor: '#00e5a0',
        borderWidth: 2,
        borderRadius: 3,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: ESTILO_GRAFICOS.colorTexto, font: { size: 10 }, maxTicksLimit: 10 }, grid: { color: ESTILO_GRAFICOS.colorGrilla } },
        y: { ticks: { color: ESTILO_GRAFICOS.colorTexto, font: { size: 10 } }, grid: { color: ESTILO_GRAFICOS.colorGrilla }, beginAtZero: true },
      },
    },
  });
}

/** Gráfico donut: distribución del consumo entre casas.
 *  Lee el consumo del período de cada casa desde el estado. */
function renderGraficoDonut() {
  const canvas = document.getElementById('chart-donut');
  if (!canvas || typeof Chart === 'undefined') return;
  destruirGrafico('donut');

  const nombres = S.casas.map(c => c.nombre);
  const consumos = S.casas.map(c => Math.round(getConsumoPeriodo(c.id)));
  const colores = S.casas.map(c => c.color + 'b3'); // 70% opacidad

  graficos.donut = new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels: nombres,
      datasets: [{ data: consumos, backgroundColor: colores, borderWidth: 0, hoverOffset: 4 }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: true, position: 'right', labels: { color: ESTILO_GRAFICOS.colorTexto, font: { size: 12 }, padding: 12 } },
      },
    },
  });
}

/** Gráfico de barras del inquilino: consumo por período de SU casa. */
function renderGraficoInquilino(casaId) {
  const canvas = document.getElementById('chart-tenant');
  if (!canvas || typeof Chart === 'undefined') return;
  destruirGrafico('inquilino');

  const casa = getCasa(casaId);
  const lecturas = getLecturasDeCasa(casaId).slice().reverse(); // ascendente

  const etiquetas = [];
  const consumos = [];
  lecturas.forEach((lectura, i) => {
    const anterior = lecturas[i - 1];
    if (anterior) {
      etiquetas.push(formatFecha(lectura.fecha, { day: '2-digit', month: 'short' }));
      consumos.push(Math.round(lectura.kwh - anterior.kwh));
    }
  });

  graficos.inquilino = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: etiquetas,
      datasets: [{
        label: 'kWh',
        data: consumos,
        backgroundColor: (casa ? casa.color : '#00e5a0') + '44',
        borderColor: casa ? casa.color : '#00e5a0',
        borderWidth: 2,
        borderRadius: 4,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: ESTILO_GRAFICOS.colorTexto, font: { size: 11 } }, grid: { color: ESTILO_GRAFICOS.colorGrilla } },
        y: { ticks: { color: ESTILO_GRAFICOS.colorTexto, font: { size: 11 } }, grid: { color: ESTILO_GRAFICOS.colorGrilla }, beginAtZero: true },
      },
    },
  });
}

/** Inicializa los gráficos del dashboard (llamado por el router) */
function inicializarGraficosDashboard() {
  renderGraficoDiario();
  renderGraficoDonut();
}
