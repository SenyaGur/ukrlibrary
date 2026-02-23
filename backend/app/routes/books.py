import uuid
from flask import Blueprint, request, jsonify

from app.auth import admin_required
from app.database import get_db, query_db

books_bp = Blueprint('books', __name__, url_prefix='/api/books')


def _enrich_book(book):
    """Add joined publisher/series data and convert integer flags to booleans."""
    enriched = dict(book)

    # Convert 0/1 integers to booleans
    enriched['available'] = bool(enriched.get('available'))
    enriched['new_book'] = bool(enriched.get('new_book'))

    # Join publisher data
    if enriched.get('publisher_id'):
        publisher = query_db(
            'SELECT name, city FROM publishers WHERE id = ?',
            [enriched['publisher_id']],
            one=True
        )
        enriched['publishers'] = publisher
    else:
        enriched['publishers'] = None

    # Join series data
    if enriched.get('series_id'):
        series = query_db(
            'SELECT name FROM series WHERE id = ?',
            [enriched['series_id']],
            one=True
        )
        enriched['series'] = series
    else:
        enriched['series'] = None

    return enriched


@books_bp.route('', methods=['GET'])
def get_books():
    """Get all books with optional filtering, joined publisher and series data."""
    category = request.args.get('category')
    search = request.args.get('search')
    available = request.args.get('available')

    query = 'SELECT * FROM books WHERE 1=1'
    args = []

    if category:
        query += ' AND category = ?'
        args.append(category)

    if search:
        query += ' AND (title LIKE ? OR author LIKE ?)'
        search_term = f'%{search}%'
        args.extend([search_term, search_term])

    if available is not None:
        query += ' AND available = ?'
        args.append(int(available))

    query += ' ORDER BY title ASC'

    books = query_db(query, args)
    return jsonify([_enrich_book(b) for b in books])


@books_bp.route('/filters', methods=['GET'])
def get_filters():
    """Return unique filter values for the book catalog."""
    categories = [r['category'] for r in query_db(
        'SELECT DISTINCT category FROM books WHERE category IS NOT NULL AND category != "" ORDER BY category'
    )]
    authors = [r['author'] for r in query_db(
        'SELECT DISTINCT author FROM books WHERE author IS NOT NULL AND author != "" ORDER BY author'
    )]
    ages = [r['age'] for r in query_db(
        'SELECT DISTINCT age FROM books WHERE age IS NOT NULL AND age != "" ORDER BY age'
    )]
    publishers = [r['name'] for r in query_db(
        'SELECT DISTINCT name FROM publishers ORDER BY name'
    )]
    series_list = [r['name'] for r in query_db(
        'SELECT DISTINCT name FROM series ORDER BY name'
    )]

    return jsonify({
        'categories': categories,
        'authors': authors,
        'ages': ages,
        'publishers': publishers,
        'series': series_list,
    })


@books_bp.route('', methods=['POST'])
@admin_required
def create_book():
    """Create a new book."""
    data = request.get_json()
    if not data:
        return jsonify({'error': 'Request body is required'}), 400

    required = ['title', 'author', 'category']
    for field in required:
        if not data.get(field):
            return jsonify({'error': f'{field} is required'}), 400

    book_id = str(uuid.uuid4())
    db = get_db()
    db.execute(
        '''INSERT INTO books (id, title, author, category, category_id, series_id, publisher_id,
           cover_color, cover_image_url, available, description, age, publication_year, isbn,
           inventory_number, supplier, new_book)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)''',
        [
            book_id,
            data['title'],
            data['author'],
            data['category'],
            data.get('category_id'),
            data.get('series_id'),
            data.get('publisher_id'),
            data.get('cover_color', '#4A90E2'),
            data.get('cover_image_url'),
            data.get('available', 1),
            data.get('description'),
            data.get('age'),
            data.get('publication_year'),
            data.get('isbn'),
            data.get('inventory_number'),
            data.get('supplier'),
            data.get('new_book', 0)
        ]
    )
    db.commit()

    book = query_db('SELECT * FROM books WHERE id = ?', [book_id], one=True)
    return jsonify(_enrich_book(book)), 201


@books_bp.route('/<book_id>', methods=['PUT'])
@admin_required
def update_book(book_id):
    """Update an existing book."""
    book = query_db('SELECT * FROM books WHERE id = ?', [book_id], one=True)
    if not book:
        return jsonify({'error': 'Book not found'}), 404

    data = request.get_json()
    if not data:
        return jsonify({'error': 'Request body is required'}), 400

    fields = [
        'title', 'author', 'category', 'category_id', 'series_id', 'publisher_id',
        'cover_color', 'cover_image_url', 'available', 'description', 'age',
        'publication_year', 'isbn', 'inventory_number', 'supplier', 'new_book'
    ]

    set_clauses = []
    args = []
    for field in fields:
        if field in data:
            set_clauses.append(f'{field} = ?')
            args.append(data[field])

    if not set_clauses:
        return jsonify({'error': 'No fields to update'}), 400

    set_clauses.append("updated_at = CURRENT_TIMESTAMP")
    args.append(book_id)

    db = get_db()
    db.execute(
        f'UPDATE books SET {", ".join(set_clauses)} WHERE id = ?',
        args
    )
    db.commit()

    updated = query_db('SELECT * FROM books WHERE id = ?', [book_id], one=True)
    return jsonify(_enrich_book(updated))


@books_bp.route('/<book_id>', methods=['DELETE'])
@admin_required
def delete_book(book_id):
    """Delete a book (admin only). Refuses if the book has active (approved) rentals."""
    book = query_db('SELECT * FROM books WHERE id = ?', [book_id], one=True)
    if not book:
        return jsonify({'error': 'Book not found'}), 404

    active = query_db(
        "SELECT id FROM rental_requests WHERE book_id = ? AND status IN ('approved', 'pending', 'queued')",
        [book_id], one=True
    )
    if active:
        return jsonify({'error': 'Cannot delete a book with active rentals'}), 400

    db = get_db()
    db.execute('DELETE FROM book_media WHERE book_id = ?', [book_id])
    db.execute('DELETE FROM rental_requests WHERE book_id = ?', [book_id])
    db.execute('DELETE FROM books WHERE id = ?', [book_id])
    db.commit()

    return jsonify({'message': 'Book deleted successfully'})


@books_bp.route('/<book_id>/duplicate', methods=['POST'])
@admin_required
def duplicate_book(book_id):
    """Create a new copy of a book with the same metadata (admin only)."""
    book = query_db('SELECT * FROM books WHERE id = ?', [book_id], one=True)
    if not book:
        return jsonify({'error': 'Book not found'}), 404

    new_id = str(uuid.uuid4())
    db = get_db()
    db.execute(
        '''INSERT INTO books (id, title, author, category, category_id, series_id, publisher_id,
           cover_color, cover_image_url, available, description, age, publication_year, isbn,
           inventory_number, supplier, new_book)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)''',
        [
            new_id,
            book['title'],
            book['author'],
            book['category'],
            book['category_id'],
            book['series_id'],
            book['publisher_id'],
            book['cover_color'],
            book['cover_image_url'],
            1,  # new copy is always available
            book['description'],
            book['age'],
            book['publication_year'],
            book['isbn'],
            book['inventory_number'],
            book['supplier'],
            book['new_book'],
        ]
    )
    db.commit()

    new_book = query_db('SELECT * FROM books WHERE id = ?', [new_id], one=True)
    return jsonify(_enrich_book(new_book)), 201


@books_bp.route('/<book_id>/force-available', methods=['PUT'])
@admin_required
def force_book_available(book_id):
    """Force a book to be available, marking any approved rentals as returned."""
    book = query_db('SELECT * FROM books WHERE id = ?', [book_id], one=True)
    if not book:
        return jsonify({'error': 'Book not found'}), 404

    db = get_db()
    db.execute('UPDATE books SET available = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [book_id])
    db.execute(
        "UPDATE rental_requests SET status = 'returned', return_date = CURRENT_TIMESTAMP WHERE book_id = ? AND status = 'approved'",
        [book_id]
    )
    db.commit()

    updated = query_db('SELECT * FROM books WHERE id = ?', [book_id], one=True)
    return jsonify(_enrich_book(updated))


@books_bp.route('/<book_id>/media', methods=['GET'])
def get_book_media(book_id):
    """Get all media for a book (public)."""
    book = query_db('SELECT id FROM books WHERE id = ?', [book_id], one=True)
    if not book:
        return jsonify({'error': 'Book not found'}), 404

    media = query_db(
        'SELECT * FROM book_media WHERE book_id = ? ORDER BY display_order',
        [book_id]
    )
    return jsonify(media)


@books_bp.route('/<book_id>/media', methods=['POST'])
@admin_required
def add_book_media(book_id):
    """Add a media record to a book (admin only)."""
    book = query_db('SELECT id FROM books WHERE id = ?', [book_id], one=True)
    if not book:
        return jsonify({'error': 'Book not found'}), 404

    data = request.get_json()
    if not data:
        return jsonify({'error': 'Request body is required'}), 400

    media_id = str(uuid.uuid4())
    db = get_db()
    db.execute(
        'INSERT INTO book_media (id, book_id, file_url, file_type, display_order) VALUES (?, ?, ?, ?, ?)',
        [
            media_id,
            book_id,
            data.get('file_url', ''),
            data.get('file_type', 'image'),
            data.get('display_order', 0)
        ]
    )
    db.commit()

    media = query_db('SELECT * FROM book_media WHERE id = ?', [media_id], one=True)
    return jsonify(media), 201


@books_bp.route('/media/<media_id>', methods=['DELETE'])
@admin_required
def delete_book_media(media_id):
    """Delete a media record (admin only)."""
    media = query_db('SELECT * FROM book_media WHERE id = ?', [media_id], one=True)
    if not media:
        return jsonify({'error': 'Media not found'}), 404

    db = get_db()
    db.execute('DELETE FROM book_media WHERE id = ?', [media_id])
    db.commit()

    return jsonify({'message': 'Media deleted successfully'})


@books_bp.route('/import', methods=['POST'])
@admin_required
def import_books():
    """Import books from Excel data (admin only).

    Accepts { booksData: [...] } where each item has book fields.
    For each book, get-or-create category/series/publisher, then insert.
    Returns { success, failed, errors }.
    """
    data = request.get_json()
    if not data or 'booksData' not in data:
        return jsonify({'error': 'booksData is required'}), 400

    books_data = data['booksData']
    db = get_db()
    success = 0
    failed = 0
    errors = []

    for idx, book_data in enumerate(books_data):
        try:
            title = book_data.get('title', '').strip()
            author = book_data.get('author', '').strip()
            category_name = book_data.get('category', '').strip()

            if not title or not author or not category_name:
                raise ValueError('title, author and category are required')

            # Get or create category
            cat = query_db('SELECT id FROM categories WHERE name = ?', [category_name], one=True)
            if not cat:
                cat_id = str(uuid.uuid4())
                db.execute('INSERT INTO categories (id, name) VALUES (?, ?)', [cat_id, category_name])
            else:
                cat_id = cat['id']

            # Get or create series (optional)
            series_id = None
            series_name = book_data.get('series', '').strip() if book_data.get('series') else ''
            if series_name:
                s = query_db('SELECT id FROM series WHERE name = ?', [series_name], one=True)
                if not s:
                    series_id = str(uuid.uuid4())
                    db.execute('INSERT INTO series (id, name) VALUES (?, ?)', [series_id, series_name])
                else:
                    series_id = s['id']

            # Get or create publisher (optional)
            publisher_id = None
            publisher_name = book_data.get('publisher', '').strip() if book_data.get('publisher') else ''
            if publisher_name:
                p = query_db('SELECT id FROM publishers WHERE name = ?', [publisher_name], one=True)
                if not p:
                    publisher_id = str(uuid.uuid4())
                    publisher_city = book_data.get('publisher_city', '').strip() if book_data.get('publisher_city') else ''
                    db.execute(
                        'INSERT INTO publishers (id, name, city) VALUES (?, ?, ?)',
                        [publisher_id, publisher_name, publisher_city]
                    )
                else:
                    publisher_id = p['id']

            book_id = str(uuid.uuid4())
            db.execute(
                '''INSERT INTO books (id, title, author, category, category_id, series_id, publisher_id,
                   cover_color, cover_image_url, available, description, age, publication_year, isbn,
                   inventory_number, supplier, new_book)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)''',
                [
                    book_id,
                    title,
                    author,
                    category_name,
                    cat_id,
                    series_id,
                    publisher_id,
                    book_data.get('cover_color', '#4A90E2'),
                    book_data.get('cover_image_url'),
                    book_data.get('available', 1),
                    book_data.get('description'),
                    book_data.get('age'),
                    book_data.get('publication_year'),
                    book_data.get('isbn'),
                    book_data.get('inventory_number'),
                    book_data.get('supplier'),
                    book_data.get('new_book', 0)
                ]
            )
            success += 1

        except Exception as e:
            failed += 1
            errors.append(f'Row {idx + 1}: {str(e)}')

    db.commit()

    return jsonify({
        'success': success,
        'failed': failed,
        'errors': errors,
    })
