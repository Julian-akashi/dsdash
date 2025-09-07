const sel = document.getElementById('datasetSel');
const msg = document.getElementById('uploadMsg');
const indicadores = document.getElementById('indicadores');
const btnDelete = document.getElementById('btnDelete');

let chartNulls = null;
let chartSeries = null;
let loading = false;        // evita solapes
let lastLoadToken = 0;      // evita carreras entre respuestas
let polling = null;

async function getJSON(url, signal) {
  const r = await fetch(url, { signal });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

async function refreshDatasets(preserveSelected = true) {
  try {
    const data = await getJSON('/api/datasets', new AbortController().signal);
    const prev = preserveSelected ? sel.value : null;

    sel.innerHTML = data.map(d =>
      `<option value="${d.id}">${d.id} - ${d.name} (${d.rows} filas)</option>`
    ).join('');

    if (!data.length) {
      indicadores.textContent = '';
      if (chartNulls) { chartNulls.destroy(); chartNulls = null; }
      if (chartSeries) { chartSeries.destroy(); chartSeries = null; }
      document.getElementById('cats').innerHTML = '';
      return;
    }

    if (prev && data.some(d => String(d.id) === String(prev))) {
      sel.value = prev;
    } else {
      sel.value = data[0].id;
    }
    await loadDashboard(sel.value);
  } catch (err) {
    console.error(err);
    msg.textContent = 'Error al listar datasets: ' + err.message;
  }
}

async function loadDashboard(id) {
  if (!id) return;
  if (loading) return;      // no solapar
  loading = true;
  const myToken = ++lastLoadToken;

  const ac = new AbortController();
  const signal = ac.signal;

  try {
    // PERFIL
    const prof = await getJSON(`/api/${id}/profile`, signal);
    if (myToken !== lastLoadToken) return;

    indicadores.textContent = JSON.stringify({
      rows: prof.rows, cols: prof.cols, dtypes: prof.dtypes,
      duplicates: prof.duplicates, date_columns: prof.date_columns
    }, null, 2);

    // NULOS
    const labels = Object.keys(prof.nulls || {});
    const values = Object.values(prof.nulls || {});
    if (chartNulls) { chartNulls.destroy(); chartNulls = null; }
    const c1 = document.getElementById('chartNulls');
    if (c1) {
      chartNulls = new Chart(c1.getContext('2d'), {
        type: 'bar',
        data: { labels, datasets: [{ label: 'Nulos', data: values }] },
        options: { responsive: true, maintainAspectRatio: false }
      });
    }

    // SERIE TEMPORAL
    const series = await getJSON(`/api/${id}/timeseries`, signal);
    if (myToken !== lastLoadToken) return;
    if (chartSeries) { chartSeries.destroy(); chartSeries = null; }
    const c2 = document.getElementById('chartSeries');
    if (c2) {
      chartSeries = new Chart(c2.getContext('2d'), {
        type: 'line',
        data: { labels: series.map(s => s.date), datasets: [{ label: 'Conteo', data: series.map(s => s.count) }] },
        options: { responsive: true, maintainAspectRatio: false }
      });
    }

    // CATEGORÍAS
    const cats = await getJSON(`/api/${id}/categories`, signal);
    if (myToken !== lastLoadToken) return;
    const container = document.getElementById('cats');
    container.innerHTML = '';
    Object.entries(cats || {}).forEach(([col, map]) => {
      const wrap = document.createElement('div');
      wrap.style.margin = '16px 0';
      const h = document.createElement('h3'); h.textContent = col;
      const canvas = document.createElement('canvas');
      canvas.style.width = '100%';
      canvas.style.maxHeight = '320px';
      canvas.style.height = '320px';
      wrap.appendChild(h);
      wrap.appendChild(canvas);
      container.appendChild(wrap);

      new Chart(canvas.getContext('2d'), {
        type: 'bar',
        data: { labels: Object.keys(map), datasets: [{ label: 'Frecuencia', data: Object.values(map) }] },
        options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false }
      });
    });

  } catch (err) {
    console.error(err);
    // no destruir charts si falla, así no “desaparecen”
    msg.textContent = 'Error cargando dashboard: ' + err.message;
  } finally {
    loading = false;
  }
}

document.getElementById('uploadForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const fd = new FormData(e.target);
  msg.textContent = 'Subiendo...';
  try {
    const r = await fetch('/api/upload', { method: 'POST', body: fd });
    if (!r.ok) { msg.textContent = await r.text(); return; }
    const j = await r.json();
    msg.textContent = `OK dataset ${j.dataset_id} (${j.rows} filas)`;
    await refreshDatasets(false);
    sel.value = j.dataset_id;
    loadDashboard(j.dataset_id);
  } catch (err) {
    msg.textContent = 'Error: ' + err.message;
  }
});

sel.addEventListener('change', () => { if (sel.value) loadDashboard(sel.value); });

// Eliminar dataset
btnDelete?.addEventListener('click', async () => {
  if (!sel.value) return;
  if (!confirm(`¿Eliminar dataset ${sel.value}? Esta acción no se puede deshacer.`)) return;
  try {
    const r = await fetch(`/api/${sel.value}/delete`, { method: 'DELETE' });
    if (!r.ok) { msg.textContent = 'Error al eliminar: ' + await r.text(); return; }
    msg.textContent = `Dataset ${sel.value} eliminado`;
    await refreshDatasets(false);
  } catch (err) {
    msg.textContent = 'Error: ' + err.message;
  }
});

// Polling estable (solo si la pestaña está visible)
function startPolling() {
  if (polling) return;
  polling = setInterval(() => {
    if (document.hidden) return;
    if (sel.value) loadDashboard(sel.value);
  }, 10000); // 10 s
}
function stopPolling() {
  if (polling) { clearInterval(polling); polling = null; }
}
document.addEventListener('visibilitychange', () => {
  if (document.hidden) stopPolling(); else startPolling();
});

refreshDatasets().then(startPolling);
