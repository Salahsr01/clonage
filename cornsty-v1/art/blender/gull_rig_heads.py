"""CORNSTY - étape 2 : pose les têtes d'expression sur le cou du corps rigué.

usage : python3 gull_rig_heads.py corps_rigue.blend sortie.blend nom=tete.glb [nom=tete.glb ...]
Chaque tête (générée par Higgsfield à partir d'un portrait) est mise à l'échelle et tournée pour que son chapeau et son bec
coïncident avec ceux du corps d'origine, ses couleurs sont ramenées à celles du corps, le bas de son cou est déformé pour
épouser exactement l'anneau de coupe du cou du corps, puis elle est liée à l'os `RIG_head`. Une propriété `expression`
(entier) de l'armature commande laquelle est visible ; un pilote cache toutes les autres.
"""
import sys, os, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from gull_rig_lib import *

BAND = 0.07            # longueur de la zone où le cou de la tête est déformé pour rejoindre l'anneau du corps
TEX = 2048             # les textures des têtes sont ramenées à cette taille (le rendu final n'en demande pas plus)


def scale_image(img, size):
    if img and (img.size[0] > size or img.size[1] > size):
        img.scale(size, size)
        img.pack()                                          # sans cela le fichier garde l'original emballé


def soft_gain(img, sel, gain):
    """Multiplie par `gain` (3,) les texels choisis par `sel(rgb) -> poids 0..1`, par tranches (mémoire)."""
    w, h = img.size
    px = np.empty(w * h * 4, dtype=np.float32)
    img.pixels.foreach_get(px)
    px = px.reshape(h, w, 4)
    step = 256
    g = np.asarray(gain, dtype=np.float32)
    for y0 in range(0, h, step):
        blk = px[y0:y0 + step, :, :3]
        if sel is None:
            blk *= g
        else:
            wt = sel(blk)[..., None]
            blk *= 1.0 + wt * (g - 1.0)
    img.pixels.foreach_set(px.ravel())
    img.update()
    img.pack()


def hat_weight(rgb):
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    return np.clip((b / np.maximum(r, 1e-4) - 1.15) / 0.25, 0, 1) * (rgb.max(-1) > 0.12)


def orange_weight(rgb):
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    sat = (rgb.max(-1) - rgb.min(-1)) / np.maximum(rgb.max(-1), 1e-4)
    return np.clip((r / np.maximum(b, 1e-4) - 3.0) / 4.0, 0, 1) * np.clip((sat - 0.7) / 0.15, 0, 1) * (rgb.max(-1) > 0.16)


def cream_weight(rgb):
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    mx = rgb.max(-1); mn = rgb.min(-1)
    sat = (mx - mn) / np.maximum(mx, 1e-4)
    warm = np.clip((r / np.maximum(b, 1e-4) - 1.1) / 0.3, 0, 1) * np.clip((0.75 - sat) / 0.2, 0, 1)
    return warm * np.clip((mx - 0.2) / 0.2, 0, 1)


def add_heads(ao, body, heads):
    """Ajoute les têtes (dict nom -> chemin GLB) au corps rigué `body` / armature `ao`, dans la scène courante."""
    A = json.loads(ao['anchors'])
    zc = float(ao['z_cut'])
    cob = coords(body)
    ringm = np.abs(cob[:, 2] - zc) < 3e-4
    ring = cob[ringm][:, :2]
    cb = ring.mean(0)
    prof_b = polar_profile(ring, cb)
    colb = vertex_colors(body)
    neck_b = colb[(cob[:, 2] > zc - 0.06)].mean(0)
    print('anneau du corps : centre', cb.round(3), 'rayon moyen', float(prof_b.mean()).__round__(3), 'couleur du cou', neck_b.round(3))
    for m in body.data.materials:
        unify_material(m)
    hat_target = np.array(A.get('hat_col', [0.348, 0.361, 0.542])) * np.array([0.86, 0.74, 1.10])     # bleu-violet plus franc, comme le brouillon
    known = json.loads(ao['expression_names']) if 'expression_names' in ao.keys() else []
    names = list(known)
    for name in heads:
        if name in names:
            raise ValueError('tête déjà présente : ' + name)
        names.append(name)
    for name in heads:
        idx = names.index(name)
        h = import_glb(heads[name])
        h.name = 'GULL_head_' + name
        h.data.name = h.name
        co = coords(h)
        col = vertex_colors(h)
        cls = classify(col)
        a = head_anchor(co, cls)
        s = A['r_eff'] / a['r_eff']
        dyaw = math.radians(A['beak_yaw'] - a['beak_yaw'])
        cs, sn = math.cos(dyaw), math.sin(dyaw)
        p = co.astype(np.float64).copy()
        p[:, 0] -= a['cx']; p[:, 1] -= a['cy']; p[:, 2] -= a['z_ref']
        p *= s
        x, y = p[:, 0].copy(), p[:, 1].copy()
        p[:, 0] = cs * x - sn * y
        p[:, 1] = sn * x + cs * y
        p[:, 0] += A['cx']; p[:, 1] += A['cy']; p[:, 2] += A['z_ref']
        # --- anneau du cou de la tête, à la hauteur de coupe (tranche la plus fine qui contient assez de sommets)
        rv = None
        for half in (0.003, 0.005, 0.008, 0.012):
            rm = np.abs(p[:, 2] - zc) < half
            if rm.sum() >= 60:
                rv = p[rm][:, :2]
                break
        if rv is None:
            print('  !! ', name, ': pas assez de sommets au niveau de coupe', int(rm.sum()), 'zmin', float(p[:, 2].min()))
            rv = p[np.abs(p[:, 2] - zc) < 0.012][:, :2]
        cv = rv.mean(0)
        prof_v = polar_profile(rv, cv)
        rel = p[:, :2] - cv
        ang = np.arctan2(rel[:, 1], rel[:, 0])
        ratio = profile_at(prof_b, ang) / np.maximum(profile_at(prof_v, ang), 1e-4)
        tgt = cb + rel * ratio[:, None]
        f = np.clip((zc + BAND - p[:, 2]) / BAND, 0, 1)
        f = f * f * (3 - 2 * f)
        p[:, :2] += f[:, None] * (tgt - p[:, :2])
        tap = np.clip((zc - p[:, 2]) / 0.02, 0, 1)                     # sous l'anneau : le cou rentre dans celui du corps
        p[:, :2] = cb + (p[:, :2] - cb) * (1 - 0.07 * tap)[:, None]
        print('  %-10s échelle %.3f  cap %+5.1f°  cou : centre décalé %.3f  rayons %.3f→%.3f' % (name, s, math.degrees(dyaw), float(np.linalg.norm(cv - cb)), float(prof_v.mean()), float(prof_b.mean())))
        set_coords(h, p)
        bpy.context.view_layer.objects.active = h                       # normales : celles du fichier ne suivent pas la déformation
        try:
            bpy.ops.mesh.customdata_custom_splitnormals_clear()
        except Exception as e:
            print('   normales personnalisées non effacées :', e)
        h.data.shade_smooth()
        for m in h.data.materials:
            unify_material(m)
        # --- couleurs : chapeau et crème ramenés à ceux du corps
        img = base_image(h)
        scale_image(img, TEX)
        for m in h.data.materials:                                     # les autres cartes (rugosité, normales) : même taille
            if m and m.use_nodes:
                for nd in m.node_tree.nodes:
                    if nd.type == 'TEX_IMAGE' and nd.image and nd.image != img:
                        scale_image(nd.image, TEX)
        hat_v = col[cls == 'H'].mean(0)
        nm = (p[:, 2] > zc - 0.05) & (p[:, 2] < zc + 0.02) & (cls == 'c')
        neck_v = col[nm].mean(0) if nm.sum() > 10 else col[cls == 'c'].mean(0)
        g_hat = np.clip(hat_target / np.maximum(hat_v, 1e-4), 0.6, 1.6)
        g_cream = np.clip(neck_b / np.maximum(neck_v, 1e-4), 0.6, 1.6)
        print('     gain chapeau', g_hat.round(2), 'gain crème', g_cream.round(2))
        soft_gain(img, None, g_cream)                                   # crème : tout le dépliage, pour que le cou se raccorde
        g_hat = np.clip(hat_target / np.maximum(hat_v * g_cream, 1e-4), 0.6, 1.6)
        soft_gain(img, hat_weight, g_hat)                               # puis le bleu du chapeau seul
        soft_gain(img, orange_weight, np.array([1.05, 0.92, 0.85]))     # et un orange de bec plus vif
        # --- découpe sous l'anneau, liaison à l'os de la tête
        bm = bmesh.new()
        bm.from_mesh(h.data)
        cut = [v for v in bm.verts if v.co.z < zc - 0.03]
        bmesh.ops.delete(bm, geom=cut, context='VERTS')
        bm.to_mesh(h.data)
        bm.free()
        h.data.update()
        vg = h.vertex_groups.new(name='RIG_head')
        vg.add(list(range(len(h.data.vertices))), 1.0, 'REPLACE')
        bind(h, ao)
        h['expression_index'] = idx
        h['expression_name'] = name
        fc = h.driver_add('hide_render').driver
        fv = h.driver_add('hide_viewport').driver
        for d in (fc, fv):
            d.type = 'SCRIPTED'
            var = d.variables.new()
            var.name = 'e'
            var.type = 'SINGLE_PROP'
            var.targets[0].id = ao
            var.targets[0].data_path = '["expression"]'
            d.expression = 'abs(e - %d)' % idx           # nul (visible) seulement pour la tête choisie ; sans opérateur de comparaison, car dans Blender avec les scripts automatiques coupés le pilote serait jugé invalide
    ao['expression'] = int(ao['expression']) if 'expression' in ao.keys() else 0
    ao['expression_names'] = json.dumps(names)
    try:
        ao.id_properties_ui('expression').update(min=0, max=len(names) - 1, soft_min=0, soft_max=len(names) - 1)
    except Exception:
        pass
    return names


def main(rig_blend, out, heads):
    bpy.ops.wm.open_mainfile(filepath=os.path.abspath(rig_blend))
    names = add_heads(bpy.data.objects['ARM_gull'], bpy.data.objects['GULL_body'], heads)
    bpy.ops.wm.save_as_mainfile(filepath=os.path.abspath(out))
    print('OK', out, names)


if __name__ == '__main__':
    heads = {}
    for a in sys.argv[3:]:
        k, v = a.split('=', 1)
        heads[k] = v
    main(sys.argv[1], sys.argv[2], heads)
