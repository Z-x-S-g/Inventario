from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import mysql.connector
from datetime import datetime, timedelta
import os

app = Flask(__name__, static_folder='static')
CORS(app)

@app.route('/')
def index():
    return send_from_directory(app.static_folder, 'index.html')

def get_db():
    return mysql.connector.connect(
        host="localhost",
        user="root",
        password="",
        database="inventario"
    )

@app.route('/productos', methods=['GET'])
def get_productos():
    db = get_db()
    cursor = db.cursor(dictionary=True)
    cursor.execute("SELECT * FROM productos")
    productos = cursor.fetchall()
    cursor.close()
    db.close()
    return jsonify(productos)

@app.route('/productos', methods=['POST'])
def create_producto():
    data = request.json
    db = get_db()
    cursor = db.cursor()
    
    sql = """INSERT INTO productos 
             (nombre, descripcion, categoria, cantidad_actual, precio_unitario, punto_reorden)
             VALUES (%s, %s, %s, %s, %s, %s)"""
    values = (
        data['nombre'],
        data.get('descripcion', ''),
        data.get('categoria', ''),
        data.get('cantidad_actual', 0),
        data['precio_unitario'],
        data.get('punto_reorden', 5)
    )
    
    cursor.execute(sql, values)
    db.commit()
    new_id = cursor.lastrowid
    cursor.close()
    db.close()
    
    return jsonify({'id': new_id, 'message': 'Producto creado exitosamente'}), 201

@app.route('/productos/<int:id>', methods=['PUT'])
def update_producto(id):
    data = request.json
    db = get_db()
    cursor = db.cursor()
    
    sql = """UPDATE productos SET 
             nombre = %s,
             descripcion = %s,
             categoria = %s,
             cantidad_actual = %s,
             precio_unitario = %s,
             punto_reorden = %s
             WHERE id = %s"""
    values = (
        data['nombre'],
        data.get('descripcion', ''),
        data.get('categoria', ''),
        data.get('cantidad_actual', 0),
        data['precio_unitario'],
        data.get('punto_reorden', 5),
        id
    )
    
    cursor.execute(sql, values)
    db.commit()
    cursor.close()
    db.close()
    
    return jsonify({'message': 'Producto actualizado exitosamente'})

@app.route('/productos/<int:id>', methods=['DELETE'])
def delete_producto(id):
    db = get_db()
    cursor = db.cursor()
    cursor.execute("DELETE FROM productos WHERE id = %s", (id,))
    db.commit()
    cursor.close()
    db.close()
    return jsonify({'message': 'Producto eliminado exitosamente'})

@app.route('/movimientos', methods=['POST'])
def create_movimiento():
    data = request.json
    db = get_db()
    cursor = db.cursor()
    
    # Verificar si el producto existe y obtener cantidad actual
    cursor.execute("SELECT cantidad_actual FROM productos WHERE id = %s", (data['producto_id'],))
    result = cursor.fetchone()
    if not result:
        return jsonify({'error': 'Producto no encontrado'}), 404
    
    cantidad_actual = result[0]
    nueva_cantidad = cantidad_actual
    
    if data['tipo_movimiento'] == 'entrada':
        nueva_cantidad = cantidad_actual + data['cantidad']
    elif data['tipo_movimiento'] == 'salida':
        if cantidad_actual < data['cantidad']:
            return jsonify({'error': 'No hay suficiente stock'}), 400
        nueva_cantidad = cantidad_actual - data['cantidad']
    
    # Registrar el movimiento
    sql_movimiento = """INSERT INTO movimientos 
                       (producto_id, tipo_movimiento, cantidad, notas)
                       VALUES (%s, %s, %s, %s)"""
    values_movimiento = (
        data['producto_id'],
        data['tipo_movimiento'],
        data['cantidad'],
        data.get('notas', '')
    )
    
    # Actualizar la cantidad del producto
    sql_update = "UPDATE productos SET cantidad_actual = %s WHERE id = %s"
    values_update = (nueva_cantidad, data['producto_id'])
    
    cursor.execute(sql_movimiento, values_movimiento)
    cursor.execute(sql_update, values_update)
    db.commit()
    cursor.close()
    db.close()
    
    return jsonify({'message': 'Movimiento registrado exitosamente'})

@app.route('/movimientos/producto/<int:producto_id>', methods=['GET'])
def get_movimientos_producto(producto_id):
    db = get_db()
    cursor = db.cursor(dictionary=True)
    cursor.execute("""
        SELECT m.*, p.nombre as producto_nombre 
        FROM movimientos m 
        JOIN productos p ON m.producto_id = p.id 
        WHERE producto_id = %s 
        ORDER BY fecha DESC
    """, (producto_id,))
    movimientos = cursor.fetchall()
    cursor.close()
    db.close()
    return jsonify(movimientos)

@app.route('/reportes/inventario', methods=['GET'])
def get_reporte_inventario():
    periodo = request.args.get('periodo', 'dia')
    fecha_inicio = datetime.now()
    
    if periodo == 'dia':
        fecha_inicio = fecha_inicio.replace(hour=0, minute=0, second=0, microsecond=0)
    elif periodo == 'semana':
        fecha_inicio = fecha_inicio - timedelta(days=fecha_inicio.weekday())
    elif periodo == 'mes':
        fecha_inicio = fecha_inicio.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    
    db = get_db()
    cursor = db.cursor(dictionary=True)
    
    cursor.execute("""
        SELECT 
            p.id,
            p.nombre,
            p.categoria,
            p.cantidad_actual,
            COALESCE(SUM(CASE WHEN m.tipo_movimiento = 'entrada' THEN m.cantidad ELSE 0 END), 0) as total_entradas,
            COALESCE(SUM(CASE WHEN m.tipo_movimiento = 'salida' THEN m.cantidad ELSE 0 END), 0) as total_salidas
        FROM productos p
        LEFT JOIN movimientos m ON p.id = m.producto_id AND m.fecha >= %s
        GROUP BY p.id
    """, (fecha_inicio,))
    
    reporte = cursor.fetchall()
    cursor.close()
    db.close()
    return jsonify(reporte)

@app.route('/productos/bajo-stock', methods=['GET'])
def get_productos_bajo_stock():
    db = get_db()
    cursor = db.cursor(dictionary=True)
    cursor.execute("SELECT * FROM productos WHERE cantidad_actual <= punto_reorden")
    productos = cursor.fetchall()
    cursor.close()
    db.close()
    return jsonify(productos)

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=54910, debug=True)