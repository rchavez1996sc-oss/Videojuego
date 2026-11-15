# Street View vía Google Map Tiles API (la clave la inyecta el proxy en X-Goog-Api-Key; ver CLAUDE.md).
# Uso: python3 scripts/streetview.py <panoId> <rumbo,rumbo,...> <salida.jpg>   ·   import: meta(), pano(), view(), panoIds en la API.
import sys, json, io, math, urllib.request, os
import numpy as np
from PIL import Image
D = os.environ.get('SV_DIR', '/tmp/sv')
os.makedirs(D, exist_ok=True)
def session():
    req = urllib.request.Request('https://tile.googleapis.com/v1/createSession', data=b'{"mapType":"streetview","language":"es-419","region":"PE"}', headers={'Content-Type': 'application/json'})
    with urllib.request.urlopen(req) as r: return json.loads(r.read())['session']
S = session()
BASE = 'https://tile.googleapis.com/v1/streetview'
def get(url):
    with urllib.request.urlopen(url) as r: return r.read()
def meta(pid): return json.loads(get(f'{BASE}/metadata?session={S}&panoId={pid}'))
def pano(pid, z=2):
    cache = f'{D}/{pid}_z{z}.jpg'
    if os.path.exists(cache): return Image.open(cache)
    nx, ny = 2 ** z, 2 ** (z - 1)
    img = Image.new('RGB', (nx * 512, ny * 512))
    for y in range(ny):
        for x in range(nx):
            img.paste(Image.open(io.BytesIO(get(f'{BASE}/tiles/{z}/{x}/{y}?session={S}&panoId={pid}'))), (x * 512, y * 512))
    img.save(cache, quality=92); return img
def view(img, heading, pitch=0, fov=90, w=960, h=600, pano_heading=0):
    a = np.asarray(img).astype(np.float32); H, W = a.shape[:2]
    f = (w / 2) / math.tan(math.radians(fov) / 2)
    xs, ys = np.meshgrid(np.arange(w) - w / 2, np.arange(h) - h / 2)
    d = np.stack([xs, -ys, np.full_like(xs, f)], -1); d /= np.linalg.norm(d, axis=-1, keepdims=True)
    p = math.radians(pitch); cy, sy = math.cos(p), math.sin(p)
    y2 = d[..., 1] * cy + d[..., 2] * sy; z2 = -d[..., 1] * sy + d[..., 2] * cy; d[..., 1], d[..., 2] = y2, z2
    yaw = np.arctan2(d[..., 0], d[..., 2]) + math.radians(heading - pano_heading)
    lat = np.arcsin(np.clip(d[..., 1], -1, 1))
    u = ((yaw / (2 * math.pi) + 0.5) % 1) * (W - 1); v = (0.5 - lat / math.pi) * (H - 1)
    return Image.fromarray(a[v.astype(int), u.astype(int)].astype(np.uint8))
if __name__ == '__main__':
    pid, heads, out = sys.argv[1], [float(x) for x in sys.argv[2].split(',')], sys.argv[3]
    m = meta(pid); img = pano(pid)
    views = [view(img, hd, pano_heading=m['heading']) for hd in heads]
    sheet = Image.new('RGB', (960 * len(views), 600))
    for i, v in enumerate(views): sheet.paste(v, (960 * i, 0))
    sheet.save(out, quality=88)
    print(m['date'], m['lat'], m['lng'], [(l['panoId'], round(l.get('heading', 0))) for l in m.get('links', [])])
