const sel = document.getElementById('datasetSel');
const msg = document.getElementById('uploadMsg');
const indicadores = document.getElementById('indicadores');
const btnDelete = document.getElementById('btnDelete'); // <-- nuevo
let chartNulls, chartSeries;

async function getJSON(url){
  const r = await fetch(url);
  if(!r.ok) throw new Error(await r.text());
  return r.json();
}

async function refreshDatasets(preserveSelected=true){
  const previously = preserveSelected ? sel.value : null;
  const data = await getJSON('/api/datasets');

  sel.innerHTML = data.map(d =>
    `<option value="${d.id}">${d.id} - ${d.name} (${d.rows} filas)</option>`
  ).join('');

  // si no hay datasets, limpia vistas
  if (!data.length) {
    indicadores.textContent = '';
    if (chartNulls) { chartNulls.destroy(); chartNulls = null; }
    if (chartSeries){ chartSeries.destroy(); chartSeries = null; }
    document.getElementById('cats').innerHTML = '';
    return;
  }

  // intenta mantener selección previa
  if (previously && data.some(d => String(d.id) === String(previously))) {
    sel.value = previously;
  } else {
    sel.value = data[0].id;
  }

  loadDashboard(sel.value);
}

async function loadDashboard(id){
  // perfil
  const prof = await getJSON(`/api/${id}/profile`);
  indicadores.textContent = JSON.stringify({
    rows: prof.rows, cols: prof.cols, dtypes: prof.dtypes,
    duplicates: prof.duplicates, date_columns: prof.date_columns
  }, null, 2);

  // Nulos
  const labels = Object.keys(prof.nulls || {});
  const values = Object.values(prof.nulls || {});
  if (chartNulls) chartNulls.destroy();
  chartNulls = new Chart(document.getElementById('chartNulls'), {
    type: 'bar',
    data: { labels, datasets: [{ label: 'Nulos', data: values }] },
    options: { responsive:true, maintainAspectRatio:false }
  });

  // Serie temporal
  const series = await getJSON(`/api/${id}/timeseries`);
  if (chartSeries) chartSeries.destroy();
  chartSeries = new Chart(document.getElementById('chartSeries'), {
    type: 'line',
    data: { labels: series.map(s=>s.date), datasets: [{ label:'Conteo', data: series.map(s=>s.count) }] },
    options: { responsive:true, maintainAspectRatio:false }
  });

  // Categorías
  const cats = await getJSON(`/api/${id}/categories`);
  const container = document.getElementById('cats');
  container.innerHTML = '';
  Object.entries(cats).forEach(([col, map])=>{
    const canvas = document.createElement('canvas');
    const h = document.createElement('h3');
    h.textContent = col;
    container.appendChild(h);
    container.appendChild(canvas);
    new Chart(canvas, {
      type: 'bar',
      data: { labels: Object.keys(map), datasets: [{ label:'Frecuencia', data: Object.values(map) }] },
      options: { indexAxis: 'y', responsive:true, maintainAspectRatio:false }
    });
  });
}

document.getElementById('uploadForm').addEventListener('submit', async (e)=>{
  e.preventDefault();
  const fd = new FormData(e.target);
  msg.textContent = 'Subiendo...';
  try {
    const r = await fetch('/api/upload', { method:'POST', body: fd });
    if(!r.ok){ msg.textContent = await r.text(); return; }
    const j = await r.json();
    msg.textContent = `OK dataset ${j.dataset_id} (${j.rows} filas)`;
    await refreshDatasets(false);
    sel.value = j.dataset_id;
    loadDashboard(j.dataset_id);
  } catch (err) {
    msg.textContent = 'Error: ' + err.message;
  }
});

sel.addEventListener('change', ()=> { if(sel.value) loadDashboard(sel.value); });

// NUEVO: borrar dataset seleccionado
btnDelete?.addEventListener('click', async ()=>{
  if(!sel.value) return;
  if(!confirm(`¿Eliminar dataset ${sel.value}? Esta acción no se puede deshacer.`)) return;
  try {
    const r = await fetch(`/api/${sel.value}/delete`, { method:'DELETE' });
    if(!r.ok) { msg.textContent = 'Error al eliminar: ' + await r.text(); return; }
    msg.textContent = `Dataset ${sel.value} eliminado`;
    await refreshDatasets(false);
  } catch (err) {
    msg.textContent = 'Error: ' + err.message;
  }
});

// polling simple cada 5s (si hay selección)
setInterval(()=> { if(sel.value) loadDashboard(sel.value); }, 5000);

refreshDatasets();
