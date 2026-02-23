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
}

export interface BookFilters {
  categories: string[];
  authors: string[];
  ages: string[];
  publishers: string[];
  series: string[];
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
}

// Import
export interface ImportResult {
  success: number;
  failed: number;
  errors: string[];
}
