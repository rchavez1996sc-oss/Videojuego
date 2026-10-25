"""Cloth masks for the civilian atlases (white = clothing that may be recoloured, black = skin/eyes/scalp).
Seeds are clothing colours picked from each atlas; neutral seeds only match unsaturated texels so pale skin is safe.
Usage: python3 -I scripts/clothmask.py   (writes public/assets/characters/<kind>.mask.png)"""
import io, json, struct, sys
from PIL import Image, ImageFilter

SEEDS = {
    'civ_a': [(13, 38, 79), (2, 19, 47), (30, 55, 100), (206, 206, 206), (175, 173, 176), (240, 240, 240)],
    'civ_b': [(218, 149, 82), (230, 160, 95), (65, 86, 107), (78, 96, 116), (213, 213, 213), (160, 159, 157), (235, 190, 30)],
    'civ_c': [(155, 44, 24), (179, 30, 32), (200, 40, 40), (156, 187, 208), (144, 172, 193), (110, 140, 165), (180, 180, 180), (225, 225, 225)],
}
DIR = 'public/assets/characters/'

def atlas(path):
    buf = open(path, 'rb').read()
    n = struct.unpack_from('<I', buf, 12)[0]
    doc, start = json.loads(buf[20:20 + n]), 20 + n + 8
    mat = next(m for m in doc['materials'] if 'body' in m['name'].lower())
    img = doc['images'][doc['textures'][mat['pbrMetallicRoughness']['baseColorTexture']['index']]['source']]
    bv = doc['bufferViews'][img['bufferView']]
    o = start + bv.get('byteOffset', 0)
    return Image.open(io.BytesIO(buf[o:o + bv['byteLength']])).convert('RGB')

for kind, seeds in SEEDS.items():
    im = atlas(DIR + kind + '.glb').resize((512, 512), Image.BILINEAR)
    out = Image.new('L', im.size)
    px, mp = im.load(), out.load()
    for y in range(im.height):
        for x in range(im.width):
            r, g, b = px[x, y]
            hi, lo = max(r, g, b), min(r, g, b)
            sat = (hi - lo) / (hi + 1e-6)
            for s in seeds:
                neutral = max(s) - min(s) < 20
                d = ((r - s[0]) ** 2 + (g - s[1]) ** 2 + (b - s[2]) ** 2) ** 0.5
                if (neutral and sat < 0.09 and d < 40) or (not neutral and d < 48):
                    mp[x, y] = 255
                    break
    out = out.filter(ImageFilter.MedianFilter(5)).resize((256, 256), Image.BILINEAR)
    out.save(DIR + kind + '.mask.png')
    print(kind, sum(1 for v in out.tobytes() if v > 127) / 65536)
