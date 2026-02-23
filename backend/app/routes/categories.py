import uuid
from flask import Blueprint, request, jsonify

from app.auth import admin_required
from app.database import get_db, query_db

categories_bp = Blueprint('categories', __name__, url_prefix='/api/categories')


@categories_bp.route('', methods=['GET'])
def get_categories():
    """Get all categories."""
    categories = query_db('SELECT * FROM categories ORDER BY name')
    return jsonify(categories)


@categories_bp.route('/<category_id>', methods=['GET'])
def get_category(category_id):
    """Get a single category by ID."""
    category = query_db('SELECT * FROM categories WHERE id = ?', [category_id], one=True)
    if not category:
        return jsonify({'error': 'Category not found'}), 404
    return jsonify(category)


@categories_bp.route('', methods=['POST'])
@admin_required
def create_category():
    """Create a new category."""
    data = request.get_json()
    if not data or not data.get('name'):
        return jsonify({'error': 'Name is required'}), 400

    category_id = str(uuid.uuid4())
    db = get_db()
    db.execute('INSERT INTO categories (id, name) VALUES (?, ?)', [category_id, data['name']])
    db.commit()

    category = query_db('SELECT * FROM categories WHERE id = ?', [category_id], one=True)
    return jsonify(category), 201


@categories_bp.route('/<category_id>', methods=['PUT'])
@admin_required
def update_category(category_id):
    """Update a category."""
    category = query_db('SELECT * FROM categories WHERE id = ?', [category_id], one=True)
    if not category:
        return jsonify({'error': 'Category not found'}), 404

    data = request.get_json()
    if not data or not data.get('name'):
        return jsonify({'error': 'Name is required'}), 400

    db = get_db()
    db.execute('UPDATE categories SET name = ? WHERE id = ?', [data['name'], category_id])
    db.commit()

    updated = query_db('SELECT * FROM categories WHERE id = ?', [category_id], one=True)
    return jsonify(updated)


@categories_bp.route('/<category_id>', methods=['DELETE'])
@admin_required
def delete_category(category_id):
    """Delete a category."""
    category = query_db('SELECT * FROM categories WHERE id = ?', [category_id], one=True)
    if not category:
        return jsonify({'error': 'Category not found'}), 404

    db = get_db()
    db.execute('DELETE FROM categories WHERE id = ?', [category_id])
    db.commit()

    return jsonify({'message': 'Category deleted successfully'})
