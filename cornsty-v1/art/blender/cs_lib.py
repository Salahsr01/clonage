"""CORNSTY - bibliotheque Blender partagee (materiaux, maillages, formes organiques, logo, pochons).

Utilisee par build_final.py (scene finale « gouache brillante »). Testee hors interface (bpy 5.0) puis dans le Blender du
proprietaire (5.1). Unites : metres, Z vers le haut, le kiosque regarde vers -Y (les cameras regardent vers +Y).
Les ressources (art/blender/) sont lues dans `ASSET_DIR` si defini, sinon telechargees depuis GitHub.
"""
import bpy, bmesh, math, os, re, random, tempfile, urllib.request
from mathutils import Vector, Matrix, Euler, Quaternion

RAW = 'https://raw.githubusercontent.com/Salahsr01/clonage/claude/elegant-newton-96gjm5/cornsty-v1/art/blender/'
ASSET_DIR = globals().get('ASSET_DIR')
CACHE = os.path.join(tempfile.gettempdir(), 'cornsty_assets')
PREFIXES = ('HERO_', 'PRP_', 'ENV_', 'LGT_', 'CAM_', 'TGT_', 'MAT_', 'RIG_', 'FX_')


# ------------------------------------------------------------------ ressources, couleurs
def asset(rel):
    if ASSET_DIR:
        p = os.path.join(ASSET_DIR, rel)
        if os.path.exists(p):
            return p
    dst = os.path.join(CACHE, rel)
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    if not os.path.exists(dst) or os.path.getsize(dst) == 0:
        urllib.request.urlretrieve(RAW + rel + '?v=1', dst)
    return dst


def lin(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def hexcol(h, a=1.0):
    h = h.lstrip('#')
    r, g, b = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return (lin(r), lin(g), lin(b), a)


# ------------------------------------------------------------------ scene, collections
def fresh(scene_name):
    old = bpy.data.scenes.get(scene_name)
    if old is not None:
        other = next((s for s in bpy.data.scenes if s != old), None)
        try:
            for w in bpy.context.window_manager.windows:
                if w.scene == old and other is not None:
                    w.scene = other
        except Exception:
            pass
        for o in list(old.objects):
            bpy.data.objects.remove(o, do_unlink=True)
        bpy.data.scenes.remove(old)
    for c in list(bpy.data.collections):
        if c.name.startswith('COL_'):
            bpy.data.collections.remove(c)
    for store in (bpy.data.objects, bpy.data.meshes, bpy.data.curves, bpy.data.lights, bpy.data.cameras, bpy.data.materials):
        for d in list(store):
            if d.name.startswith(PREFIXES) and d.users == 0:
                store.remove(d)
    return bpy.data.scenes.new(scene_name)


def make_col(sc, name):
    c = bpy.data.collections.new(name)
    sc.collection.children.link(c)
    return c


# ------------------------------------------------------------------ materiaux
def _set(node, key, val):
    try:
        node.inputs[key].default_value = val
    except (KeyError, TypeError):
        pass


def new_mat(name, col, rough=0.6, metal=0.0, coat=0.0, coat_rough=0.12, sheen=0.0, spec=0.5, emit=None, emit_s=0.0,
            sss=0.0, sss_radius=(1.0, 0.5, 0.35), sss_scale=0.03, trans=0.0, ior=1.45, alpha=1.0):
    old = bpy.data.materials.get(name)
    if old is not None:
        bpy.data.materials.remove(old)
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes.get('Principled BSDF')
    _set(b, 'Base Color', hexcol(col) if isinstance(col, str) else col)
    _set(b, 'Roughness', rough)
    _set(b, 'Metallic', metal)
    _set(b, 'Coat Weight', coat)
    _set(b, 'Coat Roughness', coat_rough)
    _set(b, 'Sheen Weight', sheen)
    _set(b, 'Specular IOR Level', spec)
    _set(b, 'IOR', ior)
    if sss > 0:
        _set(b, 'Subsurface Weight', sss)
        _set(b, 'Subsurface Radius', sss_radius)
        _set(b, 'Subsurface Scale', sss_scale)
    if trans > 0:
        _set(b, 'Transmission Weight', trans)
    if alpha < 1.0:
        _set(b, 'Alpha', alpha)
    if emit:
        _set(b, 'Emission Color', hexcol(emit))
        _set(b, 'Emission Strength', emit_s)
    return m


def _ramp(nt, c1, c2, p1=0.0, p2=1.0, interp='LINEAR'):
    r = nt.nodes.new('ShaderNodeValToRGB')
    r.color_ramp.interpolation = interp
    e = r.color_ramp.elements
    e[0].position, e[0].color = p1, hexcol(c1)
    e[1].position, e[1].color = p2, hexcol(c2)
    return r


def add_brush_bump(m, scale=140.0, strength=0.04, dist=0.003):
    """Grain de pinceau / feutre : petit relief de bruit etire, pour casser le lisse du rendu numerique."""
    nt = m.node_tree
    b = nt.nodes['Principled BSDF']
    if b.inputs['Normal'].is_linked:
        return
    L = nt.links.new
    tc = nt.nodes.new('ShaderNodeTexCoord')
    mp = nt.nodes.new('ShaderNodeMapping')
    mp.inputs['Scale'].default_value = (1.0, 0.35, 1.0)
    no = nt.nodes.new('ShaderNodeTexNoise')
    no.inputs['Scale'].default_value = scale
    no.inputs['Detail'].default_value = 5.0
    bp = nt.nodes.new('ShaderNodeBump')
    bp.inputs['Strength'].default_value = strength
    bp.inputs['Distance'].default_value = dist
    L(tc.outputs['Object'], mp.inputs['Vector'])
    L(mp.outputs['Vector'], no.inputs['Vector'])
    L(no.outputs['Fac'], bp.inputs['Height'])
    L(bp.outputs['Normal'], b.inputs['Normal'])


def wood_mat(name, c1, c2, rough=0.72, grain=(1.0, 8.0, 1.0), bump=0.12, scale=3.5):
    m = new_mat(name, c1, rough, sheen=0.15)
    nt = m.node_tree
    b = nt.nodes['Principled BSDF']
    L = nt.links.new
    tc = nt.nodes.new('ShaderNodeTexCoord')
    mp = nt.nodes.new('ShaderNodeMapping')
    mp.inputs['Scale'].default_value = grain
    no = nt.nodes.new('ShaderNodeTexNoise')
    no.inputs['Scale'].default_value = scale
    no.inputs['Detail'].default_value = 7.0
    no.inputs['Roughness'].default_value = 0.55
    rp = _ramp(nt, c1, c2, 0.35, 0.65)
    bp = nt.nodes.new('ShaderNodeBump')
    bp.inputs['Strength'].default_value = bump
    bp.inputs['Distance'].default_value = 0.01
    L(tc.outputs['Object'], mp.inputs['Vector'])
    L(mp.outputs['Vector'], no.inputs['Vector'])
    L(no.outputs['Fac'], rp.inputs['Fac'])
    L(rp.outputs['Color'], b.inputs['Base Color'])
    L(no.outputs['Fac'], bp.inputs['Height'])
    L(bp.outputs['Normal'], b.inputs['Normal'])
    return m


def stripe_mat(name, c1, c2, period, axis='X', rough=0.8, sheen=0.6, offset=0.0, sss=0.0):
    m = new_mat(name, c1, rough, sheen=sheen, sss=sss, sss_scale=0.02)
    nt = m.node_tree
    b = nt.nodes['Principled BSDF']
    L = nt.links.new
    tc = nt.nodes.new('ShaderNodeTexCoord')
    sp = nt.nodes.new('ShaderNodeSeparateXYZ')
    ad = nt.nodes.new('ShaderNodeMath')
    ad.operation = 'ADD'
    ad.inputs[1].default_value = offset
    ml = nt.nodes.new('ShaderNodeMath')
    ml.operation = 'MULTIPLY'
    ml.inputs[1].default_value = 1.0 / period
    fr = nt.nodes.new('ShaderNodeMath')
    fr.operation = 'FRACT'
    rp = _ramp(nt, c1, c2, 0.0, 0.5, 'CONSTANT')
    L(tc.outputs['Object'], sp.inputs['Vector'])
    L(sp.outputs[axis], ad.inputs[0])
    L(ad.outputs['Value'], ml.inputs[0])
    L(ml.outputs['Value'], fr.inputs[0])
    L(fr.outputs['Value'], rp.inputs['Fac'])
    L(rp.outputs['Color'], b.inputs['Base Color'])
    add_brush_bump(m, 90.0, 0.05, 0.004)
    return m


def band_mat(name, base, band, z_ranges, rough=0.7, sheen=0.5, axis='Z'):
    """Bandes de couleur (rayures d'un chapeau) : `z_ranges` = [(z0, z1), ...] en coordonnees objet."""
    m = new_mat(name, base, rough, sheen=sheen)
    nt = m.node_tree
    b = nt.nodes['Principled BSDF']
    L = nt.links.new
    tc = nt.nodes.new('ShaderNodeTexCoord')
    sp = nt.nodes.new('ShaderNodeSeparateXYZ')
    L(tc.outputs['Object'], sp.inputs['Vector'])
    mask = None
    for z0, z1 in z_ranges:
        gt = nt.nodes.new('ShaderNodeMath')
        gt.operation = 'GREATER_THAN'
        gt.inputs[1].default_value = z0
        lt = nt.nodes.new('ShaderNodeMath')
        lt.operation = 'LESS_THAN'
        lt.inputs[1].default_value = z1
        mu = nt.nodes.new('ShaderNodeMath')
        mu.operation = 'MULTIPLY'
        L(sp.outputs[axis], gt.inputs[0])
        L(sp.outputs[axis], lt.inputs[0])
        L(gt.outputs['Value'], mu.inputs[0])
        L(lt.outputs['Value'], mu.inputs[1])
        if mask is None:
            mask = mu
        else:
            ad = nt.nodes.new('ShaderNodeMath')
            ad.operation = 'MAXIMUM'
            L(mask.outputs['Value'], ad.inputs[0])
            L(mu.outputs['Value'], ad.inputs[1])
            mask = ad
    rp = _ramp(nt, base, band, 0.0, 1.0, 'LINEAR')
    L(mask.outputs['Value'], rp.inputs['Fac'])
    L(rp.outputs['Color'], b.inputs['Base Color'])
    add_brush_bump(m, 120.0, 0.05, 0.003)
    return m


def wear_mat(name, paint, bare, rough=0.45, coat=0.25, wear_scale=9.0, edge=3.0, amount=1.4):
    """Peinture ecaillee : elle part sur les aretes (pointiness, Cycles) et par petites plaques (bruit)."""
    m = new_mat(name, paint, rough, coat=coat, coat_rough=0.2, spec=0.5)
    nt = m.node_tree
    b = nt.nodes['Principled BSDF']
    L = nt.links.new
    gm = nt.nodes.new('ShaderNodeNewGeometry')
    tc = nt.nodes.new('ShaderNodeTexCoord')
    no = nt.nodes.new('ShaderNodeTexNoise')
    no.inputs['Scale'].default_value = wear_scale
    no.inputs['Detail'].default_value = 6.0
    e1 = nt.nodes.new('ShaderNodeMath')
    e1.operation = 'SUBTRACT'
    e1.inputs[1].default_value = 0.5
    e2 = nt.nodes.new('ShaderNodeMath')
    e2.operation = 'MULTIPLY'
    e2.inputs[1].default_value = edge
    n1 = nt.nodes.new('ShaderNodeMath')
    n1.operation = 'SUBTRACT'
    n1.inputs[1].default_value = 0.5
    n2 = nt.nodes.new('ShaderNodeMath')
    n2.operation = 'MULTIPLY'
    n2.inputs[1].default_value = amount
    ad = nt.nodes.new('ShaderNodeMath')
    ad.operation = 'ADD'
    rp = _ramp(nt, paint, bare, 0.42, 0.52)
    L(gm.outputs['Pointiness'], e1.inputs[0])
    L(e1.outputs['Value'], e2.inputs[0])
    L(tc.outputs['Object'], no.inputs['Vector'])
    L(no.outputs['Fac'], n1.inputs[0])
    L(n1.outputs['Value'], n2.inputs[0])
    L(e2.outputs['Value'], ad.inputs[0])
    L(n2.outputs['Value'], ad.inputs[1])
    L(ad.outputs['Value'], rp.inputs['Fac'])
    L(rp.outputs['Color'], b.inputs['Base Color'])
    return m


def sand_mat(name, c1='#CF8942', c2='#F3C173', cracks=False, bump=0.12, wave_scale=3.2):
    m = new_mat(name, '#D9A55E', 0.95)
    nt = m.node_tree
    b = nt.nodes['Principled BSDF']
    L = nt.links.new
    tc = nt.nodes.new('ShaderNodeTexCoord')
    n1 = nt.nodes.new('ShaderNodeTexNoise')
    n1.inputs['Scale'].default_value = 1.3
    n1.inputs['Detail'].default_value = 4.0
    rp = _ramp(nt, c1, c2, 0.35, 0.7)
    wv = nt.nodes.new('ShaderNodeTexWave')
    wv.wave_type = 'BANDS'
    wv.inputs['Scale'].default_value = wave_scale
    wv.inputs['Distortion'].default_value = 5.0
    wv.inputs['Detail'].default_value = 2.0
    bp = nt.nodes.new('ShaderNodeBump')
    bp.inputs['Strength'].default_value = bump
    bp.inputs['Distance'].default_value = 0.02
    L(tc.outputs['Object'], n1.inputs['Vector'])
    L(tc.outputs['Object'], wv.inputs['Vector'])
    L(n1.outputs['Fac'], rp.inputs['Fac'])
    L(wv.outputs['Fac'], bp.inputs['Height'])
    if cracks:
        vo = nt.nodes.new('ShaderNodeTexVoronoi')
        vo.feature = 'DISTANCE_TO_EDGE'
        vo.inputs['Scale'].default_value = 2.6
        cr = _ramp(nt, '#8E5E34', '#FFFFFF', 0.0, 0.028)
        mx = nt.nodes.new('ShaderNodeMix')
        mx.data_type = 'RGBA'
        mx.blend_type = 'MULTIPLY'
        mx.inputs[0].default_value = 1.0
        L(tc.outputs['Object'], vo.inputs['Vector'])
        L(vo.outputs['Distance'], cr.inputs['Fac'])
        L(rp.outputs['Color'], mx.inputs[6])
        L(cr.outputs['Color'], mx.inputs[7])
        L(mx.outputs[2], b.inputs['Base Color'])
        ad = nt.nodes.new('ShaderNodeMath')
        ad.operation = 'MULTIPLY'
        ad.inputs[1].default_value = 3.0
        sb = nt.nodes.new('ShaderNodeMath')
        sb.operation = 'SUBTRACT'
        L(vo.outputs['Distance'], ad.inputs[0])
        sb.inputs[0].default_value = 1.0
        L(ad.outputs['Value'], sb.inputs[1])
        mh = nt.nodes.new('ShaderNodeMath')
        mh.operation = 'MAXIMUM'
        L(wv.outputs['Fac'], mh.inputs[0])
        L(vo.outputs['Distance'], mh.inputs[1])
        L(wv.outputs['Fac'], bp.inputs['Height'])
    else:
        L(rp.outputs['Color'], b.inputs['Base Color'])
    L(bp.outputs['Normal'], b.inputs['Normal'])
    return m


def pouch_mats(fid, base_hex):
    """Facade = le vrai emballage (rendu de la V1) ; les coins arrondis transparents prennent la couleur de fond."""
    img = bpy.data.images.load(asset('tex/pouch-%s.png' % fid), check_existing=True)
    img.colorspace_settings.name = 'sRGB'
    m = new_mat('MAT_pouch_' + fid, base_hex, 0.42, coat=0.14, coat_rough=0.2, sheen=0.0, spec=0.4)
    nt = m.node_tree
    b = nt.nodes['Principled BSDF']
    L = nt.links.new
    ti = nt.nodes.new('ShaderNodeTexImage')
    ti.image = img
    ti.interpolation = 'Linear'
    ti.extension = 'EXTEND'
    mx = nt.nodes.new('ShaderNodeMix')
    mx.data_type = 'RGBA'
    mx.blend_type = 'MIX'
    mx.inputs[6].default_value = hexcol(base_hex)
    L(ti.outputs['Alpha'], mx.inputs[0])
    L(ti.outputs['Color'], mx.inputs[7])
    L(mx.outputs[2], b.inputs['Base Color'])
    tc = nt.nodes.new('ShaderNodeTexCoord')
    no = nt.nodes.new('ShaderNodeTexNoise')
    no.inputs['Scale'].default_value = 70.0
    no.inputs['Detail'].default_value = 3.0
    bp = nt.nodes.new('ShaderNodeBump')
    bp.inputs['Strength'].default_value = 0.05
    bp.inputs['Distance'].default_value = 0.001
    L(tc.outputs['Object'], no.inputs['Vector'])
    L(no.outputs['Fac'], bp.inputs['Height'])
    L(bp.outputs['Normal'], b.inputs['Normal'])
    back = new_mat('MAT_pouchback_' + fid, base_hex, 0.45, coat=0.1, coat_rough=0.2)
    return m, back


# ------------------------------------------------------------------ maillages de base
CUBE_F = [(0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)]


def _cube_v(s):
    x, y, z = s[0] / 2, s[1] / 2, s[2] / 2
    return [(-x, -y, -z), (x, -y, -z), (x, y, -z), (-x, y, -z), (-x, -y, z), (x, -y, z), (x, y, z), (-x, y, z)]


def boxes_mesh(name, items):
    """items : (centre, taille, rotation_z_deg, inclinaison_x_deg, indice_materiau). Une maille, dimensions vraies en metres."""
    verts, faces, midx = [], [], []
    for c, s, rz, rx, mi in items:
        M = Matrix.Translation(c) @ Matrix.Rotation(math.radians(rz), 4, 'Z') @ Matrix.Rotation(math.radians(rx), 4, 'X')
        base = len(verts)
        verts += [tuple(M @ Vector(v)) for v in _cube_v(s)]
        faces += [tuple(base + i for i in f) for f in CUBE_F]
        midx += [mi] * 6
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], faces)
    me.update()
    me.polygons.foreach_set('material_index', midx)
    return me


def sphere_mesh(name, r=1.0, seg=32, ring=16, scale=(1, 1, 1)):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=seg, v_segments=ring, radius=r)
    if scale != (1, 1, 1):
        bmesh.ops.scale(bm, vec=Vector(scale), verts=bm.verts)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    me.polygons.foreach_set('use_smooth', [True] * len(me.polygons))
    return me


def cyl_mesh(name, r, h, seg=20, r2=None):
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=seg, radius1=r, radius2=(r if r2 is None else r2), depth=h)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    me.polygons.foreach_set('use_smooth', [True] * len(me.polygons))
    return me


def link(o, coll, loc=(0, 0, 0), rot=(0, 0, 0), mats=(), parent=None, scale=None):
    coll.objects.link(o)
    o.location = loc
    o.rotation_euler = Euler(rot, 'XYZ')
    if scale is not None:
        o.scale = scale
    if o.type in ('MESH', 'CURVE'):
        for m in mats:
            o.data.materials.append(m)
    if parent is not None:
        o.parent = parent
    return o


def new_obj(name, data, coll, **kw):
    return link(bpy.data.objects.new(name, data), coll, **kw)


def bevel(o, w=0.006, seg=3, angle=40):
    md = o.modifiers.new('Bevel', 'BEVEL')
    md.width = w
    md.segments = seg
    md.limit_method = 'ANGLE'
    md.angle_limit = math.radians(angle)
    try:
        md.harden_normals = True
    except Exception:
        pass
    if o.type == 'MESH':
        o.data.polygons.foreach_set('use_smooth', [True] * len(o.data.polygons))
    return md


def subsurf(o, levels=2, render=3):
    md = o.modifiers.new('Subsurf', 'SUBSURF')
    md.levels = levels
    md.render_levels = render
    if o.type == 'MESH':
        o.data.polygons.foreach_set('use_smooth', [True] * len(o.data.polygons))
    return md


def smooth_all(o):
    if o.type == 'MESH':
        o.data.polygons.foreach_set('use_smooth', [True] * len(o.data.polygons))


# ------------------------------------------------------------------ formes organiques
def catmull(points, n):
    """Catmull-Rom a travers `points`, n+1 echantillons."""
    P = [Vector(p) for p in points]
    P = [P[0] * 2 - P[1]] + P + [P[-1] * 2 - P[-2]]
    segs = len(P) - 3
    out = []
    for i in range(n + 1):
        t = i / n * segs
        k = min(int(t), segs - 1)
        u = t - k
        p0, p1, p2, p3 = P[k], P[k + 1], P[k + 2], P[k + 3]
        out.append(0.5 * ((2 * p1) + (-p0 + p2) * u + (2 * p0 - 5 * p1 + 4 * p2 - p3) * u * u + (-p0 + 3 * p1 - 3 * p2 + p3) * u ** 3))
    return out


def loft(name, path, radii, seg=28, up=(0, 0, 1), twist=None, cap0=True, cap1=True):
    """Tube le long de `path` (liste de Vector). radii(t) -> (a, b) : demi-axes selon N1 (cote) et N2 (avant). twist(t) -> radians."""
    n = len(path)
    T = [(path[min(i + 1, n - 1)] - path[max(i - 1, 0)]).normalized() for i in range(n)]
    N1 = T[0].cross(Vector(up))
    if N1.length < 1e-4:
        N1 = T[0].cross(Vector((1, 0, 0)))
    N1.normalize()
    N2 = T[0].cross(N1).normalized()
    frames = []
    for i in range(n):
        if i > 0:
            q = T[i - 1].rotation_difference(T[i])
            N1 = (q @ N1).normalized()
            N2 = (q @ N2).normalized()
        f1, f2 = N1, N2
        if twist is not None:
            qt = Quaternion(T[i], twist(i / (n - 1)))
            f1, f2 = qt @ N1, qt @ N2
        frames.append((f1.copy(), f2.copy()))
    bm = bmesh.new()
    rings = []
    for i in range(n):
        a, b = radii(i / (n - 1))
        c = path[i]
        f1, f2 = frames[i]
        rings.append([bm.verts.new(c + f1 * (a * math.cos(2 * math.pi * k / seg)) + f2 * (b * math.sin(2 * math.pi * k / seg))) for k in range(seg)])
    for i in range(n - 1):
        for k in range(seg):
            bm.faces.new((rings[i][k], rings[i][(k + 1) % seg], rings[i + 1][(k + 1) % seg], rings[i + 1][k]))
    if cap0:
        bm.faces.new(rings[0][::-1])
    if cap1:
        bm.faces.new(rings[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    me.polygons.foreach_set('use_smooth', [True] * len(me.polygons))
    return me


def lathe(name, prof, seg=56, cap=False):
    """Surface de revolution autour de Z. prof : [(rayon, z), ...] du centre vers l'exterieur."""
    bm = bmesh.new()
    rings = [[bm.verts.new((r * math.cos(2 * math.pi * k / seg), r * math.sin(2 * math.pi * k / seg), z)) for k in range(seg)] for r, z in prof]
    for i in range(len(prof) - 1):
        for k in range(seg):
            bm.faces.new((rings[i][k], rings[i][(k + 1) % seg], rings[i + 1][(k + 1) % seg], rings[i + 1][k]))
    if prof[0][0] < 1e-6:
        bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-6)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    me.polygons.foreach_set('use_smooth', [True] * len(me.polygons))
    return me


def curve_tube(name, pts, radius, closed=False, res=6, handle='AUTO', taper=None):
    cu = bpy.data.curves.new(name, 'CURVE')
    cu.dimensions = '3D'
    cu.bevel_depth = radius
    cu.bevel_resolution = res
    cu.resolution_u = 12
    try:
        cu.use_fill_caps = True
    except Exception:
        pass
    sp = cu.splines.new('BEZIER')
    sp.bezier_points.add(len(pts) - 1)
    for bp, p in zip(sp.bezier_points, pts):
        bp.co = p
        bp.handle_left_type = bp.handle_right_type = handle
    sp.use_cyclic_u = closed
    return cu


def remesh_union(o, voxel=0.006, smooth_iter=8, smooth_factor=0.55):
    """Fond plusieurs coques recouvrantes en une seule peau lisse (pas de pli a la jonction cou / tete)."""
    md = o.modifiers.new('Remesh', 'REMESH')
    md.mode = 'VOXEL'
    md.voxel_size = voxel
    try:
        md.adaptivity = 0.0
        md.use_smooth_shade = True
    except Exception:
        pass
    sm = o.modifiers.new('Smooth', 'SMOOTH')
    sm.factor = smooth_factor
    sm.iterations = smooth_iter
    return md


def join_meshes(name, meshes_xf):
    """Fusionne plusieurs maillages (mesh, matrice) en un seul maillage, dans un meme repere."""
    bm = bmesh.new()
    for me, M in meshes_xf:
        tmp = bmesh.new()
        tmp.from_mesh(me)
        bmesh.ops.transform(tmp, matrix=M, verts=tmp.verts)
        vmap = {}
        for v in tmp.verts:
            vmap[v.index] = bm.verts.new(v.co)
        for f in tmp.faces:
            bm.faces.new([vmap[v.index] for v in f.verts])
        tmp.free()
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    me.polygons.foreach_set('use_smooth', [True] * len(me.polygons))
    return me


# ------------------------------------------------------------------ pochons et logo (vrais emballages, vrais tracés)
def pouch_mesh(name, W=0.16, H=0.262, T=0.036):
    """Pochon coussin : dos et face soudes sur le pourtour, sceaux plats plisses. Origine : milieu du bas, face vers +Z."""
    top, bot = 0.052, 0.042
    v0, v1 = bot, 1.0 - top
    n_seal, n_body, nx = 14, 78, 56
    ys = [bot * H * j / n_seal for j in range(n_seal)]
    ys += [H * (v0 + (v1 - v0) * j / n_body) for j in range(n_body + 1)]
    ys += [H * (v1 + (1 - v1) * j / n_seal) for j in range(1, n_seal + 1)]
    xs = [(-0.5 + i / nx) * W for i in range(nx + 1)]
    ny = len(ys) - 1
    ridge = 0.0034 * (W / 0.16)

    def zf(x, y):
        u, t = x / (W / 2), y / H
        fade = max(0.0, min(1.0, (1 - abs(u)) * 16.0)) * max(0.0, min(1.0, min(t, 1 - t) * 50.0))
        if t <= v0 or t >= v1:
            ph = y if t <= v0 else H - y
            return fade * (0.0006 + 0.0009 * (0.5 + 0.5 * math.sin(2 * math.pi * ph / ridge))) * (W / 0.16)
        s = (t - v0) / (v1 - v0)
        return T * (math.sin(math.pi * s) ** 0.62) * ((1 - abs(u) ** 2.6) ** 0.6) + fade * 0.0006 * (W / 0.16)

    bm = bmesh.new()
    uvl = bm.loops.layers.uv.new('UVMap')
    F = [[None] * (ny + 1) for _ in range(nx + 1)]
    B = [[None] * (ny + 1) for _ in range(nx + 1)]
    for i in range(nx + 1):
        for j in range(ny + 1):
            z = zf(xs[i], ys[j])
            F[i][j] = bm.verts.new((xs[i], ys[j], z))
            B[i][j] = F[i][j] if (i in (0, nx) or j in (0, ny)) else bm.verts.new((xs[i], ys[j], -z))
    for i in range(nx):
        for j in range(ny):
            bm.faces.new((F[i][j], F[i + 1][j], F[i + 1][j + 1], F[i][j + 1])).material_index = 0
            bm.faces.new((B[i][j + 1], B[i + 1][j + 1], B[i + 1][j], B[i][j])).material_index = 1
    for f in bm.faces:
        for l in f.loops:
            l[uvl].uv = (l.vert.co.x / W + 0.5, l.vert.co.y / H)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    me.polygons.foreach_set('use_smooth', [True] * len(me.polygons))
    return me


def parse_d(d):
    toks = re.findall(r'[MLCHVZ]|-?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?', d)
    subs, cur, i, cmd, x, y = [], None, 0, None, 0.0, 0.0
    while i < len(toks):
        t = toks[i]
        if t.isalpha():
            cmd = t
            i += 1
            if cmd == 'Z':
                if cur is not None:
                    cur['closed'] = True
                cur = None
                continue
        if cmd == 'M':
            x, y = float(toks[i]), float(toks[i + 1])
            i += 2
            cur = {'p': [[(x, y), (x, y), (x, y)]], 'closed': False}
            subs.append(cur)
            cmd = 'L'
        elif cmd == 'L':
            x, y = float(toks[i]), float(toks[i + 1])
            i += 2
            cur['p'].append([(x, y), (x, y), (x, y)])
        elif cmd == 'H':
            x = float(toks[i])
            i += 1
            cur['p'].append([(x, y), (x, y), (x, y)])
        elif cmd == 'V':
            y = float(toks[i])
            i += 1
            cur['p'].append([(x, y), (x, y), (x, y)])
        elif cmd == 'C':
            x1, y1, x2, y2, x, y = [float(v) for v in toks[i:i + 6]]
            i += 6
            cur['p'][-1][2] = (x1, y1)
            cur['p'].append([(x2, y2), (x, y), (x, y)])
        else:
            i += 1
    for s in subs:                     # les contours du brand book n'ont pas de « Z » : ils se referment sur leur point de depart
        p = s['p']
        if len(p) > 2 and abs(p[0][1][0] - p[-1][1][0]) < 0.05 and abs(p[0][1][1] - p[-1][1][1]) < 0.05:
            p[0][0] = p[-1][0]
            p.pop()
        s['closed'] = True
    return [s for s in subs if len(s['p']) > 2]


def logo_curves(coll, svg_text, width_m, depth, bev, mat_ink, mat_red, parent):
    paths = re.findall(r'<path[^>]*?id="([^"]+)"[^>]*?d="([^"]+)"', svg_text)
    letters = [parse_d(d) for pid, d in paths if pid != 'mark']
    mark = [parse_d(d) for pid, d in paths if pid == 'mark']
    allpts = [q[1] for grp in letters + mark for s in grp for q in s['p']]
    x0, x1 = min(p[0] for p in allpts), max(p[0] for p in allpts)
    y0, y1 = min(p[1] for p in allpts), max(p[1] for p in allpts)
    sc, cx, cy = width_m / (x1 - x0), (x0 + x1) / 2, (y0 + y1) / 2
    f = lambda q: ((q[0] - cx) * sc, -(q[1] - cy) * sc, 0.0)

    def build(name, groups, mat, dz, extrude_scale=1.0):
        cu = bpy.data.curves.new(name, 'CURVE')
        cu.dimensions = '2D'
        cu.resolution_u = 10
        try:
            cu.fill_mode = 'FULL'
        except TypeError:
            cu.fill_mode = 'BOTH'
        cu.extrude = depth * extrude_scale / 2
        cu.bevel_depth = bev
        cu.bevel_resolution = 3
        for grp in groups:
            for s in grp:
                sp = cu.splines.new('BEZIER')
                sp.bezier_points.add(len(s['p']) - 1)
                sp.use_cyclic_u = s['closed']
                for bp, (hl, co, hr) in zip(sp.bezier_points, s['p']):
                    bp.handle_left_type = bp.handle_right_type = 'FREE'
                    bp.co = f(co)
                    bp.handle_left = f(hl)
                    bp.handle_right = f(hr)
        cu.materials.append(mat)
        o = bpy.data.objects.new(name, cu)
        link(o, coll, loc=(0, dz, 0), rot=(math.pi / 2, 0, 0), parent=parent)
        return o

    lo = build('HERO_logo_wordmark', letters, mat_ink, 0.0)
    mo = build('HERO_logo_mark', mark, mat_red, -0.004, 1.5)
    return lo, mo, (x1 - x0) * sc, (y1 - y0) * sc
