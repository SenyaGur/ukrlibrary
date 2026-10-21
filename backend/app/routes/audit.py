from flask import Blueprint, request, jsonify

from app.auth import admin_required
from app.database import query_db

audit_bp = Blueprint('audit', __name__, url_prefix='/api/audit')


@audit_bp.route('', methods=['GET'])
@admin_required
def get_audit_log():
    """Return audit-log entries, newest first (admin only).

    Optional query params: user_id, entity_type, action, q (matches email or
    path substring), limit (default 100, max 500), offset. Returns
    { items: [...], total: N }.
    """
    where = []
    args = []

    user_id = request.args.get('user_id')
    if user_id:
        where.append('user_id = ?')
        args.append(user_id)

    entity_type = request.args.get('entity_type')
    if entity_type:
        where.append('entity_type = ?')
        args.append(entity_type)

    action = request.args.get('action')
    if action:
        where.append('action = ?')
        args.append(action)

    q = request.args.get('q')
    if q:
        where.append('(user_email LIKE ? OR user_name LIKE ? OR path LIKE ?)')
        like = f'%{q}%'
        args.extend([like, like, like])

    clause = (' WHERE ' + ' AND '.join(where)) if where else ''

    total_row = query_db(f'SELECT COUNT(*) AS cnt FROM audit_log{clause}', args, one=True)
    total = total_row['cnt'] if total_row else 0

    try:
        limit = min(int(request.args.get('limit', 100)), 500)
    except (TypeError, ValueError):
        limit = 100
    try:
        offset = max(int(request.args.get('offset', 0)), 0)
    except (TypeError, ValueError):
        offset = 0

    items = query_db(
        f'SELECT * FROM audit_log{clause} ORDER BY created_at DESC LIMIT ? OFFSET ?',
        args + [limit, offset],
    )
    return jsonify({'items': items, 'total': total})
