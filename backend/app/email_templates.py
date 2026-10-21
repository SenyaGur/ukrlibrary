"""HTML builders for outgoing emails (issue receipts, reader reports, overdue).

Clean, restrained letterhead style — inline-styled and table-based so it renders
consistently across email clients. Ukrainian copy throughout.
"""

from html import escape
from datetime import datetime, timedelta

BLUE = "#1a4f8b"
INK = "#1a1a1a"
MUTED = "#6b7280"
RED = "#c0392b"
BORDER = "#e5e7eb"
HEAD_BG = "#f4f6f8"

WEBSITE = "https://library.uakidsclub-sofia.org"
LIB_NAME = "Дитяча бібліотека"
LIB_SUB = "Український дитячий клуб у Софії"


# --- Date helpers (imported by overdue.py) -----------------------------------
def parse_dt(value):
    """Parse a timestamp string into a datetime, or None.

    Handles both SQLite CURRENT_TIMESTAMP ("YYYY-MM-DD HH:MM:SS") and Python
    ISO output with a 'T' separator and microseconds ("...T16:59:11.421248"),
    which is how auto-approved rentals store approved_at.
    """
    if not value:
        return None
    text = str(value).strip().replace('Z', '')
    try:
        return datetime.fromisoformat(text)
    except (ValueError, TypeError):
        pass
    for fmt in ('%Y-%m-%d %H:%M:%S.%f', '%Y-%m-%dT%H:%M:%S.%f',
                '%Y-%m-%d %H:%M:%S', '%Y-%m-%dT%H:%M:%S'):
        try:
            return datetime.strptime(text, fmt)
        except (ValueError, TypeError):
            continue
    return None


def due_date(approved_at, duration_weeks):
    """Expected return date = approved_at + duration weeks, or None."""
    dt = parse_dt(approved_at)
    if not dt or not duration_weeks:
        return None
    return dt + timedelta(weeks=int(duration_weeks))


def fmt_date(dt):
    return dt.strftime('%d.%m.%Y') if dt else '—'


# --- Layout primitives -------------------------------------------------------
def _page(inner):
    return f"""<!doctype html><html lang="uk"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#ffffff;font-family:Arial,Helvetica,sans-serif;color:{INK};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px 12px;">
<tr><td align="center">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">
<tr><td style="padding-bottom:14px;border-bottom:2px solid {BLUE};">
<span style="color:{BLUE};font-size:18px;font-weight:bold;">{LIB_NAME}</span>
<span style="color:{MUTED};font-size:13px;"> — {LIB_SUB}</span>
</td></tr>
<tr><td style="padding:20px 0;font-size:15px;line-height:1.6;">{inner}</td></tr>
<tr><td style="padding-top:14px;border-top:1px solid {BORDER};color:{MUTED};font-size:12px;line-height:1.6;">
Онлайн-каталог: <a href="{WEBSITE}" style="color:{BLUE};text-decoration:none;">{WEBSITE.replace('https://','')}</a><br>
Це автоматичний лист від бібліотеки, будь ласка, не відповідайте на нього.
</td></tr>
</table>
</td></tr></table></body></html>"""


def _table(headers, rows_html):
    ths = ''.join(
        f'<th style="text-align:left;padding:8px 10px;background:{HEAD_BG};'
        f'border-bottom:1px solid {BORDER};font-size:13px;color:{MUTED};font-weight:600;">{escape(h)}</th>'
        for h in headers
    )
    return (f'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" '
            f'style="border-collapse:collapse;margin:10px 0;">'
            f'<thead><tr>{ths}</tr></thead><tbody>{rows_html}</tbody></table>')


def _td(value, color=None, bold=False):
    style = f"padding:8px 10px;border-bottom:1px solid {BORDER};font-size:14px;"
    if color:
        style += f"color:{color};"
    if bold:
        style += "font-weight:600;"
    return f'<td style="{style}">{escape(str(value))}</td>'


# --- Email builders ----------------------------------------------------------
def issue_receipt_html(reader_name, items, issued_at_str=''):
    """Receipt for a batch of just-issued books.

    items: list of dicts with keys title, author, inventory_number, due.
    """
    rows = ''
    for i in items:
        rows += ('<tr>' + _td(i.get('title', ''), bold=True) +
                 _td(i.get('author', '') or '—') + _td(i.get('inventory_number') or '—') +
                 _td(i.get('due') or '—') + '</tr>')
    due_values = [i.get('due') for i in items if i.get('due')]
    return_by = due_values[0] if due_values else '—'

    who = escape(reader_name) if reader_name else 'Шановний читачу'
    inner = (
        f'<p style="margin:0 0 10px;">Вітаємо, <strong>{who}</strong>!</p>'
        + '<p style="margin:0 0 4px;">Ви отримали такі книги'
        + (f' (дата видачі: {escape(issued_at_str)})' if issued_at_str else '') + ':</p>'
        + _table(['Назва', 'Автор', 'Інв. №', 'Повернути до'], rows)
        + f'<p style="margin:8px 0 0;">Просимо повернути книги до <strong>{escape(return_by)}</strong>. Дякуємо!</p>'
    )
    return _page(inner)


def reader_report_html(reader_name, rentals, now=None):
    """Full reader report: currently on-hand books + reading history."""
    now = now or datetime.utcnow()
    active = [r for r in rentals if r.get('status') == 'approved' and not r.get('return_date')]

    active_rows = ''
    for r in active:
        due = due_date(r.get('approved_at'), r.get('rental_duration'))
        overdue = bool(due and now > due)
        active_rows += ('<tr>' + _td(r.get('book_title', ''), bold=True) +
                        _td(fmt_date(parse_dt(r.get('approved_at')))) +
                        _td(fmt_date(due) + (' (прострочено)' if overdue else ''),
                            color=RED if overdue else None) + '</tr>')
    if not active_rows:
        active_rows = f'<tr><td colspan="3" style="padding:8px 10px;color:{MUTED};font-size:14px;">Немає книг на руках</td></tr>'

    status_uk = {'approved': 'На руках', 'returned': 'Повернено', 'pending': 'Очікує',
                 'declined': 'Відхилено', 'queued': 'У черзі'}
    hist_rows = ''
    for r in rentals:
        hist_rows += ('<tr>' + _td(r.get('book_title', ''), bold=True) +
                      _td(fmt_date(parse_dt(r.get('requested_at')))) +
                      _td(status_uk.get(r.get('status'), r.get('status', ''))) +
                      _td(fmt_date(parse_dt(r.get('return_date'))) if r.get('return_date') else '—') + '</tr>')
    if not hist_rows:
        hist_rows = f'<tr><td colspan="4" style="padding:8px 10px;color:{MUTED};font-size:14px;">Історія порожня</td></tr>'

    who = escape(reader_name) if reader_name else 'Шановний читачу'
    inner = (
        f'<p style="margin:0 0 10px;">Вітаємо, <strong>{who}</strong>! Ось ваша читацька довідка.</p>'
        + f'<p style="margin:16px 0 0;font-weight:600;color:{BLUE};">Книги на руках</p>'
        + _table(['Назва', 'Видано', 'Повернути до'], active_rows)
        + f'<p style="margin:16px 0 0;font-weight:600;color:{BLUE};">Історія читання</p>'
        + _table(['Назва', 'Дата запиту', 'Статус', 'Повернено'], hist_rows)
    )
    return _page(inner)


def rental_reminder_html(reader_name, book_title, due_str, days_overdue=0):
    """Reminder about a single borrowed book (overdue or upcoming)."""
    who = escape(reader_name) if reader_name else 'Шановний читачу'
    if days_overdue and days_overdue > 0:
        status = f'Термін користування минув <strong style="color:{RED};">{days_overdue} дн.</strong> тому — будь ласка, поверніть книгу якнайшвидше.'
    else:
        status = f'Просимо повернути книгу до <strong>{escape(due_str)}</strong>.'
    inner = (
        f'<p style="margin:0 0 10px;">Вітаємо, <strong>{who}</strong>!</p>'
        + f'<p style="margin:0 0 6px;">Нагадуємо про книгу, яку ви взяли в нашій бібліотеці:</p>'
        + f'<p style="margin:0 0 10px;font-size:16px;"><strong>{escape(book_title)}</strong></p>'
        + f'<p style="margin:0;">{status}</p>'
        + f'<p style="margin:12px 0 0;color:{MUTED};font-size:13px;">Якщо ви вже повернули книгу, просто проігноруйте цей лист.</p>'
    )
    return _page(inner)


def overdue_reminder_html(reader_name, items):
    """Reminder that one or more books are overdue.

    items: list of dicts with keys title, due, days_overdue.
    """
    rows = ''
    for i in items:
        rows += ('<tr>' + _td(i.get('title', ''), bold=True) +
                 _td(i.get('due') or '—') +
                 _td(f"{i.get('days_overdue', 0)} дн.", color=RED) + '</tr>')

    who = escape(reader_name) if reader_name else 'Шановний читачу'
    inner = (
        f'<p style="margin:0 0 10px;">Вітаємо, <strong>{who}</strong>!</p>'
        + '<p style="margin:0 0 4px;">Нагадуємо, що термін користування наведеними книгами минув. '
          'Будь ласка, поверніть їх до бібліотеки якнайшвидше:</p>'
        + _table(['Назва', 'Треба було повернути до', 'Прострочено'], rows)
        + f'<p style="margin:10px 0 0;color:{MUTED};font-size:13px;">Якщо ви вже повернули ці книги, '
          'просто проігноруйте цей лист.</p>'
    )
    return _page(inner)
