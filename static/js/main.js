const API_URL = 'http://localhost:54910';

// Funciones de carga inicial
document.addEventListener('DOMContentLoaded', () => {
    cargarProductos();
    verificarBajoStock();
    cargarProductosSelect();
});

// Funciones de productos
async function cargarProductos() {
    try {
        const response = await fetch(`${API_URL}/productos`);
        const productos = await response.json();
        const tbody = document.getElementById('tabla-productos');
        tbody.innerHTML = '';
        
        productos.forEach(producto => {
            const tr = document.createElement('tr');
            if (producto.cantidad_actual <= producto.punto_reorden) {
                tr.classList.add('bajo-stock');
            }
            
            tr.innerHTML = `
                <td>${producto.id}</td>
                <td>${producto.nombre}</td>
                <td>${producto.descripcion || ''}</td>
                <td>${producto.categoria || ''}</td>
                <td>${producto.cantidad_actual}</td>
                <td>${producto.precio_unitario}</td>
                <td>${producto.punto_reorden}</td>
                <td>
                    <button class="btn btn-sm btn-primary" onclick="editarProducto(${producto.id})">Editar</button>
                    <button class="btn btn-sm btn-danger" onclick="eliminarProducto(${producto.id})">Eliminar</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (error) {
        console.error('Error al cargar productos:', error);
        alert('Error al cargar productos');
    }
}

async function verificarBajoStock() {
    try {
        const response = await fetch(`${API_URL}/productos/bajo-stock`);
        const productos = await response.json();
        const alertas = document.getElementById('alertas');
        
        if (productos.length > 0) {
            alertas.classList.remove('d-none');
            alertas.innerHTML = `¡Hay ${productos.length} producto(s) con bajo stock!`;
        } else {
            alertas.classList.add('d-none');
        }
    } catch (error) {
        console.error('Error al verificar bajo stock:', error);
    }
}

function mostrarFormularioProducto(producto = null) {
    const modal = new bootstrap.Modal(document.getElementById('productoModal'));
    document.getElementById('producto-id').value = producto ? producto.id : '';
    document.getElementById('producto-nombre').value = producto ? producto.nombre : '';
    document.getElementById('producto-descripcion').value = producto ? producto.descripcion : '';
    document.getElementById('producto-categoria').value = producto ? producto.categoria : '';
    document.getElementById('producto-cantidad').value = producto ? producto.cantidad_actual : 0;
    document.getElementById('producto-precio').value = producto ? producto.precio_unitario : '';
    document.getElementById('producto-reorden').value = producto ? producto.punto_reorden : 5;
    modal.show();
}

async function editarProducto(id) {
    try {
        const response = await fetch(`${API_URL}/productos`);
        const productos = await response.json();
        const producto = productos.find(p => p.id === id);
        if (producto) {
            mostrarFormularioProducto(producto);
        }
    } catch (error) {
        console.error('Error al cargar producto:', error);
        alert('Error al cargar producto');
    }
}

async function guardarProducto() {
    const id = document.getElementById('producto-id').value;
    const producto = {
        nombre: document.getElementById('producto-nombre').value,
        descripcion: document.getElementById('producto-descripcion').value,
        categoria: document.getElementById('producto-categoria').value,
        cantidad_actual: parseInt(document.getElementById('producto-cantidad').value),
        precio_unitario: parseFloat(document.getElementById('producto-precio').value),
        punto_reorden: parseInt(document.getElementById('producto-reorden').value)
    };

    try {
        const url = id ? `${API_URL}/productos/${id}` : `${API_URL}/productos`;
        const method = id ? 'PUT' : 'POST';
        
        const response = await fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(producto)
        });

        if (response.ok) {
            const modal = bootstrap.Modal.getInstance(document.getElementById('productoModal'));
            modal.hide();
            cargarProductos();
            verificarBajoStock();
            cargarProductosSelect();
        } else {
            alert('Error al guardar producto');
        }
    } catch (error) {
        console.error('Error al guardar producto:', error);
        alert('Error al guardar producto');
    }
}

async function eliminarProducto(id) {
    if (confirm('¿Está seguro de eliminar este producto?')) {
        try {
            const response = await fetch(`${API_URL}/productos/${id}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                cargarProductos();
                verificarBajoStock();
                cargarProductosSelect();
            } else {
                alert('Error al eliminar producto');
            }
        } catch (error) {
            console.error('Error al eliminar producto:', error);
            alert('Error al eliminar producto');
        }
    }
}

// Funciones de movimientos
async function cargarProductosSelect() {
    try {
        const response = await fetch(`${API_URL}/productos`);
        const productos = await response.json();
        
        const selectMovimientos = document.getElementById('producto-movimientos');
        const selectMovimiento = document.getElementById('movimiento-producto');
        
        [selectMovimientos, selectMovimiento].forEach(select => {
            if (select) {
                select.innerHTML = '<option value="">Seleccione un producto...</option>';
                productos.forEach(producto => {
                    select.innerHTML += `<option value="${producto.id}">${producto.nombre}</option>`;
                });
            }
        });
    } catch (error) {
        console.error('Error al cargar productos en select:', error);
    }
}

function mostrarFormularioMovimiento(tipo) {
    const modal = new bootstrap.Modal(document.getElementById('movimientoModal'));
    document.getElementById('movimiento-tipo').value = tipo;
    document.getElementById('movimiento-cantidad').value = '';
    document.getElementById('movimiento-notas').value = '';
    modal.show();
}

async function guardarMovimiento() {
    const movimiento = {
        producto_id: parseInt(document.getElementById('movimiento-producto').value),
        tipo_movimiento: document.getElementById('movimiento-tipo').value,
        cantidad: parseInt(document.getElementById('movimiento-cantidad').value),
        notas: document.getElementById('movimiento-notas').value
    };

    try {
        const response = await fetch(`${API_URL}/movimientos`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(movimiento)
        });

        if (response.ok) {
            const modal = bootstrap.Modal.getInstance(document.getElementById('movimientoModal'));
            modal.hide();
            cargarProductos();
            verificarBajoStock();
            if (document.getElementById('producto-movimientos').value) {
                cargarMovimientosProducto();
            }
        } else {
            const error = await response.json();
            alert(error.error || 'Error al guardar movimiento');
        }
    } catch (error) {
        console.error('Error al guardar movimiento:', error);
        alert('Error al guardar movimiento');
    }
}

async function cargarMovimientosProducto() {
    const productoId = document.getElementById('producto-movimientos').value;
    if (!productoId) {
        document.getElementById('tabla-movimientos').innerHTML = '';
        return;
    }

    try {
        const response = await fetch(`${API_URL}/movimientos/producto/${productoId}`);
        const movimientos = await response.json();
        const tbody = document.getElementById('tabla-movimientos');
        tbody.innerHTML = '';
        
        movimientos.forEach(movimiento => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${new Date(movimiento.fecha).toLocaleString()}</td>
                <td>${movimiento.tipo_movimiento}</td>
                <td>${movimiento.cantidad}</td>
                <td>${movimiento.notas || ''}</td>
            `;
            tbody.appendChild(tr);
        });
    } catch (error) {
        console.error('Error al cargar movimientos:', error);
        alert('Error al cargar movimientos');
    }
}

// Funciones de reportes
async function cargarReporte() {
    const periodo = document.getElementById('periodo-reporte').value;
    
    try {
        const response = await fetch(`${API_URL}/reportes/inventario?periodo=${periodo}`);
        const reporte = await response.json();
        const tbody = document.getElementById('tabla-reporte');
        tbody.innerHTML = '';
        
        reporte.forEach(item => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${item.nombre}</td>
                <td>${item.categoria || ''}</td>
                <td>${item.cantidad_actual}</td>
                <td>${item.total_entradas}</td>
                <td>${item.total_salidas}</td>
            `;
            tbody.appendChild(tr);
        });
    } catch (error) {
        console.error('Error al cargar reporte:', error);
        alert('Error al cargar reporte');
    }
}