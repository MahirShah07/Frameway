// Built-in "studio": draws minimalist low-poly animated scenes on a canvas. No install, no network, no model.
export const THEMES = ["sky", "sea", "city", "land", "space"], SUBJECTS = ["plane", "ship", "car", "train", "rocket", "building", "person"];
export const ACTIONS = ["cross", "approach", "rise", "fall", "still"], MOODS = ["day", "dusk", "night", "storm"];
const KW = {
  subject: { plane: /plane|aircraft|jet|airliner|flight/, ship: /ship|boat|vessel|ferry|liner/, rocket: /rocket|shuttle|launch|missile/, train: /train|rail|locomotive/, car: /\bcar\b|vehicle|truck|taxi|road|driv/, person: /person|man\b|woman|worker|figure|people|crowd|pilot|engineer|walk/, building: /building|tower|office|factory|hall|house|bank/ },
  action: { approach: /approach|toward|closer|arriv|looms?/, rise: /climb|rise|ascend|launch|lift|take.?off/, fall: /fall|descend|crash|sink|drop|collapse/, cross: /cross|pass|travel|move|sail|driv|fly|flies|speed/ },
  mood: { night: /night|dark|midnight/, dusk: /dusk|sunset|evening|dawn|sunrise/, storm: /storm|rain|fog|snow|turbulen|wind/ },
};
const pick = (v, list, map, text, def) => (list.includes(v) ? v : Object.keys(map).find((k) => map[k].test(text)) || def);
export function normalizeScene(raw = {}, text = "") {
  const t = (text || "").toLowerCase();
  const subject = pick(raw.subject, SUBJECTS, KW.subject, t, "building");
  const dflt = { plane: "sky", ship: "sea", rocket: "space", car: "land", train: "land", building: "city", person: "city" }[subject];
  let action = pick(raw.action, ACTIONS, KW.action, t, "still");
  if (subject === "building" && action === "cross") action = "approach";
  return { subject, action, theme: THEMES.includes(raw.theme) ? raw.theme : dflt, mood: pick(raw.mood, MOODS, KW.mood, t, "day") };
}

const PAL = { // desaturated, matte: [skyTop, skyBottom, ground, accent, ink]
  day: ["#9db8c4", "#dfe6e3", "#8ea08a", "#e2d3b0", "#3d4a52"], dusk: ["#6d6a85", "#e0b69a", "#4f5668", "#ecd0a8", "#2c2f3d"],
  night: ["#1b2233", "#3a4660", "#222a38", "#c3cde0", "#0e121b"], storm: ["#59636b", "#8c969b", "#434d52", "#c9d0d3", "#1f272b"],
};
const rnd = (i) => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const lerp = (a, b, u) => a + (b - a) * u, ease = (u) => u * u * (3 - 2 * u);
function poly(c, pts, fill, a = 1) { c.globalAlpha = a; c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath(); c.fillStyle = fill; c.fill(); c.globalAlpha = 1; }
const rect = (c, x, y, w, h, fill, a) => poly(c, [[x, y], [x + w, y], [x + w, y + h], [x, y + h]], fill, a);
function disc(c, x, y, r, fill, a = 1) { c.globalAlpha = a; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fillStyle = fill; c.fill(); c.globalAlpha = 1; }

function subject(c, s, t, P) {
  const [, , , acc, ink] = P;
  if (s === "plane") { poly(c, [[10, 6], [-20, 40], [0, 40], [40, 6]], ink, .55); poly(c, [[-90, 0], [-70, -14], [60, -14], [100, -2], [60, 10], [-70, 10]], acc); poly(c, [[-10, -2], [-40, -48], [-18, -48], [30, -2]], ink, .8); poly(c, [[-90, 0], [-100, -34], [-78, -34], [-62, -8]], ink); }
  if (s === "ship") { c.translate(0, Math.sin(t * 2) * 3); poly(c, [[-110, 0], [110, 0], [85, 32], [-90, 32]], ink); rect(c, -40, -30, 70, 30, acc); rect(c, 10, -52, 22, 22, ink); rect(c, -30, -20, 50, 8, ink, .5); }
  if (s === "car") { poly(c, [[-60, 0], [-50, -18], [-20, -28], [25, -28], [50, -12], [65, 0], [65, 14], [-62, 14]], acc); poly(c, [[-18, -24], [22, -24], [40, -10], [-38, -10]], ink, .7); disc(c, -35, 16, 10, ink); disc(c, 38, 16, 10, ink); }
  if (s === "train") { for (let i = 0; i < 3; i++) { rect(c, -150 + i * 100, -24, 92, 40, i ? acc : ink); for (let k = 0; k < 4; k++) rect(c, -140 + i * 100 + k * 21, -14, 14, 10, ink, .6); } rect(c, 118, -40, 12, 16, ink); disc(c, -100, 18, 7, ink); disc(c, 0, 18, 7, ink); disc(c, 100, 18, 7, ink); }
  if (s === "rocket") { rect(c, -14, -90, 28, 120, acc); poly(c, [[-14, -90], [0, -130], [14, -90]], ink); poly(c, [[-14, 10], [-36, 44], [-14, 30]], ink); poly(c, [[14, 10], [36, 44], [14, 30]], ink); poly(c, [[-10, 30], [0, 70 + 12 * Math.sin(t * 30)], [10, 30]], acc, .8); }
  if (s === "building") { rect(c, -40, -150, 80, 170, ink, .92); poly(c, [[40, -150], [70, -165], [70, 5], [40, 20]], ink, .6); for (let r = 0; r < 8; r++) for (let k = 0; k < 4; k++) rect(c, -30 + k * 18, -138 + r * 20, 10, 10, acc, .2 + .5 * rnd(r * 4 + k + Math.floor(t))); }
  if (s === "person") { const sw = Math.sin(t * 6) * 8; disc(c, 0, -60, 9, ink); poly(c, [[-12, -48], [12, -48], [16, -10], [-16, -10]], ink); poly(c, [[-9 + sw, 30], [-4 + sw, 30], [-2, -10], [-12, -10]], ink, .9); poly(c, [[9 - sw, 30], [4 - sw, 30], [2, -10], [12, -10]], ink, .9); }
}

export function drawScene(c, sc, t, w, h) {
  const P = PAL[sc.mood] || PAL.day, [top, bot, ground, acc, ink] = P, hz = h * 0.64, k = Math.min(t / 5, 1), p = ease(k);
  c.save(); const z = 1 + 0.06 * k; c.translate(w / 2, h / 2); c.scale(z, z); c.translate(-w / 2, -h / 2);
  const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, top); g.addColorStop(1, bot); c.fillStyle = g; c.fillRect(-w * .1, -h * .1, w * 1.2, h * 1.2);
  if (sc.mood === "night" || sc.theme === "space") for (let i = 0; i < 70; i++) rect(c, rnd(i) * w, rnd(i + 50) * hz, 2, 2, acc, .3 + .5 * rnd(i + 9));
  if (sc.theme === "sky") for (let i = 0; i < 7; i++) { const cx = ((rnd(i) * w * 1.4 - t * (8 + i * 3)) % (w * 1.4) + w * 1.4) % (w * 1.4) - w * .2, cy = h * (.1 + .6 * rnd(i + 20)), s = .8 + rnd(i + 3); poly(c, [[-60, 0], [-35, -22], [10, -28], [50, -12], [70, 0], [20, 10]].map(([x, y]) => [cx + x * s, cy + y * s]), acc, .35); }
  if (sc.theme === "sea") { rect(c, 0, hz, w, h - hz, ground); for (let i = 0; i < 8; i++) { const y = hz + ((i + 1) * (h - hz)) / 9; c.beginPath(); for (let x = 0; x <= w; x += 20) c.lineTo(x, y + Math.sin(x / 60 + t * 1.5 + i) * 4); c.strokeStyle = acc; c.globalAlpha = .25; c.lineWidth = 2; c.stroke(); c.globalAlpha = 1; } }
  if (sc.theme === "land") { for (const [off, col, a] of [[0, ink, .25], [40, ground, 1]]) { const pts = [[0, h]]; for (let x = 0; x <= 8; x++) pts.push([(x * w) / 8, hz - (30 + 60 * rnd(x + off)) + off * .5]); pts.push([w, h]); poly(c, pts, col, a); } rect(c, 0, hz + 20, w, h, ground); if (sc.subject === "car" || sc.subject === "train") rect(c, 0, hz + (h - hz) * .5 + 16, w, 16, ink, .5); }
  if (sc.theme === "city") { rect(c, 0, hz, w, h - hz, ground); for (const l of [0, 1]) for (let i = 0; i < 14; i++) { const bw = w / 9, x = i * bw * .95 - p * (20 + 20 * l), bh = h * (.1 + .28 * rnd(i + l * 30)) * (l ? 1 : 1.3), y = hz - bh; rect(c, x, y, bw * .8, bh, l ? ground : ink, l ? 1 : .35); poly(c, [[x + bw * .8, y], [x + bw, y - bw * .12], [x + bw, hz - bw * .12], [x + bw * .8, hz]], ink, l ? .35 : .2); if (sc.mood === "night") for (let r = 0; r < 4; r++) rect(c, x + 10, y + 12 + r * 24, 8, 8, acc, .5); } }
  if (sc.theme === "space") { disc(c, w * .7, h * 1.15, h * .55, ground); c.beginPath(); c.arc(w * .7, h * 1.15, h * .56, 0, Math.PI * 2); c.strokeStyle = acc; c.globalAlpha = .4; c.lineWidth = 3; c.stroke(); c.globalAlpha = 1; }
  const base = { sky: h * .38, sea: hz + (h - hz) * .18, land: hz + (h - hz) * .5, city: hz + (h - hz) * .55, space: h * .4 }[sc.theme];
  let x = w * .5, y = base, s = Math.min(w, h) / 420, rot = 0;
  if (sc.action === "cross") x = lerp(-.15 * w, 1.15 * w, p);
  else if (sc.action === "approach") { s *= lerp(.35, 1.3, p); y = lerp(hz * .98, base, p); }
  else if (sc.action === "rise") { y = lerp(hz * 1.02, h * .22, p); rot = -.25 * p; if (sc.subject === "plane") rot = -.3; }
  else if (sc.action === "fall") { y = lerp(h * .2, hz * .98, p); rot = .5 * p; }
  else y += Math.sin(t * 1.5) * 3;
  c.save(); c.translate(x, y); c.rotate(rot); c.scale(s, s); subject(c, sc.subject, t, P); c.restore(); c.restore();
  const v = c.createRadialGradient(w / 2, h / 2, h * .3, w / 2, h / 2, h * .9); v.addColorStop(0, "rgba(0,0,0,0)"); v.addColorStop(1, "rgba(0,0,0,0.45)"); c.fillStyle = v; c.fillRect(0, 0, w, h);
  const f = Math.floor(t * 12); for (let i = 0; i < 120; i++) rect(c, rnd(f * 1000 + i) * w, rnd(f * 1000 + i + 500) * h, 2, 2, "#fff", .05);
}
