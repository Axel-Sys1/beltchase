// Relais Cloudflare (Pages Function) : /api/rss?u=<flux RSS autorisé>
// Les sites d'actus n'autorisent pas la lecture directe depuis le navigateur (CORS) ; le flux est relu
// au plus toutes les 10 min pour tous les joueurs (cache partagé). Liste des flux : js/services/news.js.
const ALLOWED = new Set([
  'https://rmcsport.bfmtv.com/rss/sports-de-combat/',
  'https://lasueur.com/wp-json/wp/v2/posts?per_page=20&_fields=link,title,date_gmt,excerpt,jetpack_featured_media_url,class_list',
]);
const TTL = 600;

const text = (body, status, extra = {}) => new Response(body, {
  status,
  headers: { 'Content-Type': 'application/xml; charset=utf-8', ...extra },
});

export async function onRequestGet({ request, waitUntil }) {
  const self = new URL(request.url);
  const target = self.searchParams.get('u') || '';
  if (!ALLOWED.has(target)) return text('<error>flux non autorisé</error>', 403);

  const cache = caches.default;
  const key = new Request(`${self.origin}/api/rss?u=${encodeURIComponent(target)}`);
  const hit = await cache.match(key);
  if (hit) return hit;

  let upstream;
  try {
    upstream = await fetch(target, { headers: { 'User-Agent': 'Mozilla/5.0 (BeltChase)', Accept: 'application/rss+xml, application/xml' }, cf: { cacheTtl: TTL, cacheEverything: true } });
  } catch {
    return text('<error>flux injoignable</error>', 502, { 'Cache-Control': 'no-store' });
  }
  if (!upstream.ok) return text('<error>flux en erreur</error>', upstream.status, { 'Cache-Control': 'no-store' });
  const res = text(await upstream.arrayBuffer(), 200, { 'Cache-Control': `public, max-age=${TTL}` });
  waitUntil(cache.put(key, res.clone()));
  return res;
}
