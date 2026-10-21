"""Audit logging.

A single ``after_request`` hook records every mutating request (POST/PUT/PATCH/
DELETE) that did not error, capturing WHO (the authenticated user, when known)
did WHAT (the Flask endpoint) to WHICH entity (URL id). This gives blanket
coverage — new routes are audited automatically, with no per-route edits — which
is exactly what the client asked for ("see who did what actions").

Passwords and tokens are never stored: only a whitelist of safe body keys is
persisted in ``details``.
"""

import json
import uuid
import logging

from flask import g, request

logger = logging.getLogger(__name__)

_MUTATING_METHODS = {'POST', 'PUT', 'PATCH', 'DELETE'}

# Body fields that are safe and useful to record. Anything not listed here
# (notably password / token / hash) is dropped.
_SAFE_BODY_KEYS = {
    'status', 'role', 'name', 'title', 'author', 'available', 'reader_id',
    'child_id', 'inventory_number', 'supplier', 'full_name', 'email',
    'rental_duration', 'category', 'city', 'publisher_id', 'series_id',
}


def _safe_details():
    """Collect a JSON-safe summary of URL params and a whitelist of body keys."""
    details = {}
    if request.view_args:
        details.update({k: v for k, v in request.view_args.items()})
    body = request.get_json(silent=True)
    if isinstance(body, dict):
        for key in _SAFE_BODY_KEYS:
            if key in body:
                details[key] = body[key]
    return details


def _entity_id_from_view_args():
    """Pick the most specific id from the route params, if any."""
    if not request.view_args:
        return None
    # Prefer a param literally named "*_id", else the first value.
    for key, value in request.view_args.items():
        if key.endswith('_id'):
            return str(value)
    first = next(iter(request.view_args.values()), None)
    return str(first) if first is not None else None


def record_request_audit(response):
    """after_request hook: persist a row for successful mutating requests."""
    try:
        if request.method not in _MUTATING_METHODS:
            return response
        # Don't log failed attempts (validation errors, 401/403, etc.).
        if response.status_code >= 400:
            return response

        endpoint = request.endpoint or request.path
        entity_type = endpoint.split('.')[0] if '.' in endpoint else None

        user = getattr(g, 'current_user', None)
        if user is not None:
            user_id = user['id']
            user_email = user['email']
            user_name = user.get('full_name') if isinstance(user, dict) else user['full_name']
        else:
            user_id = None
            # For unauthenticated actions (login, public rental request) record
            # the email from the body when present, so the row is still useful.
            body = request.get_json(silent=True)
            user_email = body.get('email') if isinstance(body, dict) else None
            user_name = None

        details = _safe_details()

        # Use a dedicated short-lived connection so the audit write never
        # interferes with (or gets rolled back by) the request's own transaction.
        from app.database import get_db
        db = get_db()
        db.execute(
            '''INSERT INTO audit_log
               (id, user_id, user_email, user_name, action, method, path,
                entity_type, entity_id, details, status_code)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)''',
            [
                str(uuid.uuid4()), user_id, user_email, user_name,
                endpoint, request.method, request.path,
                entity_type, _entity_id_from_view_args(),
                json.dumps(details, ensure_ascii=False) if details else None,
                response.status_code,
            ],
        )
        db.commit()
    except Exception as exc:  # noqa: BLE001 - auditing must never break a response
        logger.error('audit: failed to record %s %s: %s', request.method, request.path, exc)
    return response


def init_audit(app):
    """Register the audit hook on the Flask app."""
    app.after_request(record_request_audit)
