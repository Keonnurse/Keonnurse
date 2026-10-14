// Animated ASCII avatar: assets/portrait.txt -> preview/avatar.gif (500x500, <1 MB for GitHub).
// Frame 0 is the complete portrait, so it still looks right if GitHub only shows the first frame.
// Needs Chrome (renders frames) and ffmpeg (builds the GIF). Run: node tools/avatar.mjs
import { readFileSync, writeFileSync, mkdirSync, rmSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "preview", "avatar");
const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const FFMPEG = "ffmpeg";

const SIZE = 500, FPS = 12, HOLD = 8, SWEEP = 30, TAIL = 6;
const BG = "#0d1117", GREEN = "#3fb950", BAND = "#7ee787", SCAN = "#d2ffd8";
const GLYPHS = "|/-\\=+*#:.";

const rows = readFileSync(join(ROOT, "assets", "portrait.txt"), "utf8").replace(/\r/g, "").split("\n");
while (rows.length && !rows.at(-1).trim()) rows.pop();
const cols = Math.max(...rows.map((r) => r.length));

// fit the portrait inside the circular crop GitHub applies
const CW = (SIZE * 0.78) / cols, LH = CW / 0.525, FS = CW / 0.6;
const X0 = (SIZE - cols * CW) / 2, Y0 = (SIZE - rows.length * LH) / 2 + LH * 0.8;

let seed = 7;
const rand = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const scramble = (r) => [...r].map((c) => (c === " " ? " " : GLYPHS[Math.floor(rand() * GLYPHS.length)])).join("");

function frame(scanRow) {
  let body = "";
  rows.forEach((r, i) => {
    if (!r.trim()) return;
    const d = scanRow === null ? 99 : scanRow - i;           // rows the scanline just passed
    const glitch = d >= 0 && d < 3;
    const fill = d === 0 ? SCAN : glitch ? BAND : GREEN;
    const txt = glitch ? scramble(r) : r;
    body += `<text x="${X0.toFixed(1)}" y="${(Y0 + i * LH).toFixed(1)}" font-size="${FS.toFixed(2)}" fill="${fill}" textLength="${(r.length * CW).toFixed(1)}" lengthAdjust="spacingAndGlyphs" xml:space="preserve">${esc(txt)}</text>\n`;
  });
  if (scanRow !== null) {
    const y = Y0 + scanRow * LH - LH * 0.3;
    body += `<rect x="0" y="${(y - LH * 2).toFixed(1)}" width="${SIZE}" height="${(LH * 2).toFixed(1)}" fill="url(#glow)"/>\n`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" font-family="Consolas, 'Courier New', monospace">
<defs><linearGradient id="glow" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${SCAN}" stop-opacity="0"/><stop offset="1" stop-color="${SCAN}" stop-opacity="0.18"/></linearGradient></defs>
<rect width="${SIZE}" height="${SIZE}" fill="${BG}"/>
${body}</svg>`;
}

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
const frames = [];
for (let i = 0; i < HOLD; i++) frames.push(null);                                   // full portrait first
for (let i = 0; i < SWEEP; i++) frames.push(Math.round((i / (SWEEP - 1)) * (rows.length + 2)));
for (let i = 0; i < TAIL; i++) frames.push(null);

frames.forEach((scan, i) => {
  const n = String(i).padStart(3, "0");
  const svg = join(OUT, `f${n}.svg`);
  writeFileSync(svg, frame(scan));
  execFileSync(CHROME, ["--headless=new", "--disable-gpu", "--hide-scrollbars", `--window-size=${SIZE},${SIZE}`,
    `--screenshot=${join(OUT, `f${n}.png`)}`, "file:///" + svg.replace(/\\/g, "/")], { stdio: "ignore" });
});

const gif = join(ROOT, "preview", "avatar.gif");
execFileSync(FFMPEG, ["-y", "-loglevel", "error", "-framerate", String(FPS), "-i", join(OUT, "f%03d.png"),
  "-vf", "split[a][b];[a]palettegen=max_colors=32:stats_mode=full[p];[b][p]paletteuse=dither=none",
  "-loop", "0", gif]);
console.log(`${frames.length} frames -> ${gif} (${(statSync(gif).size / 1024).toFixed(0)} KB)`);
