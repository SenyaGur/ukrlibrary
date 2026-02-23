import uuid
from flask import Blueprint, request, jsonify

from app.auth import admin_required
from app.database import get_db, query_db

series_bp = Blueprint('series', __name__, url_prefix='/api/series')


@series_bp.route('', methods=['GET'])
def get_series():
    """Get all series."""
    series = query_db('SELECT * FROM series ORDER BY name')
    return jsonify(series)


@series_bp.route('/<series_id>', methods=['GET'])
def get_single_series(series_id):
    """Get a single series by ID."""
    s = query_db('SELECT * FROM series WHERE id = ?', [series_id], one=True)
    if not s:
        return jsonify({'error': 'Series not found'}), 404
    return jsonify(s)


@series_bp.route('', methods=['POST'])
@admin_required
def create_series():
    """Create a new series."""
    data = request.get_json()
    if not data or not data.get('name'):
        return jsonify({'error': 'Name is required'}), 400

    series_id = str(uuid.uuid4())
    db = get_db()
    db.execute('INSERT INTO series (id, name) VALUES (?, ?)', [series_id, data['name']])
    db.commit()

    s = query_db('SELECT * FROM series WHERE id = ?', [series_id], one=True)
    return jsonify(s), 201


@series_bp.route('/<series_id>', methods=['PUT'])
@admin_required
def update_series(series_id):
    """Update a series."""
    s = query_db('SELECT * FROM series WHERE id = ?', [series_id], one=True)
    if not s:
        return jsonify({'error': 'Series not found'}), 404

    data = request.get_json()
    if not data or not data.get('name'):
        return jsonify({'error': 'Name is required'}), 400

    db = get_db()
    db.execute('UPDATE series SET name = ? WHERE id = ?', [data['name'], series_id])
    db.commit()

    updated = query_db('SELECT * FROM series WHERE id = ?', [series_id], one=True)
    return jsonify(updated)


@series_bp.route('/<series_id>', methods=['DELETE'])
@admin_required
def delete_series(series_id):
    """Delete a series."""
    s = query_db('SELECT * FROM series WHERE id = ?', [series_id], one=True)
    if not s:
        return jsonify({'error': 'Series not found'}), 404

    db = get_db()
    db.execute('DELETE FROM series WHERE id = ?', [series_id])
    db.commit()

    return jsonify({'message': 'Series deleted successfully'})
