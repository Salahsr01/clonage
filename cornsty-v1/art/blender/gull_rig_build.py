"""CORNSTY - construit le squelette de la Mouette Higgsfield (étape 1 : le corps).

usage : python3 gull_rig_build.py corps.glb sortie.blend
Lit le corps en pose « A » (Tripo puis remaillage Meshy, hauteur 1 m, pieds au sol, avant = +X), coupe la tête sous le
chapeau (les têtes d'expression viennent d'ailleurs), calcule les poids de peau par diffusion sur la surface, crée
l'armature `ARM_gull` et enregistre le tout dans un .blend. Repère : X avant, Y gauche, Z haut, mètres.
"""
import sys, os, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from gull_rig_lib import *

Z_CUT = 0.64            # plan de coupe du cou (le corps garde tout ce qui est dessous)

# nom, tête, queue, parent   (repères mesurés sur les vues orthographiques du modèle remaillé, 1 m de haut)
BONES = [
    ('RIG_root',   (0.00, 0, 0.00),  (0.00, 0, 0.10),  None),
    ('RIG_hips',   (-0.02, 0, 0.34), (0.00, 0, 0.42),  'RIG_root'),
    ('RIG_chest',  (0.00, 0, 0.42),  (0.06, 0, 0.52),  'RIG_hips'),
    ('RIG_neck1',  (0.06, 0, 0.52),  (0.085, 0, 0.60), 'RIG_chest'),
    ('RIG_neck2',  (0.085, 0, 0.60), (0.10, 0, 0.67),  'RIG_neck1'),
    ('RIG_head',   (0.10, 0, 0.67),  (0.10, 0, 0.90),  'RIG_neck2'),
    ('RIG_tail',   (-0.13, 0, 0.31), (-0.31, 0, 0.21), 'RIG_hips'),
]
for _s, _k in (('L', 1), ('R', -1)):
    BONES += [
        ('RIG_wing1_' + _s, (0.05, _k * 0.12, 0.52),  (-0.08, _k * 0.17, 0.38),  'RIG_chest'),
        ('RIG_wing2_' + _s, (-0.08, _k * 0.17, 0.38), (-0.25, _k * 0.19, 0.25),  'RIG_wing1_' + _s),
        ('RIG_thigh_' + _s, (0.00, _k * 0.047, 0.34), (0.00, _k * 0.047, 0.21),  'RIG_hips'),
        ('RIG_shin_' + _s,  (0.00, _k * 0.047, 0.21), (0.00, _k * 0.047, 0.06),  'RIG_thigh_' + _s),
        ('RIG_foot_' + _s,  (0.00, _k * 0.047, 0.06), (0.11, _k * 0.047, 0.02),  'RIG_shin_' + _s),
    ]
WEIGHTED = [b[0] for b in BONES if b[0] != 'RIG_root']


def cut_head(o, zc):
    """Coupe le maillage au plan z = zc et jette ce qui est au-dessus (la tête). L'anneau du cou reste ouvert."""
    bm = bmesh.new()
    bm.from_mesh(o.data)
    geom = list(bm.verts) + list(bm.edges) + list(bm.faces)
    bmesh.ops.bisect_plane(bm, geom=geom, dist=1e-6, plane_co=(0, 0, zc), plane_no=(0, 0, 1), clear_outer=True, clear_inner=False)
    loose = [v for v in bm.verts if not v.link_faces]
    bmesh.ops.delete(bm, geom=loose, context='VERTS')
    bm.to_mesh(o.data)
    bm.free()
    o.data.update()


def body_seeds(co, zc):
    x, y, z = co[:, 0], co[:, 1], co[:, 2]
    ay = np.abs(y)
    S = {}
    S['RIG_head'] = np.abs(z - zc) < 3e-4                                        # anneau de coupe : suit la tête
    S['RIG_neck2'] = (z > 0.585) & (z < 0.605) & (ay < 0.11)
    S['RIG_neck1'] = (z > 0.545) & (z < 0.565) & (ay < 0.10)
    S['RIG_chest'] = (z > 0.43) & (z < 0.50) & (ay < 0.085)
    S['RIG_hips'] = (z > 0.27) & (z < 0.42) & (ay < 0.085) & (x > -0.13) & (x < 0.16)
    S['RIG_tail'] = (x < -0.18) & (z < 0.34) & (ay < 0.09)
    for side, sy in (('L', 1.0), ('R', -1.0)):
        yy = sy * y
        s0 = np.array([0.05, sy * 0.12, 0.52]); t1 = np.array([-0.25, sy * 0.19, 0.25])
        d = t1 - s0
        t = ((co - s0) @ d) / float(d @ d)                                       # abscisse le long de l'aile (0 épaule, 1 pointe)
        shell = (yy > 0.14) & (z < 0.52)
        S['RIG_wing1_' + side] = shell & (t < 0.38)
        S['RIG_wing2_' + side] = shell & (t > 0.55)
        S['RIG_foot_' + side] = (z < 0.045) & (yy > 0.0) & (yy < 0.13) & (x > -0.10) & (x < 0.16)
        S['RIG_shin_' + side] = (z > 0.075) & (z < 0.20) & (yy > 0.015) & (yy < 0.09) & (np.abs(x) < 0.05)
        S['RIG_thigh_' + side] = (z > 0.225) & (z < 0.26) & (yy > 0.02) & (yy < 0.09) & (np.abs(x) < 0.05)
    return S


def build_body(glb, collection=None):
    """Importe le corps, coupe la tête, calcule les poids, crée l'armature. Travaille dans la scène courante."""
    o = import_glb(glb)
    o.name = 'GULL_body'
    o.data.name = 'GULL_body'
    print('corps', len(o.data.vertices), 'sommets')
    co0 = coords(o)
    col0 = vertex_colors(o)
    cls0 = classify(col0)
    anchors = head_anchor(co0, cls0, zmin=0.66)
    anchors['hat_col'] = [float(v) for v in col0[(cls0 == 'H') & (co0[:, 2] > 0.66)].mean(0)]
    print('repères du chapeau du corps', {k: (round(v, 3) if not isinstance(v, list) else v) for k, v in anchors.items()})
    cut_head(o, Z_CUT)
    co = coords(o)
    print('après coupe', len(co), 'sommets', 'z max', float(co[:, 2].max()))
    seeds = body_seeds(co, Z_CUT)
    W, names = harmonic_weights(co, mesh_edges(o), seeds)
    W = limit_influences(W, 4)
    apply_weights(o, W, names)
    ao = build_armature('ARM_gull', BONES, collection)
    bind(o, ao)
    ao['anchors'] = json.dumps(anchors)
    ao['z_cut'] = Z_CUT
    return o, ao


def main(glb, out):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    build_body(glb)
    bpy.ops.wm.save_as_mainfile(filepath=os.path.abspath(out))
    print('OK', out)


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
