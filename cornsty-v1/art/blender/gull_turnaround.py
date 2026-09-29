"""CORNSTY - planche de rotation de la Mouette modelisee (face, trois-quarts, profil, dos) sous lumiere de studio neutre.

Sert a verifier le modele seul, sans decor. usage : python3 gull_turnaround.py sortie.png [largeur_par_vue] [echantillons]
(hors interface, module `bpy` de pip). Depend de cs_lib.py et gull.py, executes dans le meme espace de noms.
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

A = os.path.dirname(os.path.abspath(__file__)) + '/'
ns = {'ASSET_DIR': A[:-1], '__name__': 'turnaround'}
for f in ('cs_lib.py', 'gull.py'):
    exec(compile(open(A + f).read(), f, 'exec'), ns)
Vector = ns['Vector']
out_path = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else 'gull-turnaround.png')
W = int(sys.argv[2]) if len(sys.argv) > 2 else 700
H = int(W * 1.25)
SAMPLES = int(sys.argv[3]) if len(sys.argv) > 3 else 48
VIEWS = [('face', 0.0), ('trois-quarts', 38.0), ('profil', 90.0), ('dos', 180.0)]

sc = ns['fresh']('TURN_gull')
cE, cH, cL, cC = (ns['make_col'](sc, n) for n in ('COL_ENV', 'COL_HERO', 'COL_LGT', 'COL_CAM'))
g = ns['make_gull'](cH, loc=(0, 0, 0), yaw_deg=0.0, pitch_deg=0.0)
floor = ns['new_mat']('MAT_floor_t', '#DCD6E6', 0.85)
ns['new_obj']('ENV_floor_t', ns['cyl_mesh']('ENV_floor_t', 3.0, 0.05, 96), cE, loc=(0, 0, 0.505), mats=[floor])   # plateau sous le corps, a la hauteur du comptoir de la scene


def light(name, kind, energy, color, loc, target, size=None, size_y=None):
    li = bpy.data.lights.new(name, kind)
    li.energy = energy
    li.color = color
    if kind == 'AREA':
        li.shape = 'RECTANGLE'
        li.size, li.size_y = size, size_y
    o = ns['new_obj'](name, li, cL, loc=loc)
    o.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()


light('LGT_key', 'AREA', 260, (1.0, 0.86, 0.72), (2.4, -2.8, 2.9), (0, 0, 1.2), 2.4, 2.4)
light('LGT_fill', 'AREA', 90, (0.7, 0.75, 1.0), (-2.8, -2.2, 1.7), (0, 0, 1.2), 3.0, 3.0)
light('LGT_rim', 'AREA', 150, (1.0, 0.92, 0.85), (-1.2, 2.6, 2.8), (0, 0, 1.3), 2.0, 2.0)
w = bpy.data.worlds.new('W_turn')
w.use_nodes = True
w.node_tree.nodes['Background'].inputs['Color'].default_value = (0.62, 0.66, 0.85, 1)
w.node_tree.nodes['Background'].inputs['Strength'].default_value = 0.9
sc.world = w
cd = bpy.data.cameras.new('CAM_t')
cd.lens = 52
cd.sensor_width = 36
co = ns['new_obj']('CAM_t', cd, cC, loc=(0.0, -4.6, 1.42))
co.rotation_euler = (Vector((0, 0, 1.33)) - Vector(co.location)).to_track_quat('-Z', 'Y').to_euler()
sc.camera = co
sc.render.engine = 'CYCLES'
sc.render.resolution_x, sc.render.resolution_y, sc.render.resolution_percentage = W, H, 100
sc.view_settings.view_transform = 'Standard'
cy = sc.cycles
cy.device = 'CPU'
cy.samples = SAMPLES
cy.use_denoising = True
try:
    cy.denoiser = 'OPENIMAGEDENOISE'
except Exception:
    pass
cy.max_bounces = 6

tiles = []
for label, rot in VIEWS:
    g['root'].rotation_euler = (0, 0, math.radians(rot))
    p = out_path.rsplit('.', 1)[0] + '-%s.png' % label
    sc.render.filepath = p
    sc.render.image_settings.file_format = 'PNG'
    bpy.ops.render.render(write_still=True, scene=sc.name)
    img = bpy.data.images.load(p, check_existing=False)
    img.colorspace_settings.name = 'Non-Color'                       # valeurs sRVB brutes, recopiees telles quelles
    w_, h_ = img.size
    a = np.empty(w_ * h_ * 4, dtype=np.float32)
    img.pixels.foreach_get(a)
    tiles.append(a.reshape(h_, w_, 4))
    os.remove(p)
sheet = np.concatenate(tiles, axis=1)
out = bpy.data.images.new('sheet', sheet.shape[1], sheet.shape[0], alpha=False)
out.colorspace_settings.name = 'Non-Color'
out.pixels.foreach_set(sheet.ravel())
out.filepath_raw = out_path
out.file_format = 'PNG'
out.save()
print('TURNAROUND', out_path, sheet.shape[1], 'x', sheet.shape[0])
