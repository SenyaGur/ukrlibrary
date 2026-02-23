from datetime import datetime, timezone
from functools import wraps

import bcrypt
import jwt
from flask import request, g, jsonify, current_app

from app.database import query_db


def generate_token(user_id, role):
    """Create a JWT with user_id, role, exp (24h), and iat claims using HS256."""
    now = datetime.now(timezone.utc)
    payload = {
        'user_id': user_id,
        'role': role,
        'iat': now,
        'exp': now + current_app.config['JWT_EXPIRY']
    }
    return jwt.encode(payload, current_app.config['SECRET_KEY'], algorithm='HS256')


def decode_token(token):
    """Decode a JWT and return its payload. Returns None on any failure."""
    try:
        payload = jwt.decode(
            token,
            current_app.config['SECRET_KEY'],
            algorithms=['HS256']
        )
        return payload
    except (jwt.ExpiredSignatureError, jwt.InvalidTokenError):
        return None


def hash_password(password):
    """Hash a password using bcrypt."""
    return bcrypt.hashpw(
        password.encode('utf-8'),
        bcrypt.gensalt()
    ).decode('utf-8')


def check_password(password, hashed):
    """Verify a password against a bcrypt hash."""
    return bcrypt.checkpw(
        password.encode('utf-8'),
        hashed.encode('utf-8')
    )


def login_required(f):
    """Decorator that extracts JWT from Authorization header (Bearer token),
    loads user from DB, and injects g.current_user.
    Returns 401 JSON response on failure."""
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get('Authorization', '')

        if not auth_header.startswith('Bearer '):
            return jsonify({'error': 'Authorization token required'}), 401

        token = auth_header.split('Bearer ')[1]
        payload = decode_token(token)

        if payload is None:
            return jsonify({'error': 'Invalid or expired token'}), 401

        user = query_db(
            'SELECT id, email, full_name, role, avatar_url, created_at, updated_at FROM users WHERE id = ?',
            [payload['user_id']],
            one=True
        )

        if user is None:
            return jsonify({'error': 'User not found'}), 401

        g.current_user = user
        return f(*args, **kwargs)

    return decorated


def admin_required(f):
    """Decorator that checks the user is authenticated AND has role 'admin'.
    Returns 401 for missing/invalid token, 403 for non-admin users."""
    @wraps(f)
    @login_required
    def decorated(*args, **kwargs):
        if g.current_user['role'] != 'admin':
            return jsonify({'error': 'Admin access required'}), 403
        return f(*args, **kwargs)

    return decorated
