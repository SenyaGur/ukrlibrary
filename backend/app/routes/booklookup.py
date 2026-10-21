"""Online book lookup / import from knigoland.com.ua.

Knigoland is a Ukrainian bookstore aggregator (40k+ titles across major UA
publishers) that — unlike yakaboo.ua — serves real HTML to server-side requests
and exposes clean data (JSON-LD Product + a characteristics block). We search it,
parse a chosen book, download its cover into our own storage, and match the
publisher/series/category against the local DB before pre-filling the add-book
form for the admin to review and save.

Politeness: a normal browser UA, short timeouts, and only on-demand admin fetches.
"""

import os
import re
import json
import uuid
import html as html_lib
import logging
import urllib.request
import urllib.parse

from bs4 import BeautifulSoup
from flask import Blueprint, request, jsonify, current_app

from app.auth import admin_required
from app.database import query_db

logger = logging.getLogger(__name__)

booklookup_bp = Blueprint('booklookup', __name__, url_prefix='/api/booklookup')

BASE = 'https://knigoland.com.ua'
_UA = 'Mozilla/5.0 (compatible; ukrlibrary/1.0; +https://library.uakidsclub-sofia.org)'


def _fetch(url, timeout=15):
    req = urllib.request.Request(url, headers={'User-Agent': _UA, 'Accept-Language': 'uk,en'})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.read().decode('utf-8', 'ignore')


def _norm(s):
    return re.sub(r'\s+', ' ', (s or '').strip().lower())


def _clean_desc(raw):
    """Turn a possibly HTML/entity-encoded description into clean plain text.

    Knigoland stores descriptions HTML-entity-encoded in JSON-LD (e.g.
    "&lt;p&gt;&lt;strong&gt;..."), so we must un-escape the entities FIRST
    (revealing the real tags), then strip the tags — otherwise BeautifulSoup's
    get_text would decode the entities back into visible <p>/<a> text.
    """
    if not raw:
        return ''
    s = html_lib.unescape(html_lib.unescape(raw))  # handle single & double encoding
    s = re.sub(r'(?i)<br\s*/?>', '\n', s)           # line breaks
    s = re.sub(r'(?i)</p\s*>', '\n\n', s)           # paragraph breaks
    s = BeautifulSoup(s, 'html.parser').get_text()  # drop remaining tags, keep link text
    s = re.sub(r'[ \t]+\n', '\n', s)
    s = re.sub(r'\n{3,}', '\n\n', s)
    return s.strip()


# --- Cover download ----------------------------------------------------------
def _download_cover(url):
    if not url:
        return None
    if url.startswith('/'):
        url = BASE + url
    try:
        req = urllib.request.Request(url, headers={'User-Agent': _UA})
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = resp.read()
            ctype = (resp.headers.get('Content-Type') or '').lower()
    except Exception as exc:  # noqa: BLE001
        logger.info('cover download failed for %s: %s', url, exc)
        return None
    if not data or len(data) < 1000:
        return None
    ext = 'jpg'
    if 'png' in ctype:
        ext = 'png'
    elif 'webp' in ctype:
        ext = 'webp'
    elif 'gif' in ctype:
        ext = 'gif'
    fname = f'{uuid.uuid4()}.{ext}'
    folder = os.path.join(current_app.config['UPLOAD_FOLDER'], 'book-covers')
    os.makedirs(folder, exist_ok=True)
    with open(os.path.join(folder, fname), 'wb') as f:
        f.write(data)
    return f'/uploads/book-covers/{fname}'


# --- DB matching -------------------------------------------------------------
def _match_publisher(name):
    n = _norm(name)
    if not n:
        return None
    pubs = query_db('SELECT id, name FROM publishers')
    for p in pubs:
        if _norm(p['name']) == n:
            return p['id']
    for p in pubs:
        pn = _norm(p['name'])
        if pn and (pn in n or n in pn):
            return p['id']
    return None


def _match_series(name):
    n = _norm(name)
    if not n:
        return None
    for s in query_db('SELECT id, name FROM series'):
        if _norm(s['name']) == n:
            return s['id']
    return None


def _match_category(names):
    cats = query_db('SELECT id, name FROM categories')
    norm_names = [_norm(x) for x in (names or [])]
    for c in cats:
        cn = _norm(c['name'])
        for nn in norm_names:
            if cn and (cn == nn or cn in nn or nn in cn):
                return c['id']
    return None


# --- Parsing -----------------------------------------------------------------
def _ld_blocks(soup):
    out = []
    for s in soup.find_all('script', type='application/ld+json'):
        try:
            d = json.loads(s.string or s.get_text())
        except Exception:  # noqa: BLE001
            continue
        out.extend(d if isinstance(d, list) else [d])
    return out


def search_knigoland(q, limit=16):
    html = _fetch(f'{BASE}/search?q={urllib.parse.quote(q)}')
    soup = BeautifulSoup(html, 'html.parser')
    out, seen = [], set()
    for a in soup.find_all('a', href=True):
        href = a['href']
        m = re.match(r'^/([a-z0-9\-]+-item)(?:\?|$)', href)
        if not m:
            continue
        slug = m.group(1)
        if slug in seen:
            continue
        img = a.find('img')
        if not img or not (img.get('alt') or '').strip():
            continue  # the cover-image anchor carries the title in alt
        thumb = img.get('src') or ''
        if thumb.startswith('/') and not thumb.startswith('//'):
            thumb = BASE + thumb
        seen.add(slug)
        out.append({
            'source': 'knigoland',
            'url': f'{BASE}/{slug}',
            'title': img['alt'].strip(),
            'thumb': thumb or None,
        })
        if len(out) >= limit:
            break
    return out


def import_knigoland(url):
    if not url.startswith(BASE):
        raise ValueError('url must be a knigoland.com.ua product URL')
    html = _fetch(url)
    soup = BeautifulSoup(html, 'html.parser')
    blocks = _ld_blocks(soup)

    product = next((b for b in blocks if isinstance(b, dict) and b.get('@type') == 'Product'), {})
    title = (product.get('name') or '').strip()
    description = _clean_desc(product.get('description') or '')
    images = product.get('image')
    cover_src = images[0] if isinstance(images, list) and images else (images if isinstance(images, str) else None)

    # Breadcrumb categories (Ukrainian) for category matching
    crumbs = []
    bl = next((b for b in blocks if isinstance(b, dict) and b.get('@type') == 'BreadcrumbList'), None)
    if bl:
        for el in bl.get('itemListElement', []):
            item = el.get('item')
            nm = item.get('name') if isinstance(item, dict) else el.get('name')
            if nm:
                crumbs.append(nm)

    # Characteristics: <span class="whitespace-nowrap">LABEL</span> ... <span class="w-[220px]">VALUE</span>
    fields = {}
    for lab in soup.select('span.whitespace-nowrap'):
        label = lab.get_text(strip=True)
        parent = lab.find_parent()
        val = parent.find_next('span', class_=re.compile(r'w-\[220px\]')) if parent else None
        if label and val:
            fields[label] = val.get_text(' ', strip=True)

    publisher = fields.get('Видавництво', '')
    year = fields.get('Рік видання', '')
    series = fields.get('Серія товару') or fields.get('Серія', '')
    pages_str = fields.get('Кількість сторінок') or fields.get('Сторінки') or fields.get('Сторінок', '')
    language = fields.get('Мова', '')
    age = fields.get('Вік') or fields.get('Вікова категорія') or fields.get('Вік дитини', '')

    authors = [a.get_text(strip=True) for a in soup.select('a[href$="-authors"]')]
    author = ', '.join(dict.fromkeys([a for a in authors if a]))

    m = re.search(r'ISBN:?\s*(\d{10,13})', html)
    isbn = m.group(1) if m else ''

    if not title:
        og = soup.find('meta', property='og:title')
        if og and og.get('content'):
            title = re.split(r'\s+книга автора|\s+купити', og['content'])[0].strip()

    pages = None
    pm = re.search(r'\d+', pages_str or '')
    if pm:
        pages = int(pm.group(0))

    cover_url = _download_cover(cover_src)

    return {
        'title': title,
        'author': author,
        'description': description,
        'publicationYear': str(year or ''),
        'isbn': isbn,
        'pages': pages,
        'language': language,
        'age': age,
        'coverImageUrl': cover_url,
        'publisherId': _match_publisher(publisher),
        'publisherName': publisher,
        'seriesId': _match_series(series),
        'seriesName': series,
        'categoryId': _match_category(crumbs),
        'sourceUrl': url,
    }


# --- Routes ------------------------------------------------------------------
@booklookup_bp.route('/search', methods=['GET'])
@admin_required
def search():
    """Search Knigoland. Returns { results: [{source,url,title,thumb}, ...] }."""
    q = (request.args.get('q') or '').strip()
    if not q:
        return jsonify({'results': []})
    try:
        return jsonify({'results': search_knigoland(q)})
    except Exception as exc:  # noqa: BLE001
        logger.error('booklookup search failed: %s', exc)
        return jsonify({'results': [], 'error': 'Не вдалося виконати пошук'}), 502


@booklookup_bp.route('/import', methods=['POST'])
@admin_required
def import_book():
    """Fetch + parse a chosen book and return add-book-form pre-fill data.
    Body: { url }."""
    data = request.get_json(silent=True) or {}
    url = (data.get('url') or '').strip()
    if not url:
        return jsonify({'error': 'url is required'}), 400
    try:
        return jsonify(import_knigoland(url))
    except ValueError as exc:
        return jsonify({'error': str(exc)}), 400
    except Exception as exc:  # noqa: BLE001
        logger.error('booklookup import failed for %s: %s', url, exc)
        return jsonify({'error': 'Не вдалося отримати дані книги'}), 502
