// Fichiers du dépôt qui ne doivent pas être servis sur le site (outils, tests, notes) : « page introuvable ».
// Cloudflare Pages publie tout le dossier ; robots.txt ne fait que demander aux moteurs de ne pas les lire.
//
// Avant le lancement (CONFIG.LAUNCH_AT), l'accueil sert la page de pré-inscription (bientot.html) à la
// place du jeu. ?app dans l'adresse ouvre le jeu et s'en souvient (cookie) : aperçu, page admin.
// Après le lancement, /bientot renvoie vers l'accueil.
import { CONFIG } from '../js/config.js';

const PRIVATE = /^\/(tests|tools|js\/tools|functions|marketing)(\/|$)|^\/(serve\.py|README\.md|\.gitignore)$/i;
const LAUNCH = new Date(CONFIG.LAUNCH_AT).getTime();
const HOME = /^\/(index(\.html)?)?$/;
const PRELAUNCH = /^\/bientot(\.html)?$/;
const APP_COOKIE = 'bc_app=1';

export async function onRequest({ request, next, env }) {
  const url = new URL(request.url);
  const { pathname } = url;
  if (PRIVATE.test(decodeURIComponent(pathname))) {
    const notFound = await env.ASSETS.fetch(new URL('/404.html', request.url));
    return new Response(notFound.body, { status: 404, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  }
  const before = Date.now() < LAUNCH;
  if (!before && PRELAUNCH.test(pathname)) return Response.redirect(new URL('/', url), 302);
  if (before && HOME.test(pathname)) {
    if (url.searchParams.has('app')) {
      const res = await next();
      const out = new Response(res.body, res);
      out.headers.append('Set-Cookie', `${APP_COOKIE}; Path=/; Max-Age=2592000; Secure; SameSite=Lax`);
      return out;
    }
    if (!(request.headers.get('Cookie') || '').includes(APP_COOKIE)) {
      const page = await env.ASSETS.fetch(new URL('/bientot', request.url));
      return new Response(page.body, { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
    }
  }
  return next();
}
