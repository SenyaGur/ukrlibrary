"""Overdue-book detection and reminder emails.

Shared by the manual admin trigger (POST /api/rentals/overdue/run) and the
standalone cron script (check_overdue.py). Requires an active Flask app context
so it can use the request-scoped DB helpers.
"""

import os
import uuid
from datetime import datetime, timedelta

from app.database import get_db, query_db
from app.mailer import send_email, is_configured
from app.email_templates import overdue_reminder_html, due_date, fmt_date, parse_dt


def _int_env(key, default):
    try:
        return int(os.environ.get(key, str(default)) or default)
    except (TypeError, ValueError):
        return default


def find_overdue(now=None):
    """Return approved, not-yet-returned rentals whose due date + grace has
    passed. Each item is the rental row plus computed `_due` and `_days`.
    """
    now = now or datetime.utcnow()
    grace = timedelta(days=_int_env('OVERDUE_GRACE_DAYS', 0))
    rentals = query_db(
        "SELECT * FROM rental_requests "
        "WHERE status = 'approved' AND return_date IS NULL AND approved_at IS NOT NULL"
    )
    overdue = []
    for r in rentals:
        due = due_date(r['approved_at'], r['rental_duration'])
        if not due:
            continue
        if now > due + grace:
            item = dict(r)
            item['_due'] = due
            item['_days'] = (now - due).days
            overdue.append(item)
    return overdue


def _resolve_email_and_name(rental):
    """Prefer the linked reader's email/name, else the rental's own fields."""
    email = ''
    name = rental.get('renter_name') or ''
    if rental.get('reader_id'):
        rd = query_db(
            'SELECT email, parent_name, parent_surname FROM readers WHERE id = ?',
            [rental['reader_id']], one=True
        )
        if rd:
            email = (rd['email'] or '').strip()
            full = f"{rd['parent_surname']} {rd['parent_name']}".strip()
            if full:
                name = full
    if not email:
        email = (rental.get('renter_email') or '').strip()
    return email, name


def _recently_notified(rental_id, now):
    """True if a reminder for this rental was sent within the resend window."""
    resend_days = _int_env('OVERDUE_RESEND_DAYS', 7)
    row = query_db(
        'SELECT sent_at FROM overdue_reminders WHERE rental_id = ? ORDER BY sent_at DESC LIMIT 1',
        [rental_id], one=True
    )
    if not row or not row['sent_at']:
        return False
    last = parse_dt(row['sent_at'])
    if not last:
        return False
    return (now - last).days < resend_days


def run_overdue_reminders(now=None):
    """Find overdue loans and email each reader a reminder (one email per
    reader listing all their overdue books). Returns a summary dict.
    """
    now = now or datetime.utcnow()
    result = {
        'overdue': 0, 'emailed': 0, 'books_covered': 0,
        'skipped_no_email': 0, 'skipped_recent': 0, 'failed': 0,
        'smtp_configured': is_configured(),
    }

    overdue = find_overdue(now)
    result['overdue'] = len(overdue)
    if not overdue:
        return result

    # Group still-eligible rentals by recipient email.
    groups = {}
    for r in overdue:
        if _recently_notified(r['id'], now):
            result['skipped_recent'] += 1
            continue
        email, name = _resolve_email_and_name(r)
        if not email:
            result['skipped_no_email'] += 1
            continue
        grp = groups.setdefault(email, {'name': name, 'rentals': []})
        grp['rentals'].append(r)

    if not is_configured():
        # Nothing can be sent; the counts above still describe what's overdue.
        return result

    db = get_db()
    for email, grp in groups.items():
        items = [
            {'title': r['book_title'], 'due': fmt_date(r['_due']), 'days_overdue': r['_days']}
            for r in grp['rentals']
        ]
        html = overdue_reminder_html(grp['name'], items)
        ok = send_email(email, 'Нагадування про повернення книг — Бібліотека', html)
        if ok:
            for r in grp['rentals']:
                db.execute(
                    'INSERT INTO overdue_reminders (id, rental_id, email) VALUES (?, ?, ?)',
                    [str(uuid.uuid4()), r['id'], email]
                )
            db.commit()
            result['emailed'] += 1
            result['books_covered'] += len(grp['rentals'])
        else:
            result['failed'] += 1
    return result


def list_overdue(now=None):
    """Serializable overdue list for the admin UI (no emails sent)."""
    overdue = find_overdue(now)
    out = []
    for r in overdue:
        email, name = _resolve_email_and_name(r)
        out.append({
            'id': r['id'],
            'book_title': r['book_title'],
            'renter_name': name,
            'reader_id': r.get('reader_id'),
            'email': email,
            'due': fmt_date(r['_due']),
            'days_overdue': r['_days'],
            'has_email': bool(email),
        })
    return out


def send_reminder_for_reader(reader_id, now=None):
    """Send an overdue reminder to ONE reader for all of their overdue books.

    Used by the admin "send reminder" button. Returns a small status dict.
    """
    now = now or datetime.utcnow()
    if not reader_id:
        return {'sent': False, 'reason': 'no_reader'}

    overdue = [r for r in find_overdue(now) if r.get('reader_id') == reader_id]
    if not overdue:
        return {'sent': False, 'reason': 'no_overdue'}

    reader = query_db(
        'SELECT email, parent_name, parent_surname FROM readers WHERE id = ?',
        [reader_id], one=True
    )
    if not reader:
        return {'sent': False, 'reason': 'no_reader'}
    email = (reader['email'] or '').strip()
    if not email:
        return {'sent': False, 'reason': 'no_email'}
    if not is_configured():
        return {'sent': False, 'reason': 'smtp_not_configured'}

    name = f"{reader['parent_surname']} {reader['parent_name']}".strip()
    items = [
        {'title': r['book_title'], 'due': fmt_date(r['_due']), 'days_overdue': r['_days']}
        for r in overdue
    ]
    html = overdue_reminder_html(name, items)
    ok = send_email(email, 'Нагадування про повернення книг — Бібліотека', html)
    if ok:
        db = get_db()
        for r in overdue:
            db.execute(
                'INSERT INTO overdue_reminders (id, rental_id, email) VALUES (?, ?, ?)',
                [str(uuid.uuid4()), r['id'], email]
            )
        db.commit()
    return {'sent': ok, 'email': email, 'books': len(items)}
