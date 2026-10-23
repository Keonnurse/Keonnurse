"""Line art to outline ASCII by glyph shape matching.
usage: python lineart2ascii.py <lineart.png> <out.txt> [cols] [preview.png]
"""
import sys
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter

src, out = sys.argv[1], sys.argv[2]
COLS = int(sys.argv[3]) if len(sys.argv) > 3 else 90
PREVIEW = sys.argv[4] if len(sys.argv) > 4 else None
ASPECT = 0.525                     # cell width / height, matches build.mjs (ACW/ALH)
GW, GH = 12, 23                    # template size, same aspect
CHARS = r" .,'`-_~:;=|/\()<>^v!"
FONT = ImageFont.truetype(r"C:\Windows\Fonts\consola.ttf", 40)

# glyph templates
asc, desc = FONT.getmetrics()
adv = FONT.getlength("M")
tmpl = {}
for ch in CHARS:
    im = Image.new("L", (int(adv), asc + desc), 0)
    ImageDraw.Draw(im).text((0, 0), ch, font=FONT, fill=255)
    t = np.asarray(im.resize((GW, GH), Image.LANCZOS).filter(ImageFilter.GaussianBlur(0.8)), dtype=np.float32) / 255
    tmpl[ch] = t
names = list(tmpl)
T = np.stack([tmpl[c] for c in names])           # (n, GH, GW)

# ink map, cropped to the drawing
g = Image.open(src).convert("L")
ink = 255 - np.asarray(g)
ys, xs = np.where(ink > 60)
pad = 12
y0, y1 = max(ys.min() - pad, 0), min(ys.max() + pad, ink.shape[0])
x0, x1 = max(xs.min() - pad, 0), min(xs.max() + pad, ink.shape[1])
g = Image.fromarray(ink[y0:y1, x0:x1])
W, H = g.size
cw = W / COLS
ch = cw / ASPECT
ROWS = int(round(H / ch))
# thin every stroke to 1 px (Zhang-Suen), then give it glyph-like weight
big = g.resize((COLS * GW, ROWS * GH), Image.LANCZOS)
B = (np.asarray(big) > 90).astype(np.uint8)

def thin(img):
    img = img.copy()
    while True:
        changed = False
        for step in (0, 1):
            P = np.pad(img, 1)
            p2, p3, p4, p5 = P[:-2, 1:-1], P[:-2, 2:], P[1:-1, 2:], P[2:, 2:]
            p6, p7, p8, p9 = P[2:, 1:-1], P[2:, :-2], P[1:-1, :-2], P[:-2, :-2]
            nb = [p2, p3, p4, p5, p6, p7, p8, p9]
            Bn = sum(x.astype(int) for x in nb)
            seq = nb + [p2]
            An = sum(((seq[i] == 0) & (seq[i + 1] == 1)).astype(int) for i in range(8))
            if step == 0:
                c = (p2 * p4 * p6 == 0) & (p4 * p6 * p8 == 0)
            else:
                c = (p2 * p4 * p8 == 0) & (p2 * p6 * p8 == 0)
            m = (img == 1) & (Bn >= 2) & (Bn <= 6) & (An == 1) & c
            if m.any():
                img[m] = 0
                changed = True
        if not changed:
            return img

S = thin(B)
big = Image.fromarray(S * 255).filter(ImageFilter.MaxFilter(3)).filter(ImageFilter.GaussianBlur(0.8))
A = np.asarray(big, dtype=np.float32) / 255

lines = []
for r in range(ROWS):
    row = []
    for c in range(COLS):
        p = A[r * GH:(r + 1) * GH, c * GW:(c + 1) * GW]
        if p.mean() < 0.03:
            row.append(" ")
            continue
        err = ((T - p) ** 2).sum(axis=(1, 2))
        row.append(names[int(err.argmin())])
    lines.append("".join(row).rstrip())
while lines and not lines[0].strip():
    lines.pop(0)
while lines and not lines[-1].strip():
    lines.pop()
open(out, "w", encoding="utf-8", newline="\n").write("\n".join(lines) + "\n")
print(f"{COLS} cols x {len(lines)} rows -> {out}")

if PREVIEW:
    S = 2
    fw, fh = 3.6 * S * 2, 6.86 * S * 2
    f = ImageFont.truetype(r"C:\Windows\Fonts\consola.ttf", int(6 * S * 2))
    im = Image.new("RGB", (int(COLS * fw) + 40, int(len(lines) * fh) + 40), (13, 17, 23))
    d = ImageDraw.Draw(im)
    for i, ln in enumerate(lines):
        for j, chh in enumerate(ln):
            if chh != " ":
                d.text((20 + j * fw, 20 + i * fh), chh, font=f, fill=(230, 237, 243))
    im.save(PREVIEW)
