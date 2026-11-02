// Fichiers du dépôt qui ne doivent pas être servis sur le site (outils, tests, notes) : « page introuvable ».
// Cloudflare Pages publie tout le dossier ; robots.txt ne fait que demander aux moteurs de ne pas les lire.
const PRIVATE = /^\/(tests|tools|js\/tools|functions)(\/|$)|^\/(serve\.py|README\.md|\.gitignore)$/i;

export async function onRequest({ request, next, env }) {
  const { pathname } = new URL(request.url);
  if (PRIVATE.test(decodeURIComponent(pathname))) {
    const notFound = await env.ASSETS.fetch(new URL('/404.html', request.url));
    return new Response(notFound.body, { status: 404, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  }
  return next();
}
