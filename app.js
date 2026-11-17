const $ = (id) => document.getElementById(id);

// Determina la base URL de la API:
// 1. Si el usuario ingresa una en el input "api_url" o si está en localStorage.
// 2. Si no, usa el origen actual si no es github.io.
const savedApiUrl = localStorage.getItem('API_URL') || '';
if ($('api_url')) {
  $('api_url').value = savedApiUrl;
  $('api_url').addEventListener('change', () => {
    localStorage.setItem('API_URL', $('api_url').value.trim());
    load(1);
  });
}

function getBaseUrl() {
  const custom = $('api_url') ? $('api_url').value.trim().replace(/\/+$/, '') : '';
  if (custom) return custom;
  if (window.location.hostname.includes('github.io')) {
    return '';
  }
  return '';
}

function getApiEndpoint(path = '') {
  const base = getBaseUrl();
  return `${base}/api/Productos${path}`;
}

const state = { page: 1, totalPages: 1, editingId: null };

// Un solo punto de acceso a la API: añade el token y normaliza errores.
async function request(path = '', options = {}) {
  const endpoint = getApiEndpoint(path);
  if (window.location.hostname.includes('github.io') && !getBaseUrl()) {
    throw new Error('Por favor ingresa la URL de tu API de Render arriba para conectar GitHub Pages.');
  }

  const res = await fetch(endpoint, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${$('token').value.trim()}`,
      ...(options.headers || {}),
    },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${res.status}: ${json.error || 'Error en la petición'}`);
  return json;
}

function show(text, type = 'ok') {
  const msg = $('msg');
  msg.textContent = text;
  msg.className = type;
}

function formData() {
  return {
    id_producto: $('id_producto').value.trim(),
    id_categoria: $('id_categoria').value.trim(),
    pro_descripcion: $('pro_descripcion').value.trim(),
    pro_precio_venta: Number($('pro_precio_venta').value),
  };
}

function renderRows(items) {
  const tbody = $('rows');
  tbody.replaceChildren();
  if (!items.length) {
    const tr = tbody.insertRow();
    const td = tr.insertCell();
    td.colSpan = 5;
    td.textContent = 'Sin resultados';
    return;
  }
  for (const p of items) {
    const tr = tbody.insertRow();
    tr.insertCell().textContent = p.id_producto;
    tr.insertCell().textContent = p.id_categoria;
    tr.insertCell().textContent = p.pro_descripcion;
    const price = tr.insertCell();
    price.className = 'price';
    price.textContent = Number(p.pro_precio_venta).toFixed(2);

    const actions = tr.insertCell();
    const wrap = document.createElement('div');
    wrap.className = 'row-actions';
    const edit = document.createElement('button');
    edit.textContent = 'Editar';
    edit.className = 'secondary';
    edit.onclick = () => startEdit(p);
    const del = document.createElement('button');
    del.textContent = 'Eliminar';
    del.className = 'danger';
    del.onclick = () => remove(p.id_producto);
    wrap.append(edit, del);
    actions.append(wrap);
  }
}

// GET /api/Productos?page=&limit=
async function load(page = state.page) {
  try {
    const limit = $('limit').value;
    const { data, pagination } = await request(`?page=${page}&limit=${limit}`);
    state.page = pagination.page;
    state.totalPages = pagination.totalPages || 1;
    renderRows(data);
    $('page-info').textContent = `Página ${state.page} de ${state.totalPages} (${pagination.total} registros)`;
    $('prev').disabled = state.page <= 1;
    $('next').disabled = state.page >= state.totalPages;
  } catch (e) {
    show(e.message, 'error');
  }
}

// GET /api/Productos/:id
async function search(id) {
  try {
    const { data } = await request(`/${encodeURIComponent(id)}`);
    renderRows([data]);
    $('page-info').textContent = 'Resultado de búsqueda';
    $('prev').disabled = $('next').disabled = true;
    show('Producto encontrado');
  } catch (e) {
    renderRows([]);
    show(e.message, 'error');
  }
}

function startEdit(p) {
  state.editingId = p.id_producto;
  $('id_producto').value = p.id_producto;
  $('id_producto').disabled = true;
  $('id_categoria').value = p.id_categoria;
  $('pro_descripcion').value = p.pro_descripcion;
  $('pro_precio_venta').value = p.pro_precio_venta;
  $('form-title').textContent = `Editar ${p.id_producto}`;
  $('btn-save').textContent = 'Guardar (PUT)';
  $('btn-patch').hidden = false;
  $('btn-cancel').hidden = false;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function resetForm() {
  state.editingId = null;
  $('form').reset();
  $('id_producto').disabled = false;
  $('form-title').textContent = 'Nuevo producto';
  $('btn-save').textContent = 'Crear (POST)';
  $('btn-patch').hidden = true;
  $('btn-cancel').hidden = true;
}

// POST (crear) o PUT (actualización completa)
$('form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const body = formData();
  try {
    if (state.editingId) {
      const { id_producto, ...resto } = body;
      await request(`/${encodeURIComponent(state.editingId)}`, { method: 'PUT', body: JSON.stringify(resto) });
      show('Producto actualizado (PUT)');
    } else {
      await request('', { method: 'POST', body: JSON.stringify(body) });
      show('Producto creado (POST)');
    }
    resetForm();
    load();
  } catch (err) {
    show(err.message, 'error');
  }
});

// PATCH: envía los campos editables del formulario (el id va en la URL).
$('btn-patch').addEventListener('click', async () => {
  const { id_producto, ...campos } = formData();
  try {
    await request(`/${encodeURIComponent(state.editingId)}`, { method: 'PATCH', body: JSON.stringify(campos) });
    show('Producto actualizado parcialmente (PATCH)');
    resetForm();
    load();
  } catch (err) {
    show(err.message, 'error');
  }
});

// DELETE
async function remove(id) {
  if (!confirm(`¿Eliminar el producto ${id}?`)) return;
  try {
    await request(`/${encodeURIComponent(id)}`, { method: 'DELETE' });
    show('Producto eliminado (DELETE)');
    load();
  } catch (err) {
    show(err.message, 'error');
  }
}

$('btn-cancel').addEventListener('click', resetForm);
$('search-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const id = $('search-id').value.trim();
  id ? search(id) : load(1);
});
$('btn-all').addEventListener('click', () => { $('search-id').value = ''; load(1); });
$('prev').addEventListener('click', () => load(state.page - 1));
$('next').addEventListener('click', () => load(state.page + 1));
$('limit').addEventListener('change', () => load(1));

load(1);
