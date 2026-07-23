import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  BookOpen, Headphones, Flame, Target, CalendarDays, Plus, X,
  Upload, Search, Check, Trash2, Pencil, ChevronLeft, ChevronRight, Star,
  Download, Home, Library, Clock, PartyPopper, BookMarked,
  Tablet, ShoppingCart, Quote, LogOut
} from 'lucide-react';
import { supabase } from './supabaseClient';
import Auth from './Auth';
import { randomTagline } from './taglines';

/* ---------------------------------------------------------------- */
/* Constants & helpers                                               */
/* ---------------------------------------------------------------- */

const OWNER_EMAIL = 'xo.apple.xox@gmail.com';

const SECTIONS = [
  { id: 'home',      label: 'Home',       color: '#af839c', icon: Home },
  { id: 'shelf',     label: 'My Shelf',   color: '#875a87', icon: Library },
  { id: 'reading',   label: 'Reading',    color: '#802d38', icon: BookOpen },
  { id: 'tbr',       label: 'TBR',        color: '#9e618f', icon: BookMarked },
  { id: 'finished',  label: 'Finished',   color: '#695c70', icon: Check },
  { id: 'calendar',  label: 'Calendar',   color: '#6b5c7a', icon: CalendarDays },
  { id: 'goals',     label: 'Goals',      color: '#966254', icon: Target },
  { id: 'releases',  label: 'Releases',   color: '#804251', icon: Clock },
];

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const WEEKDAYS = ['S','M','T','W','T','F','S'];

const COVER_HUES = [ '#af839c', '#875a87', '#802d38', '#9e618f', '#695c70', '#6b5c7a', '#966254', '#804251' ];

const TROPES = [
  'Enemies to Lovers', 'Friends to Lovers', 'Second Chance', 'Fake Dating', 'Marriage of Convenience',
  'Forced Proximity', 'Grumpy x Sunshine', 'Slow Burn', 'Insta-Love', 'Love Triangle',
  'Found Family', 'Chosen One', 'Age Gap', 'Secret Identity', 'Royalty',
  'Small Town', 'Workplace Romance', 'Single Parent', 'Rivals', 'Reverse Harem',
  'Time Travel', 'Redemption Arc', 'Morally Grey', 'Only One Bed',
];

const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
const todayStr = () => new Date().toISOString().slice(0, 10);
const pad2 = (n) => String(n).padStart(2, '0');
const dateKey = (y, m, d) => `${y}-${pad2(m + 1)}-${pad2(d)}`;
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

function hashHue(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = str.charCodeAt(i) + ((h << 5) - h);
  return COVER_HUES[Math.abs(h) % COVER_HUES.length];
}

function initialsOf(title) {
  return (title || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() || '').join('');
}

function computeStreak(logDates) {
  const set = new Set(logDates);
  if (!set.size) return 0;
  const oneDay = 86400000;
  let cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  if (!set.has(cursor.toISOString().slice(0, 10))) {
    cursor = new Date(cursor.getTime() - oneDay);
  }
  let streak = 0;
  while (set.has(cursor.toISOString().slice(0, 10))) {
    streak++;
    cursor = new Date(cursor.getTime() - oneDay);
  }
  return streak;
}

function getMonthGrid(year, month) {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  return cells;
}

function daysUntil(dateStr) {
  const today = new Date(); today.setHours(0,0,0,0);
  const target = new Date(dateStr + 'T00:00:00');
  return Math.round((target - today) / 86400000);
}

function defaultGoal() {
  const y = new Date().getFullYear();
  return { id: uid(), name: `${y} Reading Goal`, type: 'books', target: 20, startDate: `${y}-01-01`, endDate: `${y}-12-31` };
}

function goalProgress(goal, books) {
  const inRange = books.filter(b => b.dateFinished && b.dateFinished >= goal.startDate && b.dateFinished <= goal.endDate);
  const current = goal.type === 'pages' ? inRange.reduce((s, b) => s + (Number(b.totalPages) || 0), 0) : inRange.length;
  const pct = goal.target > 0 ? clamp(Math.round((current / goal.target) * 100), 0, 100) : 0;
  return { current, pct };
}

const emptyData = () => ({
  books: [],
  wishlist: [],
  readingLog: [],
  goals: [defaultGoal()],
  prefs: { defaultProgressType: 'percent' },
});

/* ---------------------------------------------------------------- */
/* Small shared UI atoms                                             */
/* ---------------------------------------------------------------- */

function StarRating({ value = 0, onChange, size = 18, readOnly = false }) {
  const [hover, setHover] = useState(0);
  const shown = hover || value;
  return (
    <div className="rating-row" onMouseLeave={() => setHover(0)}>
      {[1, 2, 3, 4, 5].map(n => (
        <Star
          key={n}
          size={size}
          className={`star-icon ${n <= shown ? 'filled' : ''} ${readOnly ? '' : 'clickable'}`}
          onMouseEnter={() => !readOnly && setHover(n)}
          onClick={() => !readOnly && onChange && onChange(n === value ? 0 : n)}
        />
      ))}
    </div>
  );
}

function ChiliRating({ value = 0, onChange, size = 18, readOnly = false }) {
  const [hover, setHover] = useState(0);
  const shown = hover || value;
  return (
    <div className="rating-row" onMouseLeave={() => setHover(0)}>
      {[1, 2, 3, 4, 5].map(n => (
        <span
          key={n}
          style={{ fontSize: size, opacity: n <= shown ? 1 : 0.25, cursor: readOnly ? 'default' : 'pointer', filter: n <= shown ? 'none' : 'grayscale(1)' }}
          onMouseEnter={() => !readOnly && setHover(n)}
          onClick={() => !readOnly && onChange && onChange(n === value ? 0 : n)}
        >🌶️</span>
      ))}
    </div>
  );
}

function BookCover({ book, w = 64, h = 96, radius = 6 }) {
  const [errored, setErrored] = useState(false);
  if (book.coverUrl && !errored) {
    return <img src={book.coverUrl} alt={book.title} className="book-cover-img" style={{ width: w, height: h, borderRadius: radius }} onError={() => setErrored(true)} />;
  }
  return <FallbackCover title={book.title} w={w} h={h} radius={radius} />;
}

function FallbackCover({ title, w, h, radius }) {
  return (
    <div className="book-cover-fallback" style={{ width: w, height: h, borderRadius: radius, background: hashHue(title || 'x') }}>
      <span style={{ fontSize: Math.max(12, w * 0.28) }}>{initialsOf(title)}</span>
    </div>
  );
}

function Badge({ children, tone }) {
  return <span className={`badge badge-${tone || 'muted'}`}>{children}</span>;
}

function EmptyState({ icon: Icon, title, body, action }) {
  return (
    <div className="empty-state">
      <Icon size={30} strokeWidth={1.4} />
      <h3>{title}</h3>
      <p>{body}</p>
      {action}
    </div>
  );
}

function ProgressBar({ pct, tone = 'brass' }) {
  return (
    <div className="progress-track">
      <div className={`progress-fill fill-${tone}`} style={{ width: `${clamp(pct, 0, 100)}%` }} />
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* Book progress helper                                              */
/* ---------------------------------------------------------------- */

function bookPercent(book) {
  if (book.status === 'read') return 100;
  if (book.progressType === 'pages') {
    const total = Number(book.totalPages) || 0;
    const cur = Number(book.currentPage) || 0;
    return total > 0 ? clamp(Math.round((cur / total) * 100), 0, 100) : 0;
  }
  return clamp(Number(book.percent) || 0, 0, 100);
}

/* ---------------------------------------------------------------- */
/* Open Library search                                               */
/* ---------------------------------------------------------------- */

async function searchBooks(query) {
  if (!query.trim()) return [];
  const res = await fetch(`https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&limit=8&fields=title,author_name,cover_i,first_publish_year,number_of_pages_median,key`);
  if (!res.ok) throw new Error('Search failed');
  const data = await res.json();
  return (data.docs || []).map(d => ({
    key: d.key,
    title: d.title,
    author: (d.author_name && d.author_name[0]) || 'Unknown author',
    year: d.first_publish_year || null,
    pages: d.number_of_pages_median || null,
    coverUrl: d.cover_i ? `https://covers.openlibrary.org/b/id/${d.cover_i}-M.jpg` : null,
  }));
}

/* ---------------------------------------------------------------- */
/* Canvas export for calendar                                        */
/* ---------------------------------------------------------------- */

function loadImage(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

async function renderCalendarCanvas({ year, month, books, background, opacity, monthlyCount, ytdCount, useCovers }) {
  const W = 1080, H = 1350;
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');

  if (background) {
    const img = await loadImage(background);
    if (img) {
      const scale = Math.max(W / img.width, H / img.height);
      const w = img.width * scale, h = img.height * scale;
      ctx.drawImage(img, (W - w) / 2, (H - h) / 2, w, h);
    }
  }
  if (!background) {
    const grad = ctx.createLinearGradient(0, 0, W, H);
    grad.addColorStop(0, '#0e100d');
    grad.addColorStop(1, '#5d4659');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
  }

  const pad = 56;
  ctx.fillStyle = `rgba(24, 34, 29, ${opacity})`;
  roundRectPath(ctx, pad, pad, W - pad * 2, H - pad * 2, 28);
  ctx.fill();

  ctx.textAlign = 'center';
  ctx.fillStyle = '#b9a5b0';
  ctx.font = "600 50px 'Cormorant Garamond', Georgia, serif";
  ctx.fillText(`${MONTH_NAMES[month]} ${year}`, W / 2, pad + 86);

  ctx.font = "500 24px 'Inter', sans-serif";
  ctx.fillStyle = '#a97e97';
  ctx.fillText(`${monthlyCount} finished this month  •  ${ytdCount} finished in ${year}`, W / 2, pad + 124);

  const gridTop = pad + 168;
  const gridBottom = H - pad - 36;
  const gridLeft = pad + 24;
  const gridRight = W - pad - 24;
  const cols = 7;
  const cellW = (gridRight - gridLeft) / cols;
  const rows = 6;
  const cellH = (gridBottom - gridTop) / rows;

  ctx.font = '600 18px system-ui, sans-serif';
  ctx.fillStyle = '#9FB3A2';
  WEEKDAYS.forEach((wd, i) => ctx.fillText(wd, gridLeft + cellW * i + cellW / 2, gridTop - 12));

  const cells = getMonthGrid(year, month);
  for (let i = 0; i < cells.length; i++) {
    const day = cells[i];
    if (!day) continue;
    const col = i % 7, row = Math.floor(i / 7);
    const x = gridLeft + col * cellW, y = gridTop + row * cellH;

    ctx.strokeStyle = 'rgba(159,179,162,0.22)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 3, y + 3, cellW - 6, cellH - 6);

    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(185,165,176,0.85)';
    ctx.font = '500 17px system-ui, sans-serif';
    ctx.fillText(String(day), x + 10, y + 22);

    const dk = dateKey(year, month, day);
    const finished = books.filter(b => b.dateFinished === dk);
    if (finished.length) {
      const maxShow = 3;
      const thumbSize = Math.min(cellW - 16, cellH - 30, 34);
      let cx = x + 10;
      const cy = y + cellH - thumbSize - 8;
      for (let k = 0; k < Math.min(finished.length, maxShow); k++) {
        const b = finished[k];
        let drawn = false;
        if (useCovers && b.coverUrl) {
          const img = await loadImage(b.coverUrl);
          if (img) {
            roundRectPath(ctx, cx, cy, thumbSize, thumbSize, 4);
            ctx.save(); ctx.clip();
            ctx.drawImage(img, cx, cy, thumbSize, thumbSize);
            ctx.restore();
            drawn = true;
          }
        }
        if (!drawn) {
          ctx.fillStyle = hashHue(b.title || 'x');
          roundRectPath(ctx, cx, cy, thumbSize, thumbSize, 4);
          ctx.fill();
          ctx.fillStyle = '#fff';
          ctx.font = `600 ${thumbSize * 0.4}px system-ui, sans-serif`;
          ctx.textAlign = 'center';
          ctx.fillText(initialsOf(b.title), cx + thumbSize / 2, cy + thumbSize * 0.65);
          ctx.textAlign = 'left';
        }
        cx += thumbSize + 4;
      }
      if (finished.length > maxShow) {
        ctx.fillStyle = '#a97e97';
        ctx.font = '600 14px system-ui, sans-serif';
        ctx.fillText(`+${finished.length - maxShow}`, cx, cy + thumbSize / 2 + 5);
      }
    }
  }

  return canvas;
}

async function exportCalendarPNG(params) {
  try {
    const canvas = await renderCalendarCanvas({ ...params, useCovers: true });
    return canvas.toDataURL('image/png');
  } catch (e) {
    const canvas = await renderCalendarCanvas({ ...params, useCovers: false });
    return canvas.toDataURL('image/png');
  }
}

/* ---------------------------------------------------------------- */
/* Book form modal (add / edit)                                      */
/* ---------------------------------------------------------------- */

function BookFormModal({ initial, defaultStatus, defaultProgressType, onSave, onDelete, onClose }) {
  const isEdit = !!initial;
  const [tab, setTab] = useState('search');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');

  const [form, setForm] = useState(() => initial ? { tropes: [], blurb: '', ...initial } : {
    id: uid(),
    title: '', author: '', coverUrl: '',
    formats: [], owned: false,
    status: defaultStatus || 'tbr',
    progressType: defaultProgressType || 'percent',
    currentPage: 0, totalPages: 0, percent: 0,
    isSpicy: false, spicyNotes: [],
    tropes: [],
    blurb: '',
    starRating: 0, spiceRating: 0, review: '',
    dateAdded: todayStr(), dateStarted: null, dateFinished: null,
    notes: '',
  });
  const [spicyDraft, setSpicyDraft] = useState('');
  const [tropeDraft, setTropeDraft] = useState('');

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const toggleFormat = (fmt) => setForm(f => ({ ...f, formats: f.formats.includes(fmt) ? f.formats.filter(x => x !== fmt) : [...f.formats, fmt] }));

  const runSearch = async () => {
    setSearching(true); setSearchError('');
    try {
      const r = await searchBooks(query);
      setResults(r);
      if (!r.length) setSearchError('No matches — try different words, or switch to Manual entry.');
    } catch (e) {
      setSearchError("Couldn't reach the book database. You can add this one manually instead.");
    } finally {
      setSearching(false);
    }
  };

  const pickResult = (r) => {
    setForm(f => ({ ...f, title: r.title, author: r.author, coverUrl: r.coverUrl || '', totalPages: r.pages || f.totalPages }));
    setTab('manual');
  };

  const addSpicyNote = () => {
    if (!spicyDraft.trim()) return;
    setForm(f => ({ ...f, spicyNotes: [...f.spicyNotes, { id: uid(), label: spicyDraft.trim() }], isSpicy: true }));
    setSpicyDraft('');
  };
  const removeSpicyNote = (id) => setForm(f => ({ ...f, spicyNotes: f.spicyNotes.filter(n => n.id !== id) }));

  const toggleTrope = (t) => setForm(f => ({ ...f, tropes: f.tropes.includes(t) ? f.tropes.filter(x => x !== t) : [...f.tropes, t] }));
  const addCustomTrope = () => {
    const t = tropeDraft.trim();
    if (!t || form.tropes.includes(t)) return;
    setForm(f => ({ ...f, tropes: [...f.tropes, t] }));
    setTropeDraft('');
  };
  const removeTrope = (t) => setForm(f => ({ ...f, tropes: f.tropes.filter(x => x !== t) }));

  const handleStatusChange = (status) => {
    setForm(f => {
      const next = { ...f, status };
      if (status === 'reading' && !f.dateStarted) next.dateStarted = todayStr();
      if (status === 'read' && !f.dateFinished) next.dateFinished = todayStr();
      if (status !== 'read') { next.dateFinished = null; }
      return next;
    });
  };

  const canSave = form.title.trim().length > 0;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{isEdit ? 'Edit book' : 'Add a book'}</h2>
          <button className="icon-btn" onClick={onClose}><X size={18} /></button>
        </div>

        {!isEdit && (
          <div className="tab-row">
            <button className={`tab-btn ${tab === 'search' ? 'active' : ''}`} onClick={() => setTab('search')}><Search size={14} /> Search</button>
            <button className={`tab-btn ${tab === 'manual' ? 'active' : ''}`} onClick={() => setTab('manual')}><Pencil size={14} /> Manual</button>
          </div>
        )}

        {!isEdit && tab === 'search' && (
          <div className="search-panel">
            <div className="search-input-row">
              <input
                placeholder="Title or author…"
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && runSearch()}
              />
              <button className="btn btn-brass" onClick={runSearch} disabled={searching}>{searching ? '…' : 'Search'}</button>
            </div>
            {searchError && <p className="hint-error">{searchError}</p>}
            <div className="search-results">
              {results.map(r => (
                <div key={r.key} className="search-result" onClick={() => pickResult(r)}>
                  {r.coverUrl ? <img src={r.coverUrl} alt="" /> : <FallbackCover title={r.title} w={40} h={58} radius={4} />}
                  <div>
                    <div className="sr-title">{r.title}</div>
                    <div className="sr-author">{r.author}{r.year ? ` · ${r.year}` : ''}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {(isEdit || tab === 'manual') && (
          <div className="form-body">
            <div className="form-row-cover">
              {form.coverUrl ? <img src={form.coverUrl} className="form-cover-preview" alt="" /> : <FallbackCover title={form.title} w={64} h={96} radius={6} />}
              <div className="form-cover-fields">
                <label>Title</label>
                <input value={form.title} onChange={e => set('title', e.target.value)} placeholder="Book title" />
                <label>Author</label>
                <input value={form.author} onChange={e => set('author', e.target.value)} placeholder="Author name" />
                <label>Cover image URL (optional)</label>
                <input value={form.coverUrl} onChange={e => set('coverUrl', e.target.value)} placeholder="https://…" />
              </div>
            </div>

            <label>Blurb</label>
            <textarea value={form.blurb} onChange={e => set('blurb', e.target.value)} placeholder="What's this book about?" rows={3} />

            <div className="form-grid-2">
              <div>
                <label>Format owned</label>
                <div className="chip-row">
                  <button className={`chip ${form.formats.includes('physical') ? 'chip-on' : ''}`} onClick={() => toggleFormat('physical')}><BookOpen size={13} /> Physical</button>
                  <button className={`chip ${form.formats.includes('audio') ? 'chip-on' : ''}`} onClick={() => toggleFormat('audio')}><Headphones size={13} /> Audiobook</button>
                  <button className={`chip ${form.formats.includes('ebook') ? 'chip-on' : ''}`} onClick={() => toggleFormat('ebook')}><Tablet size={13} /> E-book</button>
                </div>
                <label className="checkbox-row"><input type="checkbox" checked={form.owned} onChange={e => set('owned', e.target.checked)} /> I own this book</label>
              </div>
              <div>
                <label>Reading status</label>
                <div className="chip-row">
                  {['tbr', 'reading', 'read'].map(s => (
                    <button key={s} className={`chip ${form.status === s ? 'chip-on' : ''}`} onClick={() => handleStatusChange(s)}>
                      {s === 'tbr' ? 'TBR' : s === 'reading' ? 'Reading' : 'Finished'}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="trope-editor">
              <label>Tropes</label>
              <div className="chip-row">
                {TROPES.map(t => (
                  <button key={t} className={`chip ${form.tropes.includes(t) ? 'chip-on' : ''}`} onClick={() => toggleTrope(t)}>{t}</button>
                ))}
              </div>
              <div className="spicy-add-row" style={{ marginTop: 8 }}>
                <input placeholder="Add a custom trope…" value={tropeDraft} onChange={e => setTropeDraft(e.target.value)} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addCustomTrope())} />
                <button className="btn btn-sm" onClick={addCustomTrope}>Add</button>
              </div>
              {form.tropes.filter(t => !TROPES.includes(t)).length > 0 && (
                <div className="spicy-notes-list">
                  {form.tropes.filter(t => !TROPES.includes(t)).map(t => (
                    <span key={t} className="spicy-note trope-note">{t} <X size={11} onClick={() => removeTrope(t)} /></span>
                  ))}
                </div>
              )}
            </div>

            {form.status === 'reading' && (
              <div className="progress-editor">
                <label>Progress tracking</label>
                <div className="chip-row" style={{ marginBottom: 8 }}>
                  <button className={`chip ${form.progressType === 'percent' ? 'chip-on' : ''}`} onClick={() => set('progressType', 'percent')}>%</button>
                  <button className={`chip ${form.progressType === 'pages' ? 'chip-on' : ''}`} onClick={() => set('progressType', 'pages')}>Pages</button>
                </div>
                {form.progressType === 'percent' ? (
                  <div className="percent-row">
                    <input type="range" min="0" max="100" value={form.percent} onChange={e => set('percent', Number(e.target.value))} />
                    <span className="mono">{form.percent}%</span>
                  </div>
                ) : (
                  <div className="pages-row">
                    <input type="number" min="0" value={form.currentPage} onChange={e => set('currentPage', e.target.value)} style={{ width: 80 }} />
                    <span>of</span>
                    <input type="number" min="0" value={form.totalPages} onChange={e => set('totalPages', e.target.value)} style={{ width: 80 }} />
                    <span>pages</span>
                  </div>
                )}
              </div>
            )}

            {(form.status === 'reading' || form.status === 'read') && (
              <div className="spicy-editor">
                <label className="checkbox-row"><input type="checkbox" checked={form.isSpicy} onChange={e => set('isSpicy', e.target.checked)} /> 🌶️ This one has spicy chapters</label>
                {form.isSpicy && (
                  <>
                    <div className="spicy-add-row">
                      <input placeholder="e.g. Chapter 14…" value={spicyDraft} onChange={e => setSpicyDraft(e.target.value)} onKeyDown={e => e.key === 'Enter' && addSpicyNote()} />
                      <button className="btn btn-sm" onClick={addSpicyNote}>Add</button>
                    </div>
                    <div className="spicy-notes-list">
                      {form.spicyNotes.map(n => (
                        <span key={n.id} className="spicy-note">🌶️ {n.label} <X size={11} onClick={() => removeSpicyNote(n.id)} /></span>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            {form.status === 'read' && (
              <div className="finish-panel">
                <div className="finish-panel-ratings">
                  <PartyPopper size={16} />
                  <div>
                    <label>Star rating</label>
                    <StarRating value={form.starRating} onChange={v => set('starRating', v)} size={22} />
                  </div>
                  <div>
                    <label>Spice rating</label>
                    <ChiliRating value={form.spiceRating} onChange={v => set('spiceRating', v)} size={20} />
                  </div>
                </div>
                <label>Review</label>
                <textarea value={form.review} onChange={e => set('review', e.target.value)} placeholder="What did you think?" rows={3} />
              </div>
            )}

            <label>Notes</label>
            <textarea value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Anything you want to remember about this one…" rows={2} />

            <div className="modal-actions">
              {isEdit && <button className="btn btn-danger" onClick={() => onDelete(form.id)}><Trash2 size={14} /> Delete</button>}
              <div style={{ flex: 1 }} />
              <button className="btn" onClick={onClose}>Cancel</button>
              <button className="btn btn-brass" disabled={!canSave} onClick={() => onSave(form)}>Save</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* Book card                                                          */
/* ---------------------------------------------------------------- */

function BookCard({ book, onOpen, onQuickStatus }) {
  const pct = bookPercent(book);
  return (
    <div className="book-card" onClick={() => onOpen(book)}>
      <BookCover book={book} w={72} h={106} />
      <div className="book-card-info">
        <div className="book-card-title">{book.title}</div>
        <div className="book-card-author">{book.author}</div>
        {book.blurb && (
          <div className="book-card-blurb">{book.blurb.length > 110 ? book.blurb.slice(0, 110) + '…' : book.blurb}</div>
        )}
        <div className="badge-row">
          {book.formats.includes('physical') && <Badge tone="teal"><BookOpen size={11} /> Physical</Badge>}
          {book.formats.includes('audio') && <Badge tone="teal"><Headphones size={11} /> Audio</Badge>}
          {book.formats.includes('ebook') && <Badge tone="teal"><Tablet size={11} /> E-book</Badge>}
          {book.isSpicy && <Badge tone="chili">🌶️ Spicy</Badge>}
        </div>
        {book.tropes && book.tropes.length > 0 && (
          <div className="badge-row">
            {book.tropes.slice(0, 3).map(t => <Badge key={t} tone="plum">{t}</Badge>)}
            {book.tropes.length > 3 && <Badge tone="muted">+{book.tropes.length - 3}</Badge>}
          </div>
        )}
        {book.status === 'reading' && (
          <div className="card-progress">
            <ProgressBar pct={pct} tone="chili" />
            <span className="mono small">{book.progressType === 'pages' ? `${book.currentPage || 0}/${book.totalPages || '?'} pg` : `${pct}%`}</span>
          </div>
        )}
        {book.status === 'read' && (
          <div className="card-ratings">
            <StarRating value={book.starRating} readOnly size={13} />
            {book.spiceRating > 0 && <ChiliRating value={book.spiceRating} readOnly size={13} />}
          </div>
        )}
        {book.status === 'read' && book.review && (
          <div className="card-review"><Quote size={11} /> {book.review.length > 90 ? book.review.slice(0, 90) + '…' : book.review}</div>
        )}
        {book.status === 'reading' && (
          <button className="btn btn-sm btn-forest" onClick={(e) => { e.stopPropagation(); onQuickStatus(book, 'read'); }}>
            <Check size={12} /> Mark finished
          </button>
        )}
        {book.status === 'tbr' && (
          <button className="btn btn-sm btn-chili" onClick={(e) => { e.stopPropagation(); onQuickStatus(book, 'reading'); }}>
            <BookOpen size={12} /> Start reading
          </button>
        )}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* Views                                                              */
/* ---------------------------------------------------------------- */

function BookGrid({ books, onOpen, onQuickStatus, empty }) {
  if (!books.length) return empty;
  return <div className="book-grid">{books.map(b => <BookCard key={b.id} book={b} onOpen={onOpen} onQuickStatus={onQuickStatus} />)}</div>;
}

function HomeView({ data, releases, onOpen, onQuickStatus, onLogToday, onAdd, goToSection, onOpenRelease }) {
  const streak = useMemo(() => computeStreak(data.readingLog), [data.readingLog]);
  const loggedToday = data.readingLog.includes(todayStr());
  const currentlyReading = data.books.filter(b => b.status === 'reading');
  const thisYear = new Date().getFullYear();
  const today = todayStr();
  const finishedThisYear = data.books.filter(b => b.dateFinished && b.dateFinished.startsWith(String(thisYear))).length;
  const activeGoals = data.goals.filter(g => g.startDate <= today && today <= g.endDate).sort((a, b) => a.endDate.localeCompare(b.endDate));
  const primaryGoal = activeGoals[0];
  const primaryProgress = primaryGoal ? goalProgress(primaryGoal, data.books) : null;
  const owned = data.books.filter(b => b.owned);
  const upcomingSoon = [...releases]
    .filter(r => { const d = daysUntil(r.releaseDate); return d >= 0 && d <= 30; })
    .sort((a, b) => a.releaseDate.localeCompare(b.releaseDate));

  return (
    <div className="view-pad">
      <div className="home-hero">
        <div className="streak-card">
          <Flame size={30} className={streak > 0 ? 'flame-lit' : 'flame-out'} />
          <div>
            <div className="streak-num mono">{streak}</div>
            <div className="streak-label">day streak</div>
          </div>
          <button className={`btn btn-sm ${loggedToday ? 'btn-forest' : 'btn-brass'}`} onClick={onLogToday} disabled={loggedToday}>
            {loggedToday ? <><Check size={13} /> Logged today</> : 'I read today'}
          </button>
        </div>
        <div className="stat-card">
          <div className="stat-num mono">{finishedThisYear}</div>
          <div className="stat-label">finished in {thisYear}</div>
        </div>
        <div className="stat-card">
          {primaryGoal ? (
            <>
              <div className="stat-num mono">{primaryProgress.current}</div>
              <div className="stat-label">{primaryGoal.name}</div>
              <ProgressBar pct={primaryProgress.pct} tone="ochre" />
              <div className="stat-sub">{primaryProgress.pct}% of {primaryGoal.target} {primaryGoal.type} · <span className="link" onClick={() => goToSection('goals')}>edit</span></div>
            </>
          ) : (
            <>
              <div className="stat-label">No active goal</div>
              <div className="stat-sub"><span className="link" onClick={() => goToSection('goals')}>Set a reading goal</span></div>
            </>
          )}
        </div>
        <div className="stat-card">
          <div className="stat-num mono">{owned.length}</div>
          <div className="stat-label">books you own</div>
          <div className="stat-sub">{owned.filter(b => b.formats.includes('physical')).length} physical · {owned.filter(b => b.formats.includes('audio')).length} audio · {owned.filter(b => b.formats.includes('ebook')).length} e-book</div>
        </div>
      </div>

      <div className="section-heading-row">
        <h2>Currently reading</h2>
        <button className="btn btn-sm" onClick={onAdd}><Plus size={13} /> Add a book</button>
      </div>
      <BookGrid
        books={currentlyReading}
        onOpen={onOpen}
        onQuickStatus={onQuickStatus}
        empty={<EmptyState icon={BookOpen} title="Nothing in progress" body="Start a book from your TBR shelf, or add a new one." action={<button className="btn btn-brass" onClick={onAdd}>Add a book</button>} />}
      />

      {upcomingSoon.length > 0 && (
        <>
          <div className="section-heading-row" style={{ marginTop: 26 }}>
            <h2>Releasing in the next 30 days</h2>
            <span className="link" onClick={() => goToSection('releases')}>See all</span>
          </div>
          <div className="release-scroll">
            {upcomingSoon.map(r => {
              const d = daysUntil(r.releaseDate);
              return (
                <div key={r.id} className="release-mini-card" onClick={() => onOpenRelease(r)}>
                  {r.coverUrl ? <img src={r.coverUrl} alt="" /> : <FallbackCover title={r.title} w={64} h={94} radius={5} />}
                  <div className="release-mini-title">{r.title}</div>
                  <div className="mono release-mini-days">{d === 0 ? 'Today' : `in ${d}d`}</div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function ShelfView({ data, onOpen, onQuickStatus, onAdd, onOpenWishlist, onAddWishlist, onPurchased }) {
  const [selectedTropes, setSelectedTropes] = useState([]);
  const owned = data.books.filter(b => b.owned);
  const availableTropes = useMemo(() => Array.from(new Set(owned.flatMap(b => b.tropes || []))).sort(), [owned]);
  const toggleTropeFilter = (t) => setSelectedTropes(s => s.includes(t) ? s.filter(x => x !== t) : [...s, t]);
  const matchesTropes = (b) => !selectedTropes.length || (b.tropes || []).some(t => selectedTropes.includes(t));
  const filteredOwned = owned.filter(matchesTropes);
  const physical = filteredOwned.filter(b => b.formats.includes('physical'));
  const audio = filteredOwned.filter(b => b.formats.includes('audio'));
  const ebook = filteredOwned.filter(b => b.formats.includes('ebook'));
  const wishlist = data.wishlist;
  return (
    <div className="view-pad">
      <div className="section-heading-row">
        <h2>Books I Own</h2>
        <button className="btn btn-sm btn-brass" onClick={onAdd}><Plus size={13} /> Add a book</button>
      </div>
      {availableTropes.length > 0 && (
        <div className="trope-filter-bar">
          <label>Filter by trope</label>
          <div className="chip-row">
            {availableTropes.map(t => (
              <button key={t} className={`chip ${selectedTropes.includes(t) ? 'chip-on' : ''}`} onClick={() => toggleTropeFilter(t)}>{t}</button>
            ))}
            {selectedTropes.length > 0 && (
              <button className="chip" onClick={() => setSelectedTropes([])}><X size={12} /> Clear</button>
            )}
          </div>
        </div>
      )}
      <h3 className="subheading"><BookOpen size={15} /> Physical ({physical.length})</h3>
      <BookGrid books={physical} onOpen={onOpen} onQuickStatus={onQuickStatus} empty={<EmptyState icon={BookOpen} title="No physical books yet" body="Add the books sitting on your shelf." />} />
      <h3 className="subheading"><Headphones size={15} /> Audiobooks ({audio.length})</h3>
      <BookGrid books={audio} onOpen={onOpen} onQuickStatus={onQuickStatus} empty={<EmptyState icon={Headphones} title="No audiobooks yet" body="Add the ones in your library." />} />
      <h3 className="subheading"><Tablet size={15} /> E-books ({ebook.length})</h3>
      <BookGrid books={ebook} onOpen={onOpen} onQuickStatus={onQuickStatus} empty={<EmptyState icon={Tablet} title="No e-books yet" body="Add the ones in your e-reader library." />} />

      <div className="section-heading-row" style={{ marginTop: 26 }}>
        <h3 className="subheading" style={{ margin: 0 }}><ShoppingCart size={15} /> Wishlist ({wishlist.length})</h3>
        <button className="btn btn-sm" onClick={onAddWishlist}><Plus size={13} /> Add to wishlist</button>
      </div>
      {!wishlist.length && (
        <EmptyState icon={ShoppingCart} title="Wishlist is empty" body="Add books you're hoping to pick up, in whatever format you'd want them." />
      )}
      <div className="release-list">
        {wishlist.map(item => (
          <div key={item.id} className="release-row">
            {item.coverUrl ? <img src={item.coverUrl} className="release-cover" alt="" /> : <FallbackCover title={item.title} w={48} h={70} radius={4} />}
            <div className="release-info" onClick={() => onOpenWishlist(item)} style={{ cursor: 'pointer' }}>
              <div className="book-card-title">{item.title}</div>
              <div className="book-card-author">{item.author}</div>
              <div className="badge-row">
                {item.formatsWanted.includes('physical') && <Badge tone="teal"><BookOpen size={11} /> Physical</Badge>}
                {item.formatsWanted.includes('audio') && <Badge tone="teal"><Headphones size={11} /> Audio</Badge>}
                {item.formatsWanted.includes('ebook') && <Badge tone="teal"><Tablet size={11} /> E-book</Badge>}
              </div>
            </div>
            <div className="release-actions">
              <button className="btn btn-sm btn-forest" onClick={() => onPurchased(item)}>Got it!</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatusListView({ title, icon, status, data, onOpen, onQuickStatus, onAdd, emptyBody }) {
  const books = data.books.filter(b => b.status === status);
  return (
    <div className="view-pad">
      <div className="section-heading-row">
        <h2>{title} ({books.length})</h2>
        <button className="btn btn-sm btn-brass" onClick={onAdd}><Plus size={13} /> Add a book</button>
      </div>
      <BookGrid books={books} onOpen={onOpen} onQuickStatus={onQuickStatus} empty={<EmptyState icon={icon} title={`${title} is empty`} body={emptyBody} action={<button className="btn btn-brass" onClick={onAdd}>Add a book</button>} />} />
    </div>
  );
}

function CalendarView({ data, bg, setBg }) {
  const [cursor, setCursor] = useState(() => { const d = new Date(); return { year: d.getFullYear(), month: d.getMonth() }; });
  const [exporting, setExporting] = useState(false);
  const fileRef = useRef(null);

  const cells = useMemo(() => getMonthGrid(cursor.year, cursor.month), [cursor]);
  const finishedThisMonth = data.books.filter(b => b.dateFinished && b.dateFinished.startsWith(`${cursor.year}-${pad2(cursor.month + 1)}`)).length;
  const finishedThisYear = data.books.filter(b => b.dateFinished && b.dateFinished.startsWith(String(cursor.year))).length;

  const shift = (delta) => setCursor(c => {
    let m = c.month + delta, y = c.year;
    if (m < 0) { m = 11; y--; } if (m > 11) { m = 0; y++; }
    return { year: y, month: m };
  });

  const onUpload = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const maxW = 1600;
        const scale = Math.min(1, maxW / img.width);
        const w = img.width * scale, h = img.height * scale;
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        setBg(prev => ({ ...prev, background: canvas.toDataURL('image/jpeg', 0.85) }));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  };

  const doExport = async () => {
    setExporting(true);
    try {
      const dataUrl = await exportCalendarPNG({
        year: cursor.year, month: cursor.month, books: data.books,
        background: bg.background, opacity: bg.opacity ?? 0.72,
        monthlyCount: finishedThisMonth, ytdCount: finishedThisYear,
      });
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `${MONTH_NAMES[cursor.month]}-${cursor.year}-reading.png`;
      a.click();
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="view-pad">
      <div className="section-heading-row">
        <h2>Reading calendar</h2>
        <div className="cal-nav">
          <button className="icon-btn" onClick={() => shift(-1)}><ChevronLeft size={16} /></button>
          <span className="mono">{MONTH_NAMES[cursor.month]} {cursor.year}</span>
          <button className="icon-btn" onClick={() => shift(1)}><ChevronRight size={16} /></button>
        </div>
      </div>
      <p className="cal-counts mono">{finishedThisMonth} finished this month · {finishedThisYear} finished in {cursor.year}</p>

      <div className="cal-export-wrap" style={{ backgroundImage: bg.background ? `url(${bg.background})` : 'linear-gradient(135deg,#0e100d,#5d4659)' }}>
        <div className="cal-panel" style={{ background: `rgba(24,34,29,${bg.opacity ?? 0.72})` }}>
          <div className="cal-grid-header">
            {WEEKDAYS.map((w, i) => <span key={i}>{w}</span>)}
          </div>
          <div className="cal-grid">
            {cells.map((day, i) => {
              if (!day) return <div key={i} className="cal-cell empty" />;
              const dk = dateKey(cursor.year, cursor.month, day);
              const finished = data.books.filter(b => b.dateFinished === dk);
              return (
                <div key={i} className="cal-cell">
                  <span className="cal-day-num mono">{day}</span>
                  <div className="cal-cell-covers">
                    {finished.slice(0, 3).map(b => <BookCover key={b.id} book={b} w={20} h={28} radius={3} />)}
                    {finished.length > 3 && <span className="mono cal-more">+{finished.length - 3}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="cal-controls">
        <div>
          <label>Background photo</label>
          <div className="chip-row">
            <button className="btn btn-sm" onClick={() => fileRef.current?.click()}><Upload size={13} /> Upload</button>
            {bg.background && <button className="btn btn-sm btn-danger" onClick={() => setBg(prev => ({ ...prev, background: null }))}><X size={13} /> Remove</button>}
          </div>
          <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => onUpload(e.target.files?.[0])} />
        </div>
        <div>
          <label>Panel opacity</label>
          <input type="range" min="0.15" max="0.95" step="0.01" value={bg.opacity ?? 0.72} onChange={e => setBg(prev => ({ ...prev, opacity: Number(e.target.value) }))} />
        </div>
        <button className="btn btn-brass" onClick={doExport} disabled={exporting}><Download size={14} /> {exporting ? 'Exporting…' : 'Export as photo'}</button>
      </div>
    </div>
  );
}

function GoalsView({ data, onSave, onDelete, onAdd }) {
  return (
    <div className="view-pad">
      <div className="section-heading-row">
        <h2>Reading goals</h2>
        <button className="btn btn-sm btn-brass" onClick={onAdd}><Plus size={13} /> New goal</button>
      </div>
      {!data.goals.length && (
        <EmptyState icon={Target} title="No goals yet" body="Set a reading goal — annual, seasonal, or a personal challenge with its own dates." action={<button className="btn btn-brass" onClick={onAdd}>New goal</button>} />
      )}
      <div className="goals-list">
        {data.goals.map(goal => {
          const { current, pct } = goalProgress(goal, data.books);
          return (
            <div key={goal.id} className="goal-card">
              <div className="goal-card-header">
                <input className="goal-name-input" value={goal.name} onChange={e => onSave({ ...goal, name: e.target.value })} placeholder="Goal name" />
                <button className="icon-btn" onClick={() => onDelete(goal.id)}><Trash2 size={14} /></button>
              </div>
              <div className="chip-row" style={{ margin: '10px 0' }}>
                <button className={`chip ${goal.type === 'books' ? 'chip-on' : ''}`} onClick={() => onSave({ ...goal, type: 'books' })}>Books</button>
                <button className={`chip ${goal.type === 'pages' ? 'chip-on' : ''}`} onClick={() => onSave({ ...goal, type: 'pages' })}>Pages</button>
              </div>
              <div className="goal-target-row">
                <span>Target:</span>
                <input type="number" min="1" value={goal.target} onChange={e => onSave({ ...goal, target: Number(e.target.value) })} style={{ width: 90 }} />
                <span>{goal.type}</span>
              </div>
              <div className="goal-dates-row">
                <div>
                  <label>Start</label>
                  <input type="date" value={goal.startDate} onChange={e => onSave({ ...goal, startDate: e.target.value })} />
                </div>
                <div>
                  <label>End</label>
                  <input type="date" value={goal.endDate} onChange={e => onSave({ ...goal, endDate: e.target.value })} />
                </div>
              </div>
              <div className="goal-progress">
                <ProgressBar pct={pct} tone="ochre" />
                <div className="mono goal-progress-label">{current} / {goal.target} {goal.type} · {pct}%</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function fileToCoverBlob(file, maxW = 600) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxW / img.width);
        const w = img.width * scale, h = img.height * scale;
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Could not process image')), 'image/jpeg', 0.85);
      };
      img.onerror = () => reject(new Error('Could not read image'));
      img.src = e.target.result;
    };
    reader.onerror = () => reject(new Error('Could not read file'));
    reader.readAsDataURL(file);
  });
}

function ReleaseFormModal({ onSave, onClose }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [form, setForm] = useState({ id: uid(), title: '', author: '', coverUrl: '', blurb: '', format: 'physical', releaseDate: todayStr() });
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [goodreadsUrl, setGoodreadsUrl] = useState('');
  const [fetchingGoodreads, setFetchingGoodreads] = useState(false);
  const [goodreadsError, setGoodreadsError] = useState('');
  const fileRef = useRef(null);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const runSearch = async () => {
    setSearching(true);
    try { setResults(await searchBooks(query)); } catch (e) { setResults([]); } finally { setSearching(false); }
  };
  const pick = (r) => setForm(f => ({ ...f, title: r.title, author: r.author, coverUrl: r.coverUrl || '' }));

  const fetchFromGoodreads = async () => {
    if (!goodreadsUrl.trim()) return;
    setFetchingGoodreads(true); setGoodreadsError('');
    try {
      const res = await fetch(`/api/goodreads?url=${encodeURIComponent(goodreadsUrl.trim())}`);
      const info = await res.json();
      if (!res.ok) throw new Error(info.error || 'Lookup failed.');
      setForm(f => ({
        ...f,
        title: info.title || f.title,
        author: info.author || f.author,
        coverUrl: info.coverUrl || f.coverUrl,
        blurb: info.blurb || f.blurb,
        releaseDate: info.releaseDate || f.releaseDate,
      }));
      if (!info.releaseDate) setGoodreadsError('Got the book details, but no release date — add it manually below.');
    } catch (e) {
      setGoodreadsError("Couldn't read that Goodreads page. You can search above or enter details manually instead.");
    } finally {
      setFetchingGoodreads(false);
    }
  };

  const handleCoverUpload = async (file) => {
    if (!file) return;
    setUploading(true); setUploadError('');
    try {
      const blob = await fileToCoverBlob(file);
      const path = `${uid()}.jpg`;
      const { error: upErr } = await supabase.storage.from('release-covers').upload(path, blob, { contentType: 'image/jpeg' });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from('release-covers').getPublicUrl(path);
      setForm(f => ({ ...f, coverUrl: pub.publicUrl }));
    } catch (e) {
      setUploadError('Could not upload cover photo.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header"><h2>Add an upcoming release</h2><button className="icon-btn" onClick={onClose}><X size={18} /></button></div>
        <div className="search-panel">
          <label>Paste a Goodreads link</label>
          <div className="search-input-row">
            <input placeholder="https://www.goodreads.com/book/show/…" value={goodreadsUrl} onChange={e => setGoodreadsUrl(e.target.value)} onKeyDown={e => e.key === 'Enter' && fetchFromGoodreads()} />
            <button className="btn btn-brass" onClick={fetchFromGoodreads} disabled={fetchingGoodreads}>{fetchingGoodreads ? '…' : 'Fetch'}</button>
          </div>
          {goodreadsError && <p className="hint-error">{goodreadsError}</p>}
        </div>
        <div className="search-panel">
          <label>Or search Open Library</label>
          <div className="search-input-row">
            <input placeholder="Title or author…" value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && runSearch()} />
            <button className="btn btn-brass" onClick={runSearch} disabled={searching}>{searching ? '…' : 'Search'}</button>
          </div>
          <div className="search-results">
            {results.map(r => (
              <div key={r.key} className="search-result" onClick={() => pick(r)}>
                {r.coverUrl ? <img src={r.coverUrl} alt="" /> : <FallbackCover title={r.title} w={40} h={58} radius={4} />}
                <div><div className="sr-title">{r.title}</div><div className="sr-author">{r.author}</div></div>
              </div>
            ))}
          </div>
        </div>
        <div className="form-body">
          <label>Title</label>
          <input value={form.title} onChange={e => set('title', e.target.value)} />
          <label>Author</label>
          <input value={form.author} onChange={e => set('author', e.target.value)} />
          <div className="form-row-cover">
            {form.coverUrl ? <img src={form.coverUrl} className="form-cover-preview" alt="" /> : <FallbackCover title={form.title} w={64} h={96} radius={6} />}
            <div className="form-cover-fields">
              <label>Cover photo</label>
              <button type="button" className="btn btn-sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
                <Upload size={13} /> {uploading ? 'Uploading…' : 'Upload cover photo'}
              </button>
              <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => handleCoverUpload(e.target.files?.[0])} />
              {uploadError && <p className="hint-error">{uploadError}</p>}
            </div>
          </div>
          <label>Blurb</label>
          <textarea value={form.blurb} onChange={e => set('blurb', e.target.value)} placeholder="What's this book about?" rows={3} />
          <label>Format</label>
          <div className="chip-row">
            <button className={`chip ${form.format === 'physical' ? 'chip-on' : ''}`} onClick={() => set('format', 'physical')}><BookOpen size={13} /> Book</button>
            <button className={`chip ${form.format === 'audio' ? 'chip-on' : ''}`} onClick={() => set('format', 'audio')}><Headphones size={13} /> Audiobook</button>
          </div>
          <label>Release date</label>
          <input type="date" value={form.releaseDate} onChange={e => set('releaseDate', e.target.value)} />
          <div className="modal-actions">
            <div style={{ flex: 1 }} />
            <button className="btn" onClick={onClose}>Cancel</button>
            <button className="btn btn-brass" disabled={!form.title.trim()} onClick={() => onSave(form)}>Add</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ReleaseDetailModal({ release, isOwner, onClose, onConvertToTBR, onAddToWishlist, onRemove }) {
  const d = daysUntil(release.releaseDate);
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header"><h2>{release.title}</h2><button className="icon-btn" onClick={onClose}><X size={18} /></button></div>
        <div className="form-body">
          <div className="form-row-cover">
            {release.coverUrl ? <img src={release.coverUrl} className="form-cover-preview" alt="" /> : <FallbackCover title={release.title} w={64} h={96} radius={6} />}
            <div className="form-cover-fields">
              <div className="book-card-author">{release.author}</div>
              <div className="badge-row" style={{ marginTop: 4 }}>
                <Badge tone="teal">{release.format === 'audio' ? <><Headphones size={11} /> Audiobook</> : <><BookOpen size={11} /> Book</>}</Badge>
                {d < 0 ? <Badge tone="forest">Released</Badge> : d === 0 ? <Badge tone="chili">Today!</Badge> : <Badge tone="muted">in {d} day{d === 1 ? '' : 's'}</Badge>}
              </div>
              <div className="mono small ash" style={{ marginTop: 4 }}>{release.releaseDate}</div>
            </div>
          </div>
          <p className={`release-detail-blurb${release.blurb ? '' : ' ash'}`}>{release.blurb || 'No blurb available for this one yet.'}</p>
          <div className="modal-actions">
            {isOwner && <button className="btn btn-danger" onClick={() => { onRemove(release.id); onClose(); }}><Trash2 size={14} /> Remove</button>}
            <div style={{ flex: 1 }} />
            <button className="btn btn-sm" onClick={() => onAddToWishlist(release)}><ShoppingCart size={13} /> Add to Wishlist</button>
            {d <= 0 && <button className="btn btn-brass" onClick={() => onConvertToTBR(release)}>Add to TBR</button>}
          </div>
        </div>
      </div>
    </div>
  );
}

function ReleasesView({ releases, isOwner, onAdd, onRemove, onConvertToTBR, onAddToWishlist, onOpenRelease }) {
  const sorted = [...releases].sort((a, b) => a.releaseDate.localeCompare(b.releaseDate));
  return (
    <div className="view-pad">
      <div className="section-heading-row">
        <h2>Upcoming releases</h2>
        {isOwner && <button className="btn btn-sm btn-brass" onClick={onAdd}><Plus size={13} /> Add release</button>}
      </div>
      {!sorted.length && <EmptyState icon={Clock} title="Nothing on the horizon yet" body="Add books and audiobooks you're excited about." action={isOwner ? <button className="btn btn-brass" onClick={onAdd}>Add release</button> : null} />}
      <div className="release-list">
        {sorted.map(r => {
          const d = daysUntil(r.releaseDate);
          return (
            <div key={r.id} className="release-row" onClick={() => onOpenRelease(r)} style={{ cursor: 'pointer' }}>
              {r.coverUrl ? <img src={r.coverUrl} className="release-cover" alt="" /> : <FallbackCover title={r.title} w={48} h={70} radius={4} />}
              <div className="release-info">
                <div className="book-card-title">{r.title}</div>
                <div className="book-card-author">{r.author}</div>
                <Badge tone="teal">{r.format === 'audio' ? <><Headphones size={11} /> Audiobook</> : <><BookOpen size={11} /> Book</>}</Badge>
              </div>
              <div className="release-countdown">
                {d < 0 ? <Badge tone="forest">Released</Badge> : d === 0 ? <Badge tone="chili">Today!</Badge> : <span className="mono">in {d} day{d === 1 ? '' : 's'}</span>}
                <span className="mono small ash">{r.releaseDate}</span>
              </div>
              <div className="release-actions">
                <button className="btn btn-sm" onClick={(e) => { e.stopPropagation(); onAddToWishlist(r); }}><ShoppingCart size={12} /> Wishlist</button>
                {d <= 0 && <button className="btn btn-sm" onClick={(e) => { e.stopPropagation(); onConvertToTBR(r); }}>Add to TBR</button>}
                {isOwner && <button className="icon-btn" onClick={(e) => { e.stopPropagation(); onRemove(r.id); }}><Trash2 size={14} /></button>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* Wishlist                                                            */
/* ---------------------------------------------------------------- */

function WishlistFormModal({ initial, onSave, onDelete, onClose }) {
  const isEdit = !!initial;
  const [tab, setTab] = useState('search');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [form, setForm] = useState(() => initial ? { ...initial } : {
    id: uid(), title: '', author: '', coverUrl: '', formatsWanted: [], notes: '', dateAdded: todayStr(),
  });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const toggleFormat = (fmt) => setForm(f => ({ ...f, formatsWanted: f.formatsWanted.includes(fmt) ? f.formatsWanted.filter(x => x !== fmt) : [...f.formatsWanted, fmt] }));

  const runSearch = async () => {
    setSearching(true);
    try { setResults(await searchBooks(query)); } catch (e) { setResults([]); } finally { setSearching(false); }
  };
  const pick = (r) => { setForm(f => ({ ...f, title: r.title, author: r.author, coverUrl: r.coverUrl || '' })); setTab('manual'); };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{isEdit ? 'Edit wishlist item' : 'Add to wishlist'}</h2>
          <button className="icon-btn" onClick={onClose}><X size={18} /></button>
        </div>

        {!isEdit && (
          <div className="tab-row">
            <button className={`tab-btn ${tab === 'search' ? 'active' : ''}`} onClick={() => setTab('search')}><Search size={14} /> Search</button>
            <button className={`tab-btn ${tab === 'manual' ? 'active' : ''}`} onClick={() => setTab('manual')}><Pencil size={14} /> Manual</button>
          </div>
        )}

        {!isEdit && tab === 'search' && (
          <div className="search-panel">
            <div className="search-input-row">
              <input placeholder="Title or author…" value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && runSearch()} />
              <button className="btn btn-brass" onClick={runSearch} disabled={searching}>{searching ? '…' : 'Search'}</button>
            </div>
            <div className="search-results">
              {results.map(r => (
                <div key={r.key} className="search-result" onClick={() => pick(r)}>
                  {r.coverUrl ? <img src={r.coverUrl} alt="" /> : <FallbackCover title={r.title} w={40} h={58} radius={4} />}
                  <div><div className="sr-title">{r.title}</div><div className="sr-author">{r.author}</div></div>
                </div>
              ))}
            </div>
          </div>
        )}

        {(isEdit || tab === 'manual') && (
          <div className="form-body">
            <div className="form-row-cover">
              {form.coverUrl ? <img src={form.coverUrl} className="form-cover-preview" alt="" /> : <FallbackCover title={form.title} w={64} h={96} radius={6} />}
              <div className="form-cover-fields">
                <label>Title</label>
                <input value={form.title} onChange={e => set('title', e.target.value)} placeholder="Book title" />
                <label>Author</label>
                <input value={form.author} onChange={e => set('author', e.target.value)} placeholder="Author name" />
                <label>Cover image URL (optional)</label>
                <input value={form.coverUrl} onChange={e => set('coverUrl', e.target.value)} placeholder="https://…" />
              </div>
            </div>
            <label>Format(s) you want</label>
            <div className="chip-row">
              <button className={`chip ${form.formatsWanted.includes('physical') ? 'chip-on' : ''}`} onClick={() => toggleFormat('physical')}><BookOpen size={13} /> Physical</button>
              <button className={`chip ${form.formatsWanted.includes('audio') ? 'chip-on' : ''}`} onClick={() => toggleFormat('audio')}><Headphones size={13} /> Audiobook</button>
              <button className={`chip ${form.formatsWanted.includes('ebook') ? 'chip-on' : ''}`} onClick={() => toggleFormat('ebook')}><Tablet size={13} /> E-book</button>
            </div>
            <label>Notes</label>
            <textarea value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Why you want it, edition, price watch, etc." rows={2} />
            <div className="modal-actions">
              {isEdit && <button className="btn btn-danger" onClick={() => onDelete(form.id)}><Trash2 size={14} /> Remove</button>}
              <div style={{ flex: 1 }} />
              <button className="btn" onClick={onClose}>Cancel</button>
              <button className="btn btn-brass" disabled={!form.title.trim()} onClick={() => onSave(form)}>Save</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* Spine navigation                                                   */
/* ---------------------------------------------------------------- */

function SpineNav({ active, onSelect }) {
  return (
    <div className="spine-shelf">
      <div className="spine-nav">
        {SECTIONS.map(s => {
          const Icon = s.icon;
          const isActive = active === s.id;
          return (
            <button key={s.id} className={`spine ${isActive ? 'active' : ''}`} style={{ background: s.color }} onClick={() => onSelect(s.id)}>
              <Icon size={14} className="spine-icon" />
              <span>{s.label}</span>
            </button>
          );
        })}
      </div>
      <div className="shelf-board" />
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* Reading tracker (signed-in app)                                    */
/* ---------------------------------------------------------------- */

function ReadingTracker({ session }) {
  const userId = session.user.id;
  const isOwner = session.user.email === OWNER_EMAIL;
  const [data, setData] = useState(null);
  const [bg, setBgState] = useState({ background: null, opacity: 0.72 });
  const [releases, setReleases] = useState([]);
  const [section, setSection] = useState('home');
  const [modal, setModal] = useState(null); // {type:'book'|'release'|'wishlist', payload}
  const [tagline] = useState(randomTagline);
  const loadedRef = useRef(false);

  useEffect(() => {
    (async () => {
      let d = emptyData();
      let b = { background: null, opacity: 0.72 };
      try {
        const { data: row, error } = await supabase.from('user_data').select('data').eq('user_id', userId).maybeSingle();
        if (error) throw error;
        if (row?.data) {
          const parsed = row.data;
          d = { ...emptyData(), ...parsed };
          if (!parsed.goals || !parsed.goals.length) {
            if (parsed.goal) {
              const y = parsed.goal.year || new Date().getFullYear();
              d.goals = [{ id: uid(), name: `${y} Reading Goal`, type: parsed.goal.type || 'books', target: parsed.goal.target || 20, startDate: `${y}-01-01`, endDate: `${y}-12-31` }];
            } else {
              d.goals = [defaultGoal()];
            }
          }
          if (!parsed.wishlist) d.wishlist = [];
        }
      } catch (e) { console.error('Failed to load reading data:', e); }
      try {
        const { data: bgRow, error } = await supabase.from('user_calendar').select('background, opacity').eq('user_id', userId).maybeSingle();
        if (error) throw error;
        if (bgRow) b = { background: bgRow.background || null, opacity: bgRow.opacity ?? 0.72 };
      } catch (e) { console.error('Failed to load calendar background:', e); }
      setData(d);
      setBgState(b);
      loadedRef.current = true;
    })();
  }, [userId]);

  useEffect(() => {
    (async () => {
      const { data: rows, error } = await supabase.from('releases').select('*').order('release_date', { ascending: true });
      if (error) { console.error('Failed to load releases:', error); return; }
      setReleases((rows || []).map(r => ({ id: r.id, title: r.title, author: r.author, coverUrl: r.cover_url, blurb: r.blurb, format: r.format, releaseDate: r.release_date })));
    })();
  }, []);

  useEffect(() => {
    if (!loadedRef.current || !data) return;
    supabase.from('user_data')
      .upsert({ user_id: userId, data, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
      .then(({ error }) => { if (error) console.error('Failed to save reading data:', error); });
  }, [data, userId]);

  useEffect(() => {
    if (!loadedRef.current) return;
    supabase.from('user_calendar')
      .upsert({ user_id: userId, background: bg.background, opacity: bg.opacity ?? 0.72 }, { onConflict: 'user_id' })
      .then(({ error }) => { if (error) console.error('Failed to save calendar background:', error); });
  }, [bg, userId]);

  const setBg = useCallback((updater) => setBgState(updater), []);

  const saveBook = (book) => {
    setData(d => {
      const exists = d.books.some(b => b.id === book.id);
      const books = exists ? d.books.map(b => b.id === book.id ? book : b) : [...d.books, book];
      let readingLog = d.readingLog;
      if (book.status === 'read' && book.dateFinished && !readingLog.includes(book.dateFinished)) {
        readingLog = [...readingLog, book.dateFinished];
      }
      return { ...d, books, readingLog };
    });
    setModal(null);
  };

  const deleteBook = (id) => {
    setData(d => ({ ...d, books: d.books.filter(b => b.id !== id) }));
    setModal(null);
  };

  const quickStatus = (book, status) => {
    const updated = { ...book, status };
    if (status === 'reading' && !updated.dateStarted) updated.dateStarted = todayStr();
    if (status === 'read') {
      updated.dateFinished = updated.dateFinished || todayStr();
      setModal({ type: 'book', payload: updated });
      return;
    }
    saveBook(updated);
  };

  const logToday = () => {
    const t = todayStr();
    setData(d => d.readingLog.includes(t) ? d : { ...d, readingLog: [...d.readingLog, t] });
  };

  const saveRelease = async (release) => {
    const { data: row, error } = await supabase.from('releases').insert({
      title: release.title, author: release.author, cover_url: release.coverUrl || null,
      blurb: release.blurb || null, format: release.format, release_date: release.releaseDate,
    }).select().single();
    if (error) { console.error('Failed to add release:', error); return; }
    setReleases(r => [...r, { id: row.id, title: row.title, author: row.author, coverUrl: row.cover_url, blurb: row.blurb, format: row.format, releaseDate: row.release_date }]);
    setModal(null);
  };
  const removeRelease = async (id) => {
    const { error } = await supabase.from('releases').delete().eq('id', id);
    if (error) { console.error('Failed to remove release:', error); return; }
    setReleases(r => r.filter(x => x.id !== id));
  };
  const convertToTBR = (release) => {
    saveBook({
      id: uid(), title: release.title, author: release.author, coverUrl: release.coverUrl || '',
      formats: [], owned: false, status: 'tbr', progressType: data.prefs.defaultProgressType,
      currentPage: 0, totalPages: 0, percent: 0, isSpicy: false, spicyNotes: [], tropes: [],
      blurb: release.blurb || '',
      starRating: 0, spiceRating: 0, dateAdded: todayStr(), dateStarted: null, dateFinished: null, notes: '',
    });
  };
  const addReleaseToWishlist = (release) => {
    saveWishlistItem({
      id: uid(), title: release.title, author: release.author, coverUrl: release.coverUrl || '',
      formatsWanted: release.format ? [release.format] : [], notes: '', dateAdded: todayStr(),
    });
  };
  const openReleaseDetail = (release) => setModal({ type: 'releaseDetail', payload: release });

  const saveGoal = (goal) => setData(d => ({ ...d, goals: d.goals.some(g => g.id === goal.id) ? d.goals.map(g => g.id === goal.id ? goal : g) : [...d.goals, goal] }));
  const deleteGoal = (id) => setData(d => ({ ...d, goals: d.goals.filter(g => g.id !== id) }));
  const addGoal = () => saveGoal(defaultGoal());

  const saveWishlistItem = (item) => {
    setData(d => {
      const exists = d.wishlist.some(w => w.id === item.id);
      const wishlist = exists ? d.wishlist.map(w => w.id === item.id ? item : w) : [...d.wishlist, item];
      return { ...d, wishlist };
    });
    setModal(null);
  };
  const deleteWishlistItem = (id) => {
    setData(d => ({ ...d, wishlist: d.wishlist.filter(w => w.id !== id) }));
    setModal(null);
  };
  const purchaseWishlistItem = (item) => {
    setData(d => ({
      ...d,
      wishlist: d.wishlist.filter(w => w.id !== item.id),
      books: [...d.books, {
        id: uid(), title: item.title, author: item.author, coverUrl: item.coverUrl || '',
        formats: item.formatsWanted.length ? item.formatsWanted : ['physical'], owned: true, status: 'tbr',
        progressType: d.prefs.defaultProgressType, currentPage: 0, totalPages: 0, percent: 0,
        isSpicy: false, spicyNotes: [], tropes: [], blurb: '', starRating: 0, spiceRating: 0, review: '',
        dateAdded: todayStr(), dateStarted: null, dateFinished: null, notes: item.notes || '',
      }],
    }));
  };

  const openAddBook = () => setModal({ type: 'book', payload: null });
  const openEditBook = (book) => setModal({ type: 'book', payload: book });
  const openAddWishlist = () => setModal({ type: 'wishlist', payload: null });
  const openEditWishlist = (item) => setModal({ type: 'wishlist', payload: item });

  if (!data) {
    return (
      <div className="app-shell loading-shell">
        <div className="loading-spinner" />
        <p className="mono">Opening your library…</p>
        <style>{STYLES}</style>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="header-row">
          <div className="wordmark">
            <BookMarked size={20} />
            <span>Tropeology</span>
          </div>
          <button className="icon-btn" onClick={() => supabase.auth.signOut()} title="Sign out"><LogOut size={16} /></button>
        </div>
        <p className="tagline">{tagline}</p>
      </header>

      <SpineNav active={section} onSelect={setSection} />

      <main className="app-main">
        {section === 'home' && <HomeView data={data} releases={releases} onOpen={openEditBook} onQuickStatus={quickStatus} onLogToday={logToday} onAdd={openAddBook} goToSection={setSection} onOpenRelease={openReleaseDetail} />}
        {section === 'shelf' && <ShelfView data={data} onOpen={openEditBook} onQuickStatus={quickStatus} onAdd={openAddBook} onOpenWishlist={openEditWishlist} onAddWishlist={openAddWishlist} onPurchased={purchaseWishlistItem} />}
        {section === 'tbr' && <StatusListView title="TBR" icon={BookMarked} status="tbr" data={data} onOpen={openEditBook} onQuickStatus={quickStatus} onAdd={openAddBook} emptyBody="Add the books you're excited to get to." />}
        {section === 'reading' && <StatusListView title="Currently reading" icon={BookOpen} status="reading" data={data} onOpen={openEditBook} onQuickStatus={quickStatus} onAdd={openAddBook} emptyBody="Start a book from your TBR shelf." />}
        {section === 'finished' && <StatusListView title="Finished" icon={Check} status="read" data={data} onOpen={openEditBook} onQuickStatus={quickStatus} onAdd={openAddBook} emptyBody="Books you've completed will show up here, with your ratings and reviews." />}
        {section === 'calendar' && <CalendarView data={data} bg={bg} setBg={setBg} />}
        {section === 'goals' && <GoalsView data={data} onSave={saveGoal} onDelete={deleteGoal} onAdd={addGoal} />}
        {section === 'releases' && <ReleasesView releases={releases} isOwner={isOwner} onAdd={() => setModal({ type: 'release' })} onRemove={removeRelease} onConvertToTBR={convertToTBR} onAddToWishlist={addReleaseToWishlist} onOpenRelease={openReleaseDetail} />}
      </main>

      {modal?.type === 'book' && (
        <BookFormModal
          initial={modal.payload}
          defaultStatus={section === 'tbr' ? 'tbr' : section === 'reading' ? 'reading' : section === 'finished' ? 'read' : 'tbr'}
          defaultProgressType={data.prefs.defaultProgressType}
          onSave={saveBook}
          onDelete={deleteBook}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.type === 'release' && <ReleaseFormModal onSave={saveRelease} onClose={() => setModal(null)} />}
      {modal?.type === 'releaseDetail' && (
        <ReleaseDetailModal
          release={modal.payload}
          isOwner={isOwner}
          onClose={() => setModal(null)}
          onConvertToTBR={convertToTBR}
          onAddToWishlist={addReleaseToWishlist}
          onRemove={removeRelease}
        />
      )}
      {modal?.type === 'wishlist' && <WishlistFormModal initial={modal.payload} onSave={saveWishlistItem} onDelete={deleteWishlistItem} onClose={() => setModal(null)} />}

      <style>{STYLES}</style>
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* Auth gate                                                          */
/* ---------------------------------------------------------------- */

export default function App() {
  const [session, setSession] = useState(undefined); // undefined = checking, null = signed out

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => setSession(session));
    return () => listener.subscription.unsubscribe();
  }, []);

  if (session === undefined) {
    return <div className="auth-loading">Loading…</div>;
  }
  if (!session) return <Auth />;
  return <ReadingTracker key={session.user.id} session={session} />;
}

/* ---------------------------------------------------------------- */
/* Styles                                                             */
/* ---------------------------------------------------------------- */

const STYLES = `
:root {
  --endsheet: #0e100d;
  --cloth: #211e1e;
  --cloth-2: #31292c;
  --foxing: #b9a5b0;
  --ash: #939894;
  --brass: #a97e97;
  --chili: #762d37;
  --forest: #6f3e4f;
  --teal: #765676;
  --plum: #815889;
  --navy: #5d4659;
  --ochre: #945f57;
  --wine: #682b33;
}
* { box-sizing: border-box; }
.app-shell {
  background: var(--endsheet);
  color: var(--foxing);
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
  font-weight: 500;
  min-height: 100%;
  width: 100%;
  border-radius: 12px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
.mono { font-family: 'SFMono-Regular', Consolas, 'Courier New', monospace; }
.small { font-size: 12px; }
.ash { color: var(--ash); }
.loading-shell { align-items: center; justify-content: center; padding: 80px 20px; gap: 12px; }
.loading-spinner { width: 26px; height: 26px; border: 3px solid var(--cloth-2); border-top-color: var(--brass); border-radius: 50%; animation: spin 0.8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

.app-header { padding: 22px 24px 8px; }
.header-row { display: flex; align-items: center; justify-content: space-between; }
.auth-loading { min-height: 100vh; display: flex; align-items: center; justify-content: center; background: #0e100d; color: #939894; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif; font-weight: 500; }
.wordmark { display: flex; align-items: center; gap: 8px; font-family: 'Cormorant Garamond', Georgia, serif; font-size: 26px; font-weight: 600; color: var(--brass); letter-spacing: 0.01em; }
.tagline { margin: 2px 0 0 28px; color: var(--ash); font-size: 13px; font-style: italic; }

.spine-shelf { padding: 10px 24px 0; }
.spine-nav { display: flex; align-items: flex-end; gap: 5px; height: 96px; overflow-x: auto; padding-bottom: 0; -webkit-overflow-scrolling: touch; }
.spine {
  writing-mode: vertical-rl; transform: rotate(180deg) translateZ(0);
  min-width: 34px; height: 84px; border: none; border-radius: 7px 7px 2px 2px;
  color: var(--foxing); cursor: pointer; display: flex; flex-direction: column; align-items: center;
  justify-content: center; gap: 8px; padding: 10px 0; font-size: 12.5px; font-weight: 600;
  letter-spacing: 0.03em; box-shadow: inset -3px 0 0 rgba(0,0,0,0.18); transition: transform 0.18s ease, height 0.18s ease, box-shadow 0.18s ease;
  opacity: 0.72; flex-shrink: 0;
  backface-visibility: hidden; will-change: transform;
  text-rendering: optimizeLegibility; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale;
}
.spine .spine-icon { transform: rotate(90deg) translateZ(0); backface-visibility: hidden; }
.spine:hover { opacity: 0.92; }
.spine.active { opacity: 1; transform: translateY(-12px) rotate(180deg) translateZ(0); height: 96px; box-shadow: 0 10px 18px rgba(0,0,0,0.35); }
.shelf-board { height: 8px; background: linear-gradient(180deg, #3a1f28, #170f12); border-radius: 0 0 6px 6px; margin-top: -2px; }

.app-main { flex: 1; overflow-y: auto; }
.view-pad { padding: 20px 24px 36px; }

.section-heading-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; gap: 10px; flex-wrap: wrap; }
.section-heading-row h2 { margin: 0; font-family: 'Cormorant Garamond', Georgia, serif; font-size: 20px; font-weight: 600; }
.subheading { display: flex; align-items: center; gap: 6px; font-size: 15px; color: var(--ash); margin: 22px 0 10px; font-weight: 600; }
.trope-filter-bar { margin-bottom: 18px; }
.trope-filter-bar label { display: block; font-size: 11.5px; color: var(--ash); font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 8px; }

.btn {
  background: var(--cloth-2); color: var(--foxing); border: 1px solid rgba(185,165,176,0.14);
  padding: 8px 14px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer;
  display: inline-flex; align-items: center; gap: 6px; transition: transform 0.12s, background 0.12s;
}
.btn:hover { transform: translateY(-1px); }
.btn:disabled { opacity: 0.45; cursor: default; transform: none; }
.btn-sm { padding: 5px 10px; font-size: 12px; }
.btn-brass { background: var(--brass); color: #0e100d; border-color: transparent; }
.btn-chili { background: var(--chili); color: #fff; border-color: transparent; }
.btn-forest { background: var(--forest); color: #fff; border-color: transparent; }
.btn-danger { background: transparent; color: #cf5969; border-color: #cf5969; }
.icon-btn { background: transparent; border: none; color: var(--foxing); cursor: pointer; padding: 6px; border-radius: 6px; display: flex; }
.icon-btn:hover { background: rgba(185,165,176,0.08); }
.link { color: var(--brass); cursor: pointer; text-decoration: underline; }

.home-hero { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 14px; margin-bottom: 26px; }
.streak-card, .stat-card { background: var(--cloth); border-radius: 14px; padding: 16px; display: flex; flex-direction: column; gap: 8px; }
.streak-card { flex-direction: row; align-items: center; }
.flame-lit { color: var(--brass); }
.flame-out { color: var(--ash); opacity: 0.5; }
.streak-num { font-size: 28px; font-weight: 700; line-height: 1; }
.streak-label { color: var(--ash); font-size: 12px; }
.streak-card .btn { margin-left: auto; }
.stat-num { font-size: 26px; font-weight: 700; }
.stat-label { color: var(--ash); font-size: 12px; margin-top: -6px; }
.stat-sub { font-size: 11.5px; color: var(--ash); }

.book-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 14px; }
.book-card { display: flex; gap: 12px; background: var(--cloth); border-radius: 12px; padding: 12px; cursor: pointer; transition: transform 0.12s, background 0.12s; }
.book-card:hover { transform: translateY(-2px); background: var(--cloth-2); }
.book-cover-img { object-fit: cover; flex-shrink: 0; }
.book-cover-fallback { display: flex; align-items: center; justify-content: center; color: #fff; font-weight: 700; flex-shrink: 0; }
.book-card-info { display: flex; flex-direction: column; gap: 5px; min-width: 0; flex: 1; }
.book-card-title { font-weight: 700; font-size: 14px; line-height: 1.25; }
.book-card-author { color: var(--ash); font-size: 12.5px; }
.book-card-blurb { color: var(--ash); font-size: 11.5px; line-height: 1.35; margin: 1px 0; }
.badge-row { display: flex; flex-wrap: wrap; gap: 5px; margin: 2px 0; }
.badge { font-size: 10.5px; font-weight: 700; padding: 3px 7px; border-radius: 20px; display: inline-flex; align-items: center; gap: 3px; }
.badge-teal { background: rgba(118,86,118,0.35); color: #e1c1e1; }
.badge-chili { background: rgba(118,45,55,0.3); color: #e0aeb5; }
.badge-forest { background: rgba(111,62,79,0.35); color: #debac7; }
.badge-muted { background: rgba(147,152,148,0.18); color: var(--ash); }
.badge-plum { background: rgba(129,88,137,0.35); color: #dcc1e1; }
.card-progress { display: flex; align-items: center; gap: 8px; margin-top: 2px; }
.card-ratings { display: flex; flex-direction: column; gap: 3px; margin-top: 2px; }

.progress-track { flex: 1; height: 6px; background: rgba(147,152,148,0.2); border-radius: 4px; overflow: hidden; }
.progress-fill { height: 100%; border-radius: 4px; }
.fill-brass { background: var(--brass); }
.fill-chili { background: var(--chili); }
.fill-ochre { background: var(--ochre); }

.rating-row { display: flex; gap: 2px; align-items: center; }
.star-icon { color: var(--ash); }
.star-icon.filled { color: var(--brass); fill: var(--brass); }
.star-icon.clickable { cursor: pointer; }

.empty-state { text-align: center; padding: 40px 20px; color: var(--ash); display: flex; flex-direction: column; align-items: center; gap: 8px; }
.empty-state h3 { color: var(--foxing); margin: 4px 0 0; font-family: 'Cormorant Garamond', Georgia, serif; font-weight: 600; }
.empty-state p { margin: 0 0 6px; font-size: 13px; max-width: 320px; }

.release-teaser { margin-top: 24px; background: var(--wine); color: var(--foxing); padding: 12px 16px; border-radius: 10px; display: flex; align-items: center; gap: 10px; cursor: pointer; font-size: 13px; }
.release-scroll { display: flex; gap: 12px; overflow-x: auto; padding-bottom: 6px; -webkit-overflow-scrolling: touch; }
.release-mini-card { flex: 0 0 auto; width: 84px; cursor: pointer; text-align: center; }
.release-mini-card img { width: 64px; height: 94px; object-fit: cover; border-radius: 5px; margin: 0 auto 6px; display: block; }
.release-mini-title { font-size: 11px; font-weight: 600; line-height: 1.25; max-height: 28px; overflow: hidden; }
.release-mini-days { font-size: 10.5px; color: var(--brass); margin-top: 2px; }

/* Modal */
.modal-backdrop { position: fixed; inset: 0; background: rgba(14,16,13,0.65); display: flex; align-items: center; justify-content: center; z-index: 50; padding: 16px; }
.modal { background: var(--cloth); border-radius: 16px; width: 100%; max-width: 480px; max-height: 88vh; overflow-y: auto; padding: 20px; }
.modal-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
.modal-header h2 { margin: 0; font-family: 'Cormorant Garamond', Georgia, serif; font-size: 19px; font-weight: 600; }
.tab-row { display: flex; gap: 6px; margin-bottom: 12px; }
.tab-btn { flex: 1; background: var(--cloth-2); border: none; color: var(--ash); padding: 8px; border-radius: 8px; font-size: 12.5px; font-weight: 600; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 5px; }
.tab-btn.active { background: var(--brass); color: #0e100d; }
.search-input-row { display: flex; gap: 8px; margin-bottom: 8px; }
.search-input-row input { flex: 1; }
.search-results { display: flex; flex-direction: column; gap: 6px; max-height: 260px; overflow-y: auto; }
.search-result { display: flex; gap: 10px; padding: 6px; border-radius: 8px; cursor: pointer; align-items: center; }
.search-result:hover { background: var(--cloth-2); }
.search-result img { width: 40px; height: 58px; object-fit: cover; border-radius: 4px; }
.sr-title { font-size: 13px; font-weight: 700; }
.sr-author { font-size: 11.5px; color: var(--ash); }
.hint-error { color: #dba8af; font-size: 12px; margin: 4px 0; }

.form-body { display: flex; flex-direction: column; gap: 10px; margin-top: 6px; }
.form-body label, .search-panel label { font-size: 11.5px; color: var(--ash); font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; margin-top: 4px; }
.search-panel label { display: block; margin-bottom: 6px; }
.form-body input, .form-body textarea { background: var(--endsheet); border: 1px solid rgba(185,165,176,0.14); color: var(--foxing); border-radius: 8px; padding: 8px 10px; font-size: 13px; width: 100%; font-family: inherit; }
.form-row-cover { display: flex; gap: 12px; }
.form-cover-preview { width: 64px; height: 96px; object-fit: cover; border-radius: 6px; flex-shrink: 0; }
.form-cover-fields { flex: 1; display: flex; flex-direction: column; gap: 4px; }
.form-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
.chip-row { display: flex; gap: 6px; flex-wrap: wrap; }
.chip { background: var(--endsheet); border: 1px solid rgba(185,165,176,0.14); color: var(--ash); padding: 6px 10px; border-radius: 20px; font-size: 12px; font-weight: 600; cursor: pointer; display: inline-flex; align-items: center; gap: 4px; }
.chip-on { background: var(--brass); color: #0e100d; border-color: transparent; }
.checkbox-row { display: flex; align-items: center; gap: 6px; text-transform: none; font-size: 13px; color: var(--foxing); font-weight: 500; }
.progress-editor, .spicy-editor, .trope-editor, .finish-panel { background: var(--endsheet); border-radius: 10px; padding: 12px; }
.percent-row { display: flex; align-items: center; gap: 10px; }
.percent-row input[type=range] { flex: 1; }
.pages-row { display: flex; align-items: center; gap: 6px; font-size: 13px; }
.spicy-add-row { display: flex; gap: 6px; margin-top: 8px; }
.spicy-notes-list { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
.spicy-note { background: rgba(118,45,55,0.25); color: #e0aeb5; font-size: 12px; padding: 4px 8px; border-radius: 14px; display: inline-flex; align-items: center; gap: 5px; }
.spicy-note.trope-note { background: rgba(129,88,137,0.3); color: #dcc1e1; }
.spicy-note svg { cursor: pointer; }
.finish-panel { display: flex; flex-direction: column; gap: 10px; }
.finish-panel-ratings { display: flex; align-items: center; gap: 20px; color: var(--brass); }
.finish-panel-ratings > div { display: flex; flex-direction: column; gap: 4px; }
.finish-panel label { margin: 0; }
.card-review { font-size: 11.5px; color: var(--ash); font-style: italic; display: flex; gap: 4px; align-items: flex-start; margin-top: 2px; line-height: 1.3; }
.card-review svg { flex-shrink: 0; margin-top: 2px; }
.modal-actions { display: flex; gap: 8px; align-items: center; margin-top: 10px; }

/* Calendar */
.cal-nav { display: flex; align-items: center; gap: 10px; }
.cal-counts { color: var(--ash); font-size: 12.5px; margin: 0 0 14px; }
.cal-export-wrap { border-radius: 16px; background-size: cover; background-position: center; padding: 22px; }
.cal-panel { border-radius: 12px; padding: 16px; }
.cal-grid-header { display: grid; grid-template-columns: repeat(7, 1fr); text-align: center; font-size: 11px; color: var(--ash); margin-bottom: 6px; font-weight: 700; }
.cal-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 3px; }
.cal-cell { min-height: 64px; border: 1px solid rgba(185,165,176,0.12); border-radius: 6px; padding: 4px; display: flex; flex-direction: column; gap: 3px; }
.cal-cell.empty { border: none; }
.cal-day-num { font-size: 11px; color: rgba(185,165,176,0.75); }
.cal-cell-covers { display: flex; gap: 2px; flex-wrap: wrap; margin-top: auto; }
.cal-more { font-size: 10px; color: var(--brass); align-self: center; }
.cal-controls { display: grid; grid-template-columns: 1fr 1fr auto; gap: 16px; align-items: end; margin-top: 16px; }
.cal-controls label { display: block; font-size: 11.5px; color: var(--ash); font-weight: 700; text-transform: uppercase; margin-bottom: 6px; }
.cal-controls input[type=range] { width: 100%; }

/* Goals */
.goals-list { display: flex; flex-direction: column; gap: 16px; }
.goal-card { background: var(--cloth); border-radius: 14px; padding: 20px; max-width: 480px; }
.goal-card-header { display: flex; align-items: center; gap: 8px; }
.goal-name-input { background: transparent; border: none; color: var(--foxing); font-family: 'Cormorant Garamond', Georgia, serif; font-size: 17px; font-weight: 600; padding: 3px 4px; flex: 1; border-radius: 4px; }
.goal-name-input:focus { outline: 1px solid var(--brass); }
.goal-target-row { display: flex; align-items: center; gap: 8px; margin-bottom: 14px; font-size: 14px; }
.goal-dates-row { display: flex; gap: 16px; margin-bottom: 14px; }
.goal-dates-row label { display: block; font-size: 11px; color: var(--ash); font-weight: 700; text-transform: uppercase; margin-bottom: 5px; }
.goal-dates-row input[type=date] { background: var(--endsheet); border: 1px solid rgba(185,165,176,0.14); color: var(--foxing); border-radius: 8px; padding: 6px 8px; font-size: 12.5px; }
.goal-progress-label { margin-top: 6px; font-size: 12.5px; color: var(--ash); }

/* Releases */
.release-list { display: flex; flex-direction: column; gap: 10px; }
.release-row { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; background: var(--cloth); border-radius: 12px; padding: 10px 14px; }
.release-cover { width: 48px; height: 70px; object-fit: cover; border-radius: 4px; }
.release-info { flex: 1; min-width: 0; }
.release-countdown { display: flex; flex-direction: column; align-items: flex-end; gap: 3px; }
.release-actions { display: flex; align-items: center; gap: 6px; }
.release-detail-blurb { font-size: 13px; line-height: 1.5; color: var(--foxing); margin: 4px 0 0; }

@media (max-width: 640px) {
  .form-grid-2 { grid-template-columns: 1fr; }
  .cal-controls { grid-template-columns: 1fr; }
  .home-hero { grid-template-columns: 1fr; }
  .goal-dates-row { flex-direction: column; gap: 10px; }
  .form-body input, .form-body textarea,
  .search-input-row input,
  .goal-dates-row input[type=date] { font-size: 16px; }
  .icon-btn { padding: 10px; }
  .chip { padding: 8px 12px; }
  .tab-btn { padding: 10px; }
}
`;
