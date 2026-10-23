"""Downloads CC0 Poly Haven texture sets (2k colour for big surfaces in HI, else 1k) and writes game-ready maps to public/assets/textures/.

Colour maps are rescaled so their mean colour matches the procedural texture they replace, so existing material
tints keep working; normal maps (OpenGL) are downsized to 1024/512; GREY sets are normalised to a neutral mean and tinted in the shader. Run: python3 scripts/phtextures.py
"""
import io, json, os, urllib.request
from PIL import Image, ImageStat

OUT = os.path.join(os.path.dirname(__file__), '..', 'public', 'assets', 'textures')
URL = 'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/{2}/{0}/{0}_{1}_{2}.jpg'
HI = {'asphalt', 'slabs', 'cobble', 'flagstone', 'plaster', 'concrete', 'brick', 'lawn', 'dryGrass'}
GREY = (128, 128, 128)
SETS = {
    'concrete': ('concrete_floor_worn_001', (134, 131, 125)),
    'slabs': ('concrete_pavement', (134, 131, 125)),
    'plaster': ('white_plaster_02', (231, 227, 219)),
    'brick': ('brick_wall_006', (141, 79, 57)),
    'rock': ('rock_face_03', (117, 112, 104)),
    'asphalt': ('asphalt_01', (117, 112, 104)),
    'roofTiles': ('clay_roof_tiles_02', (115, 54, 34)),
    'deck': ('wood_floor_deck', None),
    'parquet': ('herringbone_parquet', None),
    'flagstone': ('stone_tiles_02', None),
    'stucco': ('white_stucco_02', (236, 235, 230)),
    'bark': ('bark_platanus', (90, 67, 48)),
    'palmBark': ('palm_bark', (100, 88, 74)),
    'cobble': ('cobblestone_05', None),
    'pirca': ('old_stone_wall', None),
    'stoneWall': ('yellow_stone_wall', (168, 150, 122)),
    'pebbles': ('ganges_river_pebbles', None),
    'lawn': ('leafy_grass', GREY),
    'dryGrass': ('sparse_grass', GREY),
}

def fetch(asset, kind, res='1k'):
    with urllib.request.urlopen(URL.format(asset, kind, res)) as r:
        return Image.open(io.BytesIO(r.read())).convert('RGB')

os.makedirs(OUT, exist_ok=True)
import sys
only = sys.argv[1:]
for key, (asset, target) in SETS.items():
    if only and key not in only:
        continue
    hi = key in HI
    col = fetch(asset, 'diff', '2k' if hi else '1k')
    if target:
        mean = ImageStat.Stat(col).mean
        col = Image.merge('RGB', [band.point(lambda v, k=t / m: min(255, int(v * k))) for band, t, m in zip(col.split(), target, mean)])
    col.save(os.path.join(OUT, f'{key}_col.jpg'), quality=82, optimize=True)
    fetch(asset, 'nor_gl').resize((1024, 1024) if hi else (512, 512), Image.LANCZOS).save(os.path.join(OUT, f'{key}_nrm.jpg'), quality=88, optimize=True)
    print(key, asset)
print(json.dumps({k: {'map': f'textures/{k}_col.jpg', 'normal': f'textures/{k}_nrm.jpg', 'source': f'Poly Haven {a} (CC0)'} for k, (a, _) in SETS.items()}, indent=1))
