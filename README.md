# Бібліотечка Українського дитячого клубу

A web application for a Ukrainian children's lending library. Parents browse the catalog, request book rentals, and manage their reading history. Admins manage the full inventory — books, readers, categories, series, publishers — through a dedicated dashboard.

## Features

- **Public catalog** — browse books by category, series, publisher, age group; search and filter; view book details and media
- **Rental requests** — parents submit rental requests with duration; admins approve, decline, or queue reservations
- **Reader management** — full CRUD for readers (parents) and their children; merge readers, reassign children between families, convert a reader entry into a child
- **Admin dashboard** — manage books, categories, series, publishers, users, and rental requests; bulk import from Excel; journal of all past rentals
- **Queue system** — when a book is unavailable, new requests are queued with automatic position tracking and promotion
- **Authentication** — JWT-based auth with role separation (admin / user), bcrypt password hashing
- **Responsive UI** — works on desktop and mobile; light/dark mode support

### Admin inventory search

- In the book picker for issuing loans, a digits-only query matches the **entire inventory number**: `12` never matches `123` or `112`. All copies with that exact number are returned, including unavailable copies; already-selected copies are excluded.
- Numeric queries do not fall back to title or author search when no inventory number matches. Other text uses case-insensitive title/author substring matching (for example, `12 adventures` searches the title).
- Surrounding whitespace is ignored; an empty or whitespace-only picker query shows the usual unfiltered choices. Inventory numbers use their stored integer spelling: `0012` does not match `12`.
- The separate inventory fields in Requests, Book Management and Journal retain their existing exact-match behavior. The public catalog and other title-only searches are unchanged.

### Admin issuance and receipts

- Select a reader, then a child and that child's books. **Додати іншу дитину** adds a separate child/list; one **Видати** button processes all lists. Readers without children receive books directly. Each loan still stores its own `child_id`; no schema change.
- Age warnings apply to each selected child's books and do not block issuance. A copy already selected for one child cannot be selected again for another.
- The same dialog shows issued books grouped by child, with clean print and explicit email actions. Email is never sent automatically; it uses the reader's current stored email and the existing SMTP/SES configuration. Without an email, the button is disabled with an explanation. Update the reader's card to change their email.
- Receipt email accepts `{reader_id, rental_ids}` at `POST /api/rentals/receipt/send`; the server resolves the recipient, child names and loan details from the database and rejects loans not currently issued to that reader.
- Issuance uses the existing sequential loan API, not an atomic batch. If a request fails, successful loans remain issued and printable; the dialog retains only unprocessed books for continuation. Unavailable copies retain the existing reservation-queue behavior.
- New-book and **+1** dialogs prefill the smallest unused positive inventory number on every open. Suggestions are not reservations: another administrator may save the same number first. Users can edit the number.
- For local verification, use a temporary synthetic database, disable dotenv loading, and replace `app.mailer.send_email` with a local capture before creating the app. Never exercise these actions against real recipients or SES during development.

### Inventory allocation and duplicate audit

- Inventory numbers for new books/copies are required positive integers. `GET /api/books/inventory-suggestions?count=3` (admin-only; positive count, default 1) returns `next_inventory_number` and ascending `suggested_inventory_numbers`. An empty inventory suggests `1`; with `1, 2, 4` used, three suggestions are `3, 5, 6`. Numbers no longer used by any existing copy may be reused.
- Book creation, **+1**, HTTP bulk import and inventory edits serialize their check-and-write with SQLite `BEGIN IMMEDIATE`. Conflicting saves return HTTP `409`, `code: inventory_conflict`, a Ukrainian error, the current smallest free number and suggested replacements. Bulk conflicts include one-based input row numbers and reject the whole batch without inserting any rows.
- Dialogs retain the entered number and other form data after a conflict. The refreshed suggestion appears beside the field; **Застосувати номер** applies it explicitly. No automatic replacement or retry. The Excel import component fills missing numbers with ascending free suggestions, excluding numbers already supplied in the file. Its editable preview preserves file data on conflicts and offers **Застосувати запропоновані номери** before a separate import retry; the original spreadsheet is not modified.
- No schema migration or inventory UNIQUE index is included. Existing duplicates are neither deleted nor renumbered. A production duplicate audit and Senya's approval are required before adding a UNIQUE index. This protection covers application write paths, not direct external SQL writers or the offline seed utility.

For a later approved audit, open an approved SQLite snapshot read-only (`sqlite3 -readonly /path/to/approved-snapshot.sqlite`) and run this SELECT. It reports duplicate non-null numbers and copy IDs without reader or donor information; zero rows means no duplicate non-null inventory numbers in that snapshot.

```sql
SELECT inventory_number,
       COUNT(*) AS copy_count,
       GROUP_CONCAT(id, ', ') AS copy_ids
FROM books
WHERE inventory_number IS NOT NULL
GROUP BY inventory_number
HAVING COUNT(*) > 1
ORDER BY inventory_number;
```

Do not run repairs or create an index as part of the audit. Keep results private. No production audit was performed for this change.


## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript, Vite |
| Styling | Tailwind CSS 3, shadcn/ui (Radix UI) |
| State | React hooks, fetch API with JWT |
| Backend | Python, Flask |
| Database | SQLite (raw SQL, no ORM) |
| Auth | JWT (PyJWT), bcrypt |

## Project Structure

```
ukrlibrary/
├── frontend/          React + TypeScript SPA
│   ├── src/
│   │   ├── pages/         Route pages (Index, Admin, Auth, Readers, etc.)
│   │   ├── components/    UI components and admin dialogs
│   │   ├── lib/           API client, types, utilities
│   │   └── hooks/         Custom React hooks
│   └── public/
├── backend/           Flask REST API
│   ├── app/
│   │   ├── routes/        9 blueprint modules (auth, books, readers, rentals, etc.)
│   │   ├── schema.sql     Database schema (9 tables)
│   │   ├── auth.py        JWT + bcrypt authentication
│   │   ├── seed.py        Database seeding (demo data + Excel import)
│   │   └── database.py    SQLite connection helpers
│   └── uploads/           Uploaded book covers and media
└── README.md
```

## Getting Started

### Prerequisites

- Node.js 18+
- Python 3.10+

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

Create `backend/.env`:

```env
SECRET_KEY=your-secret-key-here
DATABASE_PATH=library.db
FLASK_ENV=development
UPLOAD_FOLDER=uploads
```

Initialize the database and seed demo data:

```bash
python -c "from app.seed import seed; seed()"
```

Start the server:

```bash
python run.py
```

Backend runs on `http://localhost:8000`.

### Frontend

```bash
cd frontend
npm install
```

Create `frontend/.env`:

```env
VITE_API_URL=http://localhost:8000
```

Start the dev server:

```bash
npm run dev
```

Frontend runs on `http://localhost:8080`.

### Seed from Excel

The app supports bulk importing books and readers from an Excel spreadsheet:

```bash
cd backend
source venv/bin/activate
python -c "from app.seed import seed_from_excel; seed_from_excel('../your-spreadsheet.xlsx')"
```

## API

28+ REST endpoints under `/api/`:

| Group | Endpoints |
|-------|----------|
| Auth | signup, login, me, reset-password |
| Books | list, inventory-suggestions, create, update, delete, duplicate, force-available, media, import |
| Categories | list, create, update, delete |
| Series | list, create, update, delete |
| Publishers | list, create, update, delete |
| Readers | list, get, create, update, delete, merge, convert-to-child |
| Children | add, update, delete, reassign |
| Rentals | list, create, update status, queue |
| Users | list, update role |
| Upload | book covers, book media |

## Database Schema

9 tables: `users`, `categories`, `series`, `publishers`, `books`, `readers`, `children`, `rental_requests`, `book_media`

All primary keys are UUIDs stored as TEXT. See `backend/app/schema.sql` for full definitions.

## License

This project is not currently licensed for redistribution.
