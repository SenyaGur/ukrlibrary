import uuid
from flask import Blueprint, request, jsonify, g

from app.auth import admin_required, hash_password
from app.database import get_db, query_db

users_bp = Blueprint('users', __name__, url_prefix='/api/users')

_USER_COLUMNS = 'id, email, full_name, role, avatar_url, created_at, updated_at'


@users_bp.route('', methods=['GET'])
@admin_required
def get_users():
    """Get all users (admin only)."""
    users = query_db(
        f'SELECT {_USER_COLUMNS} FROM users ORDER BY created_at DESC'
    )
    return jsonify(users)


@users_bp.route('', methods=['POST'])
@admin_required
def create_user():
    """Create a new user, typically an administrator (admin only).

    Accepts { email, password, full_name?, role? }. role defaults to "admin"
    since the purpose of this endpoint is adding administrators.
    """
    data = request.get_json()
    if not data:
        return jsonify({'error': 'Request body is required'}), 400

    email = (data.get('email') or '').strip()
    password = data.get('password') or ''
    full_name = (data.get('full_name') or '').strip()
    role = data.get('role', 'admin')

    if not email or not password:
        return jsonify({'error': 'Email and password are required'}), 400
    if role not in ('admin', 'user'):
        return jsonify({'error': 'role must be "admin" or "user"'}), 400
    if len(password) < 6:
        return jsonify({'error': 'Пароль має містити щонайменше 6 символів'}), 400

    existing = query_db('SELECT id FROM users WHERE email = ?', [email], one=True)
    if existing:
        return jsonify({'error': 'Email already registered'}), 409

    user_id = str(uuid.uuid4())
    db = get_db()
    db.execute(
        'INSERT INTO users (id, email, password_hash, full_name, role) VALUES (?, ?, ?, ?, ?)',
        [user_id, email, hash_password(password), full_name, role]
    )
    db.commit()

    created = query_db(
        f'SELECT {_USER_COLUMNS} FROM users WHERE id = ?', [user_id], one=True
    )
    return jsonify(created), 201


@users_bp.route('/<user_id>', methods=['DELETE'])
@admin_required
def delete_user(user_id):
    """Delete a user (admin only). Guards against removing yourself or the
    last remaining admin so the system is never locked out."""
    user = query_db('SELECT id, role FROM users WHERE id = ?', [user_id], one=True)
    if not user:
        return jsonify({'error': 'User not found'}), 404

    if user_id == g.current_user['id']:
        return jsonify({'error': 'Не можна видалити власний обліковий запис'}), 400

    if user['role'] == 'admin':
        admin_count = query_db(
            "SELECT COUNT(*) AS cnt FROM users WHERE role = 'admin'", one=True
        )
        if admin_count and admin_count['cnt'] <= 1:
            return jsonify({'error': 'Не можна видалити останнього адміністратора'}), 400

    db = get_db()
    db.execute('DELETE FROM users WHERE id = ?', [user_id])
    db.commit()
    return jsonify({'message': 'User deleted'})


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

    # Prevent demoting the last remaining admin (would lock everyone out).
    if new_role == 'user':
        current = query_db('SELECT role FROM users WHERE id = ?', [user_id], one=True)
        if current and current['role'] == 'admin':
            admin_count = query_db(
                "SELECT COUNT(*) AS cnt FROM users WHERE role = 'admin'", one=True
            )
            if admin_count and admin_count['cnt'] <= 1:
                return jsonify({'error': 'Не можна зняти права з останнього адміністратора'}), 400

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
