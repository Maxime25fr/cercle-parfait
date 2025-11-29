/* Cercle Parfait — script.js
   - resize canvas with DPR to avoid pointer offset
   - robust circle fit (algebraic least squares)
   - animated correction circle
   - score storage and display
*/

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d', { alpha: false });
let deviceChosen = false;
let deviceType = 'desktop'; // 'mobile'|'desktop'
let dpr = Math.max(1, window.devicePixelRatio || 1);

let drawing = false;
let points = [];
let lastFit = null;
let animFrame = null;
let scores = JSON.parse(localStorage.getItem('circle_perfect_scores') || '[]');

// elements
const deviceModal = document.getElementById('deviceModal');
const chooseMobile = document.getElementById('chooseMobile');
const chooseDesktop = document.getElementById('chooseDesktop');

const startBtn = document.getElementById('startBtn');
const evaluateBtn = document.getElementById('evaluateBtn');
const correctionBtn = document.getElementById('correctionBtn');
const clearBtn = document.getElementById('clearBtn');
const themeToggle = document.getElementById('themeToggle');

const scoreHud = document.getElementById('scoreHud');
const scoreValue = document.getElementById('scoreValue');
const scoreDetails = document.getElementById('scoreDetails');
const scoreList = document.getElementById('scoreList');
const exportCsv = document.getElementById('exportCsv');

// --- device selection ---
chooseMobile.addEventListener('click', ()=> selectDevice('mobile'));
chooseDesktop.addEventListener('click', ()=> selectDevice('desktop'));
function selectDevice(kind){
  deviceType = kind;
  deviceChosen = true;
  deviceModal.style.display = 'none';
  setupCanvas();
}

// --- canvas sizing with DPR ---
function setupCanvas(){
  // set CSS size according to device type & window size
  const containerWidth = Math.min(760, window.innerWidth - 320);
  if(deviceType==='mobile'){
    // mobile: make canvas full width minus margins
    const w = Math.min(window.innerWidth - 40, 480);
    const h = Math.round(w * 0.95);
    setCanvasSize(w, h);
  } else {
    // desktop
    const w = Math.min(720, Math.max(560, Math.floor((window.innerWidth - 360))));
    const h = Math.round(Math.max(480, w * 0.86));
    setCanvasSize(w, h);
  }
  clearDrawing();
}

function setCanvasSize(cssWidth, cssHeight){
  const ratio = dpr;
  canvas.style.width = cssWidth + 'px';
  canvas.style.height = cssHeight + 'px';
  canvas.width = Math.round(cssWidth * ratio);
  canvas.height = Math.round(cssHeight * ratio);
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(2, 3 * (ratio)); // visually ok
  ctx.strokeStyle = '#111';
  ctx.fillStyle = getComputedStyle(document.body).getPropertyValue('--card-light') || '#fff';
}

// --- pointer helpers (mouse & touch) ---
function pointerPos(e){
  const rect = canvas.getBoundingClientRect();
  if(e.touches && e.touches.length) {
    return { x: (e.touches[0].clientX - rect.left), y: (e.touches[0].clientY - rect.top) };
  } else {
    return { x: (e.clientX - rect.left), y: (e.clientY - rect.top) };
  }
}

canvas.addEventListener('pointerdown', e => {
  e.preventDefault();
  drawing = true;
  points = [];
  const p = pointerPos(e);
  points.push([p.x, p.y]);
});
canvas.addEventListener('pointermove', e => {
  if(!drawing) return;
  e.preventDefault();
  const p = pointerPos(e);
  const last = points[points.length-1];
  // draw immediate line from last to new
  ctx.beginPath();
  ctx.moveTo(last[0], last[1]);
  ctx.lineTo(p.x, p.y);
  ctx.stroke();
  points.push([p.x, p.y]);
});
canvas.addEventListener('pointerup', e => { drawing = false; });
canvas.addEventListener('pointercancel', e => { drawing = false; });

// --- clear / start ---
startBtn.addEventListener('click', ()=> { clearDrawing(); });
clearBtn.addEventListener('click', ()=> { clearDrawing(); });

function clearDrawing(){
  cancelAnimationFrame(animFrame);
  ctx.clearRect(0,0,canvas.width,canvas.height);
  points = [];
  lastFit = null;
  updateScoreHUD(null);
}

// --- circle fit: algebraic least squares (Kasa) ---
function fitCircleLS(pts){
  if(pts.length < 3) return null;
  let Sx=0,Sy=0,Sxx=0,Syy=0,Sxy=0,Sx3=0,Sy3=0,Sx2y2=0;
  for(const p of pts){
    const x=p[0], y=p[1];
    const z = x*x + y*y;
    Sx += x; Sy += y;
    Sxx += x*x; Syy += y*y; Sxy += x*y;
    Sx3 += x*z; Sy3 += y*z; Sx2y2 += z;
  }
  const n = pts.length;
  const M = [[Sxx, Sxy, Sx],[Sxy, Syy, Sy],[Sx, Sy, n]];
  const B = [-Sx3, -Sy3, -Sx2y2];

  // solve 3x3 via gaussian elimination
  const A = M.map(r => r.slice());
  const b = B.slice();
  for(let i=0;i<3;i++){
    // pivot
    let piv = i;
    for(let j=i+1;j<3;j++) if(Math.abs(A[j][i]) > Math.abs(A[piv][i])) piv = j;
    if(Math.abs(A[piv][i]) < 1e-12) return null;
    [A[i], A[piv]] = [A[piv], A[i]];
    [b[i], b[piv]] = [b[piv], b[i]];
    const div = A[i][i];
    for(let c=i;c<3;c++) A[i][c] /= div;
    b[i] /= div;
    for(let r=0;r<3;r++){
      if(r===i) continue;
      const fac = A[r][i];
      for(let c=i;c<3;c++) A[r][c] -= fac * A[i][c];
      b[r] -= fac * b[i];
    }
  }
  const [Acoef, Bcoef, Ccoef] = b;
  const cx = -Acoef/2;
  const cy = -Bcoef/2;
  const radius = Math.sqrt(Math.max(0, cx*cx + cy*cy - Ccoef));
  if(!isFinite(radius) || radius <= 0) return null;
  return {cx, cy, r: radius};
}

// --- angular coverage ---
function angularCoverage(pts, cx, cy){
  const ang = pts.map(p => Math.atan2(p[1]-cy, p[0]-cx)).sort((a,b)=>a-b);
  let maxgap = 0;
  for(let i=1;i<ang.length;i++) maxgap = Math.max(maxgap, ang[i]-ang[i-1]);
  const wrap = (ang[0] + 2*Math.PI) - ang[ang.length -1];
  maxgap = Math.max(maxgap, wrap);
  const coverage = Math.max(0, 2*Math.PI - maxgap);
  return coverage; // radians
}

// --- evaluate & score ---
evaluateBtn.addEventListener('click', ()=> {
  if(points.length < 8){
    alert('Dessine un cercle plus complet avant d\'évaluer.');
    return;
  }
  const fit = fitCircleLS(points);
  if(!fit){
    alert('Impossible d\'ajuster un cercle. Essaie de dessiner plus régulièrement.');
    return;
  }
  lastFit = fit;
  // compute RMSE
  let sum2 = 0; let minR = Infinity; let maxR = 0;
  for(const p of points){
    const d = Math.hypot(p[0]-fit.cx, p[1]-fit.cy);
    const err = d - fit.r;
    sum2 += err*err;
    minR = Math.min(minR, d);
    maxR = Math.max(maxR, d);
  }
  const rmse = Math.sqrt(sum2 / points.length);
  const coverage = angularCoverage(points, fit.cx, fit.cy);
  // scoring: a little more forgiving but still meaningful
  const relativeError = rmse / fit.r; // fraction
  const precision = Math.max(0, 1 - (relativeError / 0.5)); // if rmse==0.25*r -> 0.5 precision
  const coverageFactor = Math.min(1, coverage / (Math.PI * 1.6)); // expect near 2π
  const rawScore = 100 * precision;
  const finalScore = Math.round(rawScore * (0.5 + 0.5 * coverageFactor)); // combine
  // ensure between 0 and 100
  const scoreClamped = Math.max(0, Math.min(100, finalScore));

  // save to scores
  const entry = {score: scoreClamped, rmse: +rmse.toFixed(2), radius: +fit.r.toFixed(1), coverageDeg: Math.round(coverage*180/Math.PI), time: (new Date()).toISOString()};
  scores.unshift(entry);
  // keep top 20 (most recent)
  if(scores.length > 20) scores.length = 20;
  localStorage.setItem('circle_perfect_scores', JSON.stringify(scores));

  updateScoreHUD(entry);
  updateScoreList();
});

// --- show/hide correction (animated) ---
let showCorrection = false;
correctionBtn.addEventListener('click', ()=>{
  showCorrection = !showCorrection;
  if(showCorrection && lastFit){
    animateCircleDraw(lastFit.cx, lastFit.cy, lastFit.r);
  } else {
    cancelAnimationFrame(animFrame);
    redrawAll(); // redraw strokes
  }
});

// animate circle drawing
function animateCircleDraw(cx, cy, r){
  cancelAnimationFrame(animFrame);
  let start = null;
  function step(ts){
    if(!start) start = ts;
    const t = (ts - start)/800; // 0..1
    ctx.clearRect(0,0,canvas.width,canvas.height);
    redrawStrokesOnly();
    // draw partial circle
    ctx.strokeStyle = 'rgba(231,76,60,0.95)';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.arc(cx, cy, r, -Math.PI/2, -Math.PI/2 + Math.min(2*Math.PI, 2*Math.PI*t), false);
    ctx.stroke();
    if(t < 1) animFrame = requestAnimationFrame(step);
  }
  animFrame = requestAnimationFrame(step);
}

// redraw strokes only
function redrawStrokesOnly(){
  if(points.length < 2) return;
  ctx.strokeStyle = '#111';
  ctx.lineWidth = Math.max(2, 3*(dpr));
  for(let i=1;i<points.length;i++){
    ctx.beginPath();
    ctx.moveTo(points[i-1][0], points[i-1][1]);
    ctx.lineTo(points[i][0], points[i][1]);
    ctx.stroke();
  }
}

// redraw everything: strokes + hud
function redrawAll(){
  ctx.clearRect(0,0,canvas.width,canvas.height);
  redrawStrokesOnly();
}

// --- HUD & Scores UI ---
function updateScoreHUD(entry){
  if(!entry){ scoreValue.textContent = '—'; scoreDetails.textContent = ''; return; }
  scoreValue.textContent = `${entry.score} / 100`;
  scoreDetails.innerHTML = `RMSE: ${entry.rmse}px • Rayon: ${entry.radius}px • Couverture: ${entry.coverageDeg}°`;
}

function updateScoreList(){
  scoreList.innerHTML = '';
  if(scores.length===0){ scoreList.innerHTML = '<div class="score-entry">Aucun score</div>'; return; }
  scores.forEach((s, idx)=>{
    const el = document.createElement('div');
    el.className = 'score-entry';
    el.innerHTML = `<div><strong>${s.score}</strong> pts</div><div class="muted">${(new Date(s.time)).toLocaleString()}</div>`;
    scoreList.appendChild(el);
  });
}

exportCsv && exportCsv.addEventListener('click', ()=>{
  if(scores.length===0){ alert('Aucun score à exporter'); return; }
  const rows = ['score,rmse,radius,coverageDeg,time'].concat(scores.map(s=>`${s.score},${s.rmse},${s.radius},${s.coverageDeg},"${s.time}"`));
  const csv = rows.join('\n');
  const blob = new Blob([csv], {type:'text/csv;charset=utf-8;'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'circle_scores.csv';
  document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
});

// theme toggle
themeToggle.addEventListener('click', ()=>{
  const body = document.body;
  if(body.classList.contains('theme-dark')) { body.classList.remove('theme-dark'); body.classList.add('theme-light'); }
  else { body.classList.remove('theme-light'); body.classList.add('theme-dark'); }
});

// responsive handling
window.addEventListener('resize', ()=>{
  if(deviceChosen) setupCanvas();
});
window.addEventListener('load', ()=>{
  // if user has already chosen before (optional), skip modal (not implemented)
  setupCanvas();
  updateScoreList();
  // show modal to select device
  deviceModal.style.display = 'flex';
});
