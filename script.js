const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
canvas.width = canvas.offsetWidth;
canvas.height = canvas.offsetHeight;

let drawing = false;
let points = [];
let showCorrection = false;
let theme = 'light';
let scores = JSON.parse(localStorage.getItem("circleScores") || "[]");

function getPos(e){ const r = canvas.getBoundingClientRect(); return e.touches ? {x:e.touches[0].clientX-r.left,y:e.touches[0].clientY-r.top}:{x:e.clientX-r.left,y:e.clientY-r.top}; }

function startDraw(e){ drawing=true; points=[]; const p=getPos(e); points.push(p); }
function endDraw(){ drawing=false; }

function draw(e){ if(!drawing) return; e.preventDefault(); const p=getPos(e); points.push(p); const a=points[points.length-2], b=p; ctx.lineWidth=3; ctx.strokeStyle = theme==='light'?"black":"white"; ctx.beginPath(); ctx.moveTo(a.x,a.y); ctx.lineTo(b.x,b.y); ctx.stroke(); }

canvas.addEventListener('mousedown', startDraw);
canvas.addEventListener('mouseup', endDraw);
canvas.addEventListener('mousemove', draw);
canvas.addEventListener('touchstart', startDraw);
canvas.addEventListener('touchend', endDraw);
canvas.addEventListener('touchmove', draw);

document.getElementById("start").onclick = ()=>{ ctx.clearRect(0,0,canvas.width,canvas.height); points=[]; };
document.getElementById("reset").onclick = ()=>{ ctx.clearRect(0,0,canvas.width,canvas.height); points=[]; };

document.getElementById("toggleTheme").onclick = ()=>{ theme=theme==='light'?'dark':'light'; document.body.className=theme; };

document.getElementById("toggleCorrection").onclick = ()=>{ showCorrection=!showCorrection; if(showCorrection) drawCorrection(); else redrawStroke(); };

function redrawStroke(){ ctx.clearRect(0,0,canvas.width,canvas.height); for(let i=1;i<points.length;i++){ ctx.beginPath(); ctx.moveTo(points[i-1].x,points[i-1].y); ctx.lineTo(points[i].x,points[i].y); ctx.strokeStyle=theme==='light'?"black":"white"; ctx.lineWidth=3; ctx.stroke(); }}

function drawCorrection(){ if(points.length<5) return; redrawStroke(); const xs=points.map(p=>p.x), ys=points.map(p=>p.y); const cx=xs.reduce((a,b)=>a+b)/xs.length, cy=ys.reduce((a,b)=>a+b)/ys.length; const rs=points.map(p=>Math.hypot(p.x-cx,p.y-cy)); const r=rs.reduce((a,b)=>a+b)/rs.length; ctx.strokeStyle="red"; ctx.lineWidth=2; ctx.beginPath(); ctx.arc(cx,cy,r,0,Math.PI*2); ctx.stroke(); }

// Nouveau calcul PRO précis
function evaluateScore(){ if(points.length<10){ alert("Trace un cercle complet."); return; } const xs=points.map(p=>p.x), ys=points.map(p=>p.y); const cx=xs.reduce((a,b)=>a+b)/xs.length, cy=ys.reduce((a,b)=>a+b)/ys.length; const rs=points.map(p=>Math.hypot(p.x-cx,p.y-cy)); const r=rs.reduce((a,b)=>a+b)/rs.length; const variance = rs.reduce((a,b)=>a+Math.abs(b-r),0)/rs.length; let score = Math.max(0,100 - variance*4.2); score=Math.round(score); alert("Score : "+score+"/100"); scores.push(score); scores.sort((a,b)=>b-a); if(scores.length>5) scores=scores.slice(0,5); localStorage.setItem("circleScores",JSON.stringify(scores)); updateScoreTable(); }

document.getElementById("evaluate").onclick = evaluateScore;

function updateScoreTable(){ const tbody=document.querySelector('#scoreTable tbody'); tbody.innerHTML=""; scores.forEach((s,i)=>{ const tr=document.createElement("tr"); tr.innerHTML=`<td>${i+1}</td><td>${s}</td>`; tbody.appendChild(tr); }); }
updateScoreTable();
