const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

let drawing = false;
let points = [];
let showCorrection = false;

document.getElementById("start").onclick = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    points = [];
};

document.getElementById("reset").onclick = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    points = [];
};

document.getElementById("toggleCorrection").onclick = () => {
    showCorrection = !showCorrection;
    if (showCorrection) drawCorrection();
    else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        redrawStroke();
    }
};

canvas.onmousedown = (e) => {
    drawing = true;
    points = [];
};

canvas.onmouseup = () => {
    drawing = false;
};

canvas.onmousemove = (e) => {
    if (!drawing) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    points.push({ x, y });

    if (points.length > 1) {
        const p1 = points[points.length - 2];
        const p2 = points[points.length - 1];

        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
    }
};

function drawCorrection() {
    if (points.length < 3) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    redrawStroke();

    let xs = points.map(p => p.x);
    let ys = points.map(p => p.y);
    let cx = xs.reduce((a,b)=>a+b)/xs.length;
    let cy = ys.reduce((a,b)=>a+b)/ys.length;

    let rs = points.map(p => Math.hypot(p.x - cx, p.y - cy));
    let r = rs.reduce((a,b)=>a+b)/rs.length;

    ctx.strokeStyle = "red";
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI*2);
    ctx.stroke();
    ctx.strokeStyle = "black";
}

function redrawStroke() {
    for (let i = 1; i < points.length; i++) {
        ctx.beginPath();
        ctx.moveTo(points[i-1].x, points[i-1].y);
        ctx.lineTo(points[i].x, points[i].y);
        ctx.stroke();
    }
}

document.getElementById("evaluate").onclick = () => {
    if (points.length < 10) {
        alert("Trace un cercle plus complet.");
        return;
    }

    let xs = points.map(p => p.x);
    let ys = points.map(p => p.y);
    let cx = xs.reduce((a,b)=>a+b)/xs.length;
    let cy = ys.reduce((a,b)=>a+b)/ys.length;

    let rs = points.map(p => Math.hypot(p.x - cx, p.y - cy));
    let r = rs.reduce((a,b)=>a+b)/rs.length;

    let variance = rs.reduce((a,b)=>a + Math.abs(b - r), 0) / rs.length;

    let score = Math.max(0, 100 - variance * 3); // critères plus sévères
    score = Math.round(score);

    alert("Ton score : " + score + "/100");

    updateBestScore(score);
};

function updateBestScore(score) {
    let best = localStorage.getItem("bestCircleScore");
    if (!best || score > best) {
        localStorage.setItem("bestCircleScore", score);
        best = score;
    }
    document.getElementById("bestScore").innerText = best + "/100";
}

(function init() {
    let best = localStorage.getItem("bestCircleScore");
    if (best) document.getElementById("bestScore").innerText = best + "/100";
})();
