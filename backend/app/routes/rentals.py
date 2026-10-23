import uuid
from datetime import datetime
from flask import Blueprint, request, jsonify

from app.auth import admin_required
from app.database import get_db, immediate_transaction, query_db

rentals_bp = Blueprint('rentals', __name__, url_prefix='/api/rentals')


@rentals_bp.route('/receipt/send', methods=['POST'])
@admin_required
def send_issue_receipt():
    """Email selected issued loans to their reader's stored address only."""
    from app.mailer import send_email, is_configured
    from app.email_templates import issue_receipt_html, due_date, fmt_date, parse_dt

    data = request.get_json(silent=True) or {}
    reader = query_db('SELECT * FROM readers WHERE id = ?', [data.get('reader_id')], one=True)
    if not reader:
        return jsonify({'error': 'Читача не знайдено'}), 404
    email = (reader['email'] or '').strip()
    if not email:
        return jsonify({'error': 'У читача не вказано email'}), 400
    rental_ids = data.get('rental_ids')
    if not isinstance(rental_ids, list) or not rental_ids or not all(isinstance(i, str) for i in rental_ids):
        return jsonify({'error': 'Оберіть видані книги для квитанції'}), 400
    items = []
    issued_at = ''
    for rental_id in dict.fromkeys(rental_ids):
        rental = query_db(
            '''SELECT r.*, b.author, b.inventory_number, c.name AS child_name, c.surname AS child_surname
               FROM rental_requests r JOIN books b ON b.id = r.book_id
               LEFT JOIN children c ON c.id = r.child_id
               WHERE r.id = ? AND r.reader_id = ? AND r.status = 'approved' ''',
            [rental_id, reader['id']], one=True)
        if not rental:
            return jsonify({'error': 'Книга не видана цьому читачу. Оновіть список.'}), 400
        items.append({
            'title': rental['book_title'], 'author': rental['author'],
            'inventory_number': rental['inventory_number'],
            'due': fmt_date(due_date(rental['approved_at'], rental['rental_duration'])),
            'child_id': rental['child_id'],
            'child_name': ' '.join(filter(None, [rental['child_name'], rental['child_surname']])) or 'Читач особисто',
        })
        if not issued_at:
            issued_at = fmt_date(parse_dt(rental['approved_at']))
    if not is_configured():
        return jsonify({'error': 'Надсилання email не налаштовано на сервері'}), 503
    html = issue_receipt_html(
        f"{reader['parent_name']} {reader['parent_surname']}", items, issued_at)
    ok = send_email(email, 'Підтвердження видачі книг — Бібліотека', html)
    if not ok:
        return jsonify({'error': 'Не вдалося надіслати email'}), 502
    return jsonify({'sent': True, 'email': email})


@rentals_bp.route('/overdue', methods=['GET'])
@admin_required
def get_overdue():
    """List currently overdue loans (admin only). Does not send anything."""
    from app.overdue import list_overdue
    return jsonify(list_overdue())


@rentals_bp.route('/overdue/run', methods=['POST'])
@admin_required
def run_overdue():
    """Send overdue reminder emails now (admin only). Returns a summary."""
    from app.overdue import run_overdue_reminders
    return jsonify(run_overdue_reminders())


@rentals_bp.route('/<rental_id>/remind', methods=['POST'])
@admin_required
def remind_rental(rental_id):
    """Email a reminder about one specific rental to its reader (admin only).
    Resolves the recipient from the linked reader's email, else renter_email."""
    from datetime import datetime
    from app.mailer import send_email, is_configured
    from app.email_templates import rental_reminder_html, due_date, fmt_date

    rental = query_db('SELECT * FROM rental_requests WHERE id = ?', [rental_id], one=True)
    if not rental:
        return jsonify({'error': 'Rental not found'}), 404

    email = ''
    name = rental['renter_name']
    if rental['reader_id']:
        rd = query_db('SELECT email, parent_name, parent_surname FROM readers WHERE id = ?', [rental['reader_id']], one=True)
        if rd:
            email = (rd['email'] or '').strip()
            full = f"{rd['parent_surname']} {rd['parent_name']}".strip()
            if full:
                name = full
    if not email:
        email = (rental['renter_email'] or '').strip()
    if not email:
        return jsonify({'sent': False, 'reason': 'no_email'}), 400
    if not is_configured():
        return jsonify({'sent': False, 'reason': 'smtp_not_configured'}), 503

    due = due_date(rental['approved_at'], rental['rental_duration'])
    days_overdue = (datetime.utcnow() - due).days if due else 0
    html = rental_reminder_html(name, rental['book_title'], fmt_date(due), days_overdue)
    ok = send_email(email, 'Нагадування про повернення книги — Бібліотека', html)
    return jsonify({'sent': ok, 'email': email}), (200 if ok else 502)


@rentals_bp.route('/overdue/remind', methods=['POST'])
@admin_required
def remind_overdue_reader():
    """Send an overdue reminder to a single reader (admin only).
    Body: { reader_id }."""
    data = request.get_json(silent=True) or {}
    reader_id = data.get('reader_id')
    if not reader_id:
        return jsonify({'error': 'reader_id is required'}), 400
    from app.overdue import send_reminder_for_reader
    result = send_reminder_for_reader(reader_id)
    status = 200 if result.get('sent') else 400
    return jsonify(result), status


def _promote_next_or_release(db, book_id):
    """Promote the next queued reservation to pending, or release the book."""
    next_in_queue = query_db(
        '''SELECT id, queue_position FROM rental_requests
           WHERE book_id = ? AND status = 'queued'
           ORDER BY queue_position ASC LIMIT 1''',
        [book_id], one=True
    )
    if next_in_queue:
        db.execute(
            'UPDATE rental_requests SET status = ?, queue_position = NULL WHERE id = ?',
            ['pending', next_in_queue['id']]
        )
        # Decrement remaining queue positions
        db.execute(
            '''UPDATE rental_requests
               SET queue_position = queue_position - 1
               WHERE book_id = ? AND status = 'queued' AND queue_position > ?''',
            [book_id, next_in_queue['queue_position']]
        )
    else:
        db.execute('UPDATE books SET available = 1 WHERE id = ?', [book_id])


def _remove_from_queue(db, book_id, position):
    """Remove a queued entry and reorder remaining positions."""
    db.execute(
        '''UPDATE rental_requests
           SET queue_position = queue_position - 1
           WHERE book_id = ? AND status = 'queued' AND queue_position > ?''',
        [book_id, position]
    )


@rentals_bp.route('', methods=['GET'])
@admin_required
def get_rentals():
    """Get all rental requests. Supports ?reader_id=xxx filter. Admin only."""
    reader_id = request.args.get('reader_id')
    status = request.args.get('status')

    query = 'SELECT * FROM rental_requests WHERE 1=1'
    args = []

    if reader_id:
        query += ' AND reader_id = ?'
        args.append(reader_id)

    if status:
        query += ' AND status = ?'
        args.append(status)

    query += ' ORDER BY requested_at DESC'

    rentals = query_db(query, args)
    return jsonify(rentals)


@rentals_bp.route('', methods=['POST'])
def create_rental():
    """Create a new rental request or queue reservation (public endpoint, no auth required)."""
    data = request.get_json()
    if not data:
        return jsonify({'error': 'Request body is required'}), 400

    required = ['book_id', 'book_title', 'renter_name', 'renter_phone', 'rental_duration']
    for field in required:
        if not data.get(field):
            return jsonify({'error': f'{field} is required'}), 400

    rental_id = str(uuid.uuid4())
    db = get_db()
    with immediate_transaction(db):
        return _create_rental_request(db, data, rental_id)


def _create_rental_request(db, data, rental_id):

    # Check under the same write lock used by archival.
    book = query_db(
        'SELECT available, archived_at FROM books WHERE id = ?', [data['book_id']], one=True
    )
    if not book:
        return jsonify({'error': 'Book not found'}), 404
    if book['archived_at'] is not None:
        return jsonify({'error': 'Примірник в архіві. Спочатку відновіть його, '
                                 'щоб оформити видачу або бронювання.'}), 409

    auto_approve = data.get('auto_approve', False)

    # Auto-match or create reader when reader_id not provided
    reader_id = data.get('reader_id')
    child_id = data.get('child_id')
    renter_phone = data['renter_phone']
    renter_name = data['renter_name']

    if not reader_id and renter_phone:
        existing = query_db(
            'SELECT id FROM readers WHERE phone1 = ? OR phone2 = ?',
            [renter_phone, renter_phone], one=True
        )
        if existing:
            reader_id = existing['id']
        else:
            parts = renter_name.strip().rsplit(' ', 1)
            if len(parts) == 2:
                p_name, p_surname = parts[0], parts[1]
            else:
                p_name, p_surname = parts[0], parts[0]
            reader_id = str(uuid.uuid4())
            db.execute(
                'INSERT INTO readers (id, parent_name, parent_surname, phone1, address) VALUES (?, ?, ?, ?, ?)',
                [reader_id, p_name, p_surname, renter_phone, 'не вказано']
            )

    if book['available'] and auto_approve:
        # Admin-created: auto-approve and mark book unavailable immediately
        now = datetime.utcnow().isoformat()
        db.execute(
            '''INSERT INTO rental_requests
               (id, book_id, book_title, renter_name, renter_phone, renter_email,
                rental_duration, status, approved_at, reader_id, child_id)
               VALUES (?, ?, ?, ?, ?, ?, ?, 'approved', ?, ?, ?)''',
            [
                rental_id,
                data['book_id'],
                data['book_title'],
                data['renter_name'],
                data['renter_phone'],
                data.get('renter_email', ''),
                data['rental_duration'],
                now,
                reader_id,
                child_id
            ]
        )
        db.execute('UPDATE books SET available = 0 WHERE id = ?', [data['book_id']])
    elif book['available']:
        # Book is available — pending rental request (book stays available until admin approves)
        db.execute(
            '''INSERT INTO rental_requests
               (id, book_id, book_title, renter_name, renter_phone, renter_email,
                rental_duration, reader_id, child_id)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)''',
            [
                rental_id,
                data['book_id'],
                data['book_title'],
                data['renter_name'],
                data['renter_phone'],
                data.get('renter_email', ''),
                data['rental_duration'],
                reader_id,
                child_id
            ]
        )
    else:
        # Book is unavailable — queue reservation
        max_pos = query_db(
            'SELECT MAX(queue_position) as max_pos FROM rental_requests WHERE book_id = ? AND status = ?',
            [data['book_id'], 'queued'], one=True
        )
        next_position = (max_pos['max_pos'] or 0) + 1

        db.execute(
            '''INSERT INTO rental_requests
               (id, book_id, book_title, renter_name, renter_phone, renter_email,
                rental_duration, status, queue_position, reader_id, child_id)
               VALUES (?, ?, ?, ?, ?, ?, ?, 'queued', ?, ?, ?)''',
            [
                rental_id,
                data['book_id'],
                data['book_title'],
                data['renter_name'],
                data['renter_phone'],
                data.get('renter_email', ''),
                data['rental_duration'],
                next_position,
                reader_id,
                child_id
            ]
        )

    db.commit()

    rental = query_db('SELECT * FROM rental_requests WHERE id = ?', [rental_id], one=True)
    return jsonify(rental), 201


@rentals_bp.route('/<rental_id>/status', methods=['PUT'])
@admin_required
def update_rental_status(rental_id):
    """Update a rental request status (admin only).

    Accepts { status: "approved" | "declined" | "returned" }.
    """
    db = get_db()
    with immediate_transaction(db):
        return _update_rental_status(db, rental_id)


def _update_rental_status(db, rental_id):
    rental = query_db('SELECT * FROM rental_requests WHERE id = ?', [rental_id], one=True)
    if not rental:
        return jsonify({'error': 'Rental request not found'}), 404

    data = request.get_json()
    if not data or 'status' not in data:
        return jsonify({'error': 'status is required'}), 400

    new_status = data['status']
    if new_status not in ('approved', 'declined', 'returned'):
        return jsonify({'error': 'status must be "approved", "declined", or "returned"'}), 400


    if new_status == 'approved':
        book = query_db(
            'SELECT archived_at FROM books WHERE id = ?', [rental['book_id']], one=True
        )
        if not book:
            return jsonify({'error': 'Книгу не знайдено.'}), 404
        if book['archived_at'] is not None:
            return jsonify({'error': 'Примірник в архіві. Спочатку відновіть його, '
                                     'щоб схвалити видачу.'}), 409
        now = datetime.utcnow().isoformat()
        db.execute(
            'UPDATE rental_requests SET status = ?, approved_at = ? WHERE id = ?',
            ['approved', now, rental_id]
        )
        # Mark book as unavailable on approval
        db.execute('UPDATE books SET available = 0 WHERE id = ?', [rental['book_id']])

    elif new_status == 'returned':
        if rental['status'] != 'approved':
            return jsonify({'error': 'Only approved rentals can be returned'}), 400
        now = datetime.utcnow().isoformat()
        db.execute(
            'UPDATE rental_requests SET status = ?, return_date = ? WHERE id = ?',
            ['returned', now, rental_id]
        )
        _promote_next_or_release(db, rental['book_id'])

    elif new_status == 'declined':
        current_status = rental['status']
        db.execute(
            'UPDATE rental_requests SET status = ? WHERE id = ?',
            ['declined', rental_id]
        )
        if current_status == 'queued' and rental['queue_position'] is not None:
            _remove_from_queue(db, rental['book_id'], rental['queue_position'])

    db.commit()

    updated = query_db('SELECT * FROM rental_requests WHERE id = ?', [rental_id], one=True)
    return jsonify(updated)


@rentals_bp.route('/<rental_id>/reassign', methods=['PUT'])
@admin_required
def reassign_rental(rental_id):
    """Reassign a rental to a different reader (admin only).
    Accepts {reader_id: str, child_id?: str | null}.
    By default clears child_id since child belongs to old reader,
    unless new child_id is provided and belongs to the new reader."""
    rental = query_db('SELECT * FROM rental_requests WHERE id = ?', [rental_id], one=True)
    if not rental:
        return jsonify({'error': 'Rental not found'}), 404

    data = request.get_json()
    if not data or 'reader_id' not in data:
        return jsonify({'error': 'reader_id is required'}), 400

    new_reader_id = data['reader_id']
    new_child_id = data.get('child_id')

    if new_reader_id:
        reader = query_db('SELECT id FROM readers WHERE id = ?', [new_reader_id], one=True)
        if not reader:
            return jsonify({'error': 'Reader not found'}), 404

    if new_child_id:
        child = query_db('SELECT id FROM children WHERE id = ? AND reader_id = ?', [new_child_id, new_reader_id], one=True)
        if not child:
            return jsonify({'error': 'Child does not belong to the new reader'}), 400

    db = get_db()
    db.execute(
        'UPDATE rental_requests SET reader_id = ?, child_id = ? WHERE id = ?',
        [new_reader_id, new_child_id, rental_id]
    )

    # Also update renter_name to match the new reader's name (so journal display is clean)
    new_reader = query_db('SELECT parent_name, parent_surname FROM readers WHERE id = ?', [new_reader_id], one=True)
    if new_reader:
        new_name = f"{new_reader['parent_name']} {new_reader['parent_surname']}"
        db.execute('UPDATE rental_requests SET renter_name = ? WHERE id = ?', [new_name, rental_id])

    db.commit()

    updated = query_db('SELECT * FROM rental_requests WHERE id = ?', [rental_id], one=True)
    return jsonify(updated)


@rentals_bp.route('/cleanup-orphans', methods=['POST'])
@admin_required
def cleanup_orphan_rentals():
    """Find rentals with NULL or orphan reader_id whose trimmed renter_name
    unambiguously matches exactly ONE reader's 'parent_name parent_surname' or
    'parent_surname parent_name', and link them. Returns counts."""
    db = get_db()
    orphans = query_db("""
        SELECT id, renter_name FROM rental_requests
        WHERE reader_id IS NULL OR reader_id NOT IN (SELECT id FROM readers)
    """)
    readers = query_db('SELECT id, parent_name, parent_surname FROM readers')

    fixed = 0
    ambiguous = 0
    for rental in orphans:
        name_trim = (rental['renter_name'] or '').strip()
        if not name_trim:
            continue
        matches = []
        for r in readers:
            full1 = f"{r['parent_name']} {r['parent_surname']}".strip()
            full2 = f"{r['parent_surname']} {r['parent_name']}".strip()
            if name_trim == full1 or name_trim == full2:
                matches.append(r['id'])
        if len(matches) == 1:
            db.execute('UPDATE rental_requests SET reader_id = ? WHERE id = ?', [matches[0], rental['id']])
            fixed += 1
        elif len(matches) > 1:
            ambiguous += 1

    db.commit()
    return jsonify({'fixed': fixed, 'ambiguous': ambiguous, 'total_orphans': len(orphans)})


@rentals_bp.route('/queue/<book_id>', methods=['GET'])
@admin_required
def get_queue(book_id):
    """Get queue entries for a book. Admin only."""
    entries = query_db(
        '''SELECT id, renter_name, queue_position, requested_at
           FROM rental_requests
           WHERE book_id = ? AND status = 'queued'
           ORDER BY queue_position ASC''',
        [book_id]
    )
    return jsonify(entries)
