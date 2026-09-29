"""CORNSTY - charge la Mouette Higgsfield rigguée (corps + 7 têtes d'expression + mouvements) dans le Blender ouvert.

Rien n'est enregistré, les autres scènes ne sont pas touchées : tout arrive dans une NOUVELLE scène `CORNSTY_Mouette_Rig`.
Le travail est découpé en étapes courtes (le pont vers Blender coupe les appels trop longs) :

    ns = {}; exec(urllib.request.urlopen(BASE + 'load_gull_rig.py').read().decode(), ns)
    ns['fetch']()             # télécharge les scripts et les 8 modèles Higgsfield (en arrière-plan)
    ns['status']()            # attend que tout soit là
    ns['scene']()             # crée la scène
    ns['body']()              # corps : coupe du cou, poids de peau, armature
    ns['head']('neutral')     # une tête par appel (neutral, half, talk, surprised, wink, sleepy, cheer)
    ns['actions']()           # mouvements : idle, parle, salue, joie, surprise, sommeil, clin_doeil, marche, saut
    ns['stage']()             # lumières, caméra, fenêtre 3D

Les modèles viennent de Higgsfield (Tripo image vers 3D, remaillage Meshy) ; les portraits sources, de Nano Banana Pro.
"""
import os
import sys
import json
import time
import tempfile
import threading
import importlib
import urllib.request
import bpy

BASE = 'https://raw.githubusercontent.com/Salahsr01/clonage/claude/elegant-newton-96gjm5/cornsty-v1/art/blender/'
CF = 'https://d8j0ntlcm91z4.cloudfront.net/user_2zr0WKTFzPVy40tAzPjwmD5zi1u/'
ASSETS = {                                   # nom : (fichier local, URL)
    'body': 'hf_20260929_224610_f2cd8933-82d6-4d22-89b5-390c95ec76e0.glb',
    'neutral': 'hf_20260929_224622_d2281d72-257b-46c4-b885-a616fb36f2f1.glb',
    'half': 'hf_20260929_224625_1f556cdf-f302-481b-8671-3c1a26936f4a.glb',
    'talk': 'hf_20260929_224541_e7140423-f120-427b-8388-a064d46020d8.glb',
    'surprised': 'hf_20260929_224542_11ab6dcb-7de4-4919-a8cb-6ace74c14e11.glb',
    'wink': 'hf_20260929_224544_ee917243-7b8e-43da-8e52-3eee04e31bf7.glb',
    'sleepy': 'hf_20260929_224547_ece2ae07-f0f7-4507-9233-e294b386d2ed.glb',
    'cheer': 'hf_20260929_224549_a0d13396-6a28-4095-bd0a-9403a83946f1.glb',
}
SCRIPTS = ['gull_rig_lib.py', 'gull_rig_build.py', 'gull_rig_heads.py', 'gull_rig_actions.py']
SCENE = 'CORNSTY_Mouette_Rig'
DIR = os.environ.get('CS_GULL_DIR') or os.path.join(tempfile.gettempdir(), 'cornsty_gull')
_state = {'errors': []}


def _download(url, dest):
    tmp = dest + '.part'
    try:
        with urllib.request.urlopen(url, timeout=120) as r, open(tmp, 'wb') as f:
            while True:
                b = r.read(1 << 20)
                if not b:
                    break
                f.write(b)
        os.replace(tmp, dest)
    except Exception as e:                    # noqa
        _state['errors'].append('%s : %s' % (os.path.basename(dest), e))


def fetch(force_scripts=True):
    """Lance les téléchargements en arrière-plan (les scripts sont toujours rechargés, les modèles seulement s'ils manquent)."""
    os.makedirs(DIR, exist_ok=True)
    _state['errors'] = []
    stamp = str(int(time.time()))
    jobs = []
    for s in SCRIPTS:
        if force_scripts or not os.path.exists(os.path.join(DIR, s)):
            jobs.append((BASE + s + '?t=' + stamp, os.path.join(DIR, s)))
    for k, f in ASSETS.items():
        if not os.path.exists(os.path.join(DIR, f)):
            jobs.append((CF + f, os.path.join(DIR, f)))
    for url, dest in jobs:
        threading.Thread(target=_download, args=(url, dest), daemon=True).start()
    return {'lancés': len(jobs), 'dossier': DIR}


def status():
    have = {f: os.path.exists(os.path.join(DIR, f)) for f in SCRIPTS + list(ASSETS.values())}
    return {'prêts': sum(have.values()), 'total': len(have), 'manquants': [k for k, v in have.items() if not v], 'erreurs': _state['errors']}


def _mods():
    if DIR not in sys.path:
        sys.path.insert(0, DIR)
    out = {}
    for n in ('gull_rig_lib', 'gull_rig_build', 'gull_rig_heads', 'gull_rig_actions'):
        m = sys.modules.get(n)
        out[n] = importlib.reload(m) if m else importlib.import_module(n)
    return out


def _path(name):
    return os.path.join(DIR, ASSETS[name])


def _gull():
    ao = next((o for o in bpy.context.scene.objects if o.type == 'ARMATURE' and o.name.startswith('ARM_gull')), None)
    body = next((o for o in bpy.context.scene.objects if o.name.startswith('GULL_body')), None)
    return ao, body


def _switch_scene(sc):
    win = getattr(bpy.context, 'window', None)
    if win is not None:
        win.scene = sc


def scene():
    """Nouvelle scène `CORNSTY_Mouette_Rig` (l'ancienne du même nom est remplacée, jamais autre chose)."""
    old = bpy.data.scenes.get(SCENE)
    if old:
        other = next(s for s in bpy.data.scenes if s != old)
        _switch_scene(other)
        objs = list(old.objects)
        cols = list(old.collection.children_recursive)
        for o in objs:
            bpy.data.objects.remove(o, do_unlink=True)
        for c in cols:
            bpy.data.collections.remove(c)
        bpy.data.scenes.remove(old)
        for coll in (bpy.data.meshes, bpy.data.materials, bpy.data.images, bpy.data.armatures, bpy.data.actions):
            for d in [d for d in coll if d.users == 0 and (d.name.startswith('GULL_') or d.name.startswith('ARM_gull') or d.name.startswith('tripo_') or d.name.startswith('Color_') or d.name.startswith('ORM_') or d.name.startswith('NormalGL_') or d.name.startswith('texture_0') or d.name.startswith('BakedMaterial'))]:
                coll.remove(d)
    sc = bpy.data.scenes.new(SCENE)
    _switch_scene(sc)
    sc.render.fps = 24
    return {'scène': sc.name}


def body():
    m = _mods()
    lib = m['gull_rig_lib']
    col = lib.use_collection('COL_GULL')
    t = time.time()
    o, ao = m['gull_rig_build'].build_body(_path('body'), col)
    bpy.context.view_layer.update()
    return {'corps': o.name, 'armature': ao.name, 'os': len(ao.data.bones), 'sommets': len(o.data.vertices), 'secondes': round(time.time() - t, 1)}


def head(name):
    m = _mods()
    m['gull_rig_lib'].use_collection('COL_GULL')
    ao, bd = _gull()
    t = time.time()
    names = m['gull_rig_heads'].add_heads(ao, bd, {name: _path(name)})
    bpy.context.view_layer.update()
    return {'têtes': names, 'secondes': round(time.time() - t, 1)}


def actions():
    m = _mods()
    ao, _ = _gull()
    m['gull_rig_actions'].make_all(ao)
    return {'actions': [a.name for a in bpy.data.actions if a.name in m['gull_rig_actions'].ACTIONS]}


def stage(az=50.0):
    """Lumières, caméra et vue 3D de contrôle (matières, vue caméra)."""
    import math
    from mathutils import Vector
    m = _mods()
    lib = m['gull_rig_lib']
    col = lib.use_collection('COL_GULL_STAGE')
    sc = bpy.context.scene
    c = Vector((0.0, 0.0, 0.55))

    def area(name, energy, color, loc, size):
        li = bpy.data.lights.new(name, 'AREA')
        li.energy, li.color, li.size = energy, color, size
        ob = bpy.data.objects.new(name, li)
        col.objects.link(ob)
        ob.location = loc
        ob.rotation_euler = (c - ob.location).to_track_quat('-Z', 'Y').to_euler()
    area('LGT_key', 300, (1.0, 0.86, 0.66), (2.2, -2.2, 2.4), 2.4)
    area('LGT_fill', 90, (0.8, 0.84, 1.0), (-2.4, -1.8, 1.4), 3.0)
    area('LGT_rim', 240, (1.0, 0.85, 0.6), (1.4, 2.4, 2.2), 1.6)
    w = bpy.data.worlds.new('W_gull')
    w.use_nodes = True
    w.node_tree.nodes['Background'].inputs['Color'].default_value = (0.74, 0.72, 0.70, 1)
    sc.world = w
    cd = bpy.data.cameras.new('CAM_gull')
    cd.lens, cd.sensor_width = 70, 36
    cam = bpy.data.objects.new('CAM_gull', cd)
    col.objects.link(cam)
    r = math.radians(az)
    cam.location = (2.9 * math.sin(r), -2.9 * math.cos(r), 0.65)
    cam.rotation_euler = (c - cam.location).to_track_quat('-Z', 'Y').to_euler()
    sc.camera = cam
    sc.render.resolution_x, sc.render.resolution_y = 1080, 1350
    win = getattr(bpy.context, 'window_manager', None)
    if win:
        for window in win.windows:
            for area_ in window.screen.areas:
                if area_.type == 'VIEW_3D':
                    sp = area_.spaces.active
                    sp.shading.type = 'MATERIAL'
                    sp.region_3d.view_perspective = 'CAMERA'
    return {'caméra': cam.name}
