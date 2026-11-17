# Satellite mosaic via Google Map Tiles API (2D tiles; the proxy injects the key, see CLAUDE.md).
# Usage: python3 scripts/satellite.py <lat> <lng> <metres> <zoom> <out.jpg>
# Writes a north-up mosaic centred on (lat, lng) covering `metres` per side and prints metres per pixel.
import sys, json, io, math, os, urllib.request
from PIL import Image

D = os.environ.get('SV_DIR', '/tmp/sv')
os.makedirs(D, exist_ok=True)


def session():
    body = b'{"mapType":"satellite","language":"es-419","region":"PE"}'
    req = urllib.request.Request('https://tile.googleapis.com/v1/createSession', data=body, headers={'Content-Type': 'application/json'})
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read())['session']


def tile(s, z, x, y):
    cache = f'{D}/sat_{z}_{x}_{y}.jpg'
    if not os.path.exists(cache):
        with urllib.request.urlopen(f'https://tile.googleapis.com/v1/2dtiles/{z}/{x}/{y}?session={s}') as r:
            open(cache, 'wb').write(r.read())
    return Image.open(cache).convert('RGB')


def world_px(lat, lng, z):
    n = 256 * 2 ** z
    x = (lng + 180) / 360 * n
    y = (1 - math.log(math.tan(math.radians(lat)) + 1 / math.cos(math.radians(lat))) / math.pi) / 2 * n
    return x, y


lat, lng, metres, z, out = float(sys.argv[1]), float(sys.argv[2]), float(sys.argv[3]), int(sys.argv[4]), sys.argv[5]
mpp = 156543.03392 * math.cos(math.radians(lat)) / 2 ** z
half = metres / 2 / mpp
cx, cy = world_px(lat, lng, z)
x0, y0, x1, y1 = cx - half, cy - half, cx + half, cy + half
s = session()
img = Image.new('RGB', (int(x1 - x0), int(y1 - y0)))
for ty in range(int(y0 // 256), int(y1 // 256) + 1):
    for tx in range(int(x0 // 256), int(x1 // 256) + 1):
        img.paste(tile(s, z, tx, ty), (int(tx * 256 - x0), int(ty * 256 - y0)))
img.save(out, quality=88)
print(f'{img.size[0]}x{img.size[1]} px, {mpp:.3f} m/px')
