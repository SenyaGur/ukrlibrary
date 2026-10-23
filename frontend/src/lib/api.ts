import type {
  AuthResponse, LoginRequest, SignupRequest, User,
  Book, BookFilters, BookMedia,
  Category, Series, Publisher,
  Reader, ReaderWithChildren, Child,
  RentalRequest, RentalHistory, UserProfile, ImportResult,
  QueueEntry, AuditEntry, BookSearchResult, BookPrefill,
  ApiErrorPayload, InventoryConflictPayload, InventorySuggestions
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

export class ApiError<T extends ApiErrorPayload = ApiErrorPayload> extends Error {
  constructor(public readonly status: number, public readonly payload: T) {
    super(payload.error || payload.message || `HTTP ${status}`);
    this.name = 'ApiError';
  }
}

export function isInventoryConflict(error: unknown): error is ApiError<InventoryConflictPayload> {
  return error instanceof ApiError
    && error.status === 409
    && error.payload.code === 'inventory_conflict';
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
    // On 401, clear token and redirect to login
    if (response.status === 401 && token) {
      setToken(null);
      window.location.href = '/auth';
    }
    throw new ApiError(response.status, error);
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
  list: (archived?: 'all' | 'only') => apiFetch<Book[]>(`/api/books${archived ? `?archived=${archived}` : ''}`),

  filters: () => apiFetch<BookFilters>('/api/books/filters'),

  inventorySuggestions: (count = 1) =>
    apiFetch<InventorySuggestions>(`/api/books/inventory-suggestions?count=${count}`),

  create: (data: Partial<Book> & { inventory_number: number }) =>
    apiFetch<Book>('/api/books', { method: 'POST', body: JSON.stringify(data) }),

  update: (id: string, data: Partial<Book>) =>
    apiFetch<Book>(`/api/books/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  getMedia: (bookId: string) =>
    apiFetch<BookMedia[]>(`/api/books/${bookId}/media`),

  addMedia: (bookId: string, data: { file_url: string; file_type: string; display_order: number }) =>
    apiFetch<BookMedia>(`/api/books/${bookId}/media`, { method: 'POST', body: JSON.stringify(data) }),

  deleteMedia: (mediaId: string) =>
    apiFetch<void>(`/api/books/media/${mediaId}`, { method: 'DELETE' }),

  reorderMedia: (bookId: string, order: string[]) =>
    apiFetch<BookMedia[]>(`/api/books/${bookId}/media/reorder`, { method: 'PUT', body: JSON.stringify({ order }) }),

  forceAvailable: (bookId: string) =>
    apiFetch<Book>(`/api/books/${bookId}/force-available`, { method: 'PUT' }),

  duplicate: (bookId: string, inventoryNumber: number, supplier?: string | null) =>
    apiFetch<Book>(`/api/books/${bookId}/duplicate`, {
      method: 'POST',
      body: JSON.stringify({ inventory_number: inventoryNumber, supplier: supplier || null }),
    }),

  archive: (bookId: string, scope?: 'title') =>
    apiFetch<void>(`/api/books/${bookId}${scope ? `?scope=${scope}` : ''}`, { method: 'DELETE' }),

  restore: (bookId: string, scope?: 'title') =>
    apiFetch<void>(`/api/books/${bookId}/restore${scope ? `?scope=${scope}` : ''}`, { method: 'POST' }),
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
  update: (id: string, data: { parent_name?: string; parent_surname?: string; phone1?: string; phone2?: string; email?: string; address?: string; comment?: string }) =>
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
  sendReport: (readerId: string, email?: string) =>
    apiFetch<{ sent: boolean; email: string }>(`/api/readers/${readerId}/report/send`, { method: 'POST', body: JSON.stringify(email ? { email } : {}) }),
};

// Rentals API
type RentalCreatePayload = {
  book_id: string; book_title: string; renter_name: string; renter_phone: string;
  renter_email: string; rental_duration: number; reader_id?: string; child_id?: string;
};

export const rentalsApi = {
  list: () => apiFetch<RentalRequest[]>('/api/rentals'),
  create: (data: RentalCreatePayload) =>
    apiFetch<RentalRequest>('/api/rentals', { method: 'POST', body: JSON.stringify(data) }),
  // Uses apiFetch's admin bearer token; public create never requests approval.
  issue: (data: RentalCreatePayload) =>
    apiFetch<RentalRequest>('/api/rentals', { method: 'POST', body: JSON.stringify({ ...data, auto_approve: true }) }),
  updateStatus: (id: string, status: 'approved' | 'declined' | 'returned') =>
    apiFetch<RentalRequest>(`/api/rentals/${id}/status`, { method: 'PUT', body: JSON.stringify({ status }) }),
  getByReader: (readerId: string) =>
    apiFetch<RentalHistory[]>(`/api/rentals?reader_id=${readerId}`),
  getQueue: (bookId: string) =>
    apiFetch<QueueEntry[]>(`/api/rentals/queue/${bookId}`),
  reassign: (id: string, reader_id: string, child_id: string | null) =>
    apiFetch<RentalRequest>(`/api/rentals/${id}/reassign`, { method: 'PUT', body: JSON.stringify({ reader_id, child_id }) }),
  sendReceipt: (payload: { reader_id: string; rental_ids: string[] }) =>
    apiFetch<{ sent: boolean; email: string }>('/api/rentals/receipt/send', { method: 'POST', body: JSON.stringify(payload) }),
  getOverdue: () => apiFetch<Array<{ id: string; book_title: string; renter_name: string; reader_id: string | null; email: string; due: string; days_overdue: number; has_email: boolean }>>('/api/rentals/overdue'),
  runOverdueReminders: () => apiFetch<{ overdue: number; emailed: number; books_covered: number; skipped_no_email: number; skipped_recent: number; failed: number; smtp_configured: boolean }>('/api/rentals/overdue/run', { method: 'POST' }),
  remindOverdueReader: (reader_id: string) => apiFetch<{ sent: boolean; email?: string; books?: number; reason?: string }>('/api/rentals/overdue/remind', { method: 'POST', body: JSON.stringify({ reader_id }) }),
  remindRental: (rental_id: string) => apiFetch<{ sent: boolean; email?: string; reason?: string }>(`/api/rentals/${rental_id}/remind`, { method: 'POST' }),
};

// Users API (admin)
export const usersApi = {
  list: () => apiFetch<UserProfile[]>('/api/users'),
  create: (data: { email: string; password: string; full_name?: string; role?: 'admin' | 'user' }) =>
    apiFetch<UserProfile>('/api/users', { method: 'POST', body: JSON.stringify(data) }),
  updateRole: (id: string, role: 'admin' | 'user') =>
    apiFetch<UserProfile>(`/api/users/${id}/role`, { method: 'PUT', body: JSON.stringify({ role }) }),
  delete: (id: string) =>
    apiFetch<{ message: string }>(`/api/users/${id}`, { method: 'DELETE' }),
};

// Audit log API (admin) — records of who did what action
export const auditApi = {
  list: (params?: { user_id?: string; entity_type?: string; action?: string; q?: string; limit?: number; offset?: number }) => {
    const qs = new URLSearchParams();
    if (params?.user_id) qs.set('user_id', params.user_id);
    if (params?.entity_type) qs.set('entity_type', params.entity_type);
    if (params?.action) qs.set('action', params.action);
    if (params?.q) qs.set('q', params.q);
    if (params?.limit != null) qs.set('limit', String(params.limit));
    if (params?.offset != null) qs.set('offset', String(params.offset));
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    return apiFetch<{ items: AuditEntry[]; total: number }>(`/api/audit${suffix}`);
  },
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

// Online book lookup (knigoland.com.ua) — search + import metadata
export const bookLookupApi = {
  search: (q: string) =>
    apiFetch<{ results: BookSearchResult[]; error?: string }>(`/api/booklookup/search?q=${encodeURIComponent(q)}`),
  import: (url: string) =>
    apiFetch<BookPrefill>('/api/booklookup/import', { method: 'POST', body: JSON.stringify({ url }) }),
};
