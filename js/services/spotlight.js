// « À l'affiche » : repère les combats qui intéressent le plus (main events, combats pour le titre,
// stars, combattants français, affiches serrées) pour les mettre en haut de la page.

const norm = (s) => ` ${String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim()} `;
const has = (name, key) => norm(name).includes(` ${key} `);

// Combattants français (noms tels que fournis par ESPN, en minuscules, sans accents).
const FRENCH = [
  'ciryl gane', 'benoit saint denis', 'nassourdine imavov', 'manon fiorot', 'morgan charriere', 'william gomis',
  'fares ziam', 'taylor lapilus', 'cedric doumbe', 'salahdine parnasse', 'kevin jousset', 'oumar sy',
  'baisangur susurkaev', 'aymeric cussac', 'mansour barnaoui', 'tony yoka', 'souleymane cissokho',
  'jordan zebo', 'nora cornolle', 'ange loosa', 'axel sola', 'jean baptiste lepine',
];

// Stars (MMA et boxe) qui attirent le public.
const STARS = [
  'islam makhachev', 'ilia topuria', 'alex pereira', 'jon jones', 'tom aspinall', 'khamzat chimaev',
  'dricus du plessis', 'merab dvalishvili', 'sean o malley', 'alexander volkanovski', 'max holloway',
  'dustin poirier', 'justin gaethje', 'charles oliveira', 'israel adesanya', 'amanda nunes', 'kayla harrison',
  'valentina shevchenko', 'zhang weili', 'alexandre pantoja', 'leon edwards', 'belal muhammad', 'conor mcgregor',
  'oleksandr usyk', 'canelo alvarez', 'terence crawford', 'naoya inoue', 'tyson fury', 'anthony joshua',
  'shakur stevenson', 'gervonta davis', 'dmitry bivol', 'artur beterbiev', 'david benavidez',
];

const isIn = (list, f) => list.some((k) => has(f?.name, k));

// Intérêt d'un combat à venir : { score, tag } (tag = l'étiquette affichée sur la carte).
export function interest(m, now) {
  const main = /combat principal/i.test(m.round || '');
  const title = (m.meta?.rounds || 0) >= 5;
  const french = [m.home, m.away].filter((f) => isIn(FRENCH, f)).length;
  const stars = [m.home, m.away].filter((f) => isIn(STARS, f)).length;
  const o1 = m.odds?.['1'], o2 = m.odds?.['2'];
  const close = o1 && o2 ? Math.max(0, 1.5 - Math.abs(o1 - o2)) : 0;
  const hours = (m.startsAt - now) / 3_600_000;
  let score = (main ? 5 : 0) + (title ? 2 : 0) + french * 3 + stars * 2.5 + close + (hours < 36 ? 0.5 : 0) - (hours > 120 ? 1 : 0);
  if (m.oddsSource === 'model') score -= 0.5;
  const tag = main ? 'Main event' : french ? 'Combattant français 🇫🇷' : stars ? 'Star à l\'affiche'
    : title ? 'Combat en 5 rounds' : close > 1 ? 'Affiche serrée' : m.competition;
  return { score, tag, worthy: main || title || french > 0 || stars > 0 };
}

// Les `max` combats les plus intéressants parmi `list` (déjà limités aux combats à venir).
export function spotlight(list, now, max = 8) {
  return list
    .filter((m) => m.odds?.['1'] && m.odds?.['2'])
    .map((m) => ({ m, ...interest(m, now) }))
    .filter((x) => x.worthy)
    .sort((a, b) => b.score - a.score || a.m.startsAt - b.m.startsAt)
    .slice(0, max);
}
