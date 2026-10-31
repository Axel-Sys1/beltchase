// Tests des fiches combattants (js/services/fighters.js) sur une réponse ESPN réelle (Volkanovski, 01/11/2026).
// Lancer : /System/Library/Frameworks/JavaScriptCore.framework/Versions/Current/Helpers/jsc -m tests/fighters.test.mjs
globalThis.console ??= { warn: () => {}, log: print, error: print };

import { heightCm, parseAthlete, reachCm, weightKg } from '../js/services/fighters.js';

const DIR = decodeURIComponent(import.meta.url.replace(/^file:\/\//, '').replace(/[^/]*$/, ''));
const fail = (msg) => { throw new Error(msg); };
const ok = (cond, msg) => cond || fail(msg);
const eq = (a, b, msg) => (JSON.stringify(a) === JSON.stringify(b) ? true : fail(`${msg} : attendu ${JSON.stringify(b)}, obtenu ${JSON.stringify(a)}`));
async function test(name, fn) { await fn(); print(`PASS ${name}`); }

await test('unités', () => {
  eq(heightCm('5\' 6"'), 168, 'taille');
  eq(heightCm('6\' 4"'), 193, 'taille 2');
  eq(weightKg('144 lbs'), 65, 'poids');
  eq(reachCm('71.5"'), 182, 'allonge');
  eq([heightCm(''), weightKg(null), reachCm('?')], [null, null, null], 'inconnu');
});

await test('fiche Volkanovski', () => {
  const f = parseAthlete(JSON.parse(readFile(`${DIR}fixtures/fighters/espn_athlete_3949584_volkanovski.json`)));
  eq([f.id, f.name, f.nickname], ['3949584', 'Alexander Volkanovski', 'The Great'], 'identité');
  eq([f.record, f.kos, f.subs], ['29-4-0', '14-3', '3-0'], 'palmarès');
  eq([f.heightCm, f.weightKg, f.reachCm, f.weightClass, f.stance, f.team], [168, 65, 182, 'Poids plumes', 'Droitier', 'City Kickboxing'], 'bio en français');
  eq(f.fights.length, 33, '33 combats');
  ok(f.fights.every((x, i) => !i || f.fights[i - 1].date >= x.date), 'du plus récent au plus ancien');
  const last = f.fights[0];
  eq([last.opponent, last.result, last.method, last.round, last.title], ['Movsar Evloev', 'W', 'KO/TKO', 2, true], 'dernier combat');
  ok(f.photo.includes('/headshots/mma/players/full/3949584.png') && f.flag.endsWith('aus.png'), 'photo et drapeau');
  eq(parseAthlete({}), null, 'réponse vide');
});

print('ALL PASS');
