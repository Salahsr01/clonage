"""CORNSTY - le vrai logo et les 6 vrais pochons, sur le comptoir du kiosque de depart (desert).

Script de construction. Teste hors interface (bpy 5.0) puis lance dans le Blender du proprietaire (5.1).
Unites : metres, Z vers le haut. Le kiosque regarde vers -Y (les cameras regardent vers +Y).
Ressources (dossier art/blender/) : tex/pouch-*.png (rendus des vrais emballages de la V1) et logo-wordmark.svg
(tracés vectoriels du brand book). Elles sont lues dans `ASSET_DIR` si defini, sinon telechargees depuis GitHub.
Rien n'est enregistre : la scene CORNSTY_Depart est ajoutee au fichier ouvert, la scene d'origine n'est pas touchee.
"""
import bpy, bmesh, math, os, re, random, tempfile, urllib.request
from mathutils import Vector, Matrix, Euler

SCENE = 'CORNSTY_Depart'
RAW = 'https://raw.githubusercontent.com/Salahsr01/clonage/claude/elegant-newton-96gjm5/cornsty-v1/art/blender/'
ASSET_DIR = globals().get('ASSET_DIR')
ENGINE = globals().get('ENGINE', 'BLENDER_EEVEE')
CACHE = os.path.join(tempfile.gettempdir(), 'cornsty_assets')
FLAVORS = [('cheddar', '#FF8A00'), ('gaufre', '#A9CB3C'), ('wings', '#DE3F39'),
           ('nature', '#3E52CF'), ('caramel', '#8E3A5E'), ('cookies', '#A3201F')]   # ordre du catalogue
INK, CREAM, RED = '#26232B', '#F8F2E0', '#DE3F39'
SUN_ROT, SUN_EL, LAMP_EL = 304.0, 6.0, 10.0   # degres : soleil bas a gauche et derriere le kiosque (ciel a 6, lampe a 10 pour passer au-dessus des dunes)
VIEW = globals().get('VIEW', 'Standard')


# ------------------------------------------------------------------ ressources et couleurs
def asset(rel):
    if ASSET_DIR:
        p = os.path.join(ASSET_DIR, rel)
        if os.path.exists(p):
            return p
    dst = os.path.join(CACHE, rel)
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    if not os.path.exists(dst) or os.path.getsize(dst) == 0:
        urllib.request.urlretrieve(RAW + rel, dst)
    return dst


def lin(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def hexcol(h, a=1.0):
    h = h.lstrip('#')
    r, g, b = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return (lin(r), lin(g), lin(b), a)


# ------------------------------------------------------------------ scene et collections
def fresh():
    old = bpy.data.scenes.get(SCENE)
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
            if d.name.startswith(('HERO_', 'PRP_', 'ENV_', 'LGT_', 'CAM_', 'TGT_', 'MAT_')) and d.users == 0:
                store.remove(d)
    return bpy.data.scenes.new(SCENE)


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


def new_mat(name, col, rough=0.6, metal=0.0, coat=0.0, coat_rough=0.12, sheen=0.0, spec=0.5, emit=None, emit_s=0.0):
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


def wood_mat(name, c1, c2, rough=0.72, grain=(1.0, 8.0, 1.0), bump=0.12):
    m = new_mat(name, c1, rough)
    nt = m.node_tree
    b = nt.nodes['Principled BSDF']
    L = nt.links.new
    tc = nt.nodes.new('ShaderNodeTexCoord')
    mp = nt.nodes.new('ShaderNodeMapping')
    mp.inputs['Scale'].default_value = grain
    no = nt.nodes.new('ShaderNodeTexNoise')
    no.inputs['Scale'].default_value = 3.5
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


def sand_mat(name):
    m = new_mat(name, '#D9A55E', 0.95)
    nt = m.node_tree
    b = nt.nodes['Principled BSDF']
    L = nt.links.new
    tc = nt.nodes.new('ShaderNodeTexCoord')
    n1 = nt.nodes.new('ShaderNodeTexNoise')
    n1.inputs['Scale'].default_value = 1.3
    n1.inputs['Detail'].default_value = 4.0
    rp = _ramp(nt, '#CF8942', '#F3C173', 0.35, 0.7)
    wv = nt.nodes.new('ShaderNodeTexWave')
    wv.wave_type = 'BANDS'
    wv.inputs['Scale'].default_value = 3.2
    wv.inputs['Distortion'].default_value = 5.0
    wv.inputs['Detail'].default_value = 2.0
    bp = nt.nodes.new('ShaderNodeBump')
    bp.inputs['Strength'].default_value = 0.12
    bp.inputs['Distance'].default_value = 0.02
    L(tc.outputs['Object'], n1.inputs['Vector'])
    L(tc.outputs['Object'], wv.inputs['Vector'])
    L(n1.outputs['Fac'], rp.inputs['Fac'])
    L(rp.outputs['Color'], b.inputs['Base Color'])
    L(wv.outputs['Fac'], bp.inputs['Height'])
    L(bp.outputs['Normal'], b.inputs['Normal'])
    return m


def stripe_mat(name, c1, c2, period, rough=0.8):
    m = new_mat(name, c1, rough, sheen=0.6)
    nt = m.node_tree
    b = nt.nodes['Principled BSDF']
    L = nt.links.new
    tc = nt.nodes.new('ShaderNodeTexCoord')
    sp = nt.nodes.new('ShaderNodeSeparateXYZ')
    ml = nt.nodes.new('ShaderNodeMath')
    ml.operation = 'MULTIPLY'
    ml.inputs[1].default_value = 1.0 / period
    fr = nt.nodes.new('ShaderNodeMath')
    fr.operation = 'FRACT'
    rp = _ramp(nt, c1, c2, 0.0, 0.5, 'CONSTANT')
    L(tc.outputs['Object'], sp.inputs['Vector'])
    L(sp.outputs['X'], ml.inputs[0])
    L(ml.outputs['Value'], fr.inputs[0])
    L(fr.outputs['Value'], rp.inputs['Fac'])
    L(rp.outputs['Color'], b.inputs['Base Color'])
    return m


def pouch_mats(fid, base_hex):
    """Materiau facade = le vrai emballage (rendu de la V1) ; les coins arrondis transparents prennent la couleur de fond."""
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
    mx.inputs[6].default_value = hexcol(base_hex)          # A (couleur)
    L(ti.outputs['Alpha'], mx.inputs[0])
    L(ti.outputs['Color'], mx.inputs[7])                   # B (couleur)
    L(mx.outputs[2], b.inputs['Base Color'])               # Result (couleur)
    tc = nt.nodes.new('ShaderNodeTexCoord')
    no = nt.nodes.new('ShaderNodeTexNoise')                # petits plis du plastique
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


# ------------------------------------------------------------------ geometrie
CUBE_F = [(0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)]


def _cube_v(s):
    x, y, z = s[0] / 2, s[1] / 2, s[2] / 2
    return [(-x, -y, -z), (x, -y, -z), (x, y, -z), (-x, y, -z), (-x, -y, z), (x, -y, z), (x, y, z), (-x, y, z)]


def boxes_mesh(name, items):
    """items : (centre, taille, rotation_z_deg, inclinaison_x_deg, indice_materiau). Une seule maille, dimensions vraies en metres."""
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


def sphere_mesh(name, r=1.0, seg=32, ring=16):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=seg, v_segments=ring, radius=r)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    me.polygons.foreach_set('use_smooth', [True] * len(me.polygons))
    return me


def cyl_mesh(name, r, h, seg=20):
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=seg, radius1=r, radius2=r, depth=h)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    me.polygons.foreach_set('use_smooth', [True] * len(me.polygons))
    return me


def link(o, coll, loc=(0, 0, 0), rot=(0, 0, 0), mats=(), parent=None):
    coll.objects.link(o)
    o.location = loc
    o.rotation_euler = Euler(rot, 'XYZ')
    if o.type in ('MESH', 'CURVE'):
        for m in mats:
            o.data.materials.append(m)
    if parent is not None:
        o.parent = parent
    return o


def bevel(o, w=0.006, seg=3):
    md = o.modifiers.new('Bevel', 'BEVEL')
    md.width = w
    md.segments = seg
    md.limit_method = 'ANGLE'
    md.angle_limit = math.radians(40)
    try:
        md.harden_normals = True
    except Exception:
        pass
    if o.type == 'MESH':
        o.data.polygons.foreach_set('use_smooth', [True] * len(o.data.polygons))


def pouch_mesh(name, W=0.16, H=0.262, T=0.036):
    """Pochon coussin : dos et face soudes sur le pourtour, sceaux plats plisses en haut et en bas. Origine : milieu du bas, face vers +Z."""
    top, bot = 0.052, 0.042
    v0, v1 = bot, 1.0 - top
    n_seal, n_body, nx = 14, 78, 56
    ys = [bot * H * j / n_seal for j in range(n_seal)]
    ys += [H * (v0 + (v1 - v0) * j / n_body) for j in range(n_body + 1)]
    ys += [H * (v1 + (1 - v1) * j / n_seal) for j in range(1, n_seal + 1)]
    xs = [(-0.5 + i / nx) * W for i in range(nx + 1)]
    ny = len(ys) - 1

    def zf(x, y):
        u, t = x / (W / 2), y / H
        fade = max(0.0, min(1.0, (1 - abs(u)) * 16.0)) * max(0.0, min(1.0, min(t, 1 - t) * 50.0))
        if t <= v0 or t >= v1:
            ph = y if t <= v0 else H - y
            return fade * (0.0006 + 0.0009 * (0.5 + 0.5 * math.sin(2 * math.pi * ph / 0.0034)))
        s = (t - v0) / (v1 - v0)
        return T * (math.sin(math.pi * s) ** 0.62) * ((1 - abs(u) ** 2.6) ** 0.6) + fade * 0.0006

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


# ------------------------------------------------------------------ logo : les vrais tracés vectoriels du brand book
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


# ------------------------------------------------------------------ construction
def build():
    rnd = random.Random(7)
    sc = fresh()
    cE, cP, cH, cL, cC = (make_col(sc, n) for n in ('COL_ENV', 'COL_PRP', 'COL_HERO', 'COL_LGT', 'COL_CAM'))

    # --- materiaux
    m_sand = sand_mat('MAT_sand')
    m_w1 = wood_mat('MAT_wood_counter', '#8A5A33', '#B98552')
    m_w2 = wood_mat('MAT_wood_counter_b', '#7B4E2C', '#A97645')
    m_w3 = wood_mat('MAT_wood_counter_c', '#94643A', '#C4915B')
    m_wpost = wood_mat('MAT_wood_post', '#6E4A2B', '#9A6B40', grain=(8.0, 1.0, 1.0))
    m_wsign = wood_mat('MAT_wood_sign', '#8F5F36', '#BE8A55')
    m_cream = new_mat('MAT_paint_cream', CREAM, 0.55, sheen=0.3)
    m_ink = new_mat('MAT_logo_ink', INK, 0.42, coat=0.2, coat_rough=0.15)
    m_red = new_mat('MAT_logo_red', RED, 0.42, coat=0.2, coat_rough=0.15)
    m_awn = stripe_mat('MAT_awning_stripes', '#788CE3', '#EFE6CC', 0.23)
    m_patch = new_mat('MAT_awning_patch', '#C8473F', 0.8, sheen=0.5)
    m_bulb = new_mat('MAT_bulb', '#FFD9A0', 0.2, emit='#FFC46B', emit_s=9.0)
    m_metal = new_mat('MAT_metal_dark', '#3A3540', 0.45, metal=0.6)

    # --- environnement : sable et dunes (bloc grossier, tres loin de la camera)
    me = bpy.data.meshes.new('ENV_ground')
    me.from_pydata([(-60, -40, 0), (60, -40, 0), (60, 90, 0), (-60, 90, 0)], [], [(0, 1, 2, 3)])
    link(bpy.data.objects.new('ENV_ground', me), cE, mats=[m_sand])
    for k, (x, y, sx, sy, sz) in enumerate([(-12, 20, 12, 7, 2.2), (10, 22, 15, 8, 3.2), (-36, 30, 18, 9, 3.0), (26, 38, 22, 11, 5.6), (-3, 10, 6, 3, 0.9)]):
        o = link(bpy.data.objects.new('ENV_dune_%d' % (k + 1), sphere_mesh('ENV_dune_%d' % (k + 1), 1.0, 48, 24)), cE, loc=(x, y, -0.2), mats=[m_sand])
        o.scale = (sx, sy, sz)

    # --- comptoir : planches verticales devant, dessus en planches, tringle derriere les pochons
    front = [((-0.9 + 0.135 * i, -0.288, 0.405 + rnd.uniform(-0.01, 0.01)), (0.13, 0.025, 0.80 + rnd.uniform(-0.012, 0.0)), rnd.uniform(-0.7, 0.7), rnd.uniform(-0.4, 0.4), i % 3) for i in range(14)]
    front.append(((0, 0.0, 0.40), (1.95, 0.5, 0.78), 0, 0, 1))
    link(bpy.data.objects.new('PRP_counter_front', boxes_mesh('PRP_counter_front', front)), cP, mats=[m_w1, m_w2, m_w3])
    topb = [((0, -0.25 + 0.126 * j, 0.8425), (2.02, 0.124, 0.045), rnd.uniform(-0.25, 0.25), 0, j % 3) for j in range(5)]
    o = link(bpy.data.objects.new('PRP_counter_top', boxes_mesh('PRP_counter_top', topb)), cP, mats=[m_w1, m_w2, m_w3])
    bevel(o, 0.004, 2)
    rail = [((0, 0.125, 1.05), (1.5, 0.035, 0.05), 0, 0, 0), ((-0.75, 0.125, 0.955), (0.045, 0.045, 0.2), 0, 0, 0), ((0.75, 0.125, 0.955), (0.045, 0.045, 0.2), 0, 0, 0)]
    o = link(bpy.data.objects.new('PRP_rail', boxes_mesh('PRP_rail', rail)), cP, mats=[m_wpost])
    bevel(o, 0.004, 2)

    # --- poteaux et auvent
    for nm, x, tilt in (('PRP_post_L', -1.05, 1.2), ('PRP_post_R', 1.05, -1.5)):
        link(bpy.data.objects.new(nm, cyl_mesh(nm, 0.045, 2.3)), cP, loc=(x, -0.24, 1.15), rot=(math.radians(tilt), math.radians(-tilt * 0.6), 0), mats=[m_wpost])
    nx_, ny_ = 96, 10
    bm = bmesh.new()
    G = [[bm.verts.new((-1.22 + 2.44 * i / nx_, -0.36 + 0.86 * j / ny_, 0)) for j in range(ny_ + 1)] for i in range(nx_ + 1)]
    for i in range(nx_):
        for j in range(ny_):
            bm.faces.new((G[i][j], G[i + 1][j], G[i + 1][j + 1], G[i][j + 1]))
    for i in range(nx_ + 1):
        for j in range(ny_ + 1):
            v = G[i][j]
            x, y = v.co.x, v.co.y
            sag = 0.05 * (1 - (x / 1.22) ** 2)
            scal = 0.045 * (1 - abs(math.cos(math.pi * x / 0.23))) ** 1.3 * max(0.0, 1 - j / 2.0)
            v.co.z = 2.06 + (y + 0.36) * 0.2 - sag * math.sin(math.pi * (y + 0.36) / 0.86) - scal
    me = bpy.data.meshes.new('PRP_awning')
    bm.to_mesh(me)
    bm.free()
    me.polygons.foreach_set('use_smooth', [True] * len(me.polygons))
    o = link(bpy.data.objects.new('PRP_awning', me), cP, mats=[m_awn])
    sd = o.modifiers.new('Solidify', 'SOLIDIFY')
    sd.thickness = 0.008
    pm = boxes_mesh('PRP_awning_patch', [((0.62, 0.18, 2.145), (0.3, 0.22, 0.006), 4, -12, 0)])
    link(bpy.data.objects.new('PRP_awning_patch', pm), cP, mats=[m_patch])

    # --- pochons : la rangee, appuyee contre la tringle
    row = []
    for i, (fid, base) in enumerate(FLAVORS):
        art, back = pouch_mats(fid, base)
        me = pouch_mesh('HERO_pouch_' + fid)
        me.materials.append(art)
        me.materials.append(back)
        lean = 90 - rnd.uniform(6.5, 9.5)
        o = link(bpy.data.objects.new('HERO_pouch_' + fid, me), cH,
                 loc=(-0.1 + (i - 2.5) * 0.205 + rnd.uniform(-0.006, 0.006), 0.065, 0.8655),
                 rot=(math.radians(lean), 0, math.radians(rnd.uniform(-3.5, 3.5))))
        row.append(o)

    # --- enseigne : planches, plaque creme, vrai logo extrude
    root = bpy.data.objects.new('PRP_sign_root', None)
    link(root, cP, loc=(1.78, -0.12, 1.33), rot=(0, 0, math.radians(-14)))
    ob = link(bpy.data.objects.new('PRP_sign_board', boxes_mesh('PRP_sign_board', [((0, 0, 0), (1.0, 0.05, 0.6), 0, 0, 0)])), cP, mats=[m_wsign], parent=root)
    bevel(ob, 0.008, 3)
    op = link(bpy.data.objects.new('PRP_sign_plaque', boxes_mesh('PRP_sign_plaque', [((0, -0.032, 0), (0.9, 0.014, 0.5), 0, 0, 0)])), cP, mats=[m_cream], parent=root)
    bevel(op, 0.004, 2)
    svg = open(asset('logo-wordmark.svg'), encoding='utf-8').read()
    lo, mo, lw, lh = logo_curves(cH, svg, 0.66, 0.016, 0.0018, m_ink, m_red, root)
    lo.location.y, mo.location.y = -0.046, -0.046
    lo.location.z, mo.location.z = 0.0, 0.0
    for sx in (-0.45, 0.45):
        for sz in (-0.24, 0.24):
            link(bpy.data.objects.new('PRP_sign_nail', sphere_mesh('PRP_sign_nail', 0.011, 12, 8)), cP, loc=(sx, -0.042, sz), mats=[m_metal], parent=root)
    post = boxes_mesh('PRP_sign_post', [((1.82, -0.06, 0.95), (0.075, 0.075, 1.9), 0, 0, 0)])
    o = link(bpy.data.objects.new('PRP_sign_post', post), cP, mats=[m_wpost])
    bevel(o, 0.006, 2)

    # --- ampoule (pratique) : cordon, douille, verre emissif
    link(bpy.data.objects.new('PRP_bulb_cord', cyl_mesh('PRP_bulb_cord', 0.004, 0.24, 8)), cP, loc=(-0.55, -0.15, 1.95), mats=[m_metal])
    link(bpy.data.objects.new('PRP_bulb_socket', cyl_mesh('PRP_bulb_socket', 0.02, 0.05, 16)), cP, loc=(-0.55, -0.15, 1.845), mats=[m_metal])
    link(bpy.data.objects.new('PRP_bulb', sphere_mesh('PRP_bulb', 0.04, 24, 12)), cP, loc=(-0.55, -0.15, 1.79), mats=[m_bulb])

    # --- lumieres
    def add_light(name, kind, energy, color, loc, target=None, size=None, size_y=None, angle=None, radius=None):
        li = bpy.data.lights.new(name, kind)
        li.energy = energy
        li.color = color
        if kind == 'AREA':
            li.shape = 'RECTANGLE'
            li.size, li.size_y = size, size_y
        if kind == 'SUN' and angle is not None:
            li.angle = angle
        if kind == 'POINT' and radius is not None:
            li.shadow_soft_size = radius
        o = link(bpy.data.objects.new(name, li), cL, loc=loc)
        if target is not None:
            o.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
        return o

    d_sun = Vector((math.sin(math.radians(SUN_ROT)) * math.cos(math.radians(LAMP_EL)), math.cos(math.radians(SUN_ROT)) * math.cos(math.radians(LAMP_EL)), math.sin(math.radians(LAMP_EL))))
    sun = add_light('LGT_sun', 'SUN', 2.6, (1.0, 0.62, 0.34), (0, 0, 6), angle=math.radians(2.5))
    sun.rotation_euler = d_sun.to_track_quat('Z', 'Y').to_euler()
    add_light('LGT_key', 'AREA', 260.0, (1.0, 0.82, 0.62), (-2.4, -2.8, 2.5), target=(0.0, 0.0, 1.0), size=2.4, size_y=1.4)
    add_light('LGT_fill', 'AREA', 70.0, (0.55, 0.66, 1.0), (3.4, -2.6, 1.7), target=(0.3, 0.0, 1.0), size=3.0, size_y=2.0)
    add_light('LGT_practical_bulb', 'POINT', 30.0, (1.0, 0.72, 0.4), (-0.55, -0.15, 1.79), radius=0.04)

    # --- ciel de crepuscule
    w = bpy.data.worlds.get('WORLD_Depart') or bpy.data.worlds.new('WORLD_Depart')
    w.use_nodes = True
    nt = w.node_tree
    nt.nodes.clear()
    sky = nt.nodes.new('ShaderNodeTexSky')
    for kind in ('MULTIPLE_SCATTERING', 'SINGLE_SCATTERING', 'NISHITA'):     # le nom change selon la version de Blender
        try:
            sky.sky_type = kind
            break
        except TypeError:
            continue
    sky.sun_elevation = math.radians(SUN_EL)
    sky.sun_rotation = math.radians(SUN_ROT)
    for k, v in (('sun_disc', False), ('air_density', 1.6), ('dust_density', 2.2), ('ozone_density', 1.0)):
        try:
            setattr(sky, k, v)
        except Exception:
            pass
    bg = nt.nodes.new('ShaderNodeBackground')
    bg.inputs['Strength'].default_value = 0.4
    out = nt.nodes.new('ShaderNodeOutputWorld')
    nt.links.new(sky.outputs['Color'], bg.inputs['Color'])
    nt.links.new(bg.outputs['Background'], out.inputs['Surface'])
    sc.world = w

    # --- cameras : large (avec un lent travelling), pochons, logo
    def add_cam(name, loc, target, lens):
        cd = bpy.data.cameras.new(name)
        cd.lens, cd.sensor_width, cd.clip_start, cd.clip_end = lens, 36.0, 0.05, 500.0
        o = link(bpy.data.objects.new(name, cd), cC, loc=loc)
        t = link(bpy.data.objects.new('TGT_' + name, None), cC, loc=target)
        tc = o.constraints.new('TRACK_TO')
        tc.target, tc.track_axis, tc.up_axis = t, 'TRACK_NEGATIVE_Z', 'UP_Y'
        return o

    cw = add_cam('CAM_wide', (0.95, -4.7, 2.35), (0.6, 0.0, 1.0), 38)
    add_cam('CAM_pouches', (-0.1, -1.95, 1.42), (-0.1, 0.06, 1.0), 50)
    add_cam('CAM_logo', (1.35, -2.0, 1.7), (1.78, -0.12, 1.32), 50)

    # --- rendu et mouvement
    sc.render.engine = ENGINE
    sc.render.resolution_x, sc.render.resolution_y, sc.render.resolution_percentage = 1920, 1080, 100
    sc.render.fps = 24
    sc.frame_start, sc.frame_end = 1, 120
    sc.view_settings.view_transform = VIEW
    try:
        sc.view_settings.look = 'None'
    except Exception:
        pass
    if ENGINE != 'CYCLES':
        for k, v in (('use_raytracing', True), ('taa_render_samples', 96)):
            try:
                setattr(sc.eevee, k, v)
            except Exception:
                pass
    sc.camera = cw
    cw.location = (0.95, -4.7, 2.35)
    cw.keyframe_insert('location', frame=1)
    cw.location = (0.62, -3.95, 2.05)
    cw.keyframe_insert('location', frame=96)
    cw.keyframe_insert('location', frame=120)
    sc.frame_set(120)
    try:
        for win in bpy.context.window_manager.windows:
            win.scene = sc
    except Exception:
        pass
    return {'scene': sc.name, 'objects': sorted(o.name for o in sc.objects), 'logo_m': [round(lw, 3), round(lh, 3)], 'frame': sc.frame_current}


result = build()
