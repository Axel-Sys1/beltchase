// Taille des photos de combattants et des affiches, partagée par l'appli et les pages publiques.
// - ESPN : portraits détourés (tête et épaules, 4:3 environ) redimensionnés par leur serveur d'images.
// - TheSportsDB : variantes /small (≈ 250 px pour une photo, 444 px pour une affiche) et /medium (le
//   double), servies seulement par r2.thesportsdb.com (www.thesportsdb.com répond 404).

// Image adaptée à une largeur d'affichage (px CSS) ; adresse inchangée si la source est inconnue.
export function sizedPhoto(url, width) {
  const espn = /^https:\/\/a\.espncdn\.com(\/i\/headshots\/[^?]+\.png)$/.exec(url || '')?.[1];
  if (espn) return `https://a.espncdn.com/combiner/i?img=${espn}&w=${width}&h=${Math.round(width * 0.725)}`;
  const tsdb = /^https:\/\/(?:www|r2)\.thesportsdb\.com(\/images\/media\/[^?]+\.(?:png|jpe?g))$/i.exec(url || '')?.[1];
  if (tsdb) return `https://r2.thesportsdb.com${tsdb}/${width <= 450 ? 'small' : 'medium'}`;
  return url;
}

// Attributs d'une <img> dont la version réduite peut manquer (images récentes de TheSportsDB, pas encore
// copiées sur r2 : 404) : repli sur l'image d'origine, puis `fail` (code JS) si elle échoue aussi.
export function withFallback(original, fail = 'this.remove()') {
  const esc = String(original ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
  return `data-full="${esc}" onerror="if(this.dataset.full&&this.src!==this.dataset.full){this.src=this.dataset.full}else{${fail}}"`;
}

// Photo détourée en pied ou en buste (TheSportsDB) : à recadrer sur le haut du corps.
export const isCutout = (url) => /thesportsdb\.com\/images\/media\/player\/(cutout|thumb)\//.test(url || '');
