/* Cercle Parfait — script.js
   - correction offset souris/canvas
   - fit circle (algebraic least squares)
   - RMSE -> score (adjusted difficulty)
   - animations & UI wiring
*/

const canvas = document.getElementById('drawCanvas');
const ctx = canvas.getContext('2d', { alpha: false });

// ensure canvas pixel ratio & sizing to avoid blurriness and mouse offset
function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(rect.width * dpr);
  canvas.height = Math.round(rect.height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  redrawAll();
}
window.addEventListener('resize', resizeCanvas);

// initial sizing: set a sensible rect for canvas element
(function initCanvasSize(){
  // set an initial CSS size if none
  if (!canvas.style.width) canvas.style.width = '100%';
  if (!canvas.style.height) canvas.style.height = '540px';
  // small timeout to allow layout
  setTimeout(resizeCanvas, 50);
})();

// state
let drawing = false;
let points = [];       // stores {x,y}
let lastFit = null;
let scores = JSON.parse(localStorage.getItem('circle_scores_v1') || '[]');
const maxSavedScores = 7;

// UI refs
const startBtn = document.getElementById('startBtn');
const evalBtn = document.getElementById('evalBtn');
const correctionBtn = document.getElementById('correctionBtn');
const saveBtn = document.getElementById('saveBtn');
const clearBtn = document.getElementById('clearBtn');
const themeBtn = document.getElementById('themeBtn');
const deviceSelect = document.getElementById('deviceSelect');
const scoreValue = document.getElementById('scoreValue');
const scoresTableBody = document.querySelector('#scoresTable tbody');
const intro = document.getElementById('intro');

// small intro animation - fade out after 1s
if (intro) {
  setTimeout(()=> {
    intro.style.transition = 'opacity .6s ease';
    intro.style.opacity = '0';
    setTimeout(()=> intro.remove(), 700);
  }, 900);
}

// helpers: coordinate conversion using bounding rect (handles CSS scaling)
function getCanvasPos(evt) {
  const rect = canvas.getBoundingClientRect();
  const isTouch = evt.touches && evt.touches.length;
  const clientX = isTouch ? evt.touches[0].clientX : evt.clientX;
  const clientY = isTouch ? evt.touches[0].clientY : evt.clientY;
  // convert to CSS pixels inside canvas
  const x = clientX - rect.left;
  const y = clientY - rect.top;
  return { x, y };
}

// drawing events - support touch and mouse
function beginStroke(evt) {
  evt.preventDefault();
  drawing = true;
  points = [];
  const p = getCanvasPos(evt);
  points.push(p);
}
function moveStroke(evt) {
  if (!drawing) return;
  evt.preventDefault();
  const p = getCanvasPos(evt);
  points.push(p);
  const n = points.length;
  if (n >= 2) {
    const a = points[n-2], b = points[n-1];
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 3;
    ctx.strokeStyle = (document.body.classList.contains('dark') ? '#fff' : '#000');
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
}
function endStroke(evt) {
  drawing = false;
}

// wire events
canvas.addEventListener('mousedown', beginStroke);
canvas.addEventListener('mousemove', moveStroke);
window.addEventListener('mouseup', endStroke);

canvas.addEventListener('touchstart', beginStroke, { passive: false });
canvas.addEventListener('touchmove', moveStroke, { passive: false });
window.addEventListener('touchend', endStroke);

// UI buttons
startBtn.addEventListener('click', ()=> {
  clearCanvas();
  animatePulse();
});
clearBtn.addEventListener('click', ()=> {
  clearCanvas();
});
themeBtn.addEventListener('click', ()=> {
  document.body.classList.toggle('dark');
  document.body.classList.toggle('light');
  // small redraw to ensure contrast
  redrawAll();
});
deviceSelect.addEventListener('change', (e)=> {
  adaptToDevice(e.target.value);
});

// adapt layout to device choice
function adaptToDevice(choice) {
  const prefersMobile = /Mobi|Android/i.test(navigator.userAgent);
  if (choice === 'mobile') {
    canvas.style.height = '420px';
  } else if (choice === 'desktop') {
    canvas.style.height = '540px';
  } else {
    canvas.style.height = prefersMobile ? '420px' : '540px';
  }
  setTimeout(resizeCanvas, 60);
}

// clear + redraw helper
function clearCanvas() {
  points = [];
  lastFit = null;
  ctx.clearRect(0,0,canvas.width,canvas.height);
  // draw subtle grid or guideline
  drawGuidelines();
  scoreValue.textContent = '— / 100';
}
function redrawAll() {
  ctx.clearRect(0,0,canvas.width,canvas.height);
  drawGuidelines();
  // redraw stroke
  if (points.length>1) {
    ctx.lineWidth=3;
    ctx.strokeStyle = (document.body.classList.contains('dark') ? '#fff' : '#000');
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i=1;i<points.length;i++) ctx.lineTo(points[i].x, points[i].y);
    ctx.stroke();
  }
  if (lastFit) drawFit(lastFit);
}

// subtle circular guideline to help users (non-intrusive)
function drawGuidelines(){
  const w = canvas.clientWidth, h = canvas.clientHeight;
  const cx = w/2, cy = h/2;
  ctx.save();
  ctx.globalAlpha = 0.04;
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.arc(cx,cy, Math.min(w,h)/3, 0, Math.PI*2);
  ctx.fill();
  ctx.restore();
}

// animation pulse when starting
function animatePulse(){
  const overlay = document.createElement('div');
  overlay.style.position='absolute';
  overlay.style.left = canvas.getBoundingClientRect().left + 'px';
  overlay.style.top = canvas.getBoundingClientRect().top + 'px';
  overlay.style.width = canvas.offsetWidth + 'px';
  overlay.style.height = canvas.offsetHeight + 'px';
  overlay.style.pointerEvents = 'none';
  overlay.style.borderRadius = getComputedStyle(canvas).borderRadius;
  overlay.style.boxShadow = '0 0 0 0 rgba(26,115,232,0.18)';
  document.body.appendChild(overlay);
  overlay.animate([
    { boxShadow: '0 0 0 0 rgba(26,115,232,0.18)' },
    { boxShadow: '0 0 60px 30px rgba(26,115,232,0.06)' }
  ],{ duration:500, easing:'ease-out' }).onfinish = ()=> overlay.remove();
}

// ----- CIRCLE FITTING (algebraic least squares / Kåsa variant) -----
// returns {cx, cy, r} or null
function fitCircleLS(pts) {
  if (pts.length < 3) return null;
  // build normal equations using D = [x y 1], b = -(x^2+y^2)
  let Sx=0,Sy=0,Sxx=0,Syy=0,Sxy=0,Sxz=0,Syz=0,Sz=0;
  const n = pts.length;
  for (let i=0;i<n;i++){
    const x = pts[i].x, y = pts[i].y;
    const z = x*x + y*y;
    Sx += x; Sy += y;
    Sxx += x*x; Syy += y*y; Sxy += x*y;
    Sxz += x*z; Syz += y*z; Sz += z;
  }
  // normal matrix
  // [ Sxx Sxy Sx ] [A] = [ -Sxz ]
  // [ Sxy Syy Sy ] [B] = [ -Syz ]
  // [ Sx  Sy  n  ] [C] = [ -Sz  ]
  const M = [
    [Sxx, Sxy, Sx],
    [Sxy, Syy, Sy],
    [Sx,  Sy,  n]
  ];
  const B = [-Sxz, -Syz, -Sz];

  // solve 3x3
  const sol = solveLinear3(M, B);
  if (!sol) return null;
  const [A,Bb,Cc] = sol;
  const cx = -A/2, cy = -Bb/2;
  const r2 = cx*cx + cy*cy - Cc;
  if (r2 <= 0 || !isFinite(r2)) return null;
  return { cx, cy, r: Math.sqrt(r2) };
}

// small gaussian elimination for 3x3
function solveLinear3(A,b) {
  const m = A.map(r=>r.slice()); const v = b.slice();
  for (let k=0;k<3;k++){
    // pivot
    let piv = k;
    for (let i=k;i<3;i++) if (Math.abs(m[i][k]) > Math.abs(m[piv][k])) piv = i;
    if (Math.abs(m[piv][k]) < 1e-12) return null;
    // swap
    [m[k], m[piv]] = [m[piv], m[k]];
    [v[k], v[piv]] = [v[piv], v[k]];
    // normalize
    const d = m[k][k];
    for (let j=k;j<3;j++) m[k][j] /= d;
    v[k] /= d;
    // eliminate
    for (let i=0;i<3;i++){
      if (i === k) continue;
      const f = m[i][k];
      for (let j=k;j<3;j++) m[i][j] -= f*m[k][j];
      v[i] -= f*v[k];
    }
  }
  return v;
}

// compute RMSE of radial errors and angular coverage
function evaluateFit(pts, fit) {
  const {cx,cy,r} = fit;
  let sum2 = 0;
  const angs = [];
  for (let p of pts) {
    const d = Math.hypot(p.x-cx, p.y-cy);
    const err = d - r;
    sum2 += err*err;
    angs.push(Math.atan2(p.y-cy, p.x-cx));
  }
  const rmse = Math.sqrt(sum2 / pts.length);
  // angular coverage estimation
  angs.sort((a,b)=>a-b);
  let maxGap = 0;
  for (let i=1;i<angs.length;i++) maxGap = Math.max(maxGap, angs[i]-angs[i-1]);
  const wrap = (angs[0]+2*Math.PI) - angs[angs.length-1];
  maxGap = Math.max(maxGap, wrap);
  const coverage = 2*Math.PI - maxGap; // radians
  return { rmse, coverage, r };
}

// draw fitted circle visually
function drawFit(fit) {
  if (!fit) return;
  ctx.save();
  ctx.strokeStyle = 'rgba(231,76,60,0.95)'; // red-ish
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(fit.cx, fit.cy, fit.r, 0, Math.PI*2);
  ctx.stroke();
  // center dot
  ctx.fillStyle = 'rgba(231,76,60,0.95)';
  ctx.beginPath();
  ctx.arc(fit.cx, fit.cy, 4, 0, Math.PI*2);
  ctx.fill();
  ctx.restore();
}

// main evaluate function wired to UI
function evaluateCurrent() {
  if (points.length < 8) { alert('Trace un cercle plus complet avant d\'évaluer.'); return; }
  const fit = fitCircleLS(points);
  if (!fit) { alert('Impossible d\'ajuster un cercle sur ce tracé. Essaye encore.'); return; }
  lastFit = fit;
  // evaluate metrics
  const { rmse, coverage, r } = evaluateFit(points, fit);

  // scoring formula: combine RMSE relative to radius + coverage factor
  // normalized error = rmse / r
  // make scoring slightly easier than very strict, but still challenging
  const normalized = rmse / r;
  // map normalized to precision score (0..100)
  // precisionScore = 100 * clamp(1 - 4 * normalized)
  // use multiplier 4 for sensitivity (smaller rmse needed)
  let precisionScore = Math.max(0, 100 * (1 - 4 * normalized));
  // coverage factor: encourage near full circle
  const covFactor = Math.min(1, coverage / (2*Math.PI * 0.85)); // require ~85% to avoid heavy penalty
  // final blend
  let final = Math.round(precisionScore * (0.55 + 0.45 * covFactor));

  // clamp
  final = Math.max(0, Math.min(100, final));

  // update UI
  scoreValue.textContent = final + ' / 100';
  // draw correction only on demand (not automatic) — but keep lastFit for Correction button
  updateScores(final);
  // subtle highlight animation on score
  animateScorePop();
  return final;
}

// update saved scores & table
function updateScores(score) {
  const now = new Date().toLocaleString();
  scores.unshift({score, date: now});
  // keep unique top N by value
  scores.sort((a,b)=> b.score - a.score);
  if (scores.length > maxSavedScores) scores.length = maxSavedScores;
  localStorage.setItem('circle_scores_v1', JSON.stringify(scores));
  refreshScoresTable();
}
function refreshScoresTable() {
  scoresTableBody.innerHTML = '';
  for (let i=0;i<scores.length;i++){
    const row = document.createElement('tr');
    const rank = document.createElement('td'); rank.textContent = i+1;
    const sc = document.createElement('td'); sc.textContent = scores[i].score;
    const dt = document.createElement('td'); dt.textContent = scores[i].date;
    row.appendChild(rank); row.appendChild(sc); row.appendChild(dt);
    scoresTableBody.appendChild(row);
  }
}
document.getElementById('saveBtn').addEventListener('click', ()=> {
  const txt = scoreValue.textContent;
  if (!txt || txt.startsWith('—')) { alert('Pas de score à sauvegarder — évalue d\'abord.'); return; }
  // read number
  const num = parseInt(txt.split('/')[0]);
  updateScores(num);
});

// Correction button shows fitted circle
correctionBtn.addEventListener('click', ()=> {
  if (!lastFit) {
    alert('Évalue d\'abord pour générer la correction (appuie sur Évaluer).');
    return;
  }
  // redraw stroke then draw fit
  redrawAll();
  drawFit(lastFit);
});

// Evaluate button
evalBtn.addEventListener('click', ()=> {
  evaluateCurrent();
});

// clear scores
document.getElementById('clearScores').addEventListener('click', ()=> {
  if (!confirm('Effacer tous les scores enregistrés ?')) return;
  scores = [];
  localStorage.removeItem('circle_scores_v1');
  refreshScoresTable();
  scoreValue.textContent = '— / 100';
});

// on load
(function onLoad() {
  // initial canvas guidelines
  drawGuidelines();
  refreshScoresTable();
  // device auto selection
  deviceSelect.value = 'auto';
  adaptOnLoad();
})();

function adaptOnLoad(){
  const mq = window.matchMedia('(max-width:900px)');
  deviceSelect.value = mq.matches ? 'mobile' : 'desktop';
  adaptToDevice(deviceSelect.value);
}
function adaptToDevice(choice) {
  const mobile = choice === 'mobile';
  if (mobile) canvas.style.height = '420px';
  else canvas.style.height = '540px';
  setTimeout(resizeCanvas, 60);
}

// small animation when score updates
function animateScorePop(){
  const el = document.getElementById('scorePanel');
  if (!el) return;
  el.animate([{ transform: 'scale(1)'},{ transform: 'scale(1.06)'},{ transform: 'scale(1)'}], { duration: 360, easing: 'cubic-bezier(.2,.9,.3,1)'});
}

// ensure canvas resizes correctly once CSS applied
setTimeout(resizeCanvas, 120);
