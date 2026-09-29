"""CORNSTY - la Mouette en 3D (modelisee dans Blender, pieces separees pour pouvoir l'animer plus tard).

Forme prise sur le brand book : cou tres long et epais qui se prolonge en tete, grand bec orange, chapeau bob bleu a rayures
avec une petite boucle noire ; lunettes noires comme sur les images du proprietaire. Corps, cou et tete sont fondus en une
seule peau lisse (remaillage par voxels). Depend de cs_lib.py. Repere local : sol sous le corps, la Mouette regarde vers -Y.
"""

KH = 2.2                                     # echelle de la tete et du bec (le cou du brand book est tres epais)
KT = 1.5                                      # echelle du chapeau
HEAD_C = Vector((0.05, -0.06, 1.50))          # centre de la tete


def smoothstep(a, b, x):
    t = max(0.0, min(1.0, (x - a) / (b - a)))
    return t * t * (3 - 2 * t)


def gull_materials():
    return {
        'cream': new_mat('MAT_gull_cream', '#FFF4DC', 0.5, sheen=0.5, sss=0.25, sss_radius=(1.0, 0.55, 0.4), sss_scale=0.025, spec=0.45),
        'beak': new_mat('MAT_gull_beak', '#FF8A1E', 0.3, coat=0.5, coat_rough=0.12, sss=0.15, sss_radius=(1.0, 0.4, 0.2), sss_scale=0.01),
        'hat': band_mat('MAT_gull_hat', '#6F86F0', '#3F52C6', [(0.085, 0.112), (0.16, 0.187)], rough=0.7, sheen=0.25),
        'brim': new_mat('MAT_gull_brim', '#667DEA', 0.7, sheen=0.25),
        'ink': new_mat('MAT_gull_ink', '#2A2A38', 0.4, coat=0.3, coat_rough=0.15),
        'glass': new_mat('MAT_gull_glasses', '#0E0E14', 0.1, coat=0.6, coat_rough=0.05, spec=0.8),
        'leg': new_mat('MAT_gull_leg', '#2A2A38', 0.35, coat=0.3, coat_rough=0.1),
    }


def _ellipsoid(name, scale, seg=44, ring=26):
    return sphere_mesh(name, 1.0, seg, ring, scale=scale)


def make_gull(coll, loc=(0, 0, 0), yaw_deg=58.0, pitch_deg=4.0, hat_tilt=(-7.0, 9.0), mats=None):
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

    # --- ailes : bras + 3 plumes, fondus par cote
    wings = {}
    for side, nm in ((1, 'R'), (-1, 'L')):
        S = Vector((side * 0.23, 0.0, 1.10))
        wpath = catmull([S, (side * 0.34, 0.03, 0.98), (side * 0.44, 0.05, 0.86), (side * 0.50, 0.055, 0.75)], 14)
        arm = loft('arm_e', wpath, lambda t: (0.16 + 0.10 * math.sin(math.pi * min(1.0, t * 1.15)) ** 0.8, 0.11 - 0.05 * t), seg=32, up=(1, 0, 0))
        parts = [(arm, Matrix.Identity(4))]
        W = wpath[-1]
        for k, ang in enumerate((26, 50, 74)):
            a = math.radians(ang)
            d = Vector((side * math.sin(a), -0.14, -math.cos(a))).normalized()
            fe = _ellipsoid('feather_e', (0.066, 0.12, 0.26 - 0.02 * k))
            q = Vector((0, 0, 1)).rotation_difference(d)
            parts.append((fe, Matrix.Translation(W + d * 0.10) @ q.to_matrix().to_4x4()))
        wm = join_meshes('HERO_gull_wing_' + nm, parts)
        ow = new_obj('HERO_gull_wing_' + nm, wm, coll, parent=root, mats=[M['cream']])
        remesh_union(ow, 0.0065, 8, 0.55)
        wings[nm] = ow

    # --- tete : groupe qui porte bec, lunettes, chapeau
    head_grp = new_obj('HERO_gull_head', None, coll, loc=tuple(HEAD_C), rot=(math.radians(pitch_deg), 0, theta), parent=root)

    def beak_part(nm, pts, radii_fn):
        pth = catmull([(x * KH, y * KH, z * KH) for x, y, z in pts], 16)
        me = loft(nm, pth, radii_fn, seg=28, up=(0, 0, 1))
        o = new_obj(nm, me, coll, parent=head_grp, mats=[M['beak']])
        subsurf(o, 1, 2)
        return o

    bu = beak_part('HERO_gull_beak_upper', [(0, 0.075, -0.05), (0, 0.135, -0.054), (0, 0.19, -0.07), (0, 0.235, -0.098)],
                   lambda t: (KH * (0.048 * (1 - 0.88 * t ** 1.05) + 0.004), KH * (0.03 * (1 - 0.82 * t ** 1.05) + 0.004)))
    bl = beak_part('HERO_gull_beak_lower', [(0, 0.07, -0.086), (0, 0.12, -0.094), (0, 0.17, -0.106), (0, 0.205, -0.114)],
                   lambda t: (KH * (0.04 * (1 - 0.85 * t ** 1.05) + 0.004), KH * (0.02 * (1 - 0.75 * t) + 0.004)))

    # lunettes : posees sur la surface de la tete (proportionnelles a KH)
    gl = []
    rx_h, ry_h, rz_h = 0.104 * KH, 0.112 * KH, 0.100 * KH
    for sx, nm in ((1, 'R'), (-1, 'L')):
        lx = sx * 0.052 * KH
        ly = ry_h * math.sqrt(max(0.0, 1 - (lx / rx_h) ** 2)) + 0.012 * KH
        me = boxes_mesh('lens_' + nm, [((0, 0, 0), (0.076 * KH, 0.02 * KH, 0.05 * KH), 0, 0, 0)])
        o = new_obj('HERO_gull_lens_' + nm, me, coll, loc=(lx, ly, 0.008 * KH), rot=(0, 0, -sx * math.radians(30)), parent=head_grp, mats=[M['glass']])
        bevel(o, 0.009 * KH, 5)
        subsurf(o, 1, 2)
        arm = boxes_mesh('temple_' + nm, [((0, 0, 0), (0.008 * KH, 0.1 * KH, 0.010 * KH), 0, 0, 0)])
        oa = new_obj('HERO_gull_temple_' + nm, arm, coll, loc=(sx * (rx_h + 0.004 * KH), 0.045 * KH, 0.014 * KH), rot=(0, 0, sx * math.radians(4)), parent=head_grp, mats=[M['glass']])
        bevel(oa, 0.002 * KH, 2)
        gl += [o, oa]
    br = boxes_mesh('bridge', [((0, 0, 0), (0.034 * KH, 0.013 * KH, 0.010 * KH), 0, 0, 0)])
    ob = new_obj('HERO_gull_bridge', br, coll, loc=(0, ry_h + 0.010 * KH, 0.020 * KH), parent=head_grp, mats=[M['glass']])
    bevel(ob, 0.002 * KH, 2)

    # chapeau bob : couronne rayee + bord tombant, un peu de travers
    hat_grp = new_obj('HERO_gull_hat', None, coll, loc=(0, -0.03, 0.078 * KH), rot=(math.radians(hat_tilt[0]), math.radians(hat_tilt[1]), 0), parent=head_grp)
    crown_prof = [(0.0, 0.142), (0.05, 0.14), (0.088, 0.13), (0.104, 0.115), (0.111, 0.07), (0.124, 0.02), (0.134, 0.0)]
    crown = lathe('HERO_gull_hat_crown', [(r * KT * 1.16, z * KT * 1.2) for r, z in crown_prof], 64)
    oc = new_obj('HERO_gull_hat_crown', crown, coll, parent=hat_grp, mats=[M['hat']])
    sd = oc.modifiers.new('Solidify', 'SOLIDIFY')
    sd.thickness = 0.01
    sd.offset = -1.0
    subsurf(oc, 1, 2)
    brim_prof = [(0.134, 0.0), (0.165, -0.014), (0.21, -0.034), (0.246, -0.052), (0.254, -0.058), (0.25, -0.064), (0.24, -0.06)]
    brim = lathe('HERO_gull_hat_brim', [((0.134 + (r - 0.134) * 0.62) * KT * 1.16, z * KT * 1.0) for r, z in brim_prof], 64)
    obm = new_obj('HERO_gull_hat_brim', brim, coll, parent=hat_grp, mats=[M['brim']])
    sd2 = obm.modifiers.new('Solidify', 'SOLIDIFY')
    sd2.thickness = 0.012
    sd2.offset = -1.0
    subsurf(obm, 1, 2)
    # boucle : trois petites boucles noires et un noeud
    top = 0.142 * KT * 1.2
    for k, ang in enumerate((-35, 90, 215)):
        a = math.radians(ang)
        cx, cy = 0.036 * math.cos(a), 0.036 * math.sin(a)
        pts = [(0, 0, top), (cx * 0.5, cy * 0.5, top + 0.03), (cx, cy, top + 0.06), (cx * 0.3 + 0.012 * math.sin(a), cy * 0.3 - 0.012 * math.cos(a), top + 0.045), (0, 0, top + 0.004)]
        cu = curve_tube('HERO_gull_hat_loop_%d' % (k + 1), pts, 0.0075, closed=False, res=4)
        cu.materials.append(M['ink'])
        new_obj('HERO_gull_hat_loop_%d' % (k + 1), cu, coll, parent=hat_grp)
    new_obj('HERO_gull_hat_knot', sphere_mesh('HERO_gull_hat_knot', 0.015, 16, 10), coll, loc=(0, 0, top + 0.004), parent=hat_grp, mats=[M['ink']])
    return {'root': root, 'body': o_body, 'wings': wings, 'head': head_grp, 'beak': (bu, bl), 'glasses': gl + [ob], 'hat': hat_grp, 'mats': M}
