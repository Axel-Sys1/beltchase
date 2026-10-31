// Actus : dernières nouvelles des sports de combat en français, lues dans les flux RSS de RMC Sport
// et de La Sueur. On n'affiche que le titre, un court extrait, l'image fournie par le flux et un lien
// vers l'article d'origine (rien n'est recopié).
//
// Les flux passent par le relais /api/rss (Pages Function en ligne, serve.py en local) : les sites
// n'autorisent pas la lecture directe depuis le navigateur (CORS).
// Relevé du 01/11/2026 : RMC « sports-de-combat » (RSS) = 30 articles avec image (<enclosure>), rubrique
// dans l'adresse (/boxe/, /mma/, /combattants/). La Sueur : son RSS n'a pas d'image, on lit donc son API
// WordPress (20 derniers articles, photo à la une, catégories dans class_list : category-boxe…).

export const FEEDS = [
  { id: 'rmc', name: 'RMC Sport', url: 'https://rmcsport.bfmtv.com/rss/sports-de-combat/' },
  { id: 'lasueur', name: 'La Sueur', type: 'wp', url: 'https://lasueur.com/wp-json/wp/v2/posts?per_page=20&_fields=link,title,date_gmt,excerpt,jetpack_featured_media_url,class_list' },
];

// Disciplines des filtres (Amateurs : articles qui en parlent).
export const NEWS_SPORTS = [
  { id: 'all', label: 'Tout' },
  { id: 'mma', label: 'MMA' },
  { id: 'boxing', label: 'Boxe' },
  { id: 'kickboxing', label: 'Kick' },
  { id: 'bjj', label: 'JJB' },
  { id: 'amateur', label: 'Amateurs' },
];

const TTL = 10 * 60 * 1000;
const EXCERPT = 180;

// ─── Lecture d'un flux RSS (sans DOMParser : utilisable dans les tests et sur le serveur) ─────────
const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', hellip: '…', rsquo: '’', lsquo: '‘', ldquo: '“', rdquo: '”', ndash: '–', mdash: '—', laquo: '«', raquo: '»', eacute: 'é', egrave: 'è', agrave: 'à', ccedil: 'ç' };
export function decode(s) {
  return String(s ?? '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, n) => ENTITIES[n.toLowerCase()] ?? m);
}
const stripTags = (s) => decode(s).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
const tag = (xml, name) => new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, 'i').exec(xml)?.[1] ?? '';
const shorten = (s, n) => (s.length <= n ? s : `${s.slice(0, n).replace(/\s+\S*$/, '')}…`);

// Discipline d'un article : rubrique / catégories du flux, puis mots du titre.
export function sportOfArticle({ title = '', categories = [], link = '' }) {
  const text = `${categories.join(' ')} ${link.split('/').slice(3, 5).join(' ')} ${title}`.toLowerCase();
  if (/amateur/.test(text)) return 'amateur';
  if (/kick|muay|glory\b|\bk-1\b|savate/.test(text)) return 'kickboxing';
  if (/\bjjb\b|jiu-jitsu|jiu jitsu|grappling|adcc/.test(text)) return 'bjj';
  if (/\bmma\b|\bufc\b|\bpfl\b|\bares\b|bellator|oktagon|cage warriors|\bone championship\b|hexagone/.test(text)) return 'mma';
  if (/boxe|boxing|\bwbc\b|\bwba\b|\bibf\b|\bwbo\b|poids lourds?/.test(text)) return 'boxing';
  return null;
}

// Flux RSS → [{ id, title, link, date, image, excerpt, source, sport }].
export function parseFeed(xml, feed) {
  return [...String(xml).matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)].map(([, it]) => {
    const title = stripTags(tag(it, 'title'));
    const link = stripTags(tag(it, 'link'));
    const date = Date.parse(stripTags(tag(it, 'pubDate')));
    const categories = [...it.matchAll(/<category[^>]*>([\s\S]*?)<\/category>/gi)].map(([, c]) => stripTags(c));
    const image = /<enclosure[^>]+url="([^"]+)"[^>]*type="image/i.exec(it)?.[1]
      || /<media:(?:content|thumbnail)[^>]+url="([^"]+)"/i.exec(it)?.[1] || null;
    const excerpt = shorten(stripTags(tag(it, 'description')), EXCERPT);
    if (!title || !/^https:\/\//.test(link)) return null;
    return { id: link, title, link, date: Number.isFinite(date) ? date : 0, image, excerpt, source: feed.name, sport: sportOfArticle({ title, categories, link }) };
  }).filter(Boolean);
}

// Articles d'un site WordPress (API /wp-json/wp/v2/posts) → même forme que parseFeed.
export function parseWp(json, feed) {
  const posts = typeof json === 'string' ? JSON.parse(json) : json;
  return (Array.isArray(posts) ? posts : []).map((p) => {
    const title = stripTags(p?.title?.rendered);
    const link = String(p?.link ?? '');
    const date = Date.parse(`${p?.date_gmt}Z`);
    const categories = (p?.class_list || []).filter((c) => /^category-/.test(c)).map((c) => c.slice(9).replace(/-/g, ' '));
    if (!title || !/^https:\/\//.test(link)) return null;
    return {
      id: link, title, link, date: Number.isFinite(date) ? date : 0,
      image: /^https:\/\//.test(p?.jetpack_featured_media_url || '') ? p.jetpack_featured_media_url : null,
      excerpt: shorten(stripTags(p?.excerpt?.rendered), EXCERPT), source: feed.name, sport: sportOfArticle({ title, categories, link }),
    };
  }).filter(Boolean);
}

// Plusieurs flux → une seule liste, sans doublon (même lien ou même titre), la plus récente d'abord.
export function mergeFeeds(lists) {
  const seen = new Set();
  return lists.flat().sort((a, b) => b.date - a.date).filter((a) => {
    const key = a.title.toLowerCase().replace(/[^a-z0-9à-ÿ]+/g, '');
    if (seen.has(a.link) || seen.has(key)) return false;
    seen.add(a.link);
    seen.add(key);
    return true;
  });
}

// ─── Chargement dans l'appli ────────────────────────────────────────────────
export const news = { items: [], loading: false, error: null, at: 0 };
const listeners = new Set();
export const subscribeNews = (fn) => listeners.add(fn);
const emit = () => listeners.forEach((fn) => fn());

const feedUrl = (url) => `/api/rss?u=${encodeURIComponent(url)}`;

// Relit les flux s'ils datent de plus de 10 min (un flux en panne n'empêche pas les autres).
export async function loadNews({ force = false, fetchImpl = globalThis.fetch, now = Date.now() } = {}) {
  if (news.loading || (!force && news.items.length && now - news.at < TTL)) return news;
  news.loading = true; // pas d'emit ici : loadNews est appelé pendant le dessin de l'écran
  news.error = null;
  const results = await Promise.allSettled(FEEDS.map(async (feed) => {
    const res = await fetchImpl(feedUrl(feed.url));
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = await res.text();
    return feed.type === 'wp' ? parseWp(body, feed) : parseFeed(body, feed);
  }));
  const lists = results.filter((r) => r.status === 'fulfilled').map((r) => r.value);
  if (lists.length) {
    news.items = mergeFeeds(lists);
    news.at = now;
  } else {
    news.error = 'Les actus sont momentanément indisponibles.';
  }
  news.loading = false;
  emit();
  return news;
}
