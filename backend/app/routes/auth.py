import uuid
from flask import Blueprint, request, jsonify, g

from app.auth import generate_token, hash_password, check_password, login_required
from app.database import get_db, query_db

auth_bp = Blueprint('auth', __name__, url_prefix='/api/auth')


def _user_dict(user):
    """Build a flat user dict for API responses."""
    return {
        'id': user['id'],
        'email': user['email'],
        'full_name': user['full_name'],
        'role': user['role'],
        'avatar_url': user['avatar_url'],
        'created_at': user['created_at'],
    }


@auth_bp.route('/signup', methods=['POST'])
def signup():
    """Register a new user."""
    data = request.get_json()

    if not data:
        return jsonify({'error': 'Request body is required'}), 400

    email = data.get('email')
    password = data.get('password')
    full_name = data.get('full_name', '')

    if not email or not password:
        return jsonify({'error': 'Email and password are required'}), 400

    existing = query_db('SELECT id FROM users WHERE email = ?', [email], one=True)
    if existing:
        return jsonify({'error': 'Email already registered'}), 409

    user_id = str(uuid.uuid4())
    password_hashed = hash_password(password)

    db = get_db()
    db.execute(
        'INSERT INTO users (id, email, password_hash, full_name, role) VALUES (?, ?, ?, ?, ?)',
        [user_id, email, password_hashed, full_name, 'user']
    )
    db.commit()

    user = query_db('SELECT * FROM users WHERE id = ?', [user_id], one=True)
    token = generate_token(user_id, 'user')

    return jsonify({
        'token': token,
        'user': _user_dict(user),
    }), 201


@auth_bp.route('/login', methods=['POST'])
def login():
    """Authenticate a user and return a JWT."""
    data = request.get_json()

    if not data:
        return jsonify({'error': 'Request body is required'}), 400

    email = data.get('email')
    password = data.get('password')

    if not email or not password:
        return jsonify({'error': 'Email and password are required'}), 400

    user = query_db('SELECT * FROM users WHERE email = ?', [email], one=True)

    if not user or not check_password(password, user['password_hash']):
        return jsonify({'error': 'Invalid email or password'}), 401

    token = generate_token(user['id'], user['role'])

    return jsonify({
        'token': token,
        'user': _user_dict(user),
    })


@auth_bp.route('/me', methods=['GET'])
@login_required
def me():
    """Return the currently authenticated user's profile as a flat object."""
    user = g.current_user
    return jsonify(_user_dict(user))


@auth_bp.route('/reset-password', methods=['POST'])
@login_required
def reset_password():
    """Update the authenticated user's password."""
    data = request.get_json()

    if not data or not data.get('password'):
        return jsonify({'error': 'Password is required'}), 400

    new_hash = hash_password(data['password'])

    db = get_db()
    db.execute(
        'UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [new_hash, g.current_user['id']]
    )
    db.commit()

    return jsonify({'message': 'Password updated successfully'})
