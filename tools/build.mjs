// Builds the animated terminal panels in assets/. Run: node tools/build.mjs
// Edit CONTENT below, rerun, commit. No dependencies.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const ASSETS = join(ROOT, "assets");
const OUT = process.env.STATIC ? join(ROOT, "preview") : ASSETS;
if (!existsSync(OUT)) mkdirSync(OUT);
if (!existsSync(ASSETS)) mkdirSync(ASSETS);

// ---------------------------------------------------------------- content
const USER = "keon";
const HOST = "github";

const BIO = {
  name: "Keon Nurse",
  sub: "Psychology + Computing Science @ UAlberta, class of 2027",
  tagline: ["I build things that light up,", "and the networks that keep them talking."],
  now: [
    "timing, results + LED scoreboards for U of A Track & Field",
    "ESP32 hardware: a wireless ping pong scoreboard",
    "studying for CompTIA Network+",
  ],
};

const PROJECTS = [
  ["esp32-wireless-scoreboard/", "C++", "ESP32 + P10 LED panels, BLE remote, 3D printed case"],
  ["Website/", "HTML", "personal site"],
];

const STACK = [
  ["hardware", "ESP32 · C/C++ · Arduino · ESP-IDF · Fusion 360 · 3D printing"],
  ["network", "managed switches · static addressing · isolation · FinishLynx · NovaStar"],
  ["web", "HTML · CSS · JavaScript"],
];

// ---------------------------------------------------------------- theme
const C = {
  bg: "#0d1117", bar: "#161b22", border: "#30363d",
  text: "#c9d1d9", dim: "#8b949e", bright: "#f0f6fc",
  green: "#3fb950", blue: "#58a6ff", ascii: "#3fb950",
};
const FONT = "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace";
const FS = 13;            // body font size
const CW = FS * 0.6;      // monospace char width
const LH = 21;            // line height
const W = 860;
const TYPE_MS = 45;       // per typed character
const STATIC = !!process.env.STATIC; // preview: final frame, no animation

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const s = (ms) => (ms / 1000).toFixed(2) + "s";

let clipId = 0;

function frame(title, h, body) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${h}" viewBox="0 0 ${W} ${h}" font-family="${FONT}">
<style>
  .f { ${STATIC ? "opacity: 1;" : "opacity: 0; animation: in .25s ease-out forwards;"} }
  @keyframes in { to { opacity: 1; } }
  .cur { animation: blink 1s steps(1) infinite; }
  @keyframes blink { 50% { opacity: 0; } }
  @media (prefers-reduced-motion: reduce) { .f { animation: none; opacity: 1; } }
</style>
<rect x="0.5" y="0.5" width="${W - 1}" height="${h - 1}" rx="10" fill="${C.bg}" stroke="${C.border}"/>
<path d="M0.5 32 V10.5 a10 10 0 0 1 10 -10 H${W - 10.5} a10 10 0 0 1 10 10 V32 Z" fill="${C.bar}"/>
<line x1="0.5" y1="32" x2="${W - 0.5}" y2="32" stroke="${C.border}"/>
<circle cx="20" cy="16" r="6" fill="#ff5f57"/><circle cx="40" cy="16" r="6" fill="#febc2e"/><circle cx="60" cy="16" r="6" fill="#28c840"/>
<text x="${W / 2}" y="20.5" text-anchor="middle" font-size="12" fill="${C.dim}">${esc(title)}</text>
${body}
</svg>
`;
}

// one shell prompt with a typed command; returns [svg, endTime]
function prompt(x, y, cmd, t) {
  const pre = `${USER}@${HOST} ~ $ `;
  const cx = x + pre.length * CW;
  const id = `c${clipId++}`;
  const steps = [...cmd].map((_, i) => ((i + 1) * CW).toFixed(1));
  const dur = cmd.length * TYPE_MS;
  const svg = `<g class="f" style="animation-delay:${s(t)}">
  <text x="${x}" y="${y}" font-size="${FS}" textLength="${(pre.length * CW).toFixed(1)}" lengthAdjust="spacingAndGlyphs" xml:space="preserve"><tspan fill="${C.green}">${USER}@${HOST}</tspan><tspan fill="${C.blue}"> ~</tspan><tspan fill="${C.dim}"> $ </tspan></text>
</g>
<clipPath id="${id}"><rect x="${cx}" y="${y - FS}" height="${FS + 6}" width="${STATIC ? steps.at(-1) : 0}">
  <animate attributeName="width" begin="${s(t + 150)}" dur="${s(dur)}" values="0;${steps.join(";")}" calcMode="discrete" fill="freeze"/>
</rect></clipPath>
<text x="${cx}" y="${y}" font-size="${FS}" fill="${C.bright}" clip-path="url(#${id})" textLength="${(cmd.length * CW).toFixed(1)}" lengthAdjust="spacingAndGlyphs" xml:space="preserve">${esc(cmd)}</text>`;
  return [svg, t + 150 + dur + 200];
}

const line = (x, y, txt, t, fill = C.text, extra = "") =>
  `<text class="f" style="animation-delay:${s(t)}" x="${x}" y="${y}" font-size="${FS}" fill="${fill}" xml:space="preserve" ${extra}>${esc(txt)}</text>`;

const cursor = (x, y, t) =>
  `<g class="f" style="animation-delay:${s(t)}"><rect class="cur" x="${x}" y="${y - FS + 2}" width="${CW}" height="${FS + 1}" fill="${C.text}"/></g>`;

// ---------------------------------------------------------------- whoami.svg
function buildWhoami() {
  const portraitPath = join(ASSETS, "portrait.txt");
  const rows = existsSync(portraitPath)
    ? readFileSync(portraitPath, "utf8").replace(/\r/g, "").split("\n").filter((r, i, a) => i < a.length - 1 || r)
    : null;

  const PX = 24, PY = 84, AFS = 6, ACW = 3.6, ALH = 6.86; // portrait geometry (ACW/ALH = 0.525, matches ascii.ps1)
  let body = "";
  let [p, t] = prompt(PX, 62, "whoami", 300);
  body += p;

  let portraitH = 34 * ALH;
  if (rows) {
    portraitH = rows.length * ALH;
    const cols = Math.max(...rows.map((r) => r.length));
    rows.forEach((r, i) => {
      if (!r.trim()) return;
      body += `\n<text class="f" style="animation-delay:${s(t + i * 35)}" x="${PX}" y="${PY + i * ALH}" font-size="${AFS}" fill="${C.ascii}" xml:space="preserve" textLength="${(r.length * ACW).toFixed(1)}" lengthAdjust="spacingAndGlyphs">${esc(r)}</text>`;
    });
    var portraitW = cols * ACW;
  } else {
    var portraitW = 64 * ACW;
    body += `\n<rect class="f" style="animation-delay:${s(t)}" x="${PX}" y="${PY - 8}" width="${portraitW}" height="${portraitH}" fill="none" stroke="${C.border}" stroke-dasharray="4 4"/>`;
    body += "\n" + line(PX + portraitW / 2, PY + portraitH / 2, "portrait.txt missing", t, C.dim, `text-anchor="middle"`);
  }

  // right column
  const RX = PX + portraitW + 36;
  let y = PY + 8, rt = t + 200;
  body += `\n<text class="f" style="animation-delay:${s(rt)}" x="${RX}" y="${y}" font-size="20" font-weight="700" fill="${C.bright}">${esc(BIO.name)}</text>`;
  y += 26; rt += 120;
  body += "\n" + line(RX, y, BIO.sub, rt, C.dim);
  y += LH * 1.6;
  for (const l of BIO.tagline) { rt += 120; body += "\n" + line(RX, y, l, rt, C.text); y += LH; }
  y += LH * 0.8; rt += 200;
  body += "\n" + line(RX, y, "now/", rt, C.blue);
  y += LH;
  for (const n of BIO.now) {
    rt += 140;
    body += `\n<text class="f" style="animation-delay:${s(rt)}" x="${RX}" y="${y}" font-size="${FS}" xml:space="preserve"><tspan fill="${C.green}">▸ </tspan><tspan fill="${C.text}">${esc(n)}</tspan></text>`;
    y += LH;
  }

  const h = Math.max(PY + portraitH, y) + 18;
  return frame(`${USER}@${HOST}: ~`, h, body);
}

// ---------------------------------------------------------------- projects.svg
function buildProjects() {
  const X = 24, START = 1800; // start after the whoami panel has mostly drawn
  let body = "", y = 62;
  let [p, t] = prompt(X, y, "ls projects/", START);
  body += p; y += LH + 4;

  const nameW = Math.max(...PROJECTS.map((r) => r[0].length)) + 3;
  for (const [name, lang, desc] of PROJECTS) {
    body += "\n" + line(X, y, name, t, C.blue, `font-weight="700"`);
    body += "\n" + line(X + nameW * CW, y, lang, t, C.green);
    body += "\n" + line(X + (nameW + 7) * CW, y, desc, t, C.text);
    y += LH; t += 150;
  }
  y += 10;
  [p, t] = prompt(X, y, "cat stack.txt", t + 200);
  body += "\n" + p; y += LH + 4;
  const keyW = Math.max(...STACK.map((r) => r[0].length)) + 3;
  for (const [k, v] of STACK) {
    body += "\n" + line(X, y, k, t, C.dim);
    body += "\n" + line(X + keyW * CW, y, v, t, C.text);
    y += LH; t += 150;
  }
  y += 10;
  const pre = `${USER}@${HOST} ~ $ `;
  body += `\n<text class="f" style="animation-delay:${s(t)}" x="${X}" y="${y}" font-size="${FS}" textLength="${(pre.length * CW).toFixed(1)}" lengthAdjust="spacingAndGlyphs" xml:space="preserve"><tspan fill="${C.green}">${USER}@${HOST}</tspan><tspan fill="${C.blue}"> ~</tspan><tspan fill="${C.dim}"> $ </tspan></text>`;
  body += "\n" + cursor(X + pre.length * CW, y, t);
  return frame(`${USER}@${HOST}: ~/projects`, y + 22, body);
}

writeFileSync(join(OUT, "whoami.svg"), buildWhoami());
writeFileSync(join(OUT, "projects.svg"), buildProjects());
console.log(`built ${OUT}`);
