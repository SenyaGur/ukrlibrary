import os
import uuid
from flask import Blueprint, request, jsonify, current_app

from app.auth import admin_required
from app.database import get_db, query_db

upload_bp = Blueprint('upload', __name__, url_prefix='/api/upload')

ALLOWED_IMAGE_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'webp'}
ALLOWED_MEDIA_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'webp', 'mp4', 'mp3', 'pdf'}


def allowed_file(filename, allowed_extensions):
    """Check if a filename has an allowed extension."""
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in allowed_extensions


@upload_bp.route('/book-covers', methods=['POST'])
@admin_required
def upload_cover():
    """Upload a book cover image."""
    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400

    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No file selected'}), 400

    if not allowed_file(file.filename, ALLOWED_IMAGE_EXTENSIONS):
        return jsonify({'error': 'File type not allowed'}), 400

    ext = file.filename.rsplit('.', 1)[1].lower()
    filename = f'{uuid.uuid4()}.{ext}'
    upload_folder = current_app.config['UPLOAD_FOLDER']
    filepath = os.path.join(upload_folder, 'book-covers', filename)

    file.save(filepath)

    url = f'/uploads/book-covers/{filename}'
    return jsonify({'url': url, 'filename': filename}), 201


@upload_bp.route('/book-media', methods=['POST'])
@admin_required
def upload_media():
    """Upload book media (images, videos, PDFs)."""
    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400

    file = request.files['file']
    book_id = request.form.get('book_id')

    if file.filename == '':
        return jsonify({'error': 'No file selected'}), 400

    if not allowed_file(file.filename, ALLOWED_MEDIA_EXTENSIONS):
        return jsonify({'error': 'File type not allowed'}), 400

    ext = file.filename.rsplit('.', 1)[1].lower()
    filename = f'{uuid.uuid4()}.{ext}'
    upload_folder = current_app.config['UPLOAD_FOLDER']
    filepath = os.path.join(upload_folder, 'book-media', filename)

    file.save(filepath)

    url = f'/uploads/book-media/{filename}'

    # If book_id is provided, create a book_media record
    if book_id:
        media_id = str(uuid.uuid4())
        file_type = 'image' if ext in ALLOWED_IMAGE_EXTENSIONS else ext
        display_order = 0

        # Get next display order
        existing = query_db(
            'SELECT MAX(display_order) as max_order FROM book_media WHERE book_id = ?',
            [book_id],
            one=True
        )
        if existing and existing['max_order'] is not None:
            display_order = existing['max_order'] + 1

        db = get_db()
        db.execute(
            'INSERT INTO book_media (id, book_id, file_url, file_type, display_order) VALUES (?, ?, ?, ?, ?)',
            [media_id, book_id, url, file_type, display_order]
        )
        db.commit()

        media = query_db('SELECT * FROM book_media WHERE id = ?', [media_id], one=True)
        return jsonify(media), 201

    return jsonify({'url': url, 'filename': filename}), 201
