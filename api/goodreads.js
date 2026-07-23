function decodeHtmlEntities(str) {
  if (!str) return str;
  return str
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function normalizeDate(d) {
  if (!d) return null;
  const parsed = new Date(d);
  if (isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}

const MONTHS = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };

// Parses date fragments Goodreads shows for not-yet-published books, e.g.
// "Expected 4 Aug 26" or "Expected publication: August 4, 2026".
function parseExpectedDate(text) {
  if (!text) return null;
  let m = text.match(/\b(\d{1,2})\s+([A-Za-z]{3,9})\.?\s+(\d{2,4})\b/);
  if (m) {
    const day = parseInt(m[1], 10);
    const mon = MONTHS[m[2].slice(0, 3).toLowerCase()];
    let year = parseInt(m[3], 10);
    if (year < 100) year += 2000;
    if (mon !== undefined && !isNaN(day) && !isNaN(year)) {
      const iso = new Date(Date.UTC(year, mon, day));
      if (!isNaN(iso.getTime())) return iso.toISOString().slice(0, 10);
    }
  }
  m = text.match(/\b([A-Za-z]{3,9})\.?\s+(\d{1,2}),?\s+(\d{4})\b/);
  if (m) {
    const mon = MONTHS[m[1].slice(0, 3).toLowerCase()];
    const day = parseInt(m[2], 10);
    const year = parseInt(m[3], 10);
    if (mon !== undefined && !isNaN(day) && !isNaN(year)) {
      const iso = new Date(Date.UTC(year, mon, day));
      if (!isNaN(iso.getTime())) return iso.toISOString().slice(0, 10);
    }
  }
  return null;
}

function toPlainText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ');
}

module.exports = async (req, res) => {
  const { url } = req.query;
  if (!url || typeof url !== 'string') {
    res.status(400).json({ error: 'Missing url parameter.' });
    return;
  }

  let parsed;
  try {
    parsed = new URL(url);
  } catch (e) {
    res.status(400).json({ error: 'Invalid URL.' });
    return;
  }
  if (!/(^|\.)goodreads\.com$/i.test(parsed.hostname)) {
    res.status(400).json({ error: 'Only goodreads.com links are supported.' });
    return;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const pageRes = await fetch(parsed.toString(), {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!pageRes.ok) {
      res.status(502).json({ error: `Goodreads returned ${pageRes.status}.` });
      return;
    }
    const html = await pageRes.text();

    const ogTitle = html.match(/<meta property="og:title" content="([^"]*)"/i)?.[1];
    const ogImage = html.match(/<meta property="og:image" content="([^"]*)"/i)?.[1];

    let author = null;
    let releaseDate = null;
    const ldJsonMatches = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi)];
    for (const m of ldJsonMatches) {
      try {
        const json = JSON.parse(m[1]);
        const candidates = Array.isArray(json) ? json : [json];
        for (const obj of candidates) {
          const types = Array.isArray(obj['@type']) ? obj['@type'] : [obj['@type']];
          if (types.includes('Book')) {
            if (obj.author) {
              const a = Array.isArray(obj.author) ? obj.author[0] : obj.author;
              author = author || a?.name || null;
            }
            if (obj.datePublished) releaseDate = releaseDate || obj.datePublished;
          }
        }
      } catch (e) {
        // Not valid/relevant JSON-LD — skip it.
      }
    }

    if (!releaseDate) {
      const plainText = decodeHtmlEntities(toPlainText(html));
      const idx = plainText.search(/Expected/i);
      if (idx !== -1) {
        releaseDate = parseExpectedDate(plainText.slice(idx, idx + 40));
      }
    }

    if (!ogTitle && !author) {
      res.status(404).json({ error: 'Could not find book details on that page.' });
      return;
    }

    res.status(200).json({
      title: decodeHtmlEntities(ogTitle) || null,
      author: decodeHtmlEntities(author) || null,
      coverUrl: ogImage || null,
      releaseDate: normalizeDate(releaseDate),
    });
  } catch (e) {
    clearTimeout(timeout);
    res.status(500).json({ error: 'Failed to fetch or parse that page.' });
  }
};
