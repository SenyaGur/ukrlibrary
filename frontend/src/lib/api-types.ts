// Auth
export interface User {
  id: string;
  email: string;
  full_name: string | null;
  role: 'admin' | 'user';
  avatar_url: string | null;
  created_at: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface SignupRequest {
  email: string;
  password: string;
  full_name: string;
}

// Books
export interface Book {
  id: string;
  title: string;
  author: string;
  category: string;
  category_id: string | null;
  series_id: string | null;
  publisher_id: string | null;
  cover_color: string;
  cover_image_url: string | null;
  available: boolean;
  description: string | null;
  age: string | null;
  publication_year: string | null;
  isbn: string | null;
  inventory_number: number | null;
  supplier: string | null;
  new_book: boolean;
  created_at: string;
  updated_at: string;
  publishers?: { name: string; city: string } | null;
  series?: { name: string } | null;
  rental_count?: number;
  // Present (non-null) only when the copy is currently out on loan.
  current_rental?: {
    renter_name: string;
    approved_at: string | null;
    rental_duration: number | null;
    reader_id: string | null;
  } | null;
}

export interface BookFilters {
  categories: string[];
  authors: string[];
  ages: string[];
  publishers: string[];
  series: string[];
  suppliers: string[];
}

export interface BookMedia {
  id: string;
  book_id: string;
  file_url: string;
  file_type: string;
  display_order: number;
  created_at: string;
}

// Categories, Series, Publishers
export interface Category {
  id: string;
  name: string;
  created_at: string;
}

export interface Series {
  id: string;
  name: string;
  created_at: string;
}

export interface Publisher {
  id: string;
  name: string;
  city: string;
  created_at: string;
}

// Readers
export interface Reader {
  id: string;
  parent_name: string;
  parent_surname: string;
  phone1: string;
  phone2: string | null;
  email: string;
  address: string;
  comment: string;
  created_at: string;
}

export interface Child {
  id: string;
  reader_id: string;
  name: string;
  surname: string;
  birth_date: string;
  gender: string;
  created_at: string;
}

export interface ReaderWithChildren extends Reader {
  children: Child[];
  active_rentals?: string[];
}

// Rentals
export interface RentalRequest {
  id: string;
  book_id: string;
  book_title: string;
  renter_name: string;
  renter_phone: string;
  renter_email: string;
  rental_duration: number;
  status: 'pending' | 'approved' | 'declined' | 'returned' | 'queued';
  queue_position: number | null;
  reader_id: string | null;
  child_id: string | null;
  requested_at: string;
  approved_at: string | null;
  return_date: string | null;
}

export interface QueueEntry {
  id: string;
  renter_name: string;
  queue_position: number;
  requested_at: string;
}

export interface RentalHistory extends RentalRequest {
  child_name?: string;
}

// Users (admin)
export interface UserProfile {
  id: string;
  full_name: string;
  email: string;
  role: 'admin' | 'user';
  created_at: string;
  updated_at?: string;
}

// Audit log — a record of a single mutating action
export interface AuditEntry {
  id: string;
  user_id: string | null;
  user_email: string | null;
  user_name: string | null;
  action: string;      // Flask endpoint, e.g. "books.update_book"
  method: string;      // HTTP method
  path: string;        // request path
  entity_type: string | null;
  entity_id: string | null;
  details: string | null;   // JSON string
  status_code: number | null;
  created_at: string;
}

// Import
export interface ImportResult {
  success: number;
  failed: number;
  errors: string[];
}

// Online book lookup (knigoland.com.ua)
export interface BookSearchResult {
  source: string;
  url: string;
  title: string;
  thumb: string | null;
}

export interface BookPrefill {
  title: string;
  author: string;
  description: string;
  publicationYear: string;
  isbn: string;
  pages?: number | null;
  language?: string;
  age?: string;
  coverImageUrl: string | null;
  publisherId: string | null;
  publisherName: string;
  seriesId: string | null;
  seriesName?: string;
  categoryId: string | null;
  sourceUrl?: string;
}
