// =====================================================
// LuzJusta — Renderizadores de UI
// =====================================================
// Todas las funciones de este archivo:
//   - Leen SOLO del estado global S
//   - Escriben SOLO en el DOM
//   - NUNCA acceden a Firestore ni a Tuya
// =====================================================

// -----------------------------------------------------
// DASHBOARD (admin)
// -----------------------------------------------------

/** Renderiza las 4 stat cards superiores del dashboard */
function renderResumen() {
  const consumoTotal = getConsumoTotal();
  const potencia = getPotenciaTotal();
  const ultimaFactura = S.facturas[0] || null;

  document.getElementById('stat-consumo').textContent = Math.round(consumoTotal) + ' kWh';
  document.getElementById('stat-potencia').textContent = potencia.toLocaleString('es-AR') + ' W';

  // Mostrar desde qué fecha se cuenta el consumo actual
  if (ultimaFactura && ultimaFactura.hasta) {
    document.getElementById('stat-consumo-sub').textContent = 'Desde ' + formatFecha(ultimaFactura.hasta);
  } else {
    document.getElementById('stat-consumo-sub').textContent = 'Sin factura previa';
  }

  if (ultimaFactura) {
    document.getElementById('stat-factura').textContent = formatPesos(ultimaFactura.total);
    document.getElementById('stat-factura-sub').textContent = 'Período ' + (ultimaFactura.periodo || formatFecha(ultimaFactura.desde) + ' → ' + formatFecha(ultimaFactura.hasta));
  }
}

/** Renderiza las 4 meter cards del dashboard */
function renderMeterCards() {
  const contenedor = document.getElementById('meters-grid');
  if (!contenedor) return;

  contenedor.innerHTML = S.casas.map(casa => {
    const medidor = S.medidores[casa.id] || {};
    const consumo = getConsumoPeriodo(casa.id);
    const costo = calcularCosto(consumo, S.configuracion.tarifa);
    const online = medidor.online !== false;

    return `
      <div class="meter-card mc-${casa.id}">
        <div class="meter-top">
          <span class="meter-name">${casa.nombre}</span>
          <span class="badge ${online ? 'badge-online' : 'badge-offline'}">${online ? 'EN LÍNEA' : 'OFFLINE'}</span>
        </div>
        <div class="meter-kwh">${Math.round(consumo)}</div>
        <div class="meter-unit">kWh este período</div>
        <div class="meter-stats">
          <div class="meter-stat"><div class="ms-label">Ahora</div><div class="ms-value">${online ? medidor.watt + ' W' : '— W'}</div></div>
          <div class="meter-stat"><div class="ms-label">Voltaje</div><div class="ms-value">${online ? medidor.voltage + ' V' : '— V'}</div></div>
          <div class="meter-stat"><div class="ms-label">Corriente</div><div class="ms-value">${online ? medidor.corriente + ' A' : '— A'}</div></div>
          <div class="meter-stat"><div class="ms-label">Total med.</div><div class="ms-value">${formatKwh(medidor.kwhTotal)}</div></div>
        </div>
        <div class="meter-cost">${formatPesos(costo)} estimado</div>
        <div class="meter-date">Última sync: ${medidor.ultimaSync || '—'}</div>
        <div class="meter-actions">
          <button class="btn btn-secondary btn-xs" onclick="irAPagina('historial', null, '${casa.id}')">Ver historial</button>
        </div>
      </div>`;
  }).join('');
}

// -----------------------------------------------------
// PÁGINA MEDIDORES (admin)
// -----------------------------------------------------

/** Renderiza la tabla de estado de medidores y las alertas */
function renderPaginaMedidores() {
  const tbody = document.getElementById('medidores-tbody');
  if (!tbody) return;

  tbody.innerHTML = S.casas.map(casa => {
    const m = S.medidores[casa.id] || {};
    const online = m.online !== false;
    return `<tr>
      <td><span class="pill pill-${casa.id}">${casa.nombre}</span></td>
      <td><span class="badge ${online ? 'badge-online' : 'badge-offline'}">${online ? 'Online' : 'Offline'}</span></td>
      <td class="kwh-val">${formatKwh(m.kwhTotal)}</td>
      <td>${online ? m.watt + ' W' : '—'}</td>
      <td>${online ? m.voltage + ' V' : '—'}</td>
      <td>${online ? m.corriente + ' A' : '—'}</td>
      <td style="font-size:11px;color:${online ? 'var(--text2)' : 'var(--danger)'}">${m.ultimaSync || '—'}</td>
    </tr>`;
  }).join('');

  // Resumen superior
  const estado = getMedidoresOnline();
  document.getElementById('med-online').textContent = estado.online + '/' + estado.total;
  document.getElementById('med-watts').textContent = getPotenciaTotal().toLocaleString('es-AR');
  document.getElementById('med-kwh').textContent = Math.round(getConsumoTotal());

  // Alerta de medidores offline
  const offline = S.casas.filter(c => S.medidores[c.id] && !S.medidores[c.id].online);
  const alerta = document.getElementById('med-alerta');
  if (offline.length) {
    alerta.textContent = '⚠ ' + offline.map(c => c.nombre).join(', ') + ' sin conexión — Verificar WiFi o reiniciar medidor';
    alerta.classList.remove('hidden');
  } else {
    alerta.classList.add('hidden');
  }
}

// -----------------------------------------------------
// HISTORIAL (admin)
// -----------------------------------------------------

/** Renderiza la tabla de historial con filtro por casa */
function renderHistorial() {
  const tbody = document.getElementById('history-tbody');
  if (!tbody) return;

  const filtro = document.getElementById('filter-house').value;
  let lista = filtro ? S.lecturas.filter(l => l.casa === filtro) : [...S.lecturas];
  lista.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

  if (!lista.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="empty-row">Sin lecturas registradas</td></tr>';
    return;
  }

  tbody.innerHTML = lista.map(lectura => {
    const casa = getCasa(lectura.casa);
    // Buscar la lectura anterior de la misma casa para calcular consumo
    const anteriores = getLecturasDeCasa(lectura.casa);
    const indice = anteriores.findIndex(l => l.id === lectura.id);
    const anterior = anteriores[indice + 1];
    const consumo = anterior ? Math.round(lectura.kwh - anterior.kwh) : null;

    return `<tr>
      <td><span class="pill pill-${lectura.casa}">${casa ? casa.nombre : lectura.casa}</span></td>
      <td style="font-size:12px;color:var(--text2)">${formatFecha(lectura.fecha)}</td>
      <td class="kwh-val">${formatKwh(lectura.kwh)}</td>
      <td>${consumo !== null ? `<span style="color:var(--accent)">${consumo} kWh</span>` : '—'}</td>
      <td style="font-family:var(--mono);font-size:12px">${lectura.watt ? lectura.watt + ' W' : '—'}</td>
      <td><span style="color:var(--accent);font-size:11px">${lectura.fuente === 'wifi_auto' ? 'WiFi auto' : 'Manual'}</span></td>
    </tr>`;
  }).join('');
}

// -----------------------------------------------------
// FACTURAS (admin)
// -----------------------------------------------------

/** Renderiza el listado de facturas históricas */
function renderFacturas() {
  const contenedor = document.getElementById('facturas-list');
  if (!contenedor) return;

  if (!S.facturas.length) {
    contenedor.innerHTML = '<div style="color:var(--text3);font-size:13px;text-align:center;padding:16px">Sin facturas registradas</div>';
    return;
  }

  contenedor.innerHTML = S.facturas.map(factura => {
    const detalles = S.casas.map(casa => {
      const datos = factura.casas[casa.id];
      if (!datos) return '';
      return `${casa.nombre.replace('Casa ', '')}: <span style="color:${casa.color}">${formatPesos(datos.monto)}</span>`;
    }).filter(Boolean).join(' · ');

    return `
      <div class="factura-row">
        <div>
          <div style="font-size:13px;color:var(--text2);margin-bottom:3px">Período ${factura.periodo} · ${formatFecha(factura.desde)} → ${formatFecha(factura.hasta)}</div>
          <div style="font-size:11px;color:var(--text3)">${detalles}</div>
        </div>
        <div style="text-align:right">
          <div style="font-family:var(--mono);font-size:18px;font-weight:700;color:var(--warn)">${formatPesos(factura.total)}</div>
          <div style="font-size:11px;color:var(--text3)">Total factura</div>
        </div>
      </div>`;
  }).join('');
}

// -----------------------------------------------------
// PLANILLA (admin)
// -----------------------------------------------------

/** Genera y renderiza la planilla desde los datos de la factura cargada */
function renderPlanilla(totalFactura, desde, hasta) {
  // Consumos del período actual de cada casa (desde el estado)
  const consumos = {};
  S.casas.forEach(casa => {
    consumos[casa.id] = Math.round(getConsumoPeriodo(casa.id));
  });

  const distribucion = distribuirFactura(totalFactura, consumos);

  document.getElementById('plan-total-disp').textContent = formatPesos(totalFactura);
  document.getElementById('plan-periodo-disp').textContent =
    'Período: ' + formatFechaLarga(desde) + ' al ' + formatFechaLarga(hasta);
  document.getElementById('planilla-fecha-gen').textContent =
    'Generado el ' + formatFechaLarga(hoyIso()) + ' · LuzJusta';

  const tbody = document.getElementById('planilla-tbody');
  let totalKwh = 0;
  let totalMonto = 0;

  tbody.innerHTML = S.casas.map(casa => {
    const fila = distribucion[casa.id];
    if (!fila) return '';
    totalKwh += fila.kwh;
    totalMonto += fila.monto;
    return `<tr>
      <td><span class="pill pill-${casa.id}">${casa.nombre}</span></td>
      <td>
        <span class="kwh-val">${fila.kwh} kWh</span>
        <div class="pct-bar"><div class="pct-fill fill-${casa.id}" style="width:${fila.pct.toFixed(1)}%"></div></div>
      </td>
      <td style="color:var(--text2)">${fila.pct.toFixed(1)}%</td>
      <td class="pesos-val">${formatPesos(fila.monto)}</td>
    </tr>`;
  }).join('');

  // Fila total
  tbody.innerHTML += `<tr style="border-top:2px solid var(--border2)">
    <td style="font-weight:600">TOTAL</td>
    <td class="kwh-val" style="font-weight:600">${totalKwh} kWh</td>
    <td style="color:var(--text2);font-weight:600">100%</td>
    <td class="pesos-val" style="font-weight:600">${formatPesos(totalMonto)}</td>
  </tr>`;

  document.getElementById('planilla-result').classList.remove('hidden');

  // Guardar referencia para el botón guardar
  window._planillaActual = { desde, hasta, total: totalFactura, casas: distribucion, total_kwh: totalKwh };
}

// -----------------------------------------------------
// VISTA INQUILINO
// -----------------------------------------------------

/** Renderiza la vista completa del inquilino para su casa */
function renderVistaInquilino(casaId) {
  const casa = getCasa(casaId);
  const medidor = S.medidores[casaId] || {};
  const lecturas = getLecturasDeCasa(casaId);
  const consumo = getConsumoPeriodo(casaId);
  const costo = calcularCosto(consumo, S.configuracion.tarifa);

  // Encabezado y hero
  document.getElementById('tenant-house-name').textContent = casa ? casa.nombre : casaId;
  document.getElementById('t-kwh').textContent = Math.round(consumo);
  document.getElementById('t-cost').textContent = formatPesos(costo);
  document.getElementById('t-watt').textContent = medidor.online ? medidor.watt + ' W' : '— W';
  document.getElementById('t-voltage').textContent = medidor.online ? medidor.voltage + ' V' : '— V';

  // Última lectura
  const ultima = lecturas[0];
  const anterior = lecturas[1];
  document.getElementById('t-curr').textContent = ultima ? formatKwh(ultima.kwh) + ' kWh' : '—';
  document.getElementById('t-prev').textContent = anterior ? formatKwh(anterior.kwh) + ' kWh' : '—';
  document.getElementById('t-fecha').textContent = ultima ? formatFechaLarga(ultima.fecha) : '—';

  // Cobros históricos (su parte de cada factura)
  const cobros = S.facturas
    .filter(f => f.casas && f.casas[casaId])
    .map(factura => {
      const parte = factura.casas[casaId];
      return `
        <div class="cobro-row">
          <div class="cobro-period">Período ${factura.periodo} · ${formatFecha(factura.desde)} → ${formatFecha(factura.hasta)}</div>
          <div class="cobro-detail">${parte.kwh} kWh · ${parte.pct.toFixed(1)}% del total de la propiedad</div>
          <div class="cobro-monto">${formatPesos(parte.monto)}</div>
          <div class="pct-bar" style="margin-top:8px"><div class="pct-fill fill-${casaId}" style="width:${parte.pct.toFixed(1)}%"></div></div>
        </div>`;
    }).join('');
  document.getElementById('t-cobros').innerHTML = cobros || '<div style="color:var(--text3);font-size:13px;text-align:center;padding:16px">Sin cobros registrados</div>';

  // Tabla de lecturas detalladas
  document.getElementById('t-history').innerHTML = lecturas.map((lectura, i) => {
    const previa = lecturas[i + 1];
    const consumoPeriodo = previa ? Math.round(lectura.kwh - previa.kwh) : null;
    const costoPeriodo = consumoPeriodo ? calcularCosto(consumoPeriodo, S.configuracion.tarifa) : null;
    return `<tr>
      <td style="font-size:12px;color:var(--text2)">${formatFecha(lectura.fecha)}</td>
      <td class="kwh-val">${formatKwh(lectura.kwh)}</td>
      <td>${consumoPeriodo !== null ? consumoPeriodo + ' kWh' : '—'}</td>
      <td class="pesos-val">${costoPeriodo !== null ? formatPesos(costoPeriodo) : '—'}</td>
    </tr>`;
  }).join('');

  // Gráfico de su consumo
  setTimeout(() => renderGraficoInquilino(casaId), 150);
}
