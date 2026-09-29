"""CORNSTY - rendu final 2K par bandes, avec reprise (une bande terminee n'est jamais recalculee).

Pourquoi par bandes : un rendu de 30 a 40 minutes qui s'interrompt est entierement perdu ; ici chaque bande (3, avec un
recouvrement de 64 px) est enregistree a part en EXR, puis `stitch_bands.py` les recolle avec un fondu lineaire.
usage : python3 render_bands.py dossier_de_sortie [echantillons=256] [nom=final-2k]      (module `bpy` de pip, Cycles CPU)
        RES=1024x576 pour un essai rapide
"""
import sys, os, glob, importlib.util, time
spec = importlib.util.find_spec('bpy'); root = list(spec.submodule_search_locations)[0]
cfg = glob.glob(os.path.join(root, '*', 'datafiles', 'colormanagement', 'config.ocio'))
os.environ.setdefault('OCIO', cfg[0]); os.environ.setdefault('BLENDER_SYSTEM_RESOURCES', os.path.dirname(os.path.dirname(os.path.dirname(cfg[0]))))
import bpy
A = os.path.dirname(os.path.abspath(__file__)) + '/'
D = os.path.abspath(sys.argv[1]) + '/'
os.makedirs(D, exist_ok=True)
SAMPLES = int(sys.argv[2]) if len(sys.argv) > 2 else 256
NAME = sys.argv[3] if len(sys.argv) > 3 else 'final-2k'
W, H = (int(v) for v in os.environ.get('RES', '2048x1152').split('x'))
NB = 3
OV = 64 * W // 2048
CORE = H // NB
ns = {'ASSET_DIR': A[:-1], 'ENGINE': 'CYCLES', 'QUALITY': 'final', '__name__': 'build'}
t0 = time.time()
for f in ('cs_lib.py', 'gull.py', 'build_final.py'):
    exec(compile(open(A + f).read(), f, 'exec'), ns)
print('BUILD OK', ns['result'], round(time.time() - t0, 1), 's', flush=True)
sc = bpy.data.scenes['CORNSTY_Depart_Final']
sc.render.resolution_x, sc.render.resolution_y, sc.render.resolution_percentage = W, H, 100
sc.cycles.samples = SAMPLES
sc.render.image_settings.file_format = 'OPEN_EXR'
sc.render.image_settings.color_depth = '16'
sc.render.use_border = True
sc.render.use_crop_to_border = True
for k in (1, 0, 2):                                   # d'abord le milieu (Mouette, enseigne, pochons) pour pouvoir le juger tot
    y0, y1 = max(0, k * CORE - OV), min(H, (k + 1) * CORE + OV)
    out = D + '%s-band%d.exr' % (NAME, k)
    if os.path.exists(out) and os.path.getsize(out) > 0:
        print('band', k, 'deja faite', flush=True)
        continue
    sc.render.border_min_x, sc.render.border_max_x = 0.0, 1.0
    sc.render.border_min_y, sc.render.border_max_y = 1.0 - y1 / H, 1.0 - y0 / H
    sc.render.filepath = out + '.part'
    t1 = time.time()
    bpy.ops.render.render(write_still=True, scene=sc.name)
    os.replace(out + '.part' if os.path.exists(out + '.part') else out + '.part.exr', out)
    print('BAND', k, 'rows', y0, y1, SAMPLES, 'spp', round(time.time() - t1, 1), 's ->', out, flush=True)
print('ALL BANDS DONE', round(time.time() - t0, 1), 's', flush=True)
