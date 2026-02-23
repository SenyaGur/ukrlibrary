import uuid
from datetime import datetime
from flask import Blueprint, request, jsonify

from app.auth import admin_required
from app.database import get_db, query_db

rentals_bp = Blueprint('rentals', __name__, url_prefix='/api/rentals')


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
def get_rentals():
    """Get all rental requests. Supports ?reader_id=xxx filter. No auth required."""
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

    # Check book availability
    book = query_db('SELECT available FROM books WHERE id = ?', [data['book_id']], one=True)
    if not book:
        return jsonify({'error': 'Book not found'}), 404

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
    rental = query_db('SELECT * FROM rental_requests WHERE id = ?', [rental_id], one=True)
    if not rental:
        return jsonify({'error': 'Rental request not found'}), 404

    data = request.get_json()
    if not data or 'status' not in data:
        return jsonify({'error': 'status is required'}), 400

    new_status = data['status']
    if new_status not in ('approved', 'declined', 'returned'):
        return jsonify({'error': 'status must be "approved", "declined", or "returned"'}), 400

    db = get_db()

    if new_status == 'approved':
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


@rentals_bp.route('/queue/<book_id>', methods=['GET'])
def get_queue(book_id):
    """Get queue entries for a book."""
    entries = query_db(
        '''SELECT id, renter_name, queue_position, requested_at
           FROM rental_requests
           WHERE book_id = ? AND status = 'queued'
           ORDER BY queue_position ASC''',
        [book_id]
    )
    return jsonify(entries)
