import os
from PIL import Image, ImageDraw

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BG_ROOT = os.path.join(BASE_DIR, "assets", "backgrounds", "companion")

PODS = [
    {"key": "chien", "x": 16.38, "y": 16.33, "size": 27.5},
    {"key": "loup", "x": 72.11, "y": 53.13, "size": 20.0},
    {"key": "ours", "x": 27.70, "y": 52.52, "size": 22.5},
    {"key": "serpent", "x": 38.96, "y": 15.35, "size": 22.5},
    {"key": "oiseau", "x": 61.10, "y": 16.21, "size": 22.5},
    {"key": "arthropode", "x": 83.36, "y": 15.72, "size": 27.5},
    {"key": "felin", "x": 71.95, "y": 20.30, "size": 10.0},
    {"key": "taureau", "x": 16.76, "y": 56.67, "size": 27.5},
    {"key": "aquatique", "x": 27.96, "y": 15.72, "size": 23.5},
    {"key": "chimere", "x": 38.90, "y": 51.29, "size": 20.0},
    {"key": "lezard", "x": 49.78, "y": 16.94, "size": 20.0},
    {"key": "spectre", "x": 50.00, "y": 51.17, "size": 26.0},
    {"key": "tempete", "x": 83.36, "y": 57.16, "size": 23.5},
]

count = 0
for char in sorted(os.listdir(BG_ROOT)):
    char_dir = os.path.join(BG_ROOT, char)
    if not os.path.isdir(char_dir):
        continue
    bg_path = None
    for ext in ("background.jpeg", "background.jpg", "background.png"):
        p = os.path.join(char_dir, ext)
        if os.path.exists(p):
            bg_path = p
            break
    if not bg_path:
        continue

    with Image.open(bg_path).convert("RGBA") as bg:
        w, h = bg.size
        fg = bg.copy()
        mask = Image.new("L", (w, h), 255)
        draw = ImageDraw.Draw(mask)
        glass = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        gdraw = ImageDraw.Draw(glass)

        for pod in PODS:
            ph = h * (pod["size"] / 100.0) * 0.90
            pw = ph * 0.48
            cx = w * (pod["x"] / 100.0)
            cy = h * (pod["y"] / 100.0)
            x0, y0 = int(cx - pw / 2), int(cy - ph / 2)
            x1, y1 = int(cx + pw / 2), int(cy + ph / 2)
            r = max(4, int(pw * 0.16))
            draw.rounded_rectangle([x0, y0, x1, y1], radius=r, fill=0)
            sx0 = x0 + max(2, int(pw * 0.16))
            sx1 = sx0 + max(1, int(pw * 0.08))
            gdraw.rectangle([sx0, y0 + r, sx1, y1 - r], fill=(200, 245, 255, 42))

        fg.putalpha(mask)
        fg = Image.alpha_composite(fg, glass)
        out_path = os.path.join(char_dir, "foreground.png")
        fg.save(out_path)
        count += 1
        print(f"[OK] Generated depth foreground.png for {char}")

print(f"Done! Created {count} depth foreground layers.")
