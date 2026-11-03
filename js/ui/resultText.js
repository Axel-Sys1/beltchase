// Phrases de résultat dans la langue du joueur (les pages publiques /pronos gardent celles de
// seo/pages.js, en français). Score : « KO/TKO · R2 », « Décision unanime ».
import { lang, t } from '../i18n.js';
import { finishPhrase, resultSentence } from '../seo/pages.js';

export function finishText(score) {
  if (lang === 'fr') return finishPhrase(score);
  const [method, round] = String(score ?? '').split(' · ');
  const parts = [];
  if (method && !/^(victoire|terminé)$/i.test(method)) parts.push(t('par {m}', { m: t(method) }));
  const r = /^R(\d+)$/.exec(round || '');
  if (r) parts.push(t('au round {n}', { n: r[1] }));
  return parts.join(' ');
}

export function resultText(m) {
  if (lang === 'fr') return resultSentence(m);
  if (m.outcome === 'X') return t('{a} et {b} se quittent sur un match nul.', { a: m.home.name, b: m.away.name });
  const [win, lose] = m.outcome === '1' ? [m.home, m.away] : [m.away, m.home];
  const how = finishText(m.score);
  return `${t('{w} bat {l}', { w: win.name, l: lose.name })}${how ? ` ${how}` : ''}.`;
}
