const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

let drawing = false;
let points = [];
let showCorrection = false;
let theme = 'light';
let scores = JSON.parse(localStorage.getItem("circleScores") || "[]");

// Fix : bon scale + bon offset
function resizeCanvas() {
  canvas.width = canvas.clientWidth;
  canvas.height = canvas.clientHeight;
}
resizeCanvas();
window.addEventListener("resize", resizeCanvas);

// Sélection automatique couleur trait
function updateStrokeColor() {
  ctx.strokeStyle = theme === "light" ? "#000000" : "#ffffff";
}
updateStrokeColor();

// Gestion souris/tactile
function getPos(e) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (e.touches ? e.touches[0].clientX : e.clientX) - rect.left,
    y: (e.touches ? e.touches[0].clientY : e.clientY) - rect.top
  };
}

canvas.addEventListener('mousedown', () => { drawing = true; points = []; });
canvas.addEventListener('mouseup', () => drawing = false);
canvas.addEventListener('mousemove', drawStroke);
canvas.addEventListener('touchstart', () => { drawing = true; points = []; });
canvas.addEventListener('touchend', () => drawing = false);
canvas.addEventListener('touchmove', drawStroke);

function drawStroke(e) {
  if (!drawing) return;
  e.preventDefault();
  const {x, y} = getPos(e);
  points.push({x, y});
  if (points.length > 1) {
    const p1 = points[points.length-2];
    const p2 = points[points.length-1];
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();
  }
}

document.getElementById("start").onclick = () => { ctx.clearRect(0,0,canvas.width,canvas.height); points=[]; }
document.getElementById("reset").onclick = () => { ctx.clearRect(0,0,canvas.width,canvas.height); points=[]; }
document.getElementById("toggleCorrection").onclick = () => {
  showCorrection = !showCorrection;
  showCorrection ? drawCorrection() : redrawStroke();
};
document.getElementById("toggleTheme").onclick = () => {
  theme = theme === "light" ? "dark" : "light";
  document.body.className = theme;
  updateStrokeColor();
};

// Évaluation similaire (juste les valeurs)
document.getElementById("evaluate").onclick = () => {
  if (points.length < 10) { alert("Trace un cercle plus complet."); return; }

  let xs = points.map(p=>p.x);
  let ys = points.map(p=>p.y);
  let cx = xs.reduce((a,b)=>a+b)/xs.length;
  let cy = ys.reduce((a,b)=>a+b)/ys.length;
  let rs = points.map(p=>Math.hypot(p.x-cx, p.y-cy));
  let r = rs.reduce((a,b)=>a+b)/rs.length;
  let variance = rs.reduce((a,b)=>a+Math.abs(b-r),0)/rs.length;

  let score = Math.max(0, 100 - variance * 5);
  score = Math.round(score);

  alert("Ton score : "+score+"/100");

  scores.push(score);
  scores.sort((a,b)=>b-a);
  if (scores.length>5) scores.length = 5;
  localStorage.setItem("circleScores", JSON.stringify(scores));
  updateScoreTable();
};

function drawCorrection() {
  if (points.length < 3) return;
  ctx.clearRect(0,0,canvas.width,canvas.height);
  redrawStroke();

  let xs = points.map(p=>p.x);
  let ys = points.map(p=>p.y);
  let cx = xs.reduce((a,b)=>a+b)/xs.length;
  let cy = ys.reduce((a,b)=>a+b)/ys.length;
  let rs = points.map(p=>Math.hypot(p.x-cx, p.y-cy));
  let r = rs.reduce((a,b)=>a+b)/rs.length;

  ctx.strokeStyle="red";
  ctx.beginPath();
  ctx.arc(cx,cy,r,0,Math.PI*2);
  ctx.stroke();

  updateStrokeColor();
}

function redrawStroke() {
  updateStrokeColor();
  ctx.clearRect(0,0,canvas.width,canvas.height);
  for (let i = 1; i < points.length; i++) {
    ctx.beginPath();
    ctx.moveTo(points[i-1].x, points[i-1].y);
    ctx.lineTo(points[i].x, points[i].y);
    ctx.stroke();
  }
}

function updateScoreTable() {
  const tbody = document.querySelector("#scoreTable tbody");
  tbody.innerHTML = "";
  scores.forEach((s,i)=>{
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${i+1}</td><td>${s}</td>`;
    tbody.appendChild(tr);
  });
}

updateScoreTable();
