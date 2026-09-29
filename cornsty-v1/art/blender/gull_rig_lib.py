"""CORNSTY - outils du squelette de la Mouette Higgsfield (corps en pose « A » + têtes d'expression).

Tout part de fichiers GLB générés par Higgsfield (Tripo, remaillage Meshy). Ce module ne dessine rien :
il lit les sommets et leurs couleurs, calcule des poids de peau « harmoniques » (diffusion le long de la surface,
sans dépendre de la proximité dans l'espace, donc l'aile collée au flanc suit l'aile et non le corps),
construit l'armature et sait poser les os par rotations autour des axes du monde (X avant, Y gauche, Z haut).

Dépendances : bpy, numpy, scipy (calcul des poids ; le résultat est stocké dans les groupes de sommets, scipy
n'est plus nécessaire ensuite).
"""
import sys, os, glob, importlib.util, math

_spec = importlib.util.find_spec('bpy')
if _spec and _spec.submodule_search_locations:                    # module bpy de pip : il faut indiquer OCIO
    _root = list(_spec.submodule_search_locations)[0]
    _cfg = glob.glob(os.path.join(_root, '*', 'datafiles', 'colormanagement', 'config.ocio'))
    if _cfg:
        os.environ.setdefault('OCIO', _cfg[0])
        os.environ.setdefault('BLENDER_SYSTEM_RESOURCES', os.path.dirname(os.path.dirname(os.path.dirname(_cfg[0]))))
import bpy, bmesh
import numpy as np
from mathutils import Vector, Matrix, Quaternion


# ---------------------------------------------------------------- lecture d'un GLB

def import_glb(path):
    """Importe un GLB et renvoie le plus gros maillage, dé-parenté, coordonnées du monde cuites dans les sommets."""
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=os.path.abspath(path))
    new = [o for o in bpy.data.objects if o not in before]
    meshes = [o for o in new if o.type == 'MESH']
    o = max(meshes, key=lambda x: len(x.data.vertices))
    mw = o.matrix_world.copy()
    o.parent = None
    o.data.transform(mw)
    o.matrix_world = Matrix.Identity(4)
    o.rotation_mode = 'XYZ'
    for x in new:                                                  # supprime les vides et maillages annexes de l'import
        if x is not o:
            bpy.data.objects.remove(x, do_unlink=True)
    return o


def use_collection(name):
    """Crée (ou retrouve) une collection dans la scène active et la rend active : les imports y atterrissent."""
    sc = bpy.context.scene
    col = bpy.data.collections.get(name) or bpy.data.collections.new(name)
    if col.name not in [c.name for c in sc.collection.children]:
        sc.collection.children.link(col)

    def find(lc):
        if lc.collection == col:
            return lc
        for c in lc.children:
            r = find(c)
            if r:
                return r
        return None
    lc = find(bpy.context.view_layer.layer_collection)
    if lc:
        bpy.context.view_layer.active_layer_collection = lc
    return col


def base_image(o):
    for m in o.data.materials:
        if m and m.use_nodes:
            for nd in m.node_tree.nodes:
                if nd.type == 'BSDF_PRINCIPLED':
                    l = nd.inputs['Base Color'].links
                    if l and l[0].from_node.type == 'TEX_IMAGE':
                        return l[0].from_node.image
    return None


def coords(o):
    me = o.data
    n = len(me.vertices)
    co = np.empty(n * 3, dtype=np.float32)
    me.vertices.foreach_get('co', co)
    return co.reshape(n, 3)


def set_coords(o, co):
    o.data.vertices.foreach_set('co', np.ascontiguousarray(co, dtype=np.float32).ravel())
    o.data.update()


def vertex_colors(o):
    """Couleur linéaire de la texture de base au point de chaque sommet (n, 3)."""
    me = o.data
    n = len(me.vertices)
    img = base_image(o)
    uv = np.empty(len(me.loops) * 2, dtype=np.float32)
    me.uv_layers.active.data.foreach_get('uv', uv)
    uv = uv.reshape(-1, 2)
    vi = np.empty(len(me.loops), dtype=np.int32)
    me.loops.foreach_get('vertex_index', vi)
    vuv = np.zeros((n, 2), dtype=np.float32)
    vuv[vi] = uv
    w, h = img.size
    px = np.empty(w * h * 4, dtype=np.float32)
    img.pixels.foreach_get(px)
    px = px.reshape(h, w, 4)[:, :, :3]
    ix = np.clip((vuv[:, 0] % 1.0 * (w - 1)).astype(int), 0, w - 1)
    iy = np.clip((vuv[:, 1] % 1.0 * (h - 1)).astype(int), 0, h - 1)
    return px[iy, ix]


def classify(col):
    """c crème, H bleu du chapeau, O orange (bec), # sombre (lunettes, noeud, pattes), P rose (langue)."""
    r, g, b = col[:, 0], col[:, 1], col[:, 2]
    mxc, mnc = col.max(1), col.min(1)
    sat = (mxc - mnc) / np.maximum(mxc, 1e-4)
    cls = np.full(len(col), 'c')
    cls[mxc < 0.16] = '#'
    cls[(b > r * 1.3) & (b > g * 1.15) & (mxc >= 0.16)] = 'H'
    cls[(r > 3.0 * b) & (g > 0.25 * r) & (sat > 0.78) & (mxc >= 0.16)] = 'O'
    cls[(r > 2.0 * g) & (b > 0.35 * g) & (r > 0.3) & (sat > 0.6) & (cls == 'c')] = 'P'
    return cls


def mesh_edges(o):
    me = o.data
    e = np.empty(len(me.edges) * 2, dtype=np.int32)
    me.edges.foreach_get('vertices', e)
    return e.reshape(-1, 2)


# ---------------------------------------------------------------- poids harmoniques

def weld_ids(co, tol=2e-5):
    """Identifiant soudé par sommet : le GLB duplique les sommets aux coutures de dépliage, on les recolle pour le graphe."""
    key = np.round(co / tol).astype(np.int64)
    _, inv = np.unique(key, axis=0, return_inverse=True)
    return inv.reshape(-1)


def _graph(co, edges):
    wid = weld_ids(co)
    k = int(wid.max()) + 1
    P = np.zeros((k, 3)); cnt = np.zeros(k)
    np.add.at(P, wid, co); np.add.at(cnt, wid, 1)
    P /= cnt[:, None]
    a, b = wid[edges[:, 0]], wid[edges[:, 1]]
    m = a != b
    lo, hi = np.minimum(a[m], b[m]), np.maximum(a[m], b[m])
    key = np.unique(lo.astype(np.int64) * k + hi)
    lo, hi = (key // k).astype(int), (key % k).astype(int)
    d = np.linalg.norm(P[lo] - P[hi], axis=1)
    return wid, k, P, lo, hi, 1.0 / np.maximum(d, 2e-3)


def _solve_scipy(k, lo, hi, w, fixed, B):
    from scipy import sparse
    from scipy.sparse.linalg import splu
    W = sparse.coo_matrix((w, (lo, hi)), shape=(k, k))
    W = (W + W.T).tocsr()
    L = (sparse.diags(np.asarray(W.sum(1)).ravel()) - W).tocsr()
    free = np.where(~fixed)[0]
    fix = np.where(fixed)[0]
    Lff = L[free][:, free].tocsc() + sparse.identity(len(free), format='csc') * 1e-9
    rhs = -(L[free][:, fix] @ B[fix])
    B[free] = splu(Lff).solve(rhs)
    return B


def _solve_numpy(k, lo, hi, w, fixed, B, tol=1e-7, maxit=6000):
    """Même système, gradient conjugué préconditionné (Jacobi) : aucune dépendance en dehors de numpy."""
    free = np.where(~fixed)[0]
    nf = len(free)
    fi = -np.ones(k, dtype=int)
    fi[free] = np.arange(nf)
    ff = ~fixed[lo] & ~fixed[hi]
    af, bf, wf = fi[lo[ff]], fi[hi[ff]], w[ff]
    deg = np.bincount(lo, weights=w, minlength=k) + np.bincount(hi, weights=w, minlength=k)
    diag = deg[free] + 1e-9
    G = B.shape[1]
    rhs = np.zeros((nf, G))
    m1 = ~fixed[lo] & fixed[hi]
    m2 = fixed[lo] & ~fixed[hi]
    np.add.at(rhs, fi[lo[m1]], w[m1, None] * B[hi[m1]])
    np.add.at(rhs, fi[hi[m2]], w[m2, None] * B[lo[m2]])

    def matvec(x):
        return diag * x - np.bincount(af, weights=wf * x[bf], minlength=nf) - np.bincount(bf, weights=wf * x[af], minlength=nf)

    X = np.zeros((nf, G))
    for c in range(G):
        b = rhs[:, c]
        if not b.any():
            continue
        x = np.zeros(nf); r = b.copy(); z = r / diag; p = z.copy(); rz = float(r @ z); bn = float(np.linalg.norm(b))
        for _ in range(maxit):
            Ap = matvec(p)
            al = rz / float(p @ Ap)
            x += al * p; r -= al * Ap
            if float(np.linalg.norm(r)) < tol * bn:
                break
            z = r / diag; rz2 = float(r @ z); p = z + (rz2 / rz) * p; rz = rz2
        X[:, c] = x
    B[free] = X
    return B


def harmonic_weights(co, edges, seeds):
    """Poids de peau par diffusion sur la surface.

    seeds : dict nom -> tableau booléen (n,) des sommets sûrs (poids 1 pour ce groupe, 0 pour les autres).
    Renvoie un tableau (n, G) normalisé et la liste des noms de groupes.
    """
    from_scipy = os.environ.get('CS_NO_SCIPY') != '1'
    wid, k, P, lo, hi, w = _graph(co, edges)
    names = list(seeds.keys())
    G = len(names)
    B = np.zeros((k, G))
    fixed = np.zeros(k, dtype=bool)
    for gi, nm in enumerate(names):
        ids = np.unique(wid[seeds[nm]])
        ids = ids[~fixed[ids]]                                     # premier groupe servi gagne en cas de conflit
        B[ids, gi] = 1.0
        fixed[ids] = True
    try:
        if not from_scipy:
            raise ImportError
        B = _solve_scipy(k, lo, hi, w, fixed, B)
    except ImportError:
        B = _solve_numpy(k, lo, hi, w, fixed, B)
    # composantes sans aucun germe : groupe du germe le plus proche dans l'espace
    ncomp, lab = _components(k, lo, hi)
    seeded = np.zeros(ncomp, dtype=bool)
    seeded[np.unique(lab[fixed])] = True
    if not seeded.all():
        fix = np.where(fixed)[0]
        for c in np.where(~seeded)[0]:
            idx = np.where(lab == c)[0]
            d2 = ((P[idx][:, None, :] - P[fix][None, :, :]) ** 2).sum(-1)
            j = fix[np.argmin(d2, axis=1)]
            B[idx] = 0
            B[idx, np.argmax(B[j], axis=1)] = 1.0
    B = np.clip(B, 0, 1)
    s = B.sum(1, keepdims=True)
    B = np.where(s > 1e-9, B / np.maximum(s, 1e-9), 0)
    return B[wid], names


def _components(k, lo, hi):
    """Composantes connexes du graphe (numpy pur, propagation d'étiquettes)."""
    lab = np.arange(k)
    while True:
        m = np.minimum(lab[lo], lab[hi])
        new = lab.copy()
        np.minimum.at(new, lo, m)
        np.minimum.at(new, hi, m)
        new = new[new]                                             # raccourcit les chaînes d'étiquettes
        if (new == lab).all():
            break
        lab = new
    u, inv = np.unique(lab, return_inverse=True)
    return len(u), inv


def limit_influences(Wt, k=4, cut=0.012):
    """Garde les k plus gros poids par sommet (limite de l'export glTF), renormalise."""
    Wt = Wt.copy()
    order = np.argsort(-Wt, axis=1)
    mask = np.zeros_like(Wt, dtype=bool)
    rows = np.arange(len(Wt))[:, None]
    mask[rows, order[:, :k]] = True
    Wt[~mask] = 0
    Wt[Wt < cut] = 0
    s = Wt.sum(1, keepdims=True)
    return np.where(s > 0, Wt / np.maximum(s, 1e-9), Wt)


def apply_weights(o, Wt, names):
    for nm in names:
        if nm in o.vertex_groups:
            o.vertex_groups.remove(o.vertex_groups[nm])
    groups = [o.vertex_groups.new(name=nm) for nm in names]
    for gi, g in enumerate(groups):
        idx = np.where(Wt[:, gi] > 0)[0]
        for i in idx:
            g.add([int(i)], float(Wt[i, gi]), 'REPLACE')


# ---------------------------------------------------------------- armature

def build_armature(name, bones, collection=None):
    """bones : liste ordonnée (nom, tête, queue, parent|None). Repère : X avant, Y gauche, Z haut."""
    arm = bpy.data.armatures.new(name)
    ao = bpy.data.objects.new(name, arm)
    (collection or bpy.context.scene.collection).objects.link(ao)
    bpy.context.view_layer.objects.active = ao
    ao.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT')
    for nm, h, t, par in bones:
        eb = arm.edit_bones.new(nm)
        eb.head, eb.tail = Vector(h), Vector(t)
        eb.roll = 0.0
        if par:
            eb.parent = arm.edit_bones[par]
    bpy.ops.object.mode_set(mode='OBJECT')
    arm.display_type = 'OCTAHEDRAL'
    return ao


def bind(mesh_obj, arm_obj):
    mesh_obj.parent = arm_obj
    mesh_obj.matrix_parent_inverse = arm_obj.matrix_world.inverted()
    for m in list(mesh_obj.modifiers):
        if m.type == 'ARMATURE':
            mesh_obj.modifiers.remove(m)
    md = mesh_obj.modifiers.new('Armature', 'ARMATURE')
    md.object = arm_obj


def rest_rot(arm_obj, bone_name):
    return arm_obj.data.bones[bone_name].matrix_local.to_3x3()


def pose_rots(arm_obj, bone_name, rots):
    """Pose un os par une suite de rotations autour d'axes du MONDE (X avant, Y gauche, Z haut), appliquées dans l'ordre.
    Exprimée dans le repère de repos de l'os : la rotation d'un parent entraîne celle de ses enfants comme attendu."""
    pb = arm_obj.pose.bones[bone_name]
    R = rest_rot(arm_obj, bone_name)
    Qw = Matrix.Identity(3)
    for axis, deg in rots:
        Qw = Quaternion(Vector(axis).normalized(), math.radians(deg)).to_matrix() @ Qw
    loc = R.inverted() @ Qw @ R
    pb.rotation_mode = 'QUATERNION'
    pb.rotation_quaternion = loc.to_quaternion()


def pose_reset(arm_obj):
    for pb in arm_obj.pose.bones:
        pb.rotation_mode = 'QUATERNION'
        pb.rotation_quaternion = (1, 0, 0, 0)
        pb.location = (0, 0, 0)
        pb.scale = (1, 1, 1)


# ---------------------------------------------------------------- repères du chapeau et du bec (alignement des têtes)

def head_anchor(co, cls, zmin=None):
    """Repères du chapeau (sommets bleus) et du bec (sommets orange) : centre horizontal, rayon équivalent, hauteur de
    référence, cap du bec. Le rayon vient de l'écart-type horizontal (insensible à la rotation de la tête)."""
    H = cls == 'H'
    if zmin is not None:
        H = H & (co[:, 2] > zmin)
    h = co[H]
    lo, hi = np.percentile(h[:, :2], [1, 99], axis=0)
    c = (lo + hi) / 2
    ev = np.linalg.eigvalsh(np.cov((h[:, :2] - h[:, :2].mean(0)).T))
    r_eff = float(2.0 * (ev[0] * ev[1]) ** 0.25)
    zlo, zhi = np.percentile(h[:, 2], [3, 97])
    O = cls == 'O'
    if zmin is not None:
        O = O & (co[:, 2] > zmin)
    ob = co[O][:, :2] - c
    dist = np.linalg.norm(ob, axis=1)
    far = ob[dist >= np.percentile(dist, 50)]
    yaw = float(math.degrees(math.atan2(far[:, 1].mean(), far[:, 0].mean())))
    return {'cx': float(c[0]), 'cy': float(c[1]), 'r_eff': r_eff, 'z_ref': float((zlo + zhi) / 2), 'z_lo': float(zlo), 'z_hi': float(zhi), 'beak_yaw': yaw}


def polar_profile(pts_xy, center, bins=48):
    """Rayon extérieur en fonction de l'angle autour d'un centre (bords bouchés par interpolation circulaire)."""
    d = pts_xy - np.asarray(center)
    ang = np.arctan2(d[:, 1], d[:, 0])
    rad = np.linalg.norm(d, axis=1)
    idx = ((ang + math.pi) / (2 * math.pi) * bins).astype(int) % bins
    prof = np.full(bins, np.nan)
    for b in range(bins):
        m = idx == b
        if m.any():
            prof[b] = rad[m].max()
    ok = ~np.isnan(prof)
    xs = np.arange(bins)
    prof = np.interp(xs, xs[ok], prof[ok], period=bins)
    return prof


def profile_at(prof, ang):
    bins = len(prof)
    f = (ang + math.pi) / (2 * math.pi) * bins - 0.5
    i0 = np.floor(f).astype(int)
    t = f - i0
    return prof[i0 % bins] * (1 - t) + prof[(i0 + 1) % bins] * t


# ---------------------------------------------------------------- matière commune (corps et têtes)

def unify_material(mat, normal_strength=0.5, rough_base=0.52, rough_dark=0.16, rough_orange=0.30):
    """Remplace la brillance générée (différente sur chaque maillage) par une règle commune tirée de la couleur :
    satiné partout, brillant sur le noir (yeux, verres), un peu brillant sur l'orange (bec). Plus de métal.
    Sans cela le corps et les têtes ne se raccordent pas (reflets différents au niveau du cou)."""
    nt = mat.node_tree
    nodes, links = nt.nodes, nt.links
    bsdf = next(n for n in nodes if n.type == 'BSDF_PRINCIPLED')
    src = bsdf.inputs['Base Color'].links[0].from_node
    for nm in ('Metallic', 'Roughness'):
        for l in list(bsdf.inputs[nm].links):
            links.remove(l)
    for n in [n for n in nodes if n.type == 'SEPARATE_COLOR' and n.label != 'CS_hsv']:
        nodes.remove(n)
    for n in [n for n in nodes if n.type == 'TEX_IMAGE' and n.image and ('metallic_roughness' in n.image.name or n.image.name.startswith('ORM_'))]:
        nodes.remove(n)
    bsdf.inputs['Metallic'].default_value = 0.0
    bw = nodes.new('ShaderNodeRGBToBW')
    links.new(src.outputs['Color'], bw.inputs['Color'])
    m1 = nodes.new('ShaderNodeMapRange')
    m1.clamp = True
    m1.inputs['From Min'].default_value, m1.inputs['From Max'].default_value = 0.03, 0.14
    m1.inputs['To Min'].default_value, m1.inputs['To Max'].default_value = rough_dark, rough_base
    links.new(bw.outputs['Val'], m1.inputs['Value'])
    hsv = nodes.new('ShaderNodeSeparateColor')
    hsv.mode = 'HSV'
    hsv.label = 'CS_hsv'
    links.new(src.outputs['Color'], hsv.inputs['Color'])
    m2 = nodes.new('ShaderNodeMapRange')
    m2.clamp = True
    m2.inputs['From Min'].default_value, m2.inputs['From Max'].default_value = 0.6, 0.85
    m2.inputs['To Min'].default_value, m2.inputs['To Max'].default_value = rough_base, rough_orange
    links.new(hsv.outputs['Green'], m2.inputs['Value'])
    mn = nodes.new('ShaderNodeMath')
    mn.operation = 'MINIMUM'
    links.new(m1.outputs['Result'], mn.inputs[0])
    links.new(m2.outputs['Result'], mn.inputs[1])
    links.new(mn.outputs['Value'], bsdf.inputs['Roughness'])
    for n in nodes:
        if n.type == 'NORMAL_MAP':
            n.inputs['Strength'].default_value = normal_strength


def repair_dark_specks(o, zone, radius=10, dark=0.40):
    """Efface les points sombres parasites de la texture de base autour des sommets choisis par `zone(co, colors) -> masque`.
    Chaque pixel sombre d'une fenêtre autour du point de dépliage est remplacé par la médiane des pixels clairs voisins."""
    me = o.data
    co = coords(o)
    col = vertex_colors(o)
    m = zone(co, col)
    if not m.any():
        return 0
    img = base_image(o)
    w, h = img.size
    uv = np.empty(len(me.loops) * 2, dtype=np.float32)
    me.uv_layers.active.data.foreach_get('uv', uv)
    uv = uv.reshape(-1, 2)
    vi = np.empty(len(me.loops), dtype=np.int32)
    me.loops.foreach_get('vertex_index', vi)
    vuv = np.zeros((len(co), 2), dtype=np.float32)
    vuv[vi] = uv
    px = np.empty(w * h * 4, dtype=np.float32)
    img.pixels.foreach_get(px)
    px = px.reshape(h, w, 4)
    n = 0
    seen = set()
    for i in np.where(m)[0]:
        cx, cy = int((vuv[i, 0] % 1.0) * (w - 1)), int((vuv[i, 1] % 1.0) * (h - 1))
        key = (cx // radius, cy // radius)
        if key in seen:
            continue
        seen.add(key)
        x0, x1, y0, y1 = max(cx - radius, 0), min(cx + radius + 1, w), max(cy - radius, 0), min(cy + radius + 1, h)
        win = px[y0:y1, x0:x1, :3]
        lum = win.max(-1)
        ok = lum > 0.6 * np.median(lum[lum > dark]) if (lum > dark).any() else None
        if ok is None or ok.sum() < 8:
            continue
        good = np.median(win[ok], axis=0)
        bad = lum <= dark * 1.4
        win[bad] = good
        n += int(bad.sum())
    img.pixels.foreach_set(px.ravel())
    img.update()
    img.pack()
    return n


def smooth_region(o, center, radius, iters=6, lam=0.7):
    """Lisse localement le maillage autour d'un point (moyenne des voisins, fondu vers le bord de la zone) :
    efface un pli ou une rainure de quelques millimètres laissée par le remaillage."""
    co = coords(o).astype(np.float64)
    ed = mesh_edges(o)
    wid = weld_ids(co.astype(np.float32))
    k = int(wid.max()) + 1
    P = np.zeros((k, 3)); cnt = np.zeros(k)
    np.add.at(P, wid, co); np.add.at(cnt, wid, 1)
    P /= cnt[:, None]
    a, b = wid[ed[:, 0]], wid[ed[:, 1]]
    m = a != b
    a, b = a[m], b[m]
    d = np.linalg.norm(P - np.asarray(center), axis=1)
    wt = np.clip(1.0 - d / radius, 0, 1)
    wt = wt * wt * (3 - 2 * wt)
    for _ in range(iters):
        S = np.zeros((k, 3)); n = np.zeros(k)
        np.add.at(S, a, P[b]); np.add.at(n, a, 1)
        np.add.at(S, b, P[a]); np.add.at(n, b, 1)
        avg = np.where(n[:, None] > 0, S / np.maximum(n[:, None], 1), P)
        P = P + (lam * wt)[:, None] * (avg - P)
    co_new = P[wid]
    set_coords(o, co_new)
