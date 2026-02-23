import type {
  AuthResponse, LoginRequest, SignupRequest, User,
  Book, BookFilters, BookMedia,
  Category, Series, Publisher,
  Reader, ReaderWithChildren, Child,
  RentalRequest, RentalHistory, UserProfile, ImportResult,
  QueueEntry
} from './api-types';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';

/** Resolve a relative upload path (e.g. /uploads/...) to a full URL using API_URL. */
export function resolveUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  return `${API_URL}${path}`;
}

// Token management
let token: string | null = localStorage.getItem('auth_token');

export function getToken(): string | null {
  return token;
}

export function setToken(newToken: string | null) {
  token = newToken;
  if (newToken) {
    localStorage.setItem('auth_token', newToken);
  } else {
    localStorage.removeItem('auth_token');
  }
}

// Base fetch helper
async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Only set Content-Type for non-FormData bodies
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || error.message || `HTTP ${response.status}`);
  }

  // Handle empty responses (204)
  if (response.status === 204) return undefined as T;

  return response.json();
}

// Auth API
export const authApi = {
  signup: (data: SignupRequest) =>
    apiFetch<AuthResponse>('/api/auth/signup', { method: 'POST', body: JSON.stringify(data) }),

  login: (data: LoginRequest) =>
    apiFetch<AuthResponse>('/api/auth/login', { method: 'POST', body: JSON.stringify(data) }),

  me: () => apiFetch<User>('/api/auth/me'),

  resetPassword: (password: string) =>
    apiFetch<{ message: string }>('/api/auth/reset-password', { method: 'POST', body: JSON.stringify({ password }) }),

  logout: () => { setToken(null); },
};

// Books API
export const booksApi = {
  list: () => apiFetch<Book[]>('/api/books'),

  filters: () => apiFetch<BookFilters>('/api/books/filters'),

  create: (data: Partial<Book>) =>
    apiFetch<Book>('/api/books', { method: 'POST', body: JSON.stringify(data) }),

  update: (id: string, data: Partial<Book>) =>
    apiFetch<Book>(`/api/books/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  getMedia: (bookId: string) =>
    apiFetch<BookMedia[]>(`/api/books/${bookId}/media`),

  addMedia: (bookId: string, data: { file_url: string; file_type: string; display_order: number }) =>
    apiFetch<BookMedia>(`/api/books/${bookId}/media`, { method: 'POST', body: JSON.stringify(data) }),

  deleteMedia: (mediaId: string) =>
    apiFetch<void>(`/api/books/media/${mediaId}`, { method: 'DELETE' }),

  forceAvailable: (bookId: string) =>
    apiFetch<Book>(`/api/books/${bookId}/force-available`, { method: 'PUT' }),

  duplicate: (bookId: string) =>
    apiFetch<Book>(`/api/books/${bookId}/duplicate`, { method: 'POST' }),

  delete: (bookId: string) =>
    apiFetch<void>(`/api/books/${bookId}`, { method: 'DELETE' }),
};

// Categories API
export const categoriesApi = {
  list: () => apiFetch<Category[]>('/api/categories'),
  create: (data: { name: string }) =>
    apiFetch<Category>('/api/categories', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: { name: string }) =>
    apiFetch<Category>(`/api/categories/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: string) =>
    apiFetch<void>(`/api/categories/${id}`, { method: 'DELETE' }),
};

// Series API
export const seriesApi = {
  list: () => apiFetch<Series[]>('/api/series'),
  create: (data: { name: string }) =>
    apiFetch<Series>('/api/series', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: { name: string }) =>
    apiFetch<Series>(`/api/series/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: string) =>
    apiFetch<void>(`/api/series/${id}`, { method: 'DELETE' }),
};

// Publishers API
export const publishersApi = {
  list: () => apiFetch<Publisher[]>('/api/publishers'),
  create: (data: { name: string; city: string }) =>
    apiFetch<Publisher>('/api/publishers', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: { name: string; city: string }) =>
    apiFetch<Publisher>(`/api/publishers/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: string) =>
    apiFetch<void>(`/api/publishers/${id}`, { method: 'DELETE' }),
};

// Readers API
export const readersApi = {
  list: () => apiFetch<ReaderWithChildren[]>('/api/readers'),
  get: (id: string) => apiFetch<ReaderWithChildren>(`/api/readers/${id}`),
  create: (data: { parent_name: string; parent_surname: string; phone1: string; phone2?: string; address: string; comment?: string; children: Array<{ name: string; surname: string; birth_date: string; gender?: string }> }) =>
    apiFetch<ReaderWithChildren>('/api/readers', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: { parent_name?: string; parent_surname?: string; phone1?: string; phone2?: string; address?: string; comment?: string }) =>
    apiFetch<ReaderWithChildren>(`/api/readers/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: string) =>
    apiFetch<void>(`/api/readers/${id}`, { method: 'DELETE' }),
  getChildren: (readerId: string) =>
    apiFetch<Child[]>(`/api/readers/${readerId}/children`),
  addChild: (readerId: string, data: { name: string; surname?: string; birth_date: string; gender?: string }) =>
    apiFetch<Child>(`/api/readers/${readerId}/children`, { method: 'POST', body: JSON.stringify(data) }),
  updateChild: (readerId: string, childId: string, data: { name?: string; surname?: string; birth_date?: string; gender?: string }) =>
    apiFetch<Child>(`/api/readers/${readerId}/children/${childId}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteChild: (readerId: string, childId: string) =>
    apiFetch<void>(`/api/readers/${readerId}/children/${childId}`, { method: 'DELETE' }),
  reassignChild: (childId: string, newReaderId: string) =>
    apiFetch<Child>(`/api/children/${childId}/reassign`, { method: 'PUT', body: JSON.stringify({ reader_id: newReaderId }) }),
  convertToChild: (readerId: string, parentReaderId: string) =>
    apiFetch<ReaderWithChildren>(`/api/readers/${readerId}/convert-to-child`, { method: 'POST', body: JSON.stringify({ parent_reader_id: parentReaderId }) }),
  merge: (readerId: string, targetReaderId: string) =>
    apiFetch<ReaderWithChildren>(`/api/readers/${readerId}/merge`, { method: 'POST', body: JSON.stringify({ target_reader_id: targetReaderId }) }),
};

// Rentals API
export const rentalsApi = {
  list: () => apiFetch<RentalRequest[]>('/api/rentals'),
  create: (data: { book_id: string; book_title: string; renter_name: string; renter_phone: string; renter_email: string; rental_duration: number; reader_id?: string; child_id?: string; auto_approve?: boolean }) =>
    apiFetch<RentalRequest>('/api/rentals', { method: 'POST', body: JSON.stringify(data) }),
  updateStatus: (id: string, status: 'approved' | 'declined' | 'returned') =>
    apiFetch<RentalRequest>(`/api/rentals/${id}/status`, { method: 'PUT', body: JSON.stringify({ status }) }),
  getByReader: (readerId: string) =>
    apiFetch<RentalHistory[]>(`/api/rentals?reader_id=${readerId}`),
  getQueue: (bookId: string) =>
    apiFetch<QueueEntry[]>(`/api/rentals/queue/${bookId}`),
};

// Users API (admin)
export const usersApi = {
  list: () => apiFetch<UserProfile[]>('/api/users'),
  updateRole: (id: string, role: 'admin' | 'user') =>
    apiFetch<UserProfile>(`/api/users/${id}/role`, { method: 'PUT', body: JSON.stringify({ role }) }),
};

// Upload API
export const uploadApi = {
  bookCover: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return apiFetch<{ url: string }>('/api/upload/book-covers', { method: 'POST', body: formData });
  },
  bookMedia: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return apiFetch<{ url: string }>('/api/upload/book-media', { method: 'POST', body: formData });
  },
};

// Import API
export const importApi = {
  importBooks: (booksData: any[]) =>
    apiFetch<ImportResult>('/api/books/import', { method: 'POST', body: JSON.stringify({ booksData }) }),
};
