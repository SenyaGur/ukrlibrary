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
| Books | list, create, update, delete, duplicate, force-available, media, import |
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
