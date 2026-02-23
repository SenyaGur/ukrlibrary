import uuid
from flask import Blueprint, request, jsonify

from app.auth import admin_required
from app.database import get_db, query_db

publishers_bp = Blueprint('publishers', __name__, url_prefix='/api/publishers')


@publishers_bp.route('', methods=['GET'])
def get_publishers():
    """Get all publishers."""
    publishers = query_db('SELECT * FROM publishers ORDER BY name')
    return jsonify(publishers)


@publishers_bp.route('/<publisher_id>', methods=['GET'])
def get_publisher(publisher_id):
    """Get a single publisher by ID."""
    publisher = query_db('SELECT * FROM publishers WHERE id = ?', [publisher_id], one=True)
    if not publisher:
        return jsonify({'error': 'Publisher not found'}), 404
    return jsonify(publisher)


@publishers_bp.route('', methods=['POST'])
@admin_required
def create_publisher():
    """Create a new publisher."""
    data = request.get_json()
    if not data or not data.get('name'):
        return jsonify({'error': 'Name is required'}), 400

    publisher_id = str(uuid.uuid4())
    db = get_db()
    db.execute(
        'INSERT INTO publishers (id, name, city) VALUES (?, ?, ?)',
        [publisher_id, data['name'], data.get('city', '')]
    )
    db.commit()

    publisher = query_db('SELECT * FROM publishers WHERE id = ?', [publisher_id], one=True)
    return jsonify(publisher), 201


@publishers_bp.route('/<publisher_id>', methods=['PUT'])
@admin_required
def update_publisher(publisher_id):
    """Update a publisher."""
    publisher = query_db('SELECT * FROM publishers WHERE id = ?', [publisher_id], one=True)
    if not publisher:
        return jsonify({'error': 'Publisher not found'}), 404

    data = request.get_json()
    if not data:
        return jsonify({'error': 'Request body is required'}), 400

    set_clauses = []
    args = []
    for field in ['name', 'city']:
        if field in data:
            set_clauses.append(f'{field} = ?')
            args.append(data[field])

    if not set_clauses:
        return jsonify({'error': 'No fields to update'}), 400

    args.append(publisher_id)
    db = get_db()
    db.execute(f'UPDATE publishers SET {", ".join(set_clauses)} WHERE id = ?', args)
    db.commit()

    updated = query_db('SELECT * FROM publishers WHERE id = ?', [publisher_id], one=True)
    return jsonify(updated)


@publishers_bp.route('/<publisher_id>', methods=['DELETE'])
@admin_required
def delete_publisher(publisher_id):
    """Delete a publisher."""
    publisher = query_db('SELECT * FROM publishers WHERE id = ?', [publisher_id], one=True)
    if not publisher:
        return jsonify({'error': 'Publisher not found'}), 404

    db = get_db()
    db.execute('DELETE FROM publishers WHERE id = ?', [publisher_id])
    db.commit()

    return jsonify({'message': 'Publisher deleted successfully'})
