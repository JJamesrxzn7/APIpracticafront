// Configuración directa y transparente para el usuario
const API_BASE_URL = 'https://apipractica-3mj4.onrender.com';
const API_TOKEN_DEFAULT = 'secreto123';

const $ = (id) => document.getElementById(id);

const state = { page: 1, totalPages: 1, editingId: null, isLoading: false };

// Muestra mensajes de estado y feedback accesible
function show(text, type = 'ok') {
  const msg = $('msg');
  msg.textContent = text;
  msg.className = type;
  if (type === 'error') {
    msg.focus();
  }
}

// Punto centralizado para peticiones a la API en Render
async function request(path = '', options = {}) {
  const url = `${API_BASE_URL}/api/Productos${path}`;
  
  try {
    const res = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${API_TOKEN_DEFAULT}`,
        ...(options.headers || {}),
      },
    });

    const json = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error(json.error || `Error ${res.status}: Fallo en la comunicación con el servidor`);
    }

    return json;
  } catch (err) {
    if (err.name === 'TypeError' && err.message.includes('fetch')) {
      throw new Error('No se pudo conectar con el servidor en Render. Comprueba tu conexión o espera a que el servicio despierte.');
    }
    throw err;
  }
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

  if (!items || !items.length) {
    const tr = tbody.insertRow();
    const td = tr.insertCell();
    td.colSpan = 5;
    td.className = 'loading-state';
    td.textContent = 'No hay productos registrados en el inventario.';
    return;
  }

  for (const p of items) {
    const tr = tbody.insertRow();

    // ID
    const tdId = tr.insertCell();
    tdId.textContent = p.id_producto;
    tdId.style.fontWeight = '600';

    // Categoria
    tr.insertCell().textContent = p.id_categoria;

    // Descripcion
    tr.insertCell().textContent = p.pro_descripcion;

    // Precio
    const tdPrice = tr.insertCell();
    tdPrice.className = 'price text-right';
    tdPrice.textContent = `$${Number(p.pro_precio_venta).toFixed(2)}`;

    // Acciones
    const tdActions = tr.insertCell();
    tdActions.className = 'text-center';

    const wrap = document.createElement('div');
    wrap.className = 'row-actions';

    const editBtn = document.createElement('button');
    editBtn.textContent = 'Editar';
    editBtn.className = 'btn btn-secondary';
    editBtn.setAttribute('aria-label', `Editar producto ${p.id_producto}`);
    editBtn.onclick = () => startEdit(p);

    const delBtn = document.createElement('button');
    delBtn.textContent = 'Eliminar';
    delBtn.className = 'btn btn-danger';
    delBtn.setAttribute('aria-label', `Eliminar producto ${p.id_producto}`);
    delBtn.onclick = () => remove(p.id_producto);

    wrap.append(editBtn, delBtn);
    tdActions.append(wrap);
  }
}

// Cargar productos con paginación
async function load(page = state.page) {
  const tbody = $('rows');
  tbody.innerHTML = `
    <tr>
      <td colspan="5" class="loading-state">
        <div class="spinner"></div> Consultando inventario...
      </td>
    </tr>
  `;

  try {
    const limit = $('limit').value;
    const { data, pagination } = await request(`?page=${page}&limit=${limit}`);
    
    state.page = pagination.page;
    state.totalPages = pagination.totalPages || 1;
    renderRows(data);

    $('page-info').textContent = `Página ${state.page} de ${state.totalPages}`;
    $('page-summary').textContent = `${pagination.total} producto(s) en total`;
    $('prev').disabled = state.page <= 1;
    $('next').disabled = state.page >= state.totalPages;
  } catch (e) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" class="loading-state" style="color: var(--danger)">
          ⚠ ${e.message}
        </td>
      </tr>
    `;
    show(e.message, 'error');
  }
}

// Buscar por ID
async function search(id) {
  const tbody = $('rows');
  tbody.innerHTML = `
    <tr>
      <td colspan="5" class="loading-state">
        <div class="spinner"></div> Buscando producto ${id}...
      </td>
    </tr>
  `;

  try {
    const { data } = await request(`/${encodeURIComponent(id)}`);
    renderRows([data]);
    $('page-info').textContent = 'Resultado único';
    $('page-summary').textContent = `1 producto encontrado`;
    $('prev').disabled = true;
    $('next').disabled = true;
    show(`Producto ${id} encontrado.`);
  } catch (e) {
    renderRows([]);
    $('page-summary').textContent = `0 resultados`;
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

  $('form-title').textContent = `Editar: ${p.id_producto}`;
  $('btn-save').querySelector('.btn-text').textContent = 'Guardar Cambios (PUT)';
  $('btn-patch').hidden = false;
  $('btn-cancel').hidden = false;
  $('id_categoria').focus();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function resetForm() {
  state.editingId = null;
  $('form').reset();
  $('id_producto').disabled = false;
  $('form-title').textContent = 'Nuevo producto';
  $('btn-save').querySelector('.btn-text').textContent = 'Crear Producto';
  $('btn-patch').hidden = true;
  $('btn-cancel').hidden = true;
  $('msg').style.display = 'none';
}

// Envío del formulario (POST o PUT)
$('form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const body = formData();

  if (!body.id_producto && !state.editingId) {
    show('El ID de producto es requerido', 'error');
    return;
  }

  const saveBtn = $('btn-save');
  saveBtn.disabled = true;

  try {
    if (state.editingId) {
      const { id_producto, ...resto } = body;
      await request(`/${encodeURIComponent(state.editingId)}`, {
        method: 'PUT',
        body: JSON.stringify(resto),
      });
      show(`Producto ${state.editingId} actualizado exitosamente.`);
    } else {
      await request('', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      show(`Producto ${body.id_producto} creado con éxito.`);
    }

    resetForm();
    load();
  } catch (err) {
    show(err.message, 'error');
  } finally {
    saveBtn.disabled = false;
  }
});

// PATCH parcial
$('btn-patch').addEventListener('click', async () => {
  const { id_producto, ...campos } = formData();
  const patchBtn = $('btn-patch');
  patchBtn.disabled = true;

  try {
    await request(`/${encodeURIComponent(state.editingId)}`, {
      method: 'PATCH',
      body: JSON.stringify(campos),
    });
    show(`Producto ${state.editingId} actualizado parcialmente (PATCH).`);
    resetForm();
    load();
  } catch (err) {
    show(err.message, 'error');
  } finally {
    patchBtn.disabled = false;
  }
});

// DELETE
async function remove(id) {
  if (!confirm(`¿Estás seguro de que deseas eliminar permanentemente el producto "${id}"?`)) {
    return;
  }

  try {
    await request(`/${encodeURIComponent(id)}`, { method: 'DELETE' });
    show(`Producto "${id}" eliminado correctamente.`);
    load();
  } catch (err) {
    show(err.message, 'error');
  }
}

// Event Listeners de navegación
$('btn-cancel').addEventListener('click', resetForm);

$('search-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const id = $('search-id').value.trim();
  id ? search(id) : load(1);
});

$('btn-all').addEventListener('click', () => {
  $('search-id').value = '';
  load(1);
});

$('prev').addEventListener('click', () => {
  if (state.page > 1) load(state.page - 1);
});

$('next').addEventListener('click', () => {
  if (state.page < state.totalPages) load(state.page + 1);
});

$('limit').addEventListener('change', () => load(1));

// Carga inicial
load(1);
