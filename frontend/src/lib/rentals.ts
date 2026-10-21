/**
 * Rental date helpers.
 *
 * The backend never stored a due date — it only has `approved_at` (when the
 * book was handed out) and `rental_duration` (in WEEKS). These helpers derive
 * the expected return date so it can be shown to the admin, and flag overdue
 * loans.
 */

/** Parse a SQLite timestamp ("YYYY-MM-DD HH:MM:SS", UTC) or ISO string. */
export function parseServerDate(value?: string | null): Date | null {
  if (!value) return null;
  const iso = value.includes("T") ? value : value.replace(" ", "T") + "Z";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : d;
}

/** Expected return date = approved_at + rental_duration weeks. */
export function computeDueDate(
  approvedAt?: string | null,
  durationWeeks?: number | null,
): Date | null {
  const start = parseServerDate(approvedAt);
  if (!start || !durationWeeks) return null;
  const due = new Date(start);
  due.setDate(due.getDate() + durationWeeks * 7);
  return due;
}

/** Format a date as dd.mm.yyyy (Ukrainian locale), or "—" when null. */
export function formatDate(d: Date | null): string {
  if (!d) return "—";
  return d.toLocaleDateString("uk-UA", { day: "2-digit", month: "2-digit", year: "numeric" });
}

/** Convenience: format the computed due date directly. */
export function formatDueDate(approvedAt?: string | null, durationWeeks?: number | null): string {
  return formatDate(computeDueDate(approvedAt, durationWeeks));
}

/** True when a still-out loan is past its due date. */
export function isOverdue(
  approvedAt?: string | null,
  durationWeeks?: number | null,
  returnDate?: string | null,
  now: Date = new Date(),
): boolean {
  if (returnDate) return false; // already returned
  const due = computeDueDate(approvedAt, durationWeeks);
  if (!due) return false;
  return now.getTime() > due.getTime();
}

/** Whole days a loan is overdue (0 if not overdue / not applicable). */
export function daysOverdue(
  approvedAt?: string | null,
  durationWeeks?: number | null,
  returnDate?: string | null,
  now: Date = new Date(),
): number {
  if (returnDate) return 0;
  const due = computeDueDate(approvedAt, durationWeeks);
  if (!due) return 0;
  const diffMs = now.getTime() - due.getTime();
  if (diffMs <= 0) return 0;
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}
