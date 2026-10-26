// Provider de combats 100 % fictifs (« combats éclair ») : combattants, horaires, cotes et combats
// simulés round par round. Il respecte l'interface décrite dans providers/index.js.
//
// Rien n'est tiré à l'avance : chaque appel joue seulement le temps écoulé depuis le précédent, avec
// un risque d'arrêt par seconde réglé pour retrouver les probabilités des cotes (vainqueur, méthode,
// round de fin, voir services/markets.js). L'état courant (meta.sim) ne contient aucun futur.
import { MIN, rand, randInt, pick, clamp, sigmoid, shuffle, uid } from '../util.js';
import { fromProbabilities } from './odds.js';
import { fightOdds, resultText } from '../services/markets.js';

const fighter = (name, short, color, rating) => ({ name, short, color, rating });

// rounds : nombre de rounds (0 : un seul combat sans rounds, comme en JJB) ; finish : part des
// combats arrêtés avant la fin ; methods : part de chaque arrêt parmi les arrêts.
const CATALOG = {
  mma: {
    weight: 0.45, rounds: 3, finish: 0.52, methods: { KO: 0.33, SUB: 0.19 },
    competitions: ['Ligue Octogone', 'Cage Royale', 'Fight Night Éclair'],
    fighters: [
      fighter('Karim « Le Marteau » Diallo', 'DIA', '#ff5a36', 86),
      fighter('Lucas Ferreira', 'FER', '#ffd23f', 84),
      fighter('Ivan « Ours » Petrov', 'PET', '#e8e8e8', 83),
      fighter('Yanis Benali', 'BEN', '#9d7bff', 81),
      fighter('Tomás Rivera', 'RIV', '#00c2d1', 79),
      fighter('Hugo « Le Python » Garnier', 'GAR', '#e84a5f', 78),
      fighter('Malik Traoré', 'TRA', '#f5f542', 76),
      fighter('Sven Lindqvist', 'LIN', '#7aa2ff', 74),
      fighter('Rafael Costa', 'COS', '#b0b8c4', 72),
      fighter('Nikolaï Volkov', 'VOL', '#5ad1ff', 71),
    ],
  },
  boxing: {
    weight: 0.25, rounds: 8, finish: 0.5, methods: { KO: 0.5 },
    competitions: ['Gala de la Ceinture', 'Nuit des Gants', 'Ring Royal'],
    fighters: [
      fighter('Moussa « Dynamite » Keita', 'KEI', '#ff5a36', 85),
      fighter('Jake Morrison', 'MOR', '#ffd23f', 83),
      fighter('Alexis Fontaine', 'FON', '#e8e8e8', 81),
      fighter('Diego Salazar', 'SAL', '#9d7bff', 80),
      fighter('Samir Haddad', 'HAD', '#00c2d1', 77),
      fighter('Connor Walsh', 'WAL', '#e84a5f', 75),
      fighter('Kenji Mori', 'MRI', '#2ecc71', 73),
      fighter('Bilal Ouattara', 'OUA', '#ff8fb1', 71),
    ],
  },
  kickboxing: {
    weight: 0.2, rounds: 3, finish: 0.32, methods: { KO: 0.32 },
    competitions: ['Muay Thaï Masters', 'Kick Arena', 'Coupe du Tibia'],
    fighters: [
      fighter('Saenchai Por Kaew', 'KAE', '#ff5a36', 85),
      fighter('Yohan « Tibia » Lemaire', 'LEM', '#ffd23f', 83),
      fighter('Ruslan Aliev', 'ALI', '#e8e8e8', 81),
      fighter('Mehdi Zerrouki', 'ZER', '#9d7bff', 79),
      fighter('Daan de Vries', 'VRI', '#00c2d1', 77),
      fighter('Rodtang Sitmonchai', 'SIT', '#e84a5f', 75),
      fighter('Enzo Moretti', 'MRT', '#2ecc71', 73),
      fighter('Adam Kowal', 'KOW', '#ff8fb1', 71),
    ],
  },
  bjj: {
    weight: 0.1, rounds: 0, finish: 0.45, methods: { SUB: 0.45 },
    competitions: ['Open de Grappling', 'Tatami Masters'],
    fighters: [
      fighter('Rafael « Araignée » Mendes', 'MEN', '#ff5a36', 85),
      fighter('Gabriel Almeida', 'ALM', '#ffd23f', 83),
      fighter('Nils Lambert', 'LAM', '#e8e8e8', 80),
      fighter('Kaio Ruotolo', 'RUO', '#9d7bff', 79),
      fighter('Théo Marchand', 'MAR', '#00c2d1', 76),
      fighter('Craig Jones', 'JON', '#e84a5f', 74),
    ],
  },
};

const DURATION = 2 * MIN;      // durée réelle d'un combat éclair
const ROUND_DECAY = 0.8;       // comme services/markets.js
const BJJ_SECONDS = 600;       // un combat de JJB : 10 minutes de jeu (simulées)
const ROUND_SECONDS = 300;     // un round : 5 minutes de jeu (simulées)

const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const roundsOf = (cat) => cat.rounds || 0;
const fightSeconds = (cat) => (cat.rounds ? cat.rounds * ROUND_SECONDS : BJJ_SECONDS);

// Probabilité d'arrêt pendant chaque round, sachant qu'on l'atteint (pour que l'arrêt se répartisse
// comme dans les cotes : finish × part du round).
function roundHazards(cat) {
  const n = Math.max(1, roundsOf(cat));
  const w = Array.from({ length: n }, (_, i) => ROUND_DECAY ** i);
  const sum = w.reduce((a, b) => a + b, 0);
  let alive = 1;
  return w.map((x) => {
    const p = (cat.finish * x) / sum;
    const h = alive > 0 ? p / alive : 0;
    alive -= p;
    return clamp(h, 0, 1);
  });
}

function drawMethod(cat) {
  const total = Object.values(cat.methods).reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (const [k, p] of Object.entries(cat.methods)) if ((r -= p) <= 0) return k;
  return Object.keys(cat.methods)[0];
}

// Joue le temps écoulé depuis la dernière simulation → Update.
function simulate(m, now) {
  const cat = CATALOG[m.sport];
  const total = fightSeconds(cat);
  const perRound = cat.rounds ? ROUND_SECONDS : BJJ_SECONDS;
  const hazards = roundHazards(cat);
  const sim = m.meta?.sim ? { ...m.meta.sim } : { t: 0 };
  const to = clamp(Math.floor(((now - m.startsAt) / (m.endsAt - m.startsAt)) * total), 0, total);
  const p1 = m.meta.p1;

  while (!sim.done && sim.t < to) {
    const round = Math.floor(sim.t / perRound);
    const end = Math.min(to, (round + 1) * perRound);
    const secs = end - sim.t;
    // Arrêt pendant ces secondes : même risque par seconde sur tout le round.
    const perSec = 1 - (1 - hazards[round]) ** (1 / perRound);
    const stop = 1 - (1 - perSec) ** secs;
    if (Math.random() < stop) {
      sim.t += randInt(1, Math.max(1, secs));
      Object.assign(sim, { done: true, winner: Math.random() < p1 ? '1' : '2', method: drawMethod(cat), round: cat.rounds ? round + 1 : null });
      break;
    }
    sim.t = end;
    if (sim.t >= total) Object.assign(sim, { done: true, winner: Math.random() < p1 ? '1' : '2', method: 'DEC', round: cat.rounds || null });
  }

  if (sim.done) {
    const result = { method: sim.method, round: sim.round };
    return { matchId: m.id, status: 'finished', outcome: sim.winner, result, score: resultText(result) };
  }
  const round = Math.floor(sim.t / perRound);
  const clock = cat.rounds ? `R${round + 1} ${mmss(sim.t - round * perRound)}` : mmss(sim.t);
  return { matchId: m.id, status: 'live', liveScore: cat.rounds ? `Round ${round + 1}` : 'En cours', clock, meta: { sim } };
}

// ─── Combats à venir ─────────────────────────────────────────────────────────
function pickSport() {
  let r = Math.random();
  for (const [key, cat] of Object.entries(CATALOG)) {
    if ((r -= cat.weight) <= 0) return key;
  }
  return 'mma';
}

// busy : combattants déjà programmés (un combattant ne fait qu'un combat à la fois).
function generateFight(sport, startsAt, busy = new Set()) {
  const cat = CATALOG[sport];
  const free = cat.fighters.filter((f) => !busy.has(f.name));
  const [home, away] = shuffle(free.length >= 2 ? free : cat.fighters);
  busy.add(home.name);
  busy.add(away.name);
  const p1 = clamp(sigmoid((home.rating - away.rating) / 6), 0.12, 0.88);
  const win = { 1: p1, 2: 1 - p1 };
  const strip = ({ name, short, color }) => ({ name, short, color });
  return {
    id: uid('fake'),
    source: 'fake',
    real: false,
    sport,
    competition: pick(cat.competitions),
    round: cat.rounds ? `${cat.rounds} rounds` : null,
    home: strip(home),
    away: strip(away),
    startsAt,
    endsAt: startsAt + DURATION,
    odds: { ...fromProbabilities(win), ...fightOdds(sport, win, roundsOf(cat)) },
    oddsSource: 'fake',
    status: 'scheduled',
    outcome: null,
    score: null,
    meta: { p1, rounds: roundsOf(cat) }, // données privées du provider
  };
}

export function createFakeProvider() {
  return {
    id: 'fake',
    label: 'Combats fictifs',
    real: false,
    refresh: { upcomingMs: 3000, resultsMs: 3000 },

    // Complète la liste pour garder CONFIG.UPCOMING_TARGET combats à venir.
    async fetchUpcoming({ now, existing, target }) {
      const upcoming = existing.filter((m) => now < m.startsAt);
      const missing = target - upcoming.length;
      if (missing <= 0) return [];
      let cursor = Math.max(now, ...upcoming.map((m) => m.startsAt));
      const busy = new Set(existing.filter((m) => m.status !== 'finished' && m.status !== 'void').flatMap((m) => [m.home.name, m.away.name]));
      const out = [];
      for (let i = 0; i < missing; i++) {
        cursor += randInt(1, 5) * MIN + rand(0, 30_000);
        const start = Math.ceil(cursor / MIN) * MIN; // début à la minute pile
        out.push(generateFight(pickSport(), start, busy));
      }
      return out;
    },

    // Combats commencés : round en cours ({ status: 'live', liveScore, clock, meta: { sim } }) ou résultat.
    async fetchResults({ now, matches }) {
      return matches
        .filter((m) => now >= m.startsAt && CATALOG[m.sport] && m.meta?.p1 !== undefined)
        .map((m) => simulate(m, now));
    },
  };
}
