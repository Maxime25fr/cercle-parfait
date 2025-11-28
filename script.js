// script.js - Cercle Parfait (responsive, ads, scores, fit circle)
(function(){
  // --- Elements ---
  const app = document.getElementById('app');
  const canvas = document.getElementById('canvas');
  const ctx = canvas.getContext('2d', { alpha: false });
  const scoreBadge = document.getElementById('scoreBadge');
  const detailBadge = document.getElementById('detailBadge');
  const scoresTable = document.getElementById('scoresTable');
  const deviceModal = document.getElementById('deviceModal');
  const chooseDesktop = document.getElementById('chooseDesktop');
  const chooseMobile = document.getElementById('chooseMobile');
  const themeToggle = document.getElementById('themeToggle');
  const resetAll = document.getElementById('resetAll');

  // buttons
  const btnStart = document.getElementById('btnStart');
  const btnEvaluate = document.getElementById('btnEvaluate');
  const btnCorrection = document.getElementById('btnCorrection');
  const btnSave = document.getElementById('btnSave');
  const btnClearScores = document.getElementById('clearScores');

  // state
  let drawing = false;
  let points = [];
  let lastFit = null;
  let lastScore = null;
  let deviceMode = 'desktop'; // or 'mobile'
  let theme = localStorage.getItem('cp_theme') || 'light'; // persist theme

  // Resize-aware canvas: set internal size to display size * DPR
  function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); // use CSS px coordinates
    redrawAll();
  }

  // initial canvas sizing: set CSS height based on mode
  function setCanvasSizeByMode(mode) {
    if(mode === 'mobile'){
      canvas.style.height = '360px';
    } else {
      canvas.style.height = '480px';
    }
    // call resize in next tick
    setTimeout(resizeCanvas, 50);
  }

  // convert client coords to canvas coordinates (account bounding rect & DPR)
  function clientToCanvas(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const x = (clientX - rect.left);
    const y = (clientY - rect.top);
    return { x, y };
  }

  // drawing helpers
  function clearCanvas() {
    ctx.fillStyle = getComputedStyle(app).getPropertyValue('--card').trim() || '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  function redrawStroke() {
    if(points.length < 2) return;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#111';
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for(let i=1;i<points.length;i++){
      ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.stroke();
  }

  function redrawAll(){
    clearCanvas();
    redrawStroke();
    if(lastFit && showCorrectionFlag) drawCorrectionVisual(lastFit);
  }

  // input events (mouse & touch)
  function startStroke(x,y){
    drawing = true;
    points = [{x,y}];
  }
  function moveStroke(x,y){
    if(!drawing) return;
    points.push({x,y});
    // draw incremental
    const n = points.length;
    if(n>=2){
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.strokeStyle = '#111';
      ctx.beginPath();
      ctx.moveTo(points[n-2].x, points[n-2].y);
      ctx.lineTo(points[n-1].x, points[n-1].y);
      ctx.stroke();
    }
  }
  function endStroke(){
    drawing = false;
  }

  // attach pointer events (unified)
  canvas.addEventListener('pointerdown', e => {
    canvas.setPointerCapture(e.pointerId);
    const p = clientToCanvas(e.clientX, e.clientY);
    startStroke(p.x, p.y);
  });
  canvas.addEventListener('pointermove', e => {
    if(!drawing) return;
    const p = clientToCanvas(e.clientX, e.clientY);
    moveStroke(p.x, p.y);
  });
  canvas.addEventListener('pointerup', e => {
    canvas.releasePointerCapture(e.pointerId);
    endStroke();
  });
  canvas.addEventListener('pointercancel', ()=> endStroke());

  // --- Circle fit (algebraic least-squares via normal equations) ---
  function fitCircle(pts){
    if(pts.length < 3) return null;
    // use Kasa / linear algebra method
    let Sx=0,Sy=0,Sxx=0,Syy=0,Sxy=0,Sx3=0,Sy3=0,Sx2y2=0;
    for(const p of pts){
      const x = p.x, y = p.y;
      const z = x*x + y*y;
      Sx += x; Sy += y;
      Sxx += x*x; Syy += y*y; Sxy += x*y;
      Sx3 += x*z; Sy3 += y*z; Sx2y2 += z;
    }
    const n = pts.length;
    const M = [[Sxx,Sxy,Sx],[Sxy,Syy,Sy],[Sx,Sy,n]];
    const B = [-Sx3, -Sy3, -Sx2y2];

    const sol = solve3(M,B);
    if(!sol) return null;
    const [A,Bb,C] = sol;
    const cx = -A/2, cy = -Bb/2;
    const r2 = cx*cx + cy*cy - C;
    if(r2 <= 1e-6) return null;
    const r = Math.sqrt(r2);
    return {cx,cy,r};
  }

  // small 3x3 solver (gauss)
  function solve3(A,b){
    const m = A.map(r=>r.slice());
    const bb = b.slice();
    for(let i=0;i<3;i++){
      let piv = i;
      for(let j=i;j<3;j++) if(Math.abs(m[j][i]) > Math.abs(m[piv][i])) piv = j;
      if(Math.abs(m[piv][i]) < 1e-12) return null;
      [m[i], m[piv]] = [m[piv], m[i]];
      [bb[i], bb[piv]] = [bb[piv], bb[i]];
      const div = m[i][i];
      for(let k=i;k<3;k++) m[i][k] /= div;
      bb[i] /= div;
      for(let r=0;r<3;r++){
        if(r===i) continue;
        const f = m[r][i];
        for(let c=i;c<3;c++) m[r][c] -= f * m[i][c];
        bb[r] -= f * bb[i];
      }
    }
    return bb;
  }

  // coverage estimation
  function estimateCoverage(pts, cx, cy){
    const ang = pts.map(p => Math.atan2(p.y - cy, p.x - cx)).sort((a,b)=>a-b);
    if(ang.length === 0) return 0;
    let maxgap = 0;
    for(let i=1;i<ang.length;i++) maxgap = Math.max(maxgap, ang[i]-ang[i-1]);
    const wrap = (ang[0] + 2*Math.PI) - ang[ang.length-1];
    maxgap = Math.max(maxgap, wrap);
    return Math.max(0, 2*Math.PI - maxgap);
  }

  // scoring - more strict
  function scoreForFit(pts, fit){
    if(!fit) return null;
    const {cx,cy,r} = fit;
    let sum2 = 0;
    let minR=Infinity, maxR=0;
    for(const p of pts){
      const d = Math.hypot(p.x - cx, p.y - cy);
      const err = d - r;
      sum2 += err*err;
      minR = Math.min(minR, d);
      maxR = Math.max(maxR, d);
    }
    const rmse = Math.sqrt(sum2 / pts.length);
    const coverage = estimateCoverage(pts, cx, cy); // radians
    // stricter: require small rmse relative to r*0.18 (≈ 5.5% tolerance)
    const precision = Math.max(0, 1 - (rmse / (r * 0.18)));
    const coverageFactor = Math.min(1, coverage / (Math.PI * 1.9)); // require near full circle
    const base = 100 * precision * coverageFactor;
    const final = Math.round(Math.max(0, Math.min(100, base)));
    return {final, rmse, r, coverage};
  }

  // draw correction circle visual
  let showCorrectionFlag = false;
  function drawCorrectionVisual(fit){
    if(!fit) return;
    ctx.lineWidth = 2.2;
    ctx.strokeStyle = '#ff4d4f';
    ctx.beginPath();
    ctx.arc(fit.cx, fit.cy, fit.r, 0, Math.PI*2);
    ctx.stroke();
    // center mark
    ctx.fillStyle = '#ff4d4f';
    ctx.beginPath();
    ctx.arc(fit.cx, fit.cy, 4, 0, Math.PI*2);
    ctx.fill();
  }

  // UI handlers
  btnStart.addEventListener('click', () => {
    points = []; lastFit = null; lastScore = null; updateScoreDisplay();
    clearCanvas();
  });

  btnEvaluate.addEventListener('click', () => {
    if(points.length < 6){
      alert('Dessinez un cercle plus complet avant d\'évaluer (au moins quelques traits).');
      return;
    }
    const fit = fitCircle(points);
    if(!fit){
      alert('Impossible d\'ajuster un cercle sur ce tracé. Essaie encore.');
      return;
    }
    lastFit = fit;
    const s = scoreForFit(points, fit);
    if(!s){
      alert('Erreur de calcul.');
      return;
    }
    lastScore = s.final;
    updateScoreDisplay();
    // show detailed metrics
    detailBadge.textContent = `RMSE:${s.rmse.toFixed(1)}px · R:${s.r.toFixed(1)}px · C:${Math.round(s.coverage*180/Math.PI)}°`;
    // leave drawing visible, do not auto-draw correction
    showCorrectionFlag = false;
  });

  btnCorrection.addEventListener('click', () => {
    if(!lastFit){
      alert('Évalue d\'abord le tracé pour générer la correction.');
      return;
    }
    // toggle
    showCorrectionFlag = !showCorrectionFlag;
    redrawAll();
  });

  btnSave.addEventListener('click', () => {
    if(lastScore == null){
      alert('Évalue avant de sauvegarder.');
      return;
    }
    saveScore(lastScore);
    refreshScoresTable();
  });

  btnClearScores && btnClearScores.addEventListener('click', () => {
    if(confirm('Supprimer tous les scores sauvegardés ?')){
      localStorage.removeItem('cp_scores');
      refreshScoresTable();
    }
  });

  // theme toggle
  themeToggle.addEventListener('click', ()=>{
    theme = (theme === 'light') ? 'dark' : 'light';
    applyTheme();
  });
  resetAll.addEventListener('click', ()=>{
    if(confirm('Réinitialiser le jeu (scores conservés) ?')){
      points=[]; lastFit=null; lastScore=null; updateScoreDisplay(); clearCanvas();
    }
  });

  // device modal choices
  chooseDesktop.addEventListener('click', ()=>{
    deviceMode = 'desktop';
    document.getElementById('modeLabel').textContent = 'Desktop';
    deviceModal.style.display = 'none';
    setCanvasSizeByMode(deviceMode);
  });
  chooseMobile.addEventListener('click', ()=>{
    deviceMode = 'mobile';
    document.getElementById('modeLabel').textContent = 'Mobile';
    deviceModal.style.display = 'none';
    setCanvasSizeByMode(deviceMode);
  });

  // persist & apply theme
  function applyTheme(){
    app.classList.remove('light','dark');
    app.classList.add(theme === 'light' ? 'light' : 'dark');
    localStorage.setItem('cp_theme', theme);
    // redraw so colors adapt
    redrawAll();
  }
  applyTheme();

  // scores storage
  function loadScores(){
    try{
      const raw = localStorage.getItem('cp_scores');
      return raw ? JSON.parse(raw) : [];
    }catch(e){ return []; }
  }
  function saveScore(score){
    const arr = loadScores();
    arr.unshift({score:score, date:new Date().toISOString()});
    // keep max 20
    if(arr.length>20) arr.length=20;
    localStorage.setItem('cp_scores', JSON.stringify(arr));
  }
  function refreshScoresTable(){
    const arr = loadScores();
    scoresTable.innerHTML = '';
    if(arr.length===0){
      scoresTable.innerHTML = '<div style="color:var(--muted)">Aucun score enregistré</div>';
      return;
    }
    arr.forEach((item, idx) => {
      const row = document.createElement('div');
      row.className = 'scores-row';
      const left = document.createElement('div');
      left.innerHTML = `<strong>#${idx+1}</strong> ${new Date(item.date).toLocaleString()}`;
      const right = document.createElement('div');
      right.innerHTML = `<strong>${item.score}/100</strong>`;
      row.appendChild(left); row.appendChild(right);
      scoresTable.appendChild(row);
    });
  }
  refreshScoresTable();

  // score display
  function updateScoreDisplay(){
    scoreBadge.textContent = lastScore == null ? 'Score : —' : `Score : ${lastScore}/100`;
    if(lastScore == null) detailBadge.textContent = 'Détails';
  }

  // initial draw
  function initCanvasAppearance(){
    // ensure canvas fills width of parent with margin
    // set CSS width in code so we can compute rect reliably
    canvas.style.width = '100%';
    setCanvasSizeByMode(deviceMode);
  }

  // initial tick: show modal if first visit
  (function init(){
    // theme already applied
    // show device modal on first load or if never chosen
    const chosen = sessionStorage.getItem('cp_device_chosen');
    if(!chosen){
      deviceModal.style.display = 'flex';
      sessionStorage.setItem('cp_device_chosen','1');
    } else {
      // default desktop
      document.getElementById('modeLabel').textContent = deviceMode;
      setCanvasSizeByMode(deviceMode);
    }
    initCanvasAppearance();
    updateScoreDisplay();
  })();

  // window resize handling
  let resizeTimer = null;
  window.addEventListener('resize', ()=>{
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(()=> {
      resizeCanvas();
    }, 120);
  });

  // ensure redraw on visibility changes
  document.addEventListener('visibilitychange', ()=>{
    if(!document.hidden) redrawAll();
  });

  // ensure clear background on high-dpi
  resizeCanvas();

  // fix: if ads load and change layout, ensure canvas resize after a short delay
  setTimeout(resizeCanvas, 800);

})();
