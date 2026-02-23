import os
import sqlite3
from flask import g, current_app


def get_db():
    """Get a database connection stored in Flask's g object."""
    if 'db' not in g:
        db_path = current_app.config['DATABASE_PATH']
        g.db = sqlite3.connect(db_path)
        g.db.row_factory = sqlite3.Row
        g.db.execute('PRAGMA foreign_keys = ON')
    return g.db


def close_db(e=None):
    """Close the database connection on app teardown."""
    db = g.pop('db', None)
    if db is not None:
        db.close()


def init_db():
    """Initialize the database from schema.sql and create upload directories."""
    db = get_db()

    schema_path = os.path.join(os.path.dirname(__file__), 'schema.sql')
    with open(schema_path, 'r') as f:
        db.executescript(f.read())

    # Migrations for existing databases
    try:
        db.execute('ALTER TABLE rental_requests ADD COLUMN queue_position INTEGER DEFAULT NULL')
        db.commit()
    except Exception:
        pass  # Column already exists

    # Create upload directories
    upload_folder = current_app.config['UPLOAD_FOLDER']
    os.makedirs(os.path.join(upload_folder, 'book-covers'), exist_ok=True)
    os.makedirs(os.path.join(upload_folder, 'book-media'), exist_ok=True)


def query_db(query, args=(), one=False):
    """Execute a query and return results as list of dicts."""
    db = get_db()
    cursor = db.execute(query, args)
    rows = cursor.fetchall()
    results = [dict(row) for row in rows]
    return results[0] if one and results else (None if one else results)
