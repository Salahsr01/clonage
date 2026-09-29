"""CORNSTY - recolle les bandes d'un rendu par bandes (`render_bands.py`) en un seul EXR, avec un fondu lineaire dans les recouvrements.
usage : python3 stitch_bands.py dossier [nom=final-2k] [WxH=2048x1152]      -> dossier/<nom>.exr   (puis post_final.py)
"""
import sys, os, glob, importlib.util
spec = importlib.util.find_spec('bpy'); root = list(spec.submodule_search_locations)[0]
cfg = glob.glob(os.path.join(root, '*', 'datafiles', 'colormanagement', 'config.ocio'))
os.environ.setdefault('OCIO', cfg[0]); os.environ.setdefault('BLENDER_SYSTEM_RESOURCES', os.path.dirname(os.path.dirname(os.path.dirname(cfg[0]))))
import bpy
import numpy as np
D = os.path.abspath(sys.argv[1]) + '/'
NAME = sys.argv[2] if len(sys.argv) > 2 else 'final-2k'
W, H = (int(v) for v in (sys.argv[3] if len(sys.argv) > 3 else '2048x1152').split('x'))
NB = 3
OV = 64 * W // 2048
CORE = H // NB
acc = np.zeros((H, W, 4), dtype=np.float64)
wsum = np.zeros((H, 1, 1), dtype=np.float64)
for k in range(NB):
    y0, y1 = max(0, k * CORE - OV), min(H, (k + 1) * CORE + OV)
    img = bpy.data.images.load(D + '%s-band%d.exr' % (NAME, k), check_existing=False)
    img.colorspace_settings.name = 'Linear Rec.709'
    w, h = img.size
    a = np.empty(w * h * 4, dtype=np.float32)
    img.pixels.foreach_get(a)
    a = a.reshape(h, w, 4)[::-1]                       # l'image Blender a son origine en bas : on remet le haut en premier
    print('band', k, 'size', w, h, 'attendu', W, y1 - y0)
    rows = min(h, y1 - y0)
    wt = np.ones(rows)
    R = 2 * OV
    if k > 0:
        n = min(R, rows)
        wt[:n] = (np.arange(n) + 0.5) / R
    if k < NB - 1:
        n = min(R, rows)
        wt[-n:] = np.minimum(wt[-n:], 1 - (np.arange(n) + 0.5) / R)
    acc[y0:y0 + rows, :, :] += a[:rows] * wt[:, None, None]
    wsum[y0:y0 + rows] += wt[:, None, None]
res = (acc / np.maximum(wsum, 1e-6)).astype(np.float32)
print('poids min/max', float(wsum.min()), float(wsum.max()))
out = bpy.data.images.new('stitched', W, H, alpha=True, float_buffer=True)
out.colorspace_settings.name = 'Non-Color'                       # aucune conversion a l'ecriture (sinon Blender applique la courbe sRVB)
out.pixels.foreach_set(res[::-1].ravel())
out.filepath_raw = D + NAME + '.exr'
out.file_format = 'OPEN_EXR'
out.save()
print('STITCHED', D + NAME + '.exr', W, H)
