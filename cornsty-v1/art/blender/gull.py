"""CORNSTY - la Mouette en 3D (modelisee dans Blender, pieces separees pour pouvoir l'animer plus tard).

Forme prise sur la reference du proprietaire : cou droit qui se prolonge en tete, grand bec orange en coin arrondi, chapeau bob
bleu a deux rayures marine avec sa boucle noire, grandes lunettes noires enveloppantes, ailes en feuilles superposees (trois
plumes par aile). Corps, cou et tete sont fondus en une seule peau lisse (remaillage par voxels) ; chaque plume d'aile est
une piece separee (animable). Depend de cs_lib.py. Repere local : sol sous le corps, la Mouette regarde vers -Y.
"""

KH = 2.2                                     # echelle de la tete et du bec (le cou du brand book est tres epais)
KT = 1.68                                     # echelle du chapeau
HEAD_C = Vector((0.05, -0.06, 1.50))          # centre de la tete


def smoothstep(a, b, x):
    t = max(0.0, min(1.0, (x - a) / (b - a)))
    return t * t * (3 - 2 * t)


def gull_materials():
    return {
        'cream': new_mat('MAT_gull_cream', '#FFF4DC', 0.5, sheen=0.5, sss=0.25, sss_radius=(1.0, 0.55, 0.4), sss_scale=0.025, spec=0.45),
        'beak': new_mat('MAT_gull_beak', '#FF8A1E', 0.3, coat=0.5, coat_rough=0.12, sss=0.15, sss_radius=(1.0, 0.4, 0.2), sss_scale=0.01),
        'cream2': new_mat('MAT_gull_cream_wing', '#F9EBD1', 0.55, sheen=0.5, sss=0.25, sss_radius=(1.0, 0.55, 0.4), sss_scale=0.025, spec=0.4),
        'beak2': new_mat('MAT_gull_beak_low', '#FF9B3C', 0.32, coat=0.4, coat_rough=0.14, sss=0.15, sss_radius=(1.0, 0.4, 0.2), sss_scale=0.01),
        'hat': band_mat('MAT_gull_hat', '#6F84EE', '#2A388F', [(0.083, 0.115), (0.158, 0.19)], rough=0.72, sheen=0.3),
        'brim': new_mat('MAT_gull_brim', '#667BE6', 0.72, sheen=0.3),
        'ink': new_mat('MAT_gull_ink', '#2A2A38', 0.4, coat=0.3, coat_rough=0.15),
        'frame': new_mat('MAT_gull_frame', '#131318', 0.32, coat=0.35, coat_rough=0.1),
        'glass': new_mat('MAT_gull_glasses', '#1A1311', 0.06, coat=0.9, coat_rough=0.03, spec=0.9),
        'leg': new_mat('MAT_gull_leg', '#2A2A38', 0.35, coat=0.3, coat_rough=0.1),
    }


def _ellipsoid(name, scale, seg=44, ring=26):
    return sphere_mesh(name, 1.0, seg, ring, scale=scale)


# plumes des ailes : (racine, pointe, courbure, demi-largeur, demi-epaisseur, matiere) pour le cote droit (x > 0) ; la plume 1 est devant
WING_LOBES = [((0.20, -0.075, 1.09), (0.58, -0.110, 0.58), (0.035, 0.0, 0.0), 0.135, 0.060, 'cream'),
              ((0.22, -0.035, 1.05), (0.71, -0.055, 0.55), (0.035, 0.0, 0.0), 0.118, 0.054, 'cream2'),
              ((0.23, 0.005, 1.01), (0.82, 0.000, 0.60), (0.025, 0.0, 0.035), 0.100, 0.048, 'cream2')]


def leaf(t, root=0.22, k=1.7, p=0.5):
    """Profil de feuille de 0 a 1 : arrondi a la racine, effile jusqu'a la pointe."""
    if t < root:
        return math.sqrt(max(0.0, t / root)) * 0.98 + 0.02
    u = (t - root) / (1 - root)
    return max(0.0, 1 - u ** k) ** p


def squircle_mesh(name, a, b, th, n=3.0, seg=56, bend=0.0, taper=0.0):
    """Verre de lunettes : contour arrondi (super-ellipse), extrude sur `th`, plie autour de la tete (bend) et un peu plus etroit en bas (taper)."""
    bm = bmesh.new()
    r0, r1 = [], []
    for k in range(seg):
        ang = 2 * math.pi * k / seg
        c, s_ = math.cos(ang), math.sin(ang)
        x = a * math.copysign(abs(c) ** (2.0 / n), c)
        z = b * math.copysign(abs(s_) ** (2.0 / n), s_)
        x *= 1.0 - taper * max(0.0, -z / b)
        yb = -bend * x * x
        r0.append(bm.verts.new((x, yb - th / 2, z)))
        r1.append(bm.verts.new((x, yb + th / 2, z)))
    bm.faces.new(r0[::-1])
    bm.faces.new(r1)
    for k in range(seg):
        bm.faces.new((r0[k], r0[(k + 1) % seg], r1[(k + 1) % seg], r1[k]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    me.polygons.foreach_set('use_smooth', [True] * len(me.polygons))
    return me


def make_gull(coll, loc=(0, 0, 0), yaw_deg=58.0, pitch_deg=4.0, hat_tilt=(-4.0, 6.0), mats=None):
    """Retourne un dict des objets. yaw_deg : direction du regard (0 = vers la camera, > 0 = vers la droite de l'image)."""
    M = mats or gull_materials()
    root = new_obj('HERO_gull_root', None, coll, loc=loc)
    theta = math.pi + math.radians(yaw_deg)    # le bec est construit vers +Y : yaw 0 = regard vers la camera (-Y), yaw > 0 = vers la droite de l'image
    Mh = Matrix.Translation(HEAD_C) @ Matrix.Rotation(theta, 4, 'Z')

    # --- corps, cou, tete : une seule peau
    body = _ellipsoid('body_e', (0.34, 0.27, 0.34))
    path = catmull([(0.0, 0.03, 0.98), (0.0, 0.0, 1.14), (0.015, -0.03, 1.29), (0.04, -0.05, 1.41), HEAD_C], 26)
    neck = loft('neck_e', path, lambda t: (0.23 - 0.05 * smoothstep(0.0, 0.6, t) + 0.006 * smoothstep(0.8, 1.0, t),
                                          0.21 - 0.04 * smoothstep(0.0, 0.6, t) + 0.006 * smoothstep(0.8, 1.0, t)), seg=36, up=(0, 1, 0))
    head = _ellipsoid('head_e', (0.104 * KH, 0.112 * KH, 0.100 * KH))
    mesh = join_meshes('HERO_gull_body', [(body, Matrix.Translation((0.0, 0.03, 0.86)) @ Matrix.Rotation(math.radians(-7), 4, 'X')), (neck, Matrix.Identity(4)), (head, Mh)])
    o_body = new_obj('HERO_gull_body', mesh, coll, parent=root, mats=[M['cream']])
    remesh_union(o_body, 0.0075, 10, 0.6)
    add_brush_bump(M['cream'], 260.0, 0.03, 0.0015)
    add_brush_bump(M['cream2'], 260.0, 0.03, 0.0015)

    # --- ailes : trois plumes-feuilles superposees par cote (pointes en eventail), chacune une piece separee
    wings = {}
    for side, nm in ((1, 'R'), (-1, 'L')):
        wg = new_obj('HERO_gull_wing_' + nm, None, coll, parent=root)
        lobes = []
        for k, (p0, p1, bulge, a, b, mk) in enumerate(WING_LOBES):
            P0 = Vector((side * p0[0], p0[1], p0[2]))
            P1 = Vector((side * p1[0], p1[1], p1[2]))
            path = catmull([P0, (P0 + P1) / 2 + Vector((side * bulge[0], bulge[1], bulge[2])), P1], 16)
            me = loft('lobe_e', path, lambda t, a=a, b=b: (max(0.004, a * leaf(t)), max(0.004, b * leaf(t, 0.30, 1.6, 0.5))), seg=30, up=(0, 1, 0))
            o = new_obj('HERO_gull_wing_%s_feather_%d' % (nm, k + 1), me, coll, parent=wg, mats=[M[mk]])
            subsurf(o, 1, 2)
            lobes.append(o)
        wings[nm] = wg
        wings[nm + '_feathers'] = lobes

    # --- tete : groupe qui porte bec, lunettes, chapeau
    head_grp = new_obj('HERO_gull_head', None, coll, loc=tuple(HEAD_C), rot=(math.radians(pitch_deg), 0, theta), parent=root)

    def beak_part(nm, pts, radii_fn, mk):
        pth = catmull([(x * KH, y * KH, z * KH) for x, y, z in pts], 16)
        me = loft(nm, pth, radii_fn, seg=28, up=(0, 0, 1))
        o = new_obj(nm, me, coll, parent=head_grp, mats=[M[mk]])
        subsurf(o, 1, 2)
        return o

    bu = beak_part('HERO_gull_beak_upper', [(0, 0.066, -0.088), (0, 0.122, -0.091), (0, 0.172, -0.104), (0, 0.218, -0.132)],
                   lambda t: (KH * (0.054 * (1 - 0.84 * t ** 1.15) + 0.007), KH * (0.046 * (1 - 0.80 * t ** 1.1) + 0.007)), 'beak')
    bl = beak_part('HERO_gull_beak_lower', [(0, 0.066, -0.134), (0, 0.114, -0.138), (0, 0.156, -0.146), (0, 0.192, -0.154)],
                   lambda t: (KH * (0.042 * (1 - 0.80 * t) + 0.004), KH * (0.020 * (1 - 0.70 * t) + 0.004)), 'beak2')

    # lunettes : montures noires, verres sombres brillants, arcade et branches qui suivent la tete
    gl = []
    rx_h, ry_h, rz_h = 0.104 * KH, 0.112 * KH, 0.100 * KH
    gz = -0.028 * KH                                    # hauteur du centre des verres
    for sx, nm in ((1, 'R'), (-1, 'L')):
        lx = sx * 0.054 * KH
        ly = ry_h * math.sqrt(max(0.0, 1 - (lx / rx_h) ** 2)) * math.sqrt(max(0.0, 1 - (gz / rz_h) ** 2)) + 0.010 * KH
        phi = -sx * math.radians(32)
        fr = squircle_mesh('frame_' + nm, 0.052 * KH, 0.038 * KH, 0.018 * KH, n=3.0, bend=0.9, taper=0.16)
        of = new_obj('HERO_gull_frame_' + nm, fr, coll, loc=(lx, ly, gz), rot=(0, 0, phi), parent=head_grp, mats=[M['frame']])
        bevel(of, 0.006 * KH, 3, angle=30)
        ln = squircle_mesh('lens_' + nm, 0.043 * KH, 0.030 * KH, 0.018 * KH, n=3.0, bend=0.9, taper=0.16)
        fw = Vector((-math.sin(phi), math.cos(phi), 0.0)) * (0.005 * KH)
        ol = new_obj('HERO_gull_lens_' + nm, ln, coll, loc=(lx + fw.x, ly + fw.y, gz), rot=(0, 0, phi), parent=head_grp, mats=[M['glass']])
        bevel(ol, 0.005 * KH, 3, angle=30)
        ex = Vector((math.cos(phi), math.sin(phi), 0.0)) * (0.052 * KH)          # bout exterieur de la monture
        p0 = (lx + sx * abs(ex.x), ly + (ex.y if sx > 0 else -ex.y) * 1.0, gz + 0.010 * KH)
        tp = [p0, (sx * 0.227, 0.11, gz + 0.012 * KH), (sx * 0.236, 0.02, gz + 0.012 * KH), (sx * 0.232, -0.06, gz + 0.006 * KH)]
        cu = curve_tube('HERO_gull_temple_' + nm, tp, 0.0085 * KH, res=4)
        cu.materials.append(M['frame'])
        ot = new_obj('HERO_gull_temple_' + nm, cu, coll, parent=head_grp)
        gl += [of, ol, ot]
    z_top = gz + 0.034 * KH
    kz = math.sqrt(max(0.0, 1 - (z_top / rz_h) ** 2))
    arc = [(rx_h * math.sin(math.radians(a)) * kz * 0.99, ry_h * math.cos(math.radians(a)) * kz + 0.012 * KH, z_top) for a in (-72, -54, -36, -18, 0, 18, 36, 54, 72)]
    cb = curve_tube('HERO_gull_brow', arc, 0.0085 * KH, res=4)
    cb.materials.append(M['frame'])
    ob = new_obj('HERO_gull_brow', cb, coll, parent=head_grp)

    # chapeau bob : couronne rayee + bord tombant, un peu de travers
    hat_grp = new_obj('HERO_gull_hat', None, coll, loc=(0, -0.03, 0.100 * KH), rot=(math.radians(hat_tilt[0]), math.radians(hat_tilt[1]), 0), parent=head_grp)
    crown_prof = [(0.0, 0.130), (0.05, 0.129), (0.092, 0.122), (0.112, 0.106), (0.119, 0.072), (0.127, 0.03), (0.134, 0.0)]
    crown = lathe('HERO_gull_hat_crown', [(r * KT * 1.16, z * KT * 1.2) for r, z in crown_prof], 64)
    oc = new_obj('HERO_gull_hat_crown', crown, coll, parent=hat_grp, mats=[M['hat']])
    sd = oc.modifiers.new('Solidify', 'SOLIDIFY')
    sd.thickness = 0.01
    sd.offset = -1.0
    subsurf(oc, 1, 2)
    brim_prof = [(0.134, 0.0), (0.165, -0.014), (0.21, -0.034), (0.246, -0.052), (0.254, -0.058), (0.25, -0.064), (0.24, -0.06)]
    brim = lathe('HERO_gull_hat_brim', [((0.134 + (r - 0.134) * 0.50) * KT * 1.16, z * KT * 1.25) for r, z in brim_prof], 64)
    obm = new_obj('HERO_gull_hat_brim', brim, coll, parent=hat_grp, mats=[M['brim']])
    sd2 = obm.modifiers.new('Solidify', 'SOLIDIFY')
    sd2.thickness = 0.012
    sd2.offset = -1.0
    subsurf(obm, 1, 2)
    # boucle du chapeau : deux grandes boucles rondes qui partent du noeud, une languette
    top = 0.130 * KT * 1.2
    for k, ang in enumerate((12, 192)):
        a = math.radians(ang)
        ca, sa = math.cos(a), math.sin(a)
        rl = 0.055
        cr, zc = rl * 0.85, top + rl * 0.55
        pts = [((cr + rl * math.cos(math.radians(p))) * ca, (cr + rl * math.cos(math.radians(p))) * sa, zc + rl * math.sin(math.radians(p))) for p in range(0, 360, 30)]
        cu = curve_tube('HERO_gull_hat_loop_%d' % (k + 1), pts, 0.014, closed=True, res=5)
        cu.materials.append(M['ink'])
        new_obj('HERO_gull_hat_loop_%d' % (k + 1), cu, coll, parent=hat_grp)
    tail = curve_tube('HERO_gull_hat_tail', [(0, 0, top + 0.004), (0.02, -0.03, top + 0.01), (0.05, -0.06, top - 0.012), (0.075, -0.075, top - 0.05)], 0.014, res=5)
    tail.materials.append(M['ink'])
    new_obj('HERO_gull_hat_tail', tail, coll, parent=hat_grp)
    new_obj('HERO_gull_hat_knot', sphere_mesh('HERO_gull_hat_knot', 0.026, 16, 10), coll, loc=(0, 0, top + 0.004), parent=hat_grp, mats=[M['ink']])
    return {'root': root, 'body': o_body, 'wings': wings, 'head': head_grp, 'beak': (bu, bl), 'glasses': gl + [ob], 'hat': hat_grp, 'mats': M}
