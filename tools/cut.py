import os
import shutil
from datetime import datetime
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..")) if os.path.basename(HERE).lower() == "tools" else HERE
ASSETS = os.path.join(ROOT, "assets")
RAW = os.path.join(ROOT, "raw")
ARCHIVE_DOCS = os.path.join(ROOT, "docs", "prompt", "archived")

if not os.path.isdir(ASSETS):
    raise RuntimeError(f"Dossier assets introuvable depuis {ROOT}")

stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
BACKUP_CHARS = os.path.join(RAW, f"backup_characters_{stamp}")
TRASH_RAW = os.path.join(RAW, f"cleaned_from_assets_{stamp}")

# 1. Copie de sauvegarde complète de assets/characters -> raw/
src_chars = os.path.join(ASSETS, "characters")
if os.path.isdir(src_chars):
    shutil.copytree(src_chars, BACKUP_CHARS)
    print(f"[BACKUP] Sauvegarde complète créée dans : {BACKUP_CHARS}")

WEAPON_CELLS = {
    0: 0, 1: 1, 2: 2, 3: 3,
    4: 4, 5: 5, 6: 6, 7: 7,
    8: 8, 9: 10, 10: 11,
    11: 12, 12: 13, 13: 14
}

moved_dirs = 0
moved_files = 0
moved_txts = 0
sliced_chars = 0

def move_to_raw(path):
    rel = os.path.relpath(path, ASSETS)
    dest = os.path.join(TRASH_RAW, rel)
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    shutil.move(path, dest)

# 2. Déplacement des doublons et fichiers parasites de assets/ vers raw/ (zéro suppression)
for dirpath, dirnames, filenames in os.walk(ASSETS, topdown=True):
    if "characters" in dirpath and "weapons_cut" in dirnames:
        dup = os.path.join(dirpath, "weapons_cut")
        move_to_raw(dup)
        dirnames.remove("weapons_cut")
        moved_dirs += 1

    for fn in filenames:
        full = os.path.join(dirpath, fn)
        low = fn.lower()
        if low.endswith(".txt") and ("characters" in dirpath or "companion" in dirpath):
            os.makedirs(ARCHIVE_DOCS, exist_ok=True)
            shutil.move(full, os.path.join(ARCHIVE_DOCS, f"{os.path.basename(dirpath)}_{fn}"))
            moved_txts += 1
        elif low.startswith("image_") and low.endswith((".jpg", ".jpeg")) and ("characters" in dirpath or "companion" in dirpath):
            move_to_raw(full)
            moved_files += 1
        elif fn == "weapon-1-transparent.png" and os.path.basename(dirpath) == "sheets":
            move_to_raw(full)
            moved_files += 1

# 3. Découpe propre de chaque weapon-1-transparent.png directement dans weapons/wpn-0..13.png
for char_name in sorted(os.listdir(src_chars)):
    wpn_dir = os.path.join(src_chars, char_name, "weapons")
    sheet_path = os.path.join(wpn_dir, "weapon-1-transparent.png")
    if not os.path.isfile(sheet_path):
        continue
    img = Image.open(sheet_path).convert("RGBA")
    w, h = img.size
    cw, ch = w // 4, h // 4
    for wid, cell in WEAPON_CELLS.items():
        col, row = cell % 4, cell // 4
        x0, y0 = col * cw, row * ch
        y1 = y0 + (ch * 2 if wid == 10 else ch)
        img.crop((x0, y0, x0 + cw, y1)).save(os.path.join(wpn_dir, f"wpn-{wid}.png"))
    sliced_chars += 1
    print(f"[OK] {char_name}: wpn-0..13.png générés dans weapons/")

print(f"\nTerminé (zéro suppression) : {moved_dirs} dossiers doublons déplacés vers raw/, {moved_files} fichiers déplacés vers raw/, {moved_txts} .txt archivés dans docs/, {sliced_chars} personnages découpés.")
