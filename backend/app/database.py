import os
import sqlite3
from contextlib import contextmanager
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


@contextmanager
def immediate_transaction(db):
    """Serialize read/write decisions and roll back every uncommitted exit."""
    try:
        db.execute('BEGIN IMMEDIATE')
        yield
    finally:
        if db.in_transaction:
            db.rollback()


def _column_exists(db, table, column):
    """Inspect migration columns without taking a write lock."""
    existing = {row[1] for row in db.execute(f'PRAGMA table_info({table})')}
    return column in existing


def init_db():
    """Initialize the database from schema.sql and create upload directories."""
    db = get_db()
    db.execute('PRAGMA busy_timeout = 30000')

    schema_path = os.path.join(os.path.dirname(__file__), 'schema.sql')
    with open(schema_path, 'r') as f:
        db.executescript(f.read())

    migrations = [
        ('rental_requests', 'queue_position',
         'ALTER TABLE rental_requests ADD COLUMN queue_position INTEGER DEFAULT NULL'),
        ('readers', 'email', "ALTER TABLE readers ADD COLUMN email TEXT DEFAULT ''"),
        ('books', 'archived_at', 'ALTER TABLE books ADD COLUMN archived_at DATETIME'),
    ]
    # Already-migrated workers can boot while another connection holds a write lock.
    if any(not _column_exists(db, table, column) for table, column, _ in migrations):
        with immediate_transaction(db):
            # Another worker may have migrated while this connection waited.
            for table, column, ddl in migrations:
                if not _column_exists(db, table, column):
                    db.execute(ddl)
            db.commit()

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
