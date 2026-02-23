from flask import Blueprint, request, jsonify

from app.auth import admin_required
from app.database import get_db, query_db

users_bp = Blueprint('users', __name__, url_prefix='/api/users')


@users_bp.route('', methods=['GET'])
@admin_required
def get_users():
    """Get all users (admin only)."""
    users = query_db(
        'SELECT id, email, full_name, role, avatar_url, created_at, updated_at FROM users ORDER BY created_at DESC'
    )
    return jsonify(users)


@users_bp.route('/<user_id>/role', methods=['PUT'])
@admin_required
def update_user_role(user_id):
    """Update a user's role (admin only). Accepts { role: "admin" | "user" }."""
    user = query_db('SELECT id FROM users WHERE id = ?', [user_id], one=True)
    if not user:
        return jsonify({'error': 'User not found'}), 404

    data = request.get_json()
    if not data or 'role' not in data:
        return jsonify({'error': 'role is required'}), 400

    new_role = data['role']
    if new_role not in ('admin', 'user'):
        return jsonify({'error': 'role must be "admin" or "user"'}), 400

    db = get_db()
    db.execute(
        'UPDATE users SET role = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [new_role, user_id]
    )
    db.commit()

    updated = query_db(
        'SELECT id, email, full_name, role, avatar_url, created_at, updated_at FROM users WHERE id = ?',
        [user_id],
        one=True
    )
    return jsonify(updated)
