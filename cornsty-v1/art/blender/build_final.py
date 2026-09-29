"""CORNSTY - scene finale « gouache brillante » : le kiosque de depart dans le desert, avec la Mouette modelisee,
le vrai logo et les 6 vrais pochons. Compose avec cs_lib.py et gull.py (meme espace de noms, dans cet ordre).

Unites : metres, Z vers le haut. Le kiosque regarde vers -Y, la camera regarde vers +Y.
Rien n'est enregistre : la scene CORNSTY_Depart_Final est ajoutee au fichier ouvert, les autres scenes ne sont pas touchees.
"""
import re
from mathutils import noise as mnoise

SCENE = 'CORNSTY_Depart_Final'
ENGINE = globals().get('ENGINE', 'CYCLES')
QUALITY = globals().get('QUALITY', 'draft')          # 'draft' | 'final'
FLAVORS = [('cheddar', '#FF8A00'), ('gaufre', '#A9CB3C'), ('wings', '#DE3F39'),
           ('nature', '#3E52CF'), ('caramel', '#8E3A5E'), ('cookies', '#A3201F')]
INK, CREAM, RED = '#26232B', '#F8F2E0', '#DE3F39'
GS = 0.66                                            # echelle de la Mouette dans le decor
COUNTER_TOP = 0.50
AWN_Z = 1.78                                         # bord avant de l'auvent
SUN_DIR = Vector((0.90, 0.40, 0.10)).normalized()   # vers le soleil : a droite et derriere


# ------------------------------------------------------------------ ciel de crepuscule (degrade serre, nuages, etoiles, lueur du soleil)
def build_world(sc):
    w = bpy.data.worlds.get('WORLD_Final') or bpy.data.worlds.new('WORLD_Final')
    w.use_nodes = True
    nt = w.node_tree
    nt.nodes.clear()
    L = nt.links.new
    tc = nt.nodes.new('ShaderNodeTexCoord')
    nm = nt.nodes.new('ShaderNodeVectorMath')
    nm.operation = 'NORMALIZE'
    L(tc.outputs['Object'], nm.inputs[0])
    sp = nt.nodes.new('ShaderNodeSeparateXYZ')
    L(nm.outputs['Vector'], sp.inputs['Vector'])
    rp = nt.nodes.new('ShaderNodeValToRGB')
    stops = [(0.0, '#FFD27A'), (0.025, '#FFB45E'), (0.06, '#F58A6A'), (0.10, '#D8659E'), (0.145, '#9459C6'), (0.20, '#5450C4'), (0.30, '#3038B0'), (0.55, '#2B2FA6'), (1.0, '#1C1F86')]
    e = rp.color_ramp.elements
    while len(e) < len(stops):
        e.new(0.5)
    for el, (pos, col) in zip(e, stops):
        el.position, el.color = pos, hexcol(col)
    L(sp.outputs['Z'], rp.inputs['Fac'])
    sd = nt.nodes.new('ShaderNodeVectorMath')
    sd.operation = 'DOT_PRODUCT'
    sd.inputs[1].default_value = tuple(SUN_DIR)
    L(nm.outputs['Vector'], sd.inputs[0])
    gm = nt.nodes.new('ShaderNodeMath')
    gm.operation = 'MAXIMUM'
    gm.inputs[1].default_value = 0.0
    L(sd.outputs['Value'], gm.inputs[0])
    gl = nt.nodes.new('ShaderNodeMath')
    gl.operation = 'POWER'
    gl.inputs[1].default_value = 5.0
    L(gm.outputs['Value'], gl.inputs[0])
    glow = nt.nodes.new('ShaderNodeMix')
    glow.data_type = 'RGBA'
    glow.blend_type = 'ADD'
    glow.inputs[7].default_value = hexcol('#FFA83C')
    L(gl.outputs['Value'], glow.inputs[0])
    L(rp.outputs['Color'], glow.inputs[6])
    cn = nt.nodes.new('ShaderNodeTexNoise')
    cn.inputs['Scale'].default_value = 5.0
    cn.inputs['Detail'].default_value = 6.0
    cn.inputs['Roughness'].default_value = 0.55
    cm = nt.nodes.new('ShaderNodeMapping')
    cm.inputs['Scale'].default_value = (1.0, 1.0, 6.0)
    L(nm.outputs['Vector'], cm.inputs['Vector'])
    L(cm.outputs['Vector'], cn.inputs['Vector'])
    cr = nt.nodes.new('ShaderNodeValToRGB')
    cr.color_ramp.elements[0].position, cr.color_ramp.elements[1].position = 0.55, 0.72
    hb = nt.nodes.new('ShaderNodeMapRange')
    hb.inputs['From Min'].default_value, hb.inputs['From Max'].default_value = 0.03, 0.09
    L(sp.outputs['Z'], hb.inputs['Value'])
    hb2 = nt.nodes.new('ShaderNodeMapRange')
    hb2.inputs['From Min'].default_value, hb2.inputs['From Max'].default_value = 0.10, 0.26
    hb2.inputs['To Min'].default_value, hb2.inputs['To Max'].default_value = 1.0, 0.0
    L(sp.outputs['Z'], hb2.inputs['Value'])
    band = nt.nodes.new('ShaderNodeMath')
    band.operation = 'MULTIPLY'
    L(hb.outputs['Result'], band.inputs[0])
    L(hb2.outputs['Result'], band.inputs[1])
    cmask = nt.nodes.new('ShaderNodeMath')
    cmask.operation = 'MULTIPLY'
    L(cn.outputs['Fac'], cr.inputs['Fac'])
    L(cr.outputs['Color'], cmask.inputs[0])
    L(band.outputs['Value'], cmask.inputs[1])
    cmask2 = nt.nodes.new('ShaderNodeMath')
    cmask2.operation = 'MULTIPLY'
    cmask2.inputs[1].default_value = 0.85
    L(cmask.outputs['Value'], cmask2.inputs[0])
    cloud = nt.nodes.new('ShaderNodeMix')
    cloud.data_type = 'RGBA'
    cloud.inputs[7].default_value = hexcol('#FF8C8C')
    L(cmask2.outputs['Value'], cloud.inputs[0])
    L(glow.outputs[2], cloud.inputs[6])
    vo = nt.nodes.new('ShaderNodeTexVoronoi')
    vo.inputs['Scale'].default_value = 300.0
    L(nm.outputs['Vector'], vo.inputs['Vector'])
    sr = nt.nodes.new('ShaderNodeMapRange')
    sr.inputs['From Min'].default_value, sr.inputs['From Max'].default_value = 0.0, 0.045
    sr.inputs['To Min'].default_value, sr.inputs['To Max'].default_value = 1.0, 0.0
    L(vo.outputs['Distance'], sr.inputs['Value'])
    hs = nt.nodes.new('ShaderNodeMapRange')
    hs.inputs['From Min'].default_value, hs.inputs['From Max'].default_value = 0.14, 0.24
    L(sp.outputs['Z'], hs.inputs['Value'])
    sm = nt.nodes.new('ShaderNodeMath')
    sm.operation = 'MULTIPLY'
    L(sr.outputs['Result'], sm.inputs[0])
    L(hs.outputs['Result'], sm.inputs[1])
    sm2 = nt.nodes.new('ShaderNodeMath')
    sm2.operation = 'MULTIPLY'
    sm2.inputs[1].default_value = 5.0
    L(sm.outputs['Value'], sm2.inputs[0])
    star = nt.nodes.new('ShaderNodeMix')
    star.data_type = 'RGBA'
    star.blend_type = 'ADD'
    star.inputs[7].default_value = hexcol('#FFF2B0')
    L(sm2.outputs['Value'], star.inputs[0])
    L(cloud.outputs[2], star.inputs[6])
    bg = nt.nodes.new('ShaderNodeBackground')
    bg.inputs['Strength'].default_value = 1.15
    out = nt.nodes.new('ShaderNodeOutputWorld')
    L(star.outputs[2], bg.inputs['Color'])
    L(bg.outputs['Background'], out.inputs['Surface'])
    sc.world = w
    return w


def haze_mix(m, haze='#F2A07A', start=14.0, end=70.0, glow=0.0):
    """Perspective atmospherique : la couleur de base se fond dans la brume avec la distance a la camera. `glow` : lumiere propre."""
    nt = m.node_tree
    b = nt.nodes['Principled BSDF']
    L = nt.links.new
    cd = nt.nodes.new('ShaderNodeCameraData')
    mr = nt.nodes.new('ShaderNodeMapRange')
    mr.inputs['From Min'].default_value = start
    mr.inputs['From Max'].default_value = end
    mr.clamp = True
    mx = nt.nodes.new('ShaderNodeMix')
    mx.data_type = 'RGBA'
    mx.inputs[7].default_value = hexcol(haze)
    L(cd.outputs['View Z Depth'], mr.inputs['Value'])
    L(mr.outputs['Result'], mx.inputs[0])
    if b.inputs['Base Color'].is_linked:
        L(b.inputs['Base Color'].links[0].from_socket, mx.inputs[6])
    else:
        mx.inputs[6].default_value = b.inputs['Base Color'].default_value
    L(mx.outputs[2], b.inputs['Base Color'])
    if glow > 0:                                      # lumiere diffuse du ciel, art-dirigee : les dunes a contre-jour restent chaudes
        L(mx.outputs[2], b.inputs['Emission Color'])
        b.inputs['Emission Strength'].default_value = glow


def glass_mat(name, tint='#F4F0E6'):
    m = new_mat(name, tint, 0.03, trans=1.0, ior=1.45, spec=0.5)
    nt = m.node_tree
    b = nt.nodes['Principled BSDF']
    out = next(n for n in nt.nodes if n.type == 'OUTPUT_MATERIAL')
    tr = nt.nodes.new('ShaderNodeBsdfTransparent')
    lp = nt.nodes.new('ShaderNodeLightPath')
    mx = nt.nodes.new('ShaderNodeMixShader')
    L = nt.links.new
    L(lp.outputs['Is Shadow Ray'], mx.inputs[0])
    L(b.outputs['BSDF'], mx.inputs[1])
    L(tr.outputs['BSDF'], mx.inputs[2])
    L(mx.outputs['Shader'], out.inputs['Surface'])
    return m


# ------------------------------------------------------------------ terrain : sol craquele, dunes, creux du mirage a droite
def terrain_mesh(name):
    nx, ny = 240, 170
    x0, x1, y0, y1 = -75.0, 75.0, -9.0, 130.0
    bm = bmesh.new()
    G = []
    for j in range(ny + 1):
        row = []
        y = y0 + (y1 - y0) * ((j / ny) ** 1.7)
        for i in range(nx + 1):
            x = x0 + (x1 - x0) * i / nx
            far = smoothstep(9.0, 26.0, y)
            h = 0.0
            if far > 0:
                n1 = mnoise.noise(Vector((x * 0.035, y * 0.05, 1.7)))
                n2 = mnoise.noise(Vector((x * 0.09 + 5, y * 0.11, 3.1)))
                ridge = 1.0 - abs(math.sin(x * 0.045 + n1 * 2.4 + y * 0.02))
                h = far * (7.5 * ridge ** 1.6 * (0.55 + 0.45 * n1) + 1.8 * n2) * smoothstep(9.0, 60.0, y) * 1.5 + far * 2.6 * (0.5 + 0.5 * n1)
                h *= min(1.0, 0.5 + 0.5 * smoothstep(14.0, 40.0, y))
                h *= 1.0 - 0.96 * smoothstep(9.0, 15.0, x) * smoothstep(18.0, 30.0, y)        # trouee a droite : le mirage
                h *= 0.55 + 0.45 * smoothstep(-30.0, -5.0, x)                                   # dunes plus hautes a gauche
            row.append(bm.verts.new((x, y, max(h, 0.0))))
        G.append(row)
    for j in range(ny):
        for i in range(nx):
            bm.faces.new((G[j][i], G[j][i + 1], G[j + 1][i + 1], G[j + 1][i]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    me.polygons.foreach_set('use_smooth', [True] * len(me.polygons))
    return me


# ------------------------------------------------------------------ accessoires
def kernel_meshes(rnd):
    out = []
    for v in range(3):
        parts = []
        for k in range(4 + v):
            r = 0.013 + rnd.uniform(-0.002, 0.003)
            off = Vector((rnd.uniform(-0.012, 0.012), rnd.uniform(-0.012, 0.012), rnd.uniform(-0.008, 0.012)))
            parts.append((sphere_mesh('k', r, 10, 7), Matrix.Translation(off)))
        out.append(join_meshes('FX_kernel_%d' % v, parts))
    return out


def scatter(coll, meshes, mat, n, fn, rnd, name):
    """Pose n grains (instances du meme maillage) ; fn(rnd) -> (x, y, z, echelle)."""
    for me in meshes:
        if not me.materials:
            me.materials.append(mat)
    for i in range(n):
        x, y, z, s = fn(rnd)
        o = bpy.data.objects.new('%s_%03d' % (name, i), meshes[i % len(meshes)])
        coll.objects.link(o)
        o.location = (x, y, z)
        o.rotation_euler = (rnd.uniform(0, 6.28), rnd.uniform(0, 6.28), rnd.uniform(0, 6.28))
        o.scale = (s, s, s)


def barrel_cactus(name, r, ribs):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=ribs * 6, v_segments=24, radius=r)
    for v in bm.verts:
        phi = math.atan2(v.co.y, v.co.x)
        k = 1.0 + 0.09 * (0.5 + 0.5 * math.cos(ribs * phi)) ** 0.7 * (1 - abs(v.co.z / r) ** 3)
        v.co.x *= k
        v.co.y *= k
        v.co.z *= 0.92
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    me.polygons.foreach_set('use_smooth', [True] * len(me.polygons))
    parts = []
    for k in range(7):
        a = k / 7 * 2 * math.pi
        petal = sphere_mesh('petal', 1.0, 10, 6)
        M = Matrix.Translation((0.11 * r * math.cos(a), 0.11 * r * math.sin(a), r * 0.9)) @ Matrix.Rotation(a, 4, 'Z') @ Matrix.Rotation(0.5, 4, 'Y') @ Matrix.Diagonal((0.07 * r, 0.045 * r, 0.22 * r, 1.0))
        parts.append((petal, M))
    fl = join_meshes(name + '_flowers', parts)
    return me, fl


def rock_mesh(name, r, rnd, seg=48, ring=28):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=seg, v_segments=ring, radius=r)
    seed = rnd.uniform(0, 100)
    for v in bm.verts:
        n = mnoise.noise(Vector((v.co.x * 2.2 / r + seed, v.co.y * 2.2 / r, v.co.z * 2.2 / r)))
        n2 = mnoise.noise(Vector((v.co.x * 6.0 / r + seed, v.co.y * 6.0 / r, v.co.z * 6.0 / r)))
        v.co *= 1.0 + 0.16 * n + 0.04 * n2
        v.co.z = v.co.z * 0.72 if v.co.z > 0 else v.co.z * 0.45
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    me.polygons.foreach_set('use_smooth', [True] * len(me.polygons))
    return me


def boulder_mesh(name, r, rnd, cuts=5):
    """Rocher de gres : un cube subdivise, a moitie arrondi, bosselé, aplati (dessus plat, pied enterre). A biseauter ensuite."""
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=2.0)
    bmesh.ops.subdivide_edges(bm, edges=bm.edges[:], cuts=cuts, use_grid_fill=True)
    seed = rnd.uniform(0, 100)
    for v in bm.verts:
        p = v.co.copy()
        p = p.lerp(p.normalized() * 1.28, 0.42)
        n = mnoise.noise(Vector((p.x * 1.7 + seed, p.y * 1.7, p.z * 1.7)))
        p *= 1.0 + 0.24 * n
        p.x *= 1.15
        p.y *= 0.85
        p.z = p.z * 0.70 if p.z > 0 else p.z * 0.32
        v.co = p * r
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    me.polygons.foreach_set('use_smooth', [True] * len(me.polygons))
    return me


def tumbleweed(coll, name, loc, r, mat, rnd, n=90):
    for i in range(n):
        pts = []
        a0, b0 = rnd.uniform(0, 6.28), rnd.uniform(-1.4, 1.4)
        for k in range(5):
            a = a0 + k * rnd.uniform(0.5, 1.1)
            b = b0 + rnd.uniform(-0.7, 0.7)
            rr = r * rnd.uniform(0.7, 1.05)
            pts.append((rr * math.cos(a) * math.cos(b), rr * math.sin(a) * math.cos(b), rr * math.sin(b)))
        cu = curve_tube('%s_%03d' % (name, i), pts, 0.0035, res=2)
        cu.materials.append(mat)
        new_obj('%s_%03d' % (name, i), cu, coll, loc=(loc[0], loc[1], loc[2] + r * 0.85))


def palm(coll, name, loc, h, mat_trunk, mat_leaf, rnd):
    tr = curve_tube(name + '_trunk', [(0, 0, 0), (0.08 * h, 0.02 * h, 0.5 * h), (0.15 * h, 0.03 * h, h)], 0.025 * h, res=5)
    tr.materials.append(mat_trunk)
    new_obj(name + '_trunk', tr, coll, loc=loc)
    top = (loc[0] + 0.15 * h, loc[1] + 0.03 * h, loc[2] + h)
    for k in range(8):
        a = k / 8 * 2 * math.pi + rnd.uniform(-0.2, 0.2)
        d = (math.cos(a), math.sin(a))
        pts = [(0, 0, 0), (0.25 * h * d[0], 0.25 * h * d[1], 0.10 * h), (0.5 * h * d[0], 0.5 * h * d[1], 0.03 * h), (0.68 * h * d[0], 0.68 * h * d[1], -0.14 * h)]
        cu = curve_tube('%s_leaf_%d' % (name, k), pts, 0.012 * h, res=3)
        cu.materials.append(mat_leaf)
        new_obj('%s_leaf_%d' % (name, k), cu, coll, loc=top)


# ------------------------------------------------------------------ construction
def build():
    rnd = random.Random(11)
    sc = fresh(SCENE)
    cE, cP, cH, cL, cC = (make_col(sc, n) for n in ('COL_ENV', 'COL_PRP', 'COL_HERO', 'COL_LGT', 'COL_CAM'))
    build_world(sc)
    zt = COUNTER_TOP

    # --- materiaux
    m_ground = sand_mat('MAT_ground', '#E7AE60', '#F6D08C', cracks=True, bump=0.2, wave_scale=1.4)
    haze_mix(m_ground, '#EBA890', 12.0, 90.0, glow=0.22)
    m_dune = sand_mat('MAT_dune', '#EDA65A', '#FBD08A', bump=0.02, wave_scale=0.3)
    haze_mix(m_dune, '#E9A092', 8.0, 120.0, glow=0.95)
    m_drift = sand_mat('MAT_drift', '#E5A85A', '#F5CD88', bump=0.05, wave_scale=0.6)
    haze_mix(m_drift, '#EBA890', 12.0, 90.0, glow=0.15)
    m_wood_a = wood_mat('MAT_wood_a', '#B27442', '#DCA063', bump=0.10, scale=4.0)
    m_wood_b = wood_mat('MAT_wood_b', '#9E6234', '#CB8D52', bump=0.10, scale=4.0)
    m_wood_c = wood_mat('MAT_wood_c', '#C08650', '#E4AE72', bump=0.10, scale=4.0)
    m_post = wood_mat('MAT_post', '#84583A', '#B08558', grain=(8.0, 1.0, 1.0), bump=0.16, scale=5.0)
    m_rope = new_mat('MAT_rope', '#D2AE72', 0.9, sheen=0.3)
    m_awn = stripe_mat('MAT_awning', '#7F90EA', '#F6EFDC', 0.36, rough=0.85, sheen=0.7, sss=0.25)
    m_patch = new_mat('MAT_patch', '#C94A44', 0.85, sheen=0.7, sss=0.2)
    add_brush_bump(m_patch, 240.0, 0.3, 0.004)
    m_stitch = new_mat('MAT_stitch', '#F1E4C4', 0.8, sheen=0.4)
    m_bulb = new_mat('MAT_bulb', '#FFE6B0', 0.2, emit='#FFC46A', emit_s=45.0)
    m_metal = new_mat('MAT_metal', '#4A4650', 0.4, metal=0.7)
    m_nail = new_mat('MAT_nail', '#6E6068', 0.45, metal=0.6)
    m_cream = new_mat('MAT_cream', CREAM, 0.55, sheen=0.4)
    m_ink = new_mat('MAT_ink', INK, 0.4, coat=0.3, coat_rough=0.15)
    m_red = new_mat('MAT_red', RED, 0.4, coat=0.3, coat_rough=0.15)
    m_mach = wear_mat('MAT_machine_red', '#E0382F', '#6A6470', wear_scale=10.0)
    m_glass = glass_mat('MAT_glass')
    m_pop = new_mat('MAT_popcorn', '#FFF1CC', 0.55, sheen=0.3, sss=0.2, sss_scale=0.01)
    m_kettle = new_mat('MAT_kettle', '#2D2A33', 0.35, metal=0.6, coat=0.2)
    m_wicker = wood_mat('MAT_wicker', '#B98A4E', '#DDB878', grain=(1.0, 1.0, 1.0), bump=0.5, scale=60.0)
    m_cactus = new_mat('MAT_cactus', '#4FA85E', 0.6, sheen=0.5, sss=0.25, sss_scale=0.01)
    m_flower = new_mat('MAT_flower', '#FF6FA8', 0.5, sheen=0.4)
    m_rock = band_mat('MAT_rock', '#B98259', '#8A5236', [(-0.10, -0.075), (-0.035, -0.005), (0.04, 0.07), (0.115, 0.145)], rough=0.85, sheen=0.2)
    add_brush_bump(m_rock, 30.0, 0.25, 0.01)
    m_twig = new_mat('MAT_tumbleweed', '#B89058', 0.9)
    m_palm = new_mat('MAT_palm', '#5A3B2A', 0.9)
    m_leaf = new_mat('MAT_palm_leaf', '#3D5A34', 0.9)
    m_water = new_mat('MAT_water', '#39C4EE', 0.05, emit='#33B9EA', emit_s=1.6)

    # --- sol et dunes
    new_obj('ENV_terrain', terrain_mesh('ENV_terrain'), cE, mats=[m_ground])
    # --- mirage : palmiers et mer au loin, a droite
    new_obj('ENV_mirage_water', boxes_mesh('ENV_mirage_water', [((25.0, 40.0, 0.05), (30.0, 9.0, 0.1), 0, 0, 0)]), cE, mats=[m_water])
    for k, (px, py, ph) in enumerate([(18.4, 38.5, 2.6), (20.6, 39.6, 2.0), (22.2, 38.9, 2.9), (17.2, 40.2, 1.6)]):
        palm(cE, 'ENV_palm_%d' % k, (px, py, 0.0), ph, m_palm, m_leaf, rnd)

    # --- comptoir bas : planches verticales devant (usees), dessus en planches
    front = [((-1.25 + 0.135 * i, -0.36, zt / 2 + rnd.uniform(-0.01, 0.01)), (0.128, 0.03, zt - 0.02 + rnd.uniform(-0.03, 0.0)), rnd.uniform(-0.6, 0.6), rnd.uniform(-0.5, 0.5), i % 3) for i in range(20)]
    front.append(((0, 0.0, zt / 2 - 0.02), (2.6, 0.66, zt - 0.05), 0, 0, 1))
    o = new_obj('PRP_counter_front', boxes_mesh('PRP_counter_front', front), cP, mats=[m_wood_a, m_wood_b, m_wood_c])
    bevel(o, 0.004, 2)
    topb = [((0, -0.30 + 0.126 * j, zt - 0.02), (2.74, 0.124, 0.045), rnd.uniform(-0.2, 0.2), 0, j % 3) for j in range(6)]
    o = new_obj('PRP_counter_top', boxes_mesh('PRP_counter_top', topb), cP, mats=[m_wood_a, m_wood_b, m_wood_c])
    bevel(o, 0.005, 2)

    # --- poteaux tordus + cordes
    for nm, x, tx, ty in (('PRP_post_L', -1.3, 1.6, 0.6), ('PRP_post_R', 1.3, -1.8, 0.4)):
        cu = curve_tube(nm, [(x, -0.2, 0.0), (x + 0.012 * tx, -0.2 + 0.01 * ty, 1.0), (x + 0.03 * tx, -0.2 + 0.02 * ty, 2.2)], 0.055, res=8)
        cu.materials.append(m_post)
        new_obj(nm, cu, cP)
        for k, zz in enumerate((AWN_Z - 0.03, AWN_Z + 0.04, AWN_Z + 0.11)):
            new_obj(nm + '_rope_%d' % k, sphere_mesh(nm + '_rope_%d' % k, 1.0, 20, 10, scale=(0.07, 0.07, 0.024)), cP, loc=(x + 0.015 * tx * zz / 1.1, -0.2 + 0.01 * ty * zz / 1.1, zz), mats=[m_rope])

    # --- auvent : toile a rayures, avec une retombee festonnee a l'avant, rapiecee
    prof = [(0.52, AWN_Z + 0.62), (0.15, AWN_Z + 0.57), (-0.30, AWN_Z + 0.44), (-0.52, AWN_Z + 0.34), (-0.61, AWN_Z + 0.26), (-0.64, AWN_Z + 0.14), (-0.64, AWN_Z)]
    prof_pts = catmull([(0.0, y_, z_) for y_, z_ in prof], 40)
    nx_, ny_ = 160, len(prof_pts) - 1
    bm = bmesh.new()
    x0, x1 = -1.62, 1.62
    period = 0.54
    G = []
    for i in range(nx_ + 1):
        x = x0 + (x1 - x0) * i / nx_
        col = []
        for j, p_ in enumerate(prof_pts):
            s_ = j / ny_
            y_, z_ = p_.y, p_.z
            sag = 0.05 * max(0.0, 1 - (x / 1.62) ** 2) * math.sin(math.pi * min(1.0, s_ * 1.4)) ** 0.8
            drop = 0.13 * max(0.0, 1 - abs(math.cos(math.pi * (x - x0) / period))) ** 0.9 * max(0.0, (s_ - 0.72) / 0.28) ** 1.4
            wob = 0.010 * mnoise.noise(Vector((x * 2.2, y_ * 2.2, z_ * 2.2)))
            col.append(bm.verts.new((x, y_ + wob, z_ - sag - drop)))
        G.append(col)
    for i in range(nx_):
        for j in range(ny_):
            bm.faces.new((G[i][j], G[i + 1][j], G[i + 1][j + 1], G[i][j + 1]))
    me = bpy.data.meshes.new('PRP_awning')
    bm.to_mesh(me)
    bm.free()
    me.polygons.foreach_set('use_smooth', [True] * len(me.polygons))
    o = new_obj('PRP_awning', me, cP, mats=[m_awn])
    sd = o.modifiers.new('Solidify', 'SOLIDIFY')
    sd.thickness = 0.012
    smooth_all(o)
    # piece cousue sur la retombee, au creux d'un feston (x = 1.35) ; racine commune : la rotation se fait autour de son centre
    px_, py_, pz_ = 1.35, -0.652, AWN_Z + 0.04
    pw_, ph2_ = 0.26, 0.16
    proot = new_obj('PRP_awning_patch_root', None, cP, loc=(px_, py_, pz_), rot=(0, math.radians(2.5), 0))
    op = new_obj('PRP_awning_patch', boxes_mesh('PRP_awning_patch', [((0, 0, 0), (pw_, 0.012, ph2_), 0, 0, 0)]), cP, mats=[m_patch], parent=proot)
    bevel(op, 0.007, 3)
    stitches = []
    ins_ = 0.02
    nl_, ns_ = 10, 6
    for k in range(nl_):
        u = -0.5 + (k + 0.5) / nl_
        for sgn in (-1, 1):
            stitches.append(((u * (pw_ - 2 * ins_), -0.009, sgn * (ph2_ / 2 - ins_)), (0.017, 0.005, 0.0035), 0, 0, 0))
    for k in range(ns_):
        u = -0.5 + (k + 0.5) / ns_
        for sgn in (-1, 1):
            stitches.append(((sgn * (pw_ / 2 - ins_), -0.009, u * (ph2_ - 2 * ins_)), (0.0035, 0.005, 0.017), 0, 0, 0))
    new_obj('PRP_awning_stitches', boxes_mesh('PRP_awning_stitches', stitches), cP, mats=[m_stitch], parent=proot)
    qd = re.search(r'd="([^"]+)"', open(asset('logo-quatrefoil.svg'), encoding='utf-8').read()).group(1)
    shape_curve(cP, 'PRP_awning_patch_mark', qd, 0.075, 0.006, 0.0012, m_cream, loc=(0, -0.009, 0), rot=(math.pi / 2, 0, 0), parent=proot)

    # --- ampoule qui pend de l'auvent
    bz = AWN_Z - 0.20
    cu = curve_tube('PRP_bulb_cord', [(-0.36, -0.15, AWN_Z + 0.06), (-0.335, -0.15, AWN_Z - 0.06), (-0.36, -0.15, bz + 0.11)], 0.007, res=4)
    cu.materials.append(m_metal)
    new_obj('PRP_bulb_cord', cu, cP)
    new_obj('PRP_bulb_socket', cyl_mesh('PRP_bulb_socket', 0.026, 0.06, 20), cP, loc=(-0.36, -0.15, bz + 0.08), mats=[m_metal])
    new_obj('PRP_bulb', sphere_mesh('PRP_bulb', 0.06, 32, 16, scale=(1, 1, 1.18)), cP, loc=(-0.36, -0.15, bz), mats=[m_bulb])

    # --- machine a pop-corn rouge, cabossee
    mx, my = -0.92, 0.02
    ob = new_obj('PRP_machine_base', boxes_mesh('PRP_machine_base', [((mx, my, zt + 0.10), (0.56, 0.46, 0.20), 0, 0, 0)]), cP, mats=[m_mach])
    bevel(ob, 0.015, 3)
    new_obj('PRP_machine_glass', boxes_mesh('PRP_machine_glass', [((mx, my, zt + 0.38), (0.50, 0.40, 0.36), 0, 0, 0)]), cP, mats=[m_glass])
    for k, (sx, sy) in enumerate([(-1, -1), (1, -1), (-1, 1), (1, 1)]):
        op_ = new_obj('PRP_machine_post_%d' % (k + 1), boxes_mesh('PRP_machine_post_%d' % (k + 1), [((mx + sx * 0.25, my + sy * 0.20, zt + 0.38), (0.03, 0.03, 0.37), 0, 0, 0)]), cP, mats=[m_mach])
        bevel(op_, 0.006, 2)
    bmr = bmesh.new()
    bot, top_ = (0.31, 0.26), (0.225, 0.175)
    v = [bmr.verts.new(p) for p in [(-bot[0], -bot[1], 0), (bot[0], -bot[1], 0), (bot[0], bot[1], 0), (-bot[0], bot[1], 0),
                                    (-top_[0], -top_[1], 0.15), (top_[0], -top_[1], 0.15), (top_[0], top_[1], 0.15), (-top_[0], top_[1], 0.15)]]
    for f in [(0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7), (4, 5, 6, 7), (3, 2, 1, 0)]:
        bmr.faces.new([v[i] for i in f])
    bmesh.ops.recalc_face_normals(bmr, faces=bmr.faces)
    rme = bpy.data.meshes.new('PRP_machine_roof')
    bmr.to_mesh(rme)
    bmr.free()
    orf = new_obj('PRP_machine_roof', rme, cP, loc=(mx, my, zt + 0.565), rot=(math.radians(1.5), math.radians(-2.5), 0), mats=[m_mach])
    bevel(orf, 0.02, 4)
    new_obj('PRP_machine_knob', sphere_mesh('PRP_machine_knob', 0.034, 24, 14), cP, loc=(mx + 0.01, my, zt + 0.735), mats=[m_mach])
    new_obj('PRP_machine_kettle', sphere_mesh('PRP_machine_kettle', 0.115, 36, 18, scale=(1, 1, 0.55)), cP, loc=(mx, my, zt + 0.50), mats=[m_kettle])
    kh = curve_tube('PRP_machine_kettle_handle', [(mx - 0.11, my, zt + 0.52), (mx - 0.18, my, zt + 0.58), (mx - 0.22, my, zt + 0.52)], 0.008, res=4)
    kh.materials.append(m_kettle)
    new_obj('PRP_machine_kettle_handle', kh, cP)
    new_obj('PRP_machine_crank', cyl_mesh('PRP_machine_crank', 0.014, 0.10, 16), cP, loc=(mx + 0.30, my, zt + 0.30), rot=(0, math.pi / 2, 0), mats=[m_metal])
    new_obj('PRP_machine_crank_arm', boxes_mesh('PRP_machine_crank_arm', [((mx + 0.35, my, zt + 0.25), (0.02, 0.02, 0.10), 0, 0, 0)]), cP, mats=[m_metal])
    new_obj('PRP_machine_crank_knob', sphere_mesh('PRP_machine_crank_knob', 0.026, 16, 10), cP, loc=(mx + 0.35, my, zt + 0.19), mats=[m_mach])
    kms = kernel_meshes(rnd)
    scatter(cH, kms, m_pop, 110, lambda r_: (mx + r_.uniform(-0.20, 0.20), my + r_.uniform(-0.15, 0.15), zt + 0.215 + 0.075 * (1 - r_.uniform(-1, 1) ** 2) * r_.uniform(0.5, 1.0), r_.uniform(0.85, 1.15)), rnd, 'HERO_popcorn_machine')

    # --- panier de pop-corn
    bk = lathe('PRP_basket', [(0.0, 0.0), (0.11, 0.0), (0.15, 0.03), (0.175, 0.11), (0.18, 0.125)], 40)
    obk = new_obj('PRP_basket', bk, cP, loc=(0.36, -0.10, zt), mats=[m_wicker])
    sdb = obk.modifiers.new('Solidify', 'SOLIDIFY')
    sdb.thickness = 0.012
    subsurf(obk, 1, 2)
    scatter(cH, kms, m_pop, 60, lambda r_: (0.36 + r_.uniform(-0.13, 0.13), -0.10 + r_.uniform(-0.13, 0.13), zt + 0.10 + 0.05 * (1 - r_.uniform(0, 1) ** 2), r_.uniform(0.9, 1.2)), rnd, 'HERO_popcorn_basket')

    # --- caisse en bois avec les 6 vrais pochons (deux rangees)
    cx = 1.02
    cb = [((cx, 0.0, zt + 0.01), (0.76, 0.46, 0.02), 0, 0, 0)]
    for zz in (zt + 0.035, zt + 0.085):
        cb += [((cx, -0.22, zz), (0.76, 0.02, 0.045), 0, 0, 0), ((cx, 0.22, zz), (0.76, 0.02, 0.045), 0, 0, 0)]
        cb += [((cx - 0.37, 0.0, zz), (0.02, 0.46, 0.045), 0, 0, 0), ((cx + 0.37, 0.0, zz), (0.02, 0.46, 0.045), 0, 0, 0)]
    for sx in (-1, 1):
        for sy in (-1, 1):
            cb.append(((cx + sx * 0.37, sy * 0.22, zt + 0.06), (0.035, 0.035, 0.12), 0, 0, 1))
    oc = new_obj('PRP_crate', boxes_mesh('PRP_crate', cb), cP, mats=[m_wood_c, m_wood_b])
    bevel(oc, 0.003, 2)
    new_obj('PRP_crate_riser', boxes_mesh('PRP_crate_riser', [((cx, 0.10, zt + 0.065), (0.62, 0.20, 0.09), 0, 0, 0)]), cP, mats=[m_wood_b])
    pw, ph_, pt = 0.19, 0.311, 0.043
    layout = [(0, -0.20, -0.10, zt + 0.02), (1, 0.0, -0.10, zt + 0.02), (2, 0.20, -0.10, zt + 0.02),
              (3, -0.20, 0.11, zt + 0.11), (4, 0.0, 0.11, zt + 0.11), (5, 0.20, 0.11, zt + 0.11)]
    for i, dx, dy, dz in layout:
        fid, base = FLAVORS[i]
        art, back = pouch_mats(fid, base)
        me = pouch_mesh('HERO_pouch_' + fid, pw, ph_, pt)
        me.materials.append(art)
        me.materials.append(back)
        lean = 90 - (11 if i < 3 else 8) - rnd.uniform(-2, 2)
        new_obj('HERO_pouch_' + fid, me, cH, loc=(cx + dx + rnd.uniform(-0.008, 0.008), dy, dz), rot=(math.radians(lean), 0, math.radians(rnd.uniform(-4, 4))))

    # --- enseigne avec le vrai logo
    root = new_obj('PRP_sign_root', None, cP, loc=(1.16, -0.32, 1.22), rot=(0, math.radians(2.0), math.radians(-5)))
    ob = new_obj('PRP_sign_board', boxes_mesh('PRP_sign_board', [((0, 0, 0), (0.98, 0.05, 0.54), 0, 0, 0)]), cP, mats=[m_wood_b], parent=root)
    bevel(ob, 0.01, 3)
    op = new_obj('PRP_sign_plaque', boxes_mesh('PRP_sign_plaque', [((0, -0.031, 0), (0.86, 0.014, 0.42), 0, 0, 0)]), cP, mats=[m_cream], parent=root)
    bevel(op, 0.005, 2)
    svg = open(asset('logo-wordmark.svg'), encoding='utf-8').read()
    lo, mo, lw, lh = logo_curves(cH, svg, 0.66, 0.018, 0.002, m_ink, m_red, root)
    lo.location.y, mo.location.y = -0.046, -0.046
    for k, (sx, sz) in enumerate([(-0.44, -0.21), (0.44, -0.21), (-0.44, 0.21), (0.44, 0.21)], start=1):
        new_obj('PRP_sign_nail_%d' % k, sphere_mesh('PRP_sign_nail_%d' % k, 0.012, 12, 8), cP, loc=(sx, -0.042, sz), mats=[m_metal], parent=root)

    # --- la Mouette : derriere le comptoir, mains sur le plateau
    g = make_gull(cH, loc=(-0.10, 0.12, zt - 0.56 * GS + 0.012), yaw_deg=40.0, pitch_deg=2.0)
    g['root'].scale = (GS, GS, GS)

    # --- cactus, rocher, boule de paille
    for k, (px, py, r_, ribs) in enumerate([(-1.62, -0.58, 0.24, 9), (-1.36, -0.40, 0.13, 8), (-1.86, -0.34, 0.11, 8), (1.70, -0.46, 0.20, 9)]):
        me, fl = barrel_cactus('ENV_cactus_%d' % k, r_, ribs)
        oc_ = new_obj('ENV_cactus_%d' % k, me, cE, loc=(px, py, r_ * 0.86), mats=[m_cactus])
        subsurf(oc_, 1, 2)
        new_obj('ENV_cactus_flowers_%d' % k, fl, cE, loc=(px, py, r_ * 0.86), mats=[m_flower])
    orock = new_obj('ENV_rock_1', boulder_mesh('ENV_rock_1', 0.30, rnd), cE, loc=(-1.12, -1.05, 0.04), rot=(0, 0, 0.6), mats=[m_rock])
    bevel(orock, 0.03, 3, angle=35)
    orock2 = new_obj('ENV_rock_2', boulder_mesh('ENV_rock_2', 0.11, rnd, 4), cE, loc=(-0.80, -1.22, 0.02), rot=(0, 0, 1.9), mats=[m_rock])
    bevel(orock2, 0.015, 3, angle=35)
    for k, (px, py, r_) in enumerate([(-0.9, -1.4, 0.07), (0.3, -1.9, 0.05), (-2.3, -1.2, 0.09), (1.0, -1.5, 0.06)]):
        new_obj('ENV_pebble_%d' % k, rock_mesh('ENV_pebble_%d' % k, r_, rnd, 20, 12), cE, loc=(px, py, r_ * 0.3), mats=[m_rock])
    tumbleweed(cE, 'ENV_tumbleweed', (1.62, -1.15, 0.0), 0.27, m_twig, rnd)

    # --- sable amasse au pied du comptoir (lie le bois au sol) et clous des planches
    for k in range(10):
        dx_ = -1.34 + k * 0.30 + rnd.uniform(-0.05, 0.05)
        scl = (rnd.uniform(0.20, 0.32), rnd.uniform(0.08, 0.13), rnd.uniform(0.035, 0.060))
        new_obj('ENV_drift_%d' % k, sphere_mesh('ENV_drift_%d' % k, 1.0, 24, 12, scale=scl), cE, loc=(dx_, -0.42 + rnd.uniform(-0.02, 0.03), 0.0), mats=[m_drift])
    nail = sphere_mesh('nail_proto', 0.008, 8, 6, scale=(1.0, 0.45, 1.0))
    nails = []
    for i in range(20):
        nx = -1.25 + 0.135 * i
        for nz in (0.10, zt - 0.09):
            nails.append((nail, Matrix.Translation((nx + rnd.uniform(-0.004, 0.004), -0.377, nz + rnd.uniform(-0.004, 0.004)))))
    new_obj('PRP_counter_nails', join_meshes('PRP_counter_nails', nails), cP, mats=[m_nail])
    bpy.data.meshes.remove(nail)

    # --- eclairage
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
        o = new_obj(name, li, cL, loc=loc)
        if target is not None:
            o.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
        return o

    sun = add_light('LGT_sun', 'SUN', 11.0, (1.0, 0.60, 0.28), (0, 0, 6), angle=math.radians(3.0))
    sun.rotation_euler = SUN_DIR.to_track_quat('Z', 'Y').to_euler()
    add_light('LGT_bulb', 'POINT', 420.0, (1.0, 0.72, 0.36), (-0.36, -0.15, bz), radius=0.06)
    add_light('LGT_fill_front', 'AREA', 38.0, (1.0, 0.93, 0.86), (-1.8, -3.4, 1.9), target=(0.0, 0.0, 0.9), size=3.0, size_y=2.0)
    add_light('LGT_fill_cool', 'AREA', 95.0, (0.55, 0.62, 1.0), (-3.4, -2.4, 1.3), target=(0.0, 0.0, 0.8), size=3.0, size_y=2.0)

    # --- camera : basse, presque a l'horizontale, comme sur le brouillon
    cd = bpy.data.cameras.new('CAM_main')
    cd.lens, cd.sensor_width, cd.clip_start, cd.clip_end = 32.0, 36.0, 0.05, 900.0
    cd.dof.use_dof = True
    cd.dof.focus_distance = 3.9
    cd.dof.aperture_fstop = 6.0
    cam = new_obj('CAM_main', cd, cC, loc=(0.22, -3.75, 1.08))
    tg = new_obj('TGT_CAM_main', None, cC, loc=(0.22, 0.0, 0.95))
    tcn = cam.constraints.new('TRACK_TO')
    tcn.target, tcn.track_axis, tcn.up_axis = tg, 'TRACK_NEGATIVE_Z', 'UP_Y'
    sc.camera = cam

    # --- rendu
    sc.render.engine = ENGINE
    W, H = (2048, 1152) if QUALITY == 'final' else (1024, 576)
    sc.render.resolution_x, sc.render.resolution_y, sc.render.resolution_percentage = W, H, 100
    sc.view_settings.view_transform = 'Standard'
    try:
        sc.view_settings.look = 'None'
    except Exception:
        pass
    if ENGINE == 'CYCLES':
        cy = sc.cycles
        cy.device = 'CPU'
        cy.samples = 384 if QUALITY == 'final' else 24
        cy.use_denoising = True
        try:
            cy.denoiser = 'OPENIMAGEDENOISE'
        except Exception:
            pass
        cy.max_bounces = 8
        cy.sample_clamp_indirect = 6.0
        cy.use_adaptive_sampling = True
        cy.adaptive_threshold = 0.008
        cy.adaptive_min_samples = 32
        try:
            sc.view_layers[0].cycles.denoising_store_passes = True
        except Exception:
            pass
    sc.frame_set(1)
    try:
        for win in bpy.context.window_manager.windows:
            win.scene = sc
    except Exception:
        pass
    return {'scene': sc.name, 'objects': len(sc.objects)}


result = build()
