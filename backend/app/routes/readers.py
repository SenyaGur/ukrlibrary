import uuid
from flask import Blueprint, request, jsonify

from app.auth import admin_required
from app.database import get_db, query_db

readers_bp = Blueprint('readers', __name__, url_prefix='/api/readers')
children_bp = Blueprint('children', __name__, url_prefix='/api/children')


@readers_bp.route('', methods=['GET'])
@admin_required
def get_readers():
    """Get all readers with their children. Admin only."""
    readers = query_db('SELECT * FROM readers ORDER BY parent_surname, parent_name')

    for reader in readers:
        children = query_db(
            'SELECT * FROM children WHERE reader_id = ? ORDER BY surname, name',
            [reader['id']]
        )
        reader['children'] = children

    return jsonify(readers)


@readers_bp.route('/<reader_id>', methods=['GET'])
@admin_required
def get_reader(reader_id):
    """Get a single reader by ID with children. Admin only."""
    reader = query_db('SELECT * FROM readers WHERE id = ?', [reader_id], one=True)
    if not reader:
        return jsonify({'error': 'Reader not found'}), 404

    children = query_db(
        'SELECT * FROM children WHERE reader_id = ? ORDER BY surname, name',
        [reader_id]
    )
    reader['children'] = children

    return jsonify(reader)


@readers_bp.route('', methods=['POST'])
def create_reader():
    """Create a new reader with optional children. No auth required (public registration)."""
    data = request.get_json()
    if not data:
        return jsonify({'error': 'Request body is required'}), 400

    required = ['parent_name', 'parent_surname', 'phone1', 'address']
    for field in required:
        if not data.get(field):
            return jsonify({'error': f'{field} is required'}), 400

    reader_id = str(uuid.uuid4())
    db = get_db()
    db.execute(
        'INSERT INTO readers (id, parent_name, parent_surname, phone1, phone2, email, address, comment) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [reader_id, data['parent_name'], data['parent_surname'], data['phone1'],
         data.get('phone2'), data.get('email', ''), data['address'], data.get('comment', '')]
    )

    # Create children if provided
    children_data = data.get('children', [])
    for child in children_data:
        child_id = str(uuid.uuid4())
        db.execute(
            'INSERT INTO children (id, reader_id, name, surname, birth_date, gender) VALUES (?, ?, ?, ?, ?, ?)',
            [child_id, reader_id, child['name'], child['surname'], child['birth_date'], child.get('gender', '')]
        )

    db.commit()

    reader = query_db('SELECT * FROM readers WHERE id = ?', [reader_id], one=True)
    reader['children'] = query_db('SELECT * FROM children WHERE reader_id = ?', [reader_id])
    return jsonify(reader), 201


@readers_bp.route('/<reader_id>/children', methods=['GET'])
@admin_required
def get_reader_children(reader_id):
    """Get children for a specific reader. Admin only."""
    reader = query_db('SELECT id FROM readers WHERE id = ?', [reader_id], one=True)
    if not reader:
        return jsonify({'error': 'Reader not found'}), 404

    children = query_db(
        'SELECT * FROM children WHERE reader_id = ? ORDER BY surname, name',
        [reader_id]
    )
    return jsonify(children)


@readers_bp.route('/<reader_id>', methods=['PUT'])
@admin_required
def update_reader(reader_id):
    """Update a reader's info. Admin only."""
    reader = query_db('SELECT * FROM readers WHERE id = ?', [reader_id], one=True)
    if not reader:
        return jsonify({'error': 'Reader not found'}), 404

    data = request.get_json()
    if not data:
        return jsonify({'error': 'Request body is required'}), 400

    allowed_fields = ['parent_name', 'parent_surname', 'phone1', 'phone2', 'email', 'address', 'comment']
    set_clauses = []
    args = []
    for field in allowed_fields:
        if field in data:
            set_clauses.append(f'{field} = ?')
            args.append(data[field])

    if not set_clauses:
        return jsonify({'error': 'No fields to update'}), 400

    args.append(reader_id)
    db = get_db()
    db.execute(f'UPDATE readers SET {", ".join(set_clauses)} WHERE id = ?', args)
    db.commit()

    updated = query_db('SELECT * FROM readers WHERE id = ?', [reader_id], one=True)
    updated['children'] = query_db('SELECT * FROM children WHERE reader_id = ?', [reader_id])
    return jsonify(updated)


@readers_bp.route('/<reader_id>', methods=['DELETE'])
@admin_required
def delete_reader(reader_id):
    """Delete a reader and their children (cascade). Admin only."""
    reader = query_db('SELECT * FROM readers WHERE id = ?', [reader_id], one=True)
    if not reader:
        return jsonify({'error': 'Reader not found'}), 404

    db = get_db()
    # Detach rentals referencing this reader or their children
    child_ids = [c['id'] for c in query_db('SELECT id FROM children WHERE reader_id = ?', [reader_id])]
    db.execute('UPDATE rental_requests SET reader_id = NULL WHERE reader_id = ?', [reader_id])
    for cid in child_ids:
        db.execute('UPDATE rental_requests SET child_id = NULL WHERE child_id = ?', [cid])
    db.execute('DELETE FROM children WHERE reader_id = ?', [reader_id])
    db.execute('DELETE FROM readers WHERE id = ?', [reader_id])
    db.commit()

    return jsonify({'message': 'Reader deleted successfully'})


@readers_bp.route('/<reader_id>/merge', methods=['POST'])
@admin_required
def merge_reader(reader_id):
    """Merge a reader into another. Moves children and rentals, then deletes source. Admin only."""
    reader = query_db('SELECT * FROM readers WHERE id = ?', [reader_id], one=True)
    if not reader:
        return jsonify({'error': 'Reader not found'}), 404

    data = request.get_json()
    if not data or not data.get('target_reader_id'):
        return jsonify({'error': 'target_reader_id is required'}), 400

    target_id = data['target_reader_id']
    if target_id == reader_id:
        return jsonify({'error': 'Cannot merge reader into themselves'}), 400

    target = query_db('SELECT id FROM readers WHERE id = ?', [target_id], one=True)
    if not target:
        return jsonify({'error': 'Target reader not found'}), 404

    db = get_db()

    # Move children to target
    db.execute('UPDATE children SET reader_id = ? WHERE reader_id = ?', [target_id, reader_id])

    # Move rentals to target
    db.execute('UPDATE rental_requests SET reader_id = ? WHERE reader_id = ?', [target_id, reader_id])

    # Delete source reader
    db.execute('DELETE FROM readers WHERE id = ?', [reader_id])
    db.commit()

    updated = query_db('SELECT * FROM readers WHERE id = ?', [target_id], one=True)
    updated['children'] = query_db('SELECT * FROM children WHERE reader_id = ?', [target_id])
    return jsonify(updated)


@readers_bp.route('/<reader_id>/convert-to-child', methods=['POST'])
@admin_required
def convert_to_child(reader_id):
    """Convert a reader into a child of another reader. Admin only.
    Moves rentals and existing children to the target parent, then deletes the old reader."""
    reader = query_db('SELECT * FROM readers WHERE id = ?', [reader_id], one=True)
    if not reader:
        return jsonify({'error': 'Reader not found'}), 404

    data = request.get_json()
    if not data or not data.get('parent_reader_id'):
        return jsonify({'error': 'parent_reader_id is required'}), 400

    parent_reader_id = data['parent_reader_id']
    if parent_reader_id == reader_id:
        return jsonify({'error': 'Cannot convert reader to child of themselves'}), 400

    parent_reader = query_db('SELECT id FROM readers WHERE id = ?', [parent_reader_id], one=True)
    if not parent_reader:
        return jsonify({'error': 'Target parent reader not found'}), 404

    db = get_db()

    # Create child under target parent
    child_id = str(uuid.uuid4())
    db.execute(
        'INSERT INTO children (id, reader_id, name, surname, birth_date, gender) VALUES (?, ?, ?, ?, ?, ?)',
        [child_id, parent_reader_id, reader['parent_name'], reader['parent_surname'], '', '']
    )

    # Move existing children of old reader to new parent
    db.execute('UPDATE children SET reader_id = ? WHERE reader_id = ?', [parent_reader_id, reader_id])

    # Move rental requests to new parent
    db.execute('UPDATE rental_requests SET reader_id = ? WHERE reader_id = ?', [parent_reader_id, reader_id])

    # Delete the old reader
    db.execute('DELETE FROM readers WHERE id = ?', [reader_id])

    db.commit()

    updated_parent = query_db('SELECT * FROM readers WHERE id = ?', [parent_reader_id], one=True)
    updated_parent['children'] = query_db('SELECT * FROM children WHERE reader_id = ?', [parent_reader_id])
    return jsonify(updated_parent)


@readers_bp.route('/<reader_id>/children', methods=['POST'])
@admin_required
def add_child(reader_id):
    """Add a child to a reader. Admin only."""
    reader = query_db('SELECT id FROM readers WHERE id = ?', [reader_id], one=True)
    if not reader:
        return jsonify({'error': 'Reader not found'}), 404

    data = request.get_json()
    if not data:
        return jsonify({'error': 'Request body is required'}), 400

    if not data.get('name'):
        return jsonify({'error': 'name is required'}), 400
    if not data.get('birth_date'):
        return jsonify({'error': 'birth_date is required'}), 400

    child_id = str(uuid.uuid4())
    db = get_db()
    db.execute(
        'INSERT INTO children (id, reader_id, name, surname, birth_date, gender) VALUES (?, ?, ?, ?, ?, ?)',
        [child_id, reader_id, data['name'], data.get('surname', ''), data['birth_date'], data.get('gender', '')]
    )
    db.commit()

    child = query_db('SELECT * FROM children WHERE id = ?', [child_id], one=True)
    return jsonify(child), 201


@readers_bp.route('/<reader_id>/children/<child_id>', methods=['PUT'])
@admin_required
def update_child(reader_id, child_id):
    """Update a child's info. Admin only."""
    child = query_db('SELECT * FROM children WHERE id = ? AND reader_id = ?', [child_id, reader_id], one=True)
    if not child:
        return jsonify({'error': 'Child not found'}), 404

    data = request.get_json()
    if not data:
        return jsonify({'error': 'Request body is required'}), 400

    allowed_fields = ['name', 'surname', 'birth_date', 'gender']
    set_clauses = []
    args = []
    for field in allowed_fields:
        if field in data:
            set_clauses.append(f'{field} = ?')
            args.append(data[field])

    if not set_clauses:
        return jsonify({'error': 'No fields to update'}), 400

    args.append(child_id)
    db = get_db()
    db.execute(f'UPDATE children SET {", ".join(set_clauses)} WHERE id = ?', args)
    db.commit()

    updated = query_db('SELECT * FROM children WHERE id = ?', [child_id], one=True)
    return jsonify(updated)


@readers_bp.route('/<reader_id>/children/<child_id>', methods=['DELETE'])
@admin_required
def delete_child(reader_id, child_id):
    """Delete a child. Admin only."""
    child = query_db('SELECT * FROM children WHERE id = ? AND reader_id = ?', [child_id, reader_id], one=True)
    if not child:
        return jsonify({'error': 'Child not found'}), 404

    db = get_db()
    db.execute('UPDATE rental_requests SET child_id = NULL WHERE child_id = ?', [child_id])
    db.execute('DELETE FROM children WHERE id = ?', [child_id])
    db.commit()

    return jsonify({'message': 'Child deleted successfully'})


@children_bp.route('/<child_id>/reassign', methods=['PUT'])
@admin_required
def reassign_child(child_id):
    """Reassign a child to a different reader. Admin only."""
    child = query_db('SELECT * FROM children WHERE id = ?', [child_id], one=True)
    if not child:
        return jsonify({'error': 'Child not found'}), 404

    data = request.get_json()
    if not data or not data.get('reader_id'):
        return jsonify({'error': 'reader_id is required'}), 400

    new_reader = query_db('SELECT id FROM readers WHERE id = ?', [data['reader_id']], one=True)
    if not new_reader:
        return jsonify({'error': 'Target reader not found'}), 404

    db = get_db()
    db.execute('UPDATE children SET reader_id = ? WHERE id = ?', [data['reader_id'], child_id])
    db.commit()

    updated = query_db('SELECT * FROM children WHERE id = ?', [child_id], one=True)
    return jsonify(updated)
