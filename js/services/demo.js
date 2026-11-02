// Mode démo, sur ta machine seulement (localhost) : http://localhost:5173/?demo
// Pas de compte en ligne (rien n'est envoyé à Firebase) : tout est débloqué comme avec un compte, et le
// profil reçoit une fois de quoi tout voir (Gold, niveau 40, cartes de chaque rareté, cadre exclusif).
// http://localhost:5173/?demo=off pour revenir au fonctionnement normal.
const KEY = 'beltchase:demo';
const LOCAL = typeof location !== 'undefined' && /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);

function readFlag() {
  if (!LOCAL) return false;
  try {
    const q = new URLSearchParams(location.search).get('demo');
    if (q === 'off') localStorage.removeItem(KEY);
    else if (q !== null) localStorage.setItem(KEY, '1');
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

export const DEMO = readFlag();

const DEMO_LEVEL = 40;

// Cadeau de départ, une seule fois par profil.
export function seedDemo(p, { cards, levelOf }) {
  if (!DEMO || !p || p.demoSeeded) return false;
  let xp = 0;
  while (levelOf(xp).level < DEMO_LEVEL) xp += 50;
  p.xp = Math.max(p.xp || 0, xp);
  p.balance = Math.max(p.balance || 0, 50_000);
  // Environ la moitié de l'album : toutes les mythiques et légendaires, une carte sur deux sinon.
  p.cards = { ...p.cards };
  cards.forEach((c, i) => {
    if (['mythique', 'legendaire'].includes(c.rarity) || i % 2 === 0) p.cards[c.id] = (p.cards[c.id] || 0) + (i % 7 === 0 ? 2 : 1);
  });
  p.owned = { ...p.owned, 'frame-champion': Date.now(), 'title-champion': Date.now() };
  p.demoSeeded = true;
  return true;
}
