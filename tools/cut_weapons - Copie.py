import os
import shutil
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..")) if os.path.basename(HERE).lower() == "tools" else HERE
GREYBOX_SRC = os.path.join(ROOT, "assets", "weapons_cut", "greybox-weapons.png")
DUMMY_WPN_DIR = os.path.join(ROOT, "assets", "characters", "dummy", "weapons")

if not os.path.isfile(GREYBOX_SRC):
    raise RuntimeError(f"Introuvable : {GREYBOX_SRC}")

os.makedirs(DUMMY_WPN_DIR, exist_ok=True)
dst_sheet = os.path.join(DUMMY_WPN_DIR, "weapon-1-transparent.png")
shutil.copy2(GREYBOX_SRC, dst_sheet)

WEAPON_CELLS = {
    0: 0, 1: 1, 2: 2, 3: 3,
    4: 4, 5: 5, 6: 6, 7: 7,
    8: 8, 9: 10, 10: 11,
    11: 12, 12: 13, 13: 14
}

img = Image.open(dst_sheet).convert("RGBA")
w, h = img.size
cw, ch = w // 4, h // 4

for wid, cell in WEAPON_CELLS.items():
    col, row = cell % 4, cell // 4
    x0, y0 = col * cw, row * ch
    y1 = y0 + (ch * 2 if wid == 10 else ch)
    img.crop((x0, y0, x0 + cw, y1)).save(os.path.join(DUMMY_WPN_DIR, f"wpn-{wid}.png"))

print("[OK] Armes greybox installées et découpées dans assets/characters/dummy/weapons/ !")
