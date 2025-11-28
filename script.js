const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

let drawing = false;
let points = [];
let device = "pc";

// Resize canvas correctly
function resizeCanvas() {
    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;
}
resizeCanvas();
window.onresize = resizeCanvas;

// Device choice
document.querySelectorAll(".device-btn").forEach(btn => {
    btn.onclick = () => {
        device = btn.dataset.device;
        document.getElementById("device-selector").style.display = "none";
    };
});

// Fix pointer offset
function getPos(e) {
    let rect = canvas.getBoundingClientRect();
    let x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
    let y = (e.touches ? e.touches[0].clientY : e.clientY) - rect.top;
    return { x, y };
}

function start(e) {
    drawing = true;
    points = [];
    let pos = getPos(e);
    points.push(pos);
}

function move(e) {
    if (!drawing) return;
    let pos = getPos(e);
    points.push(pos);

    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#0077ff";

    ctx.beginPath();
    let p1 = points[points.length - 2];
    let p2 = points[points.length - 1];
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();
}

function end() {
    drawing = false;
}

canvas.addEventListener("mousedown", start);
canvas.addEventListener("mousemove", move);
canvas.addEventListener("mouseup", end);

canvas.addEventListener("touchstart", start);
canvas.addEventListener("touchmove", move);
canvas.addEventListener("touchend", end);

// Show perfect circle
document.getElementById("show-perfect").onclick = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "red";
    ctx.lineWidth = 3;

    let r = canvas.height * 0.35;
    ctx.beginPath();
    ctx.arc(canvas.width / 2, canvas.height / 2, r, 0, Math.PI * 2);
    ctx.stroke();
};

// Evaluation improved
document.getElementById("evaluate").onclick = () => {
    if (points.length < 20) return;

    let cx = canvas.width / 2;
    let cy = canvas.height / 2;

    // Distances au centre
    let distances = points.map(p => Math.hypot(p.x - cx, p.y - cy));
    let avg = distances.reduce((a, b) => a + b, 0) / distances.length;

    // Écart-type
    let variance = distances.reduce((s, d) => s + Math.pow(d - avg, 2), 0) / distances.length;
    let deviation = Math.sqrt(variance);

    let score = Math.max(0, 100 - deviation * 2.4); // plus dur mais pas impossible
    score = score.toFixed(1);

    document.getElementById("score-display").textContent = `Score : ${score}%`;
    saveScore(score);
};

// Effacer
document.getElementById("clear").onclick = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
};

// Score table
function saveScore(score) {
    let list = document.getElementById("score-table");

    let item = document.createElement("li");
    item.textContent = score + "%";

    list.prepend(item);
}

// Theme toggle
document.getElementById("toggle-theme").onclick = () => {
    document.body.classList.toggle("dark");
};
