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

- `POST /api/rentals` remains public for reservations: anonymous `auto_approve` is ignored, leaving available books pending (unavailable copies join the queue). Issuance sends `auto_approve: true` with the administrator's bearer token; the server verifies the current database role and records that administrator's ID in the audit log. Non-admin tokens receive 403; invalid tokens receive 401. Historical audit rows are not rewritten.
- Select a reader, then a child and that child's books. **Додати іншу дитину** adds a separate child/list; one **Видати** button processes all lists. Readers without children receive books directly. Each loan still stores its own `child_id`; no schema change.
- Age warnings apply to each selected child's books and do not block issuance. A copy already selected for one child cannot be selected again for another.
- The same dialog shows issued books grouped by child, with clean print and explicit email actions. Email is never sent automatically; it uses the reader's current stored email and the existing SMTP/SES configuration. Without an email, the button is disabled with an explanation. Update the reader's card to change their email.
- Receipt email accepts `{reader_id, rental_ids}` at `POST /api/rentals/receipt/send`; the server resolves the recipient, child names and loan details from the database and rejects loans not currently issued to that reader. Malformed JSON bodies and non-string reader IDs return 400.
- Issuance uses the existing sequential loan API, not an atomic batch. If a request fails, successful loans remain issued and printable; the dialog retains only unprocessed books for continuation. Unavailable copies retain the existing reservation-queue behavior. A `pending` result stops issuance with a Ukrainian administrator-authorization error, never a queue/success message; check the created request in Requests before retrying.
- Known limitation (N4): a 401 during issuance redirects to `/auth`. Earlier successful loans remain issued in the Journal, but the current batch's on-screen receipt and print view are lost.
- New-book and **+1** dialogs prefill the smallest unused positive inventory number on every open. Suggestions are not reservations: another administrator may save the same number first. Users can edit the number.
- For local verification, use a temporary synthetic database, disable dotenv loading, and replace `app.mailer.send_email` with a local capture before creating the app. Never exercise these actions against real recipients or SES during development.

### Inventory allocation and duplicate audit

- Inventory numbers for new books/copies are required positive integers. `GET /api/books/inventory-suggestions?count=3` (admin-only; count 1–1000, default 1; otherwise 400) returns `next_inventory_number` and ascending `suggested_inventory_numbers`. Import-conflict hints are also limited to 1000, without limiting import size. An empty inventory suggests `1`; with `1, 2, 4` used, three suggestions are `3, 5, 6`. Archived copies still reserve their numbers: archiving never makes a number available for reuse.
- Book creation, **+1**, HTTP bulk import and inventory edits serialize their check-and-write with SQLite `BEGIN IMMEDIATE`. Conflicting saves return HTTP `409`, `code: inventory_conflict`, a Ukrainian error, the current smallest free number and suggested replacements. Bulk conflicts include one-based input row numbers and reject the whole batch without inserting any rows.
- Dialogs retain the entered number and other form data after a conflict. The refreshed suggestion appears beside the field; **Застосувати номер** applies it explicitly. No automatic replacement or retry. The Excel import component fills only blank numbers with ascending free suggestions, excluding numbers already supplied in the file. A non-empty malformed sticker number rejects the file with its spreadsheet row and original cell value; correct it in the spreadsheet to match the sticker, then select the file again. **Застосувати запропоновані номери** replaces only conflicting, duplicate, missing or invalid preview inputs; valid nonconflicting numbers and manual corrections survive. Once all rows are corrected, the no-usable-suggestions alert disappears. Large files may require manual entry beyond the bounded hints. Import requires a separate retry; the original spreadsheet is not modified.
- No inventory UNIQUE index is included. Existing duplicates are neither deleted nor renumbered. A production duplicate audit and Senya's approval are required before adding a UNIQUE index. This protection covers application write paths, not direct external SQL writers or the offline seed utility.
- Editing an existing book omits an unchanged inventory field, preserving legacy zero, negative, fractional or text values. Changing a number still requires a positive integer and passes the duplicate check; no legacy numbers are repaired automatically.
- Book Management **Експорт** exports all active copies, regardless of the current search, filters or archive view. Archived copies are excluded.

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

### Book archive and startup migration

- **Архівувати всі примірники** in the book editor archives the entire title (all copies with the same exact title and author). In **Управління книгами**, the labelled **Архівувати примірник** button beside the title opens the copy picker; select an inventory number, then confirm. In the book editor, **Архівувати цей примірник** beside each copy's inventory/donor fields opens the same confirmation for that copy (also available for single-copy titles). Cancelling keeps the editor open; success closes it and refreshes the active list. These actions use saved copy IDs/inventory numbers, not unsaved form edits. No book, media or rental-history rows are deleted. Issued copies have a disabled editor action; approved, pending or queued loans on any targeted copy block the operation through the existing API and display its error without closing the confirmation.
- Archived copies disappear from the public catalog, search, filter values, catalog counts, issuance picker and new requests. Journal, Requests and reader history keep their titles and loans. In Book Management, switch to **Архів** to see retired titles and inventory numbers; **Відновити** restores a title or an individual copy. Restoration refuses inventory collisions, including pre-existing legacy duplicates, without changing numbers. Archived copies reject force-availability and new media with 409.
- `books` stores one row per copy; there is no separate title table. Nullable `books.archived_at DATETIME` records retirement. New databases receive this column from `backend/app/schema.sql`; existing databases receive an additive `ALTER TABLE` from `init_db()` at application startup. Startup checks `PRAGMA table_info` before taking a write lock and skips that lock when already migrated. Missing-column migrations use a 30-second busy timeout and recheck under the lock for concurrent workers. All ALTERs are atomic; failures propagate. Existing rows stay active (`NULL`), with no history backfill, renumbering or destructive statements.
- **Production requires Senya's migration/deployment approval and a database backup first.** Stop the service before copying SQLite, or use SQLite's backup API; never copy a live database file directly. Verify `PRAGMA integrity_check` on the backup and pre-flight startup on a disposable copy of that backup. Deploy the **backend first, then frontend**, and ask administrators to reload: the old backend hard-deletes at the new archive URL. This order supersedes older frontend-first handoff instructions. If archive has been used, code-only rollback to `main` exposes archived books again; prefer restoring the pre-deploy backup. No seed/import utilities as migrations. Verification used temporary synthetic databases only; no production database was accessed.
- `GET /api/books` returns active copies only, even for an administrator. `?archived=only` and `?archived=all` require admin authentication. `DELETE /api/books/<id>` now archives one copy; add `?scope=title` for all matching copies. `POST /api/books/<id>/restore` restores one copy; `?scope=title` restores its archived title copies. Archive/restore and inventory writes serialize with SQLite; archived inventory numbers participate in every duplicate check and free-number suggestion.



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
| Books | list, inventory-suggestions, create, update, archive (DELETE), restore, duplicate, force-available, media, import |
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
