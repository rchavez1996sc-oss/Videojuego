"""Shrinks heavy PNG textures inside .glb files in place (character hair cards: 2048 RGBA PNG of 4-6 MB).

Each embedded PNG bigger than LIMIT is resized to SIZE and saved as a 256-colour palette PNG that keeps its alpha
(hair is alpha-tested, so the mask survives); every bufferView after it is shifted and the BIN chunk rebuilt.
Run after `node scripts/mixamo.mjs chars`: python3 scripts/glbimages.py public/assets/characters/*.glb
"""
import io, json, struct, sys
from PIL import Image

LIMIT, SIZE = 1_500_000, 1024


def shrink(data: bytes) -> bytes:
    img = Image.open(io.BytesIO(data)).convert('RGBA')
    if img.width > SIZE:
        img = img.resize((SIZE, SIZE), Image.LANCZOS)
    out = io.BytesIO()
    img.quantize(256, method=Image.Quantize.FASTOCTREE).save(out, 'PNG', optimize=True)
    return out.getvalue()


def process(path: str) -> None:
    raw = open(path, 'rb').read()
    jlen = struct.unpack('<I', raw[12:16])[0]
    doc = json.loads(raw[20:20 + jlen])
    bin_start = 20 + jlen + 8
    blen = struct.unpack('<I', raw[20 + jlen:24 + jlen])[0]
    blob = raw[bin_start:bin_start + blen]
    swap = {}
    for im in doc.get('images', []):
        bv = doc['bufferViews'][im['bufferView']]
        o = bv.get('byteOffset', 0)
        data = blob[o:o + bv['byteLength']]
        if im.get('mimeType') == 'image/png' and len(data) > LIMIT:
            swap[im['bufferView']] = shrink(data)
    if not swap:
        print(path, 'unchanged')
        return
    # Every range of buffer 0: plain bufferViews and meshopt-compressed ones (their data is referenced by the extension).
    segs = []
    for i, bv in enumerate(doc['bufferViews']):
        ext = bv.get('extensions', {}).get('EXT_meshopt_compression')
        if bv['buffer'] == 0:
            segs.append((bv.get('byteOffset', 0), bv, i))
        if ext and ext['buffer'] == 0:
            segs.append((ext.get('byteOffset', 0), ext, None))
    out = bytearray()
    for o, ref, i in sorted(segs, key=lambda t: t[0]):
        data = swap.get(i, blob[o:o + ref['byteLength']]) if i is not None else blob[o:o + ref['byteLength']]
        while len(out) % 4:
            out.append(0)
        ref['byteOffset'] = len(out)
        ref['byteLength'] = len(data)
        out += data
    doc['buffers'][0]['byteLength'] = len(out)
    js = json.dumps(doc, separators=(',', ':')).encode()
    js += b' ' * (-len(js) % 4)
    total = 12 + 8 + len(js) + 8 + len(out)
    with open(path, 'wb') as f:
        f.write(struct.pack('<III', 0x46546C67, 2, total))
        f.write(struct.pack('<II', len(js), 0x4E4F534A) + js)
        f.write(struct.pack('<II', len(out), 0x004E4942) + bytes(out))
    print(path, f'{len(raw) / 1e6:.1f} -> {total / 1e6:.1f} MB')


for p in sys.argv[1:]:
    process(p)
