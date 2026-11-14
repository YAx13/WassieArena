import os
import glob
from PIL import Image

CHARS = ["empereur", "frankenstein", "general", "hazmat", "human", "inversebrah", "momie", "samourai", "zeus"]
WEAPONS = [
    (0, "epee", 0), (1, "dague", 12), (2, "couteau", 13), (3, "scie", 11),
    (4, "hache", 4), (5, "marteau", 5), (6, "pioche", 6), (7, "os", 10),
    (8, "boomerang", 14), (9, "arc", 9), (10, "trident", 1), (11, "pilier", 8)
]

os.makedirs("raw/weapons_cut", exist_ok=True)

for c in CHARS:
    pattern = f"assets/characters/{c}/weapons/weapon-*-transparent.png"
    files = sorted(glob.glob(pattern))
    for src in files:
        base = os.path.basename(src)
        skin_num = base.replace("weapon-", "").replace("-transparent.png", "")
        img = Image.open(src).convert("RGBA")
        tile = img.width // 4
        out_dir = f"raw/weapons_cut/{c}/skin-{skin_num}"
        os.makedirs(out_dir, exist_ok=True)
        for wid, name, cell in WEAPONS:
            x = (cell % 4) * tile
            y = (cell // 4) * tile
            crop = img.crop((x, y, x + tile, y + tile))
            crop.save(f"{out_dir}/wpn-{wid}-{name}.png")

print("Découpe terminée pour toutes les planches dans raw/weapons_cut/<personnage>/skin-X/ !")
