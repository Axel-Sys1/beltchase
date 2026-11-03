// Décor animé partagé par le jeu (index.html) et la page de pré-inscription (bientot.html) :
// projecteurs, octogone de la cage et fumée en CSS (.bc-bg), étincelles dorées dessinées ici.
// Rien ne bouge si le visiteur a demandé à réduire les animations.

// Étincelles qui montent doucement. `density` : surface (px²) par étincelle, plus grand = moins d'étincelles.
export function startSparks(canvas, { density = 16000, max = 90 } = {}) {
  if (!canvas || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const ctx = canvas.getContext('2d');
  let w = 0, h = 0, dots = [];
  const spawn = (y) => ({ x: Math.random() * w, y: y ?? h + 10, r: 0.6 + Math.random() * 1.8, v: 0.15 + Math.random() * 0.45, d: Math.random() * 6.28, a: 0.25 + Math.random() * 0.6 });
  const size = () => {
    const dpr = Math.min(2, devicePixelRatio || 1);
    w = innerWidth; h = innerHeight;
    canvas.width = w * dpr; canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    dots = Array.from({ length: Math.round(Math.min(max, w * h / density)) }, () => spawn(Math.random() * h));
  };
  size();
  addEventListener('resize', size);
  let running = false;
  const frame = () => {
    if (document.hidden) { running = false; return; } // onglet caché : on s'arrête (batterie)
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#ffcf5a';
    ctx.shadowColor = '#f2b630';
    ctx.shadowBlur = 6;
    for (const p of dots) {
      p.y -= p.v; p.d += 0.01; p.x += Math.sin(p.d) * 0.25;
      if (p.y < -10) Object.assign(p, spawn());
      ctx.globalAlpha = p.a * Math.min(1, p.y / (h * 0.35)); // s'éteignent en haut de l'écran
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.283); ctx.fill();
    }
    requestAnimationFrame(frame);
  };
  const start = () => { if (!running && !document.hidden) { running = true; requestAnimationFrame(frame); } };
  document.addEventListener('visibilitychange', start);
  start();
}
