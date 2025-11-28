const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

let drawing = false;
let path = [];
let showGuide = false;

// Correctif du décalage
function getPos(e) {
    const rect = canvas.getBoundingClientRect();
    return {
        x: (e.clientX || e.touches?.[0].clientX) - rect.left,
        y: (e.clientY || e.touches?.[0].clientY) - rect.top
    };
}

canvas.addEventListener("mousedown", e => { drawing = true; path = []; addPoint(e); });
canvas.addEventListener("mousemove", e => { if (drawing) addPoint(e); });
canvas.addEventListener("mouseup", () => drawing = false);

canvas.addEventListener("touchstart", e => { drawing = true; path = []; addPoint(e); });
canvas.addEventListener("touchmove", e => { if (drawing) addPoint(e); });
canvas.addEventListener("touchend", () => drawing = false);

function addPoint(e) {
    const pos = getPos(e);
    path.push(pos);
    draw();
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (showGuide) {
        ctx.strokeStyle = "red";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(200, 200, 150, 0, Math.PI * 2);
        ctx.stroke();
    }

    ctx.strokeStyle = "blue";
    ctx.lineWidth = 3;
    ctx.beginPath();

    path.forEach((p, i) => {
        if (i === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
    });

    ctx.stroke();
}

document.getElementById("reset").onclick = () => {
    path = [];
    draw();
};

document.getElementById("toggle-guide").onclick = () => {
    showGuide = !showGuide;
    draw();
};

// Évaluation améliorée
document.getElementById("evaluate").onclick = () => {
    if (path.length < 20) {
        alert("Dessine un cercle plus complet !");
        return;
    }

    const cx = canvas.width / 2;
    const cy = canvas.height / 2;

    let radii = path.map(p => Math.hypot(p.x - cx, p.y - cy));
    const avg = radii.reduce((a, b) => a + b) / radii.length;

    let deviation = radii.map(r => Math.abs(r - avg));
    let meanDeviation = deviation.reduce((a, b) => a + b) / deviation.length;

    // score ajusté (plus réaliste)
    let score = Math.max(0, 100 - meanDeviation * 1.4);
    score = Math.round(score);

    document.getElementById("score").textContent = score;

    saveScore(score);
};

function saveScore(score) {
    let scores = JSON.parse(localStorage.getItem("scores") || "[]");
    scores.push(score);
    scores.sort((a,b)=>b-a);
    scores = scores.slice(0,5);
    localStorage.setItem("scores", JSON.stringify(scores));
    showScores();
}

function showScores() {
    let scores = JSON.parse(localStorage.getItem("scores") || "[]");
    const list = document.getElementById("score-list");
    list.innerHTML = "";
    scores.forEach(s => {
        const li = document.createElement("li");
        li.textContent = s + "%";
        list.appendChild(li);
    });
}

showScores();

// MODE SOMBRE
const btn = document.getElementById("toggle-btn");
btn.onclick = () => {
    document.body.classList.toggle("dark");
    document.body.classList.toggle("light");

    btn.textContent = document.body.classList.contains("dark")
        ? "☀ Mode clair"
        : "🌙 Mode sombre";
};
