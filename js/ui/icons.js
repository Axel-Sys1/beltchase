const svg = (body, extra = '') =>
  `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${body}</svg>`;

export const icons = {
  pumpkin: svg('<path d="M12 7c-1.5-1-5-1.2-7 1.5S3.5 17 6 19c1.8 1.4 4 1 6 .2 2 .8 4.2 1.2 6-.2 2.5-2 3-8 1-10.5S13.5 6 12 7z"/><path d="M12 7c.2-1.6 1-3 2.5-3.5"/><path d="M8 13l1.5-1.5L11 13M13 13l1.5-1.5L16 13M9 16.5c1 .8 2 .9 3 .5s2 .3 3-.5"/>'),
  ball: svg('<circle cx="12" cy="12" r="9"/><path d="M12 7l4 3-1.5 4.5h-5L8 10z"/><path d="M12 3v4M16 10l4.5-1.5M14.5 14.5l2.5 4M9.5 14.5l-2.5 4M8 10L3.5 8.5"/>'),
  ticket: svg('<path d="M4 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4z"/><path d="M13 5v2M13 11v2M13 17v2"/>'),
  list: svg('<path d="M9 6h11M9 12h11M9 18h11"/><path d="M4 6l1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2"/>'),
  trophy: svg('<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3"/>'),
  user: svg('<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>'),
  gift: svg('<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13M5 12v9h14v-9"/><path d="M12 8S10.5 3 8 3.5 7 8 12 8zM12 8s1.5-5 4-4.5S17 8 12 8z"/>'),
  play: svg('<rect x="2" y="4" width="20" height="16" rx="3"/><path d="M10 9l5 3-5 3z" fill="currentColor"/>'),
  close: svg('<path d="M6 6l12 12M18 6L6 18"/>'),
  copy: svg('<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/>'),
  forward: svg('<path d="M4 6l8 6-8 6zM12 6l8 6-8 6z"/>', 'fill="currentColor"'),
  arrow: svg('<path d="M5 12h14M13 6l6 6-6 6"/>'),
  trash: svg('<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>'),
  stadium: svg('<ellipse cx="12" cy="8" rx="9" ry="3"/><path d="M3 8v8c0 1.7 4 3 9 3s9-1.3 9-3V8"/><path d="M8 11v8M16 11v8"/>'),
  bolt: svg('<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>'),
  check: svg('<path d="M5 12.5l4.5 4.5L19 7"/>', 'stroke-width="3"'),
  cross: svg('<path d="M6 6l12 12M18 6L6 18"/>', 'stroke-width="3"'),
  clock: svg('<circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/>', 'stroke-width="3"'),
  undo: svg('<path d="M9 7L4 12l5 5"/><path d="M4 12h10a6 6 0 0 1 0 12"/>', 'stroke-width="3"'),
  link: svg('<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>'),
  share: svg('<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/>'),
  edit: svg('<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>'),
  cloud: svg('<path d="M7 18a5 5 0 1 1 .9-9.9A6 6 0 0 1 19 10a4 4 0 0 1-1 8z"/>'),
  bag: svg('<path d="M5 8h14l-1 12H6z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>'),
  lock: svg('<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>'),
  // Badges
  target: svg('<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1" fill="currentColor"/>'),
  flame: svg('<path d="M12 3c1 4 5 5.5 5 10a5 5 0 0 1-10 0c0-2.5 1.5-4 2.5-5 .3 2 1.5 3 2.5 3 0-3-1-5 0-8z"/>'),
  star: svg('<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>'),
  diamond: svg('<path d="M6 4h12l3 5-9 11L3 9z"/><path d="M3 9h18M9 4l3 16 3-16"/>'),
  globe: svg('<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18"/>'),
  glove: svg('<path d="M7 11V7a3 3 0 0 1 3-3h4a4 4 0 0 1 4 4v5a6 6 0 0 1-6 6h-1a5 5 0 0 1-5-5v-1a2 2 0 0 1 2-2h3"/><path d="M8 21h8"/>'),
  chart: svg('<path d="M4 20V4M4 20h16"/><path d="M7 15l4-4 3 3 5-6"/>'),
  news: svg('<path d="M5 4h11v15a2 2 0 0 0 2 2H6a2 2 0 0 1-2-2V5a1 1 0 0 1 1-1z"/><path d="M16 8h3v11a2 2 0 0 1-2 2"/><path d="M8 8h5M8 12h5M8 16h3"/>'),
  calendar: svg('<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/>'),
  crown: svg('<path d="M4 18h16M4 18L3 7l5 4 4-6 4 6 5-4-1 11"/>'),
  coins: svg('<ellipse cx="9" cy="7" rx="5" ry="2.5"/><path d="M4 7v4c0 1.4 2.2 2.5 5 2.5s5-1.1 5-2.5V7"/><path d="M10 15.4c.8 1.2 2.8 2.1 5 2.1 2.8 0 5-1.1 5-2.5v-4c0-1.4-2.2-2.5-5-2.5"/>'),
};

// Logo « G » de Google, en couleurs (boutons « Continuer avec Google »).
export const googleLogo = `<svg class="google-g" viewBox="0 0 48 48" width="20" height="20" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.6-.4-3.9z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.6-.4-3.9z"/></svg>`;

// Citrouille orange pleine (logo pendant Halloween, à la place du ballon).
export const pumpkinLogo = `<svg class="pumpkin-logo" viewBox="0 0 64 64" width="24" height="24" aria-hidden="true">
  <path fill="#4a7a1e" d="M30 14c0-5 2-9 6-11l3 3c-3 2-4 5-4 8z"/>
  <ellipse cx="32" cy="38" rx="27" ry="22" fill="#ff7a1a"/>
  <ellipse cx="32" cy="38" rx="13" ry="22" fill="#ff8f2e"/>
  <path fill="none" stroke="#c94f05" stroke-width="2.2" d="M19 18c-6 8-6 32 0 40M45 18c6 8 6 32 0 40M32 16v44"/>
  <path fill="#2a1200" d="M18 33l6-5 5 5zM35 33l5-5 6 5zM19 44c4 5 9 7 13 7s9-2 13-7l-4 1-2 3-3-2-4 3-4-3-3 2-2-3z"/>
</svg>`;

// Logo de la marque : « BC » dans un octogone doré (lettres en tracés : même rendu partout).
export const beltLogo = `<svg class="belt-logo" viewBox="0 0 64 64" width="24" height="24" aria-hidden="true"><defs><linearGradient id="bc-gold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe08a"/><stop offset=".5" stop-color="#f2b630"/><stop offset="1" stop-color="#b9821a"/></linearGradient></defs><path d="M21 3h22l18 18v22L43 61H21L3 43V21z" fill="#0b1733" stroke="url(#bc-gold)" stroke-width="5" stroke-linejoin="round"/><path transform="translate(14.4 45.3) scale(.38)" fill="url(#bc-gold)" d="M44.90-19.90Q43.90-10.30 37.55-5.15Q31.20 0 22.20 0L22.20 0L2.60 0Q2.10 0 1.80-0.35Q1.50-0.70 1.60-1.20L1.60-1.20L9.90-68.80Q10-69.30 10.35-69.65Q10.70-70 11.20-70L11.20-70L28.30-70Q37.40-70 42.55-66Q47.70-62 47.70-54L47.70-54Q47.70-51.80 47.50-50.60L47.50-50.60Q46.30-41 39.70-36.50L39.70-36.50Q39.20-36.20 39.50-35.90L39.50-35.90Q45.10-31.30 45.10-23.10L45.10-23.10Q45.10-22.10 44.90-19.90L44.90-19.90ZM24.90-55.80Q24.50-55.80 24.30-55.30L24.30-55.30L22.80-42.50Q22.60-42 23.20-42L23.20-42L25-42Q28.10-42 29.85-44.25Q31.60-46.50 31.60-50.50L31.60-50.50Q31.60-53.10 30.35-54.45Q29.10-55.80 26.70-55.80L26.70-55.80L24.90-55.80ZM22.70-14.30Q25.50-14.30 27.35-16.80Q29.20-19.30 29.20-23.80L29.20-23.80Q29.20-26.70 28-28.40Q26.80-30.10 24.70-30.10L24.70-30.10L21.70-30.10Q21.20-30.10 21.20-29.60L21.20-29.60L19.40-14.80Q19.20-14.30 19.80-14.30L19.80-14.30L22.70-14.30ZM67.20 0.80Q58.80 0.80 54.00-3.80Q49.20-8.40 49.20-16.40L49.20-16.40Q49.20-17.50 49.40-19.70L49.40-19.70L53.20-50.40Q54.30-59.80 60.50-65.30Q66.70-70.80 75.90-70.80L75.90-70.80Q84.30-70.80 89.15-66.25Q94-61.70 94-53.80L94-53.80Q94-52.80 93.80-50.40L93.80-50.40L93.70-49.50Q93.60-49 93.25-48.65Q92.90-48.30 92.40-48.30L92.40-48.30L78.50-47.70Q77.40-47.70 77.50-48.90L77.50-48.90L77.90-51.60Q78.10-53.90 77.10-55.25Q76.10-56.60 74.20-56.60L74.20-56.60Q72.30-56.60 71-55.25Q69.70-53.90 69.40-51.60L69.40-51.60L65.30-18.30Q65.10-16.10 66.05-14.75Q67-13.40 68.90-13.40L68.90-13.40Q70.80-13.40 72.15-14.75Q73.50-16.10 73.80-18.30L73.80-18.30L74.10-21.20Q74.20-21.70 74.55-22.05Q74.90-22.40 75.40-22.40L75.40-22.40L89.10-21.80Q90.20-21.80 90.20-20.60L90.20-20.60L90-19.70Q88.90-10.40 82.65-4.80Q76.40 0.80 67.20 0.80L67.20 0.80Z"/></svg>`;

// Boule de Noël (logo pendant Noël, à la place du logo) : boule rouge brillante, rubans et étoile
// dorés, attache dorée et son anneau.
export const baubleLogo = `<svg class="bauble-logo" viewBox="0 0 64 64" width="24" height="24" aria-hidden="true">
  <defs>
    <radialGradient id="bauble-red" cx="0.36" cy="0.34" r="0.75">
      <stop offset="0" stop-color="#ff7b6e"/><stop offset="0.45" stop-color="#e3242b"/><stop offset="1" stop-color="#8e0f16"/>
    </radialGradient>
  </defs>
  <circle cx="32" cy="8" r="4" fill="none" stroke="#f2c14e" stroke-width="2.4"/>
  <rect x="25" y="11" width="14" height="7" rx="2" fill="#f2c14e"/>
  <path d="M26 13.5h12" stroke="#b8862b" stroke-width="1.2"/>
  <circle cx="32" cy="39" r="22" fill="url(#bauble-red)"/>
  <path d="M11.5 36c13 5 28 5 41 0M10.5 44c14 5 29 5 43 0" fill="none" stroke="#ffd166" stroke-width="2.2" opacity="0.9"/>
  <path d="M32 26.5l3.3 6.7 7.4 1.1-5.4 5.2 1.3 7.3-6.6-3.5-6.6 3.5 1.3-7.3-5.4-5.2 7.4-1.1z" fill="#ffd166" stroke="#b8862b" stroke-width="0.8"/>
  <ellipse cx="24" cy="29" rx="6" ry="3.6" fill="#fff" opacity="0.35" transform="rotate(-35 24 29)"/>
</svg>`;

export const coin = (cls = 'coin') => `
<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true">
  <circle cx="12" cy="12" r="11" fill="#e79a00"/>
  <circle cx="12" cy="11.2" r="10" fill="#ffc83d"/>
  <circle cx="12" cy="11.2" r="7.4" fill="none" stroke="#e79a00" stroke-width="1.3"/>
  <path d="M14.6 8.3a3.6 3.6 0 1 0 .4 5.2V11.6h-2.6" fill="none" stroke="#a86400" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

// Emblème de rang : une gemme à la couleur du rang, des ailes à partir d'Or, une couronne à
// partir d'Ascendant, un éclat pour Radiant ; les petits losanges en bas indiquent la division.
export function rankEmblem(rank, cls = 'rank-emblem') {
  const level = rank.id === 'radiant' ? 8 : ['iron', 'bronze', 'silver', 'gold', 'platinum', 'diamond', 'ascendant', 'immortal'].indexOf(rank.id);
  const g = `rk-${rank.id}`;
  const wings = level >= 3 ? '<path d="M5 9L1 7l2 6 3 1zM19 9l4-2-2 6-3 1z" fill="currentColor" opacity=".7"/>' : '';
  const crown = level >= 6 ? '<path d="M8 4l1-3 2 2 1-2 1 2 2-2 1 3z" fill="currentColor"/>' : '';
  const burst = level === 8
    ? '<g stroke="currentColor" stroke-width="1.2" opacity=".8"><path d="M12 0v3M2 3l2.5 2M22 3l-2.5 2M0 13h3M24 13h-3"/></g>' : '';
  const pips = rank.division
    ? Array.from({ length: rank.division }, (_, i) => {
      const x = 12 + (i - (rank.division - 1) / 2) * 4;
      return `<path d="M${x} 23.5l1.5 1.5-1.5 1.5-1.5-1.5z" fill="currentColor"/>`;
    }).join('') : '';
  return `
<svg class="${cls}" viewBox="0 0 24 27" style="color:${rank.color}" role="img" aria-label="${rank.label}">
  <defs><linearGradient id="${g}" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="${rank.color}"/><stop offset="1" stop-color="${rank.color}" stop-opacity=".45"/>
  </linearGradient></defs>
  ${burst}${wings}${crown}
  <path d="M12 3l7 7-7 11-7-11z" fill="url(#${g})" stroke="currentColor" stroke-width="1"/>
  <path d="M12 6.5l3.5 3.5L12 16l-3.5-6z" fill="#fff" opacity=".28"/>
  ${pips}
</svg>`;
}
