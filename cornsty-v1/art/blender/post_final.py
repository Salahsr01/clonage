"""CORNSTY - finition de l'image finale « gouache brillante » (Python + numpy, sans autre dependance que bpy pour lire/ecrire).

Ce qu'elle ajoute au rendu brut de Cycles : lueur doree des sources (ampoule, soleil), etoiles jaunes a quatre branches,
dominante chaude dans les lumieres et froide dans les ombres, leger grain de pinceau, vignette.
usage : python3 post_final.py entree.(png|exr) sortie.png [force_de_lueur]
"""
import sys, os, glob, importlib.util, math
spec = importlib.util.find_spec('bpy')
_root = list(spec.submodule_search_locations)[0]
_cfg = glob.glob(os.path.join(_root, '*', 'datafiles', 'colormanagement', 'config.ocio'))
if _cfg:
    os.environ.setdefault('OCIO', _cfg[0])
    os.environ.setdefault('BLENDER_SYSTEM_RESOURCES', os.path.dirname(os.path.dirname(os.path.dirname(_cfg[0]))))
import bpy
import numpy as np


def load(path):
    img = bpy.data.images.load(os.path.abspath(path), check_existing=False)
    img.colorspace_settings.name = 'Non-Color' if path.lower().endswith('.png') else 'Linear Rec.709'
    w, h = img.size
    a = np.empty(w * h * 4, dtype=np.float32)
    img.pixels.foreach_get(a)
    a = a.reshape(h, w, 4)[:, :, :3]
    return np.ascontiguousarray(a), path.lower().endswith('.png')


def save(a, path):
    h, w, _ = a.shape
    img = bpy.data.images.new('post_out', w, h, alpha=False, float_buffer=False)
    img.colorspace_settings.name = 'Non-Color'
    buf = np.ones((h, w, 4), dtype=np.float32)
    buf[:, :, :3] = np.clip(a, 0, 1)
    img.pixels.foreach_set(buf.ravel())
    img.filepath_raw = os.path.abspath(path)
    img.file_format = 'PNG'
    img.save()


def srgb_to_lin(x):
    return np.where(x <= 0.04045, x / 12.92, ((x + 0.055) / 1.055) ** 2.4)


def lin_to_srgb(x):
    x = np.clip(x, 0, None)
    return np.where(x <= 0.0031308, x * 12.92, 1.055 * np.power(x, 1 / 2.4) - 0.055)


def gauss(a, sigma):
    """Flou gaussien par FFT (sigma en pixels), canal par canal."""
    h, w = a.shape[:2]
    fy = np.fft.fftfreq(h)[:, None]
    fx = np.fft.rfftfreq(w)[None, :]
    k = np.exp(-2 * (math.pi * sigma) ** 2 * (fx ** 2 + fy ** 2))
    if a.ndim == 2:
        return np.fft.irfft2(np.fft.rfft2(a) * k, s=(h, w))
    return np.stack([np.fft.irfft2(np.fft.rfft2(a[:, :, c]) * k, s=(h, w)) for c in range(a.shape[2])], axis=2)


def star(h, w, cx, cy, size, rot=0.0):
    """Etoile a quatre branches (spikes fins + coeur), valeurs additives 0..1."""
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    dx, dy = xx - cx, yy - cy
    c, s = math.cos(rot), math.sin(rot)
    u, v = dx * c + dy * s, -dx * s + dy * c
    au, av = np.abs(u), np.abs(v)
    spike_h = np.exp(-av / (size * 0.055)) * np.exp(-(au / size) ** 1.1)
    spike_v = np.exp(-au / (size * 0.055)) * np.exp(-(av / size) ** 1.1)
    core = np.exp(-(au ** 2 + av ** 2) / (2 * (size * 0.12) ** 2))
    halo = np.exp(-(au ** 2 + av ** 2) / (2 * (size * 0.5) ** 2)) * 0.25
    return np.clip(spike_h + spike_v + core * 1.2 + halo, 0, 1.6)


# positions relatives (x, y) et tailles (en % de la largeur) des etoiles jaunes, d'apres le brouillon valide
SPARKLES = [(0.062, 0.30, 0.026), (0.535, 0.245, 0.032), (0.585, 0.18, 0.018), (0.925, 0.29, 0.03), (0.240, 0.27, 0.014), (0.030, 0.47, 0.016), (0.975, 0.40, 0.02), (0.865, 0.21, 0.012)]


def process(src, dst, glow=1.0, seed=3):
    a, is_png = load(src)
    lin = srgb_to_lin(a) if is_png else a.astype(np.float32)
    h, w = lin.shape[:2]
    lum = lin @ np.array([0.2126, 0.7152, 0.0722], dtype=np.float32)
    # --- lueur : passe haute sur la luminance, plusieurs rayons, teinte doree
    bright = np.clip(np.minimum(lin, 6.0) - 0.55, 0, None) * (lum[:, :, None] > 0.35)      # les sources tres fortes (ampoule) sont plafonnees pour que la lueur reste douce
    scale = w / 2048.0
    bloom = 0.55 * gauss(bright, 5 * scale) + 0.45 * gauss(bright, 16 * scale) + 0.35 * gauss(bright, 46 * scale)
    tint = np.array([1.0, 0.82, 0.55], dtype=np.float32)
    lin = lin + glow * 0.9 * bloom * tint
    # --- etoiles
    stars = np.zeros((h, w), dtype=np.float32)
    for x, y, s in SPARKLES:
        stars += star(h, w, x * w, (1 - y) * h, s * w)          # l'origine de l'image Blender est en bas a gauche
    lin = lin + stars[:, :, None] * np.array([1.0, 0.86, 0.35], dtype=np.float32) * 0.95
    # --- dominante : ombres froides (violet-bleu), lumieres chaudes
    lum2 = lin @ np.array([0.2126, 0.7152, 0.0722], dtype=np.float32)
    shadow = np.clip(1 - lum2 * 2.2, 0, 1)[:, :, None]
    high = np.clip(lum2 * 1.4 - 0.3, 0, 1)[:, :, None]
    lin = lin * (1 + shadow * np.array([-0.07, -0.03, 0.14], dtype=np.float32)) * (1 + high * np.array([0.06, 0.02, -0.06], dtype=np.float32))
    # --- grain de pinceau (bruit etire) + papier fin
    rng = np.random.default_rng(seed)
    brush = gauss(rng.standard_normal((h, w)).astype(np.float32), 1.4 * scale)
    brush2 = np.stack([gauss(rng.standard_normal((h, w)).astype(np.float32), 0.6) for _ in range(1)])[0]
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    strokes = gauss(rng.standard_normal((h, w)).astype(np.float32), 5 * scale)
    strokes = strokes / (np.std(strokes) + 1e-6)
    grain = 1 + 0.012 * strokes + 0.010 * brush / (np.std(brush) + 1e-6) + 0.006 * brush2 / (np.std(brush2) + 1e-6)
    lin = lin * grain[:, :, None]
    # --- vignette douce
    cx, cy = (xx - w / 2) / (w / 2), (yy - h / 2) / (h / 2)
    vig = 1 - 0.16 * np.clip((cx ** 2 * 0.8 + cy ** 2 * 1.0) - 0.35, 0, None)
    lin = lin * vig[:, :, None]
    # --- courbe : contraste doux + saturation, puis sRVB
    out = np.clip(lin_to_srgb(lin), 0, 1)                                # ecretage comme la vue « Standard » (sinon la courbe en S inverse les hautes lumieres)
    out = out + 0.10 * (out - 0.5) * (1 - np.abs(out - 0.5) * 2)         # S douce
    g = out @ np.array([0.2126, 0.7152, 0.0722], dtype=np.float32)
    out = g[:, :, None] + (out - g[:, :, None]) * 1.14
    save(np.clip(out, 0, 1), dst)
    return {'w': w, 'h': h}


if __name__ == '__main__':
    src, dst = sys.argv[1], sys.argv[2]
    glow = float(sys.argv[3]) if len(sys.argv) > 3 else 1.0
    print('POST', process(src, dst, glow), '->', dst)
