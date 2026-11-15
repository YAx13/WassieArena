import os
import glob
from PIL import Image

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CHARS = ["empereur", "frankenstein", "general", "hazmat", "momie", "samourai", "zeus"]
WEAPONS = [
    (0, "epee", 0), (1, "dague", 1), (2, "couteau", 2), (3, "scie", 3),
    (4, "hache", 4), (5, "marteau", 5), (6, "pioche", 6), (7, "os", 7),
    (8, "boomerang", 8), (9, "arc", 9), (10, "trident", 10), (11, "pilier", 11),
    (12, "shuriken", 12), (13, "grenade", 13), (14, "molotov", 14)
]

os.makedirs(os.path.join(BASE_DIR, "assets", "weapons_cut"), exist_ok=True)

def slice_sheet(src_path, out_dir):
    img = Image.open(src_path).convert("RGBA")
    tile_w = img.width // 4
    tile_h = img.height // 4
    os.makedirs(out_dir, exist_ok=True)
    for wid, name, cell in WEAPONS:
        x = (cell % 4) * tile_w
        y = (cell // 4) * tile_h
        h = tile_h * 2 if wid == 11 else tile_h
        crop = img.crop((x, y, x + tile_w, y + h))
        crop.save(os.path.join(out_dir, f"wpn-{wid}-{name}.png"))

for c in CHARS:
    folders = [c, "samouraï"] if c == "samourai" else [c]
    files = []
    for folder in folders:
        files.extend(glob.glob(os.path.join(BASE_DIR, "assets", "characters", folder, "weapons", "*.png")))
    files = sorted(set(files))
    print(f"[{c}] fichiers trouvés : {files}")
    for src in files:
        base = os.path.basename(src)
        digits = "".join(ch for ch in base if ch.isdigit())
        skin_num = digits if digits else "1"
        out_dir = os.path.join(BASE_DIR, "assets", "weapons_cut", c, f"skin-{skin_num}")
        slice_sheet(src, out_dir)

greybox_src = os.path.join(BASE_DIR, "assets", "weapons_cut", "greybox-weapons.png")
if os.path.exists(greybox_src):
    for fb_char in ["human", "inversebrah"]:
        out_dir = os.path.join(BASE_DIR, "assets", "weapons_cut", fb_char, "skin-1")
        slice_sheet(greybox_src, out_dir)
        print(f"[{fb_char}] fallback greybox découpé dans {out_dir}")

print("Découpe terminée dans assets/weapons_cut/<personnage>/skin-X/ !")
