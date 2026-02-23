CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    full_name TEXT,
    role TEXT DEFAULT 'user' CHECK(role IN ('admin', 'user')),
    avatar_url TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS series (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS publishers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    city TEXT NOT NULL DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS books (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    author TEXT NOT NULL,
    category TEXT NOT NULL,
    category_id TEXT REFERENCES categories(id),
    series_id TEXT REFERENCES series(id),
    publisher_id TEXT REFERENCES publishers(id),
    cover_color TEXT NOT NULL DEFAULT '#4A90E2',
    cover_image_url TEXT,
    available INTEGER DEFAULT 1,
    description TEXT,
    age TEXT,
    publication_year TEXT,
    isbn TEXT,
    inventory_number INTEGER,
    supplier TEXT,
    new_book INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS readers (
    id TEXT PRIMARY KEY,
    parent_name TEXT NOT NULL,
    parent_surname TEXT NOT NULL,
    phone1 TEXT NOT NULL,
    phone2 TEXT,
    email TEXT DEFAULT '',
    address TEXT NOT NULL,
    comment TEXT DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS children (
    id TEXT PRIMARY KEY,
    reader_id TEXT NOT NULL REFERENCES readers(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    surname TEXT NOT NULL,
    birth_date TEXT NOT NULL,
    gender TEXT DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS rental_requests (
    id TEXT PRIMARY KEY,
    book_id TEXT NOT NULL REFERENCES books(id),
    book_title TEXT NOT NULL,
    renter_name TEXT NOT NULL,
    renter_phone TEXT NOT NULL,
    renter_email TEXT NOT NULL,
    rental_duration INTEGER NOT NULL,
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'declined', 'returned', 'queued')),
    queue_position INTEGER DEFAULT NULL,
    reader_id TEXT REFERENCES readers(id),
    child_id TEXT REFERENCES children(id),
    requested_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    approved_at DATETIME,
    return_date DATETIME
);

CREATE TABLE IF NOT EXISTS book_media (
    id TEXT PRIMARY KEY,
    book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    file_url TEXT NOT NULL,
    file_type TEXT NOT NULL,
    display_order INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
