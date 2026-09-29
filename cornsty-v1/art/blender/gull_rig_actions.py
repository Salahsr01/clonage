"""CORNSTY - étape 3 : les mouvements de la Mouette (actions Blender) sur le squelette `ARM_gull`.

usage : python3 gull_rig_actions.py mouette.blend sortie.blend
Chaque mouvement est une fonction du temps t (0..1) qui donne, pour chaque os, des rotations autour des axes du MONDE
(X avant, Y gauche, Z haut, en degrés) et un décalage éventuel ; le module l'échantillonne en images clés. Les boucles se
referment (première et dernière images identiques). L'expression (tête visible) est aussi une image clé, sans interpolation.
Actions : idle, parle, salue, joie, surprise, sommeil, clin_doeil, marche, saut.
"""
import sys, os, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from gull_rig_lib import *

TAU = 2 * math.pi
X, Y, Z = (1, 0, 0), (0, 1, 0), (0, 0, 1)
EXPR = {'neutral': 0, 'half': 1, 'talk': 2, 'surprised': 3, 'wink': 4, 'sleepy': 5, 'cheer': 6}
FPS = 24


def sm(t):                       # 0 -> 1 -> 0 doux sur un cycle
    return 0.5 - 0.5 * math.cos(TAU * t)


def ease(t):                     # 0 -> 1 doux
    t = min(max(t, 0.0), 1.0)
    return t * t * (3 - 2 * t)


def idle(t):
    s, c = math.sin(TAU * t), math.cos(TAU * t)
    return {'pose': {
        'RIG_hips': dict(loc=(0, 0, 0.004 * sm(t))),
        'RIG_chest': dict(rots=[(Y, 1.2 * s)]),
        'RIG_neck1': dict(rots=[(Y, -2.0 * s)]),
        'RIG_neck2': dict(rots=[(Y, -1.5 * s)]),
        'RIG_head': dict(rots=[(Z, 5 * math.sin(TAU * t)), (Y, 1.5 * c)]),
        'RIG_wing1_L': dict(rots=[(X, 1.5 * s)]), 'RIG_wing1_R': dict(rots=[(X, -1.5 * s)]),
        'RIG_tail': dict(rots=[(Z, 3 * math.sin(2 * TAU * t)), (Y, 1.0 * s)]),
    }, 'expr': 0}


def parle(t):
    s = math.sin(TAU * 2 * t)
    ph = (t * 4) % 1.0                                  # ouvre / mi-ouvert / ferme
    e = 2 if ph < 0.25 else 1 if ph < 0.5 else 0 if ph < 0.6 else 1 if ph < 0.75 else 2 if ph < 0.9 else 0
    return {'pose': {
        'RIG_hips': dict(loc=(0, 0, 0.004 * sm(2 * t))),
        'RIG_chest': dict(rots=[(Y, 1.0 * s)]),
        'RIG_neck1': dict(rots=[(Y, 3 * s)]),
        'RIG_neck2': dict(rots=[(Y, 2 * s)]),
        'RIG_head': dict(rots=[(Y, 4 * s), (Z, 6 * math.sin(TAU * t))]),
        'RIG_wing1_L': dict(rots=[(X, 3 + 4 * sm(2 * t))]), 'RIG_wing1_R': dict(rots=[(X, -3 - 4 * sm(2 * t))]),
    }, 'expr': e}


def salue(t):
    up = ease(min(t / 0.2, 1.0)) * ease(min((1 - t) / 0.2, 1.0))
    w = math.sin(TAU * 3 * t)
    return {'pose': {
        'RIG_chest': dict(rots=[(X, -4 * up)]),
        'RIG_neck1': dict(rots=[(X, 6 * up)]),
        'RIG_head': dict(rots=[(X, 10 * up * math.sin(TAU * 3 * t)), (Z, 8 * up)]),
        'RIG_wing1_L': dict(rots=[(X, 78 * up), (Z, -12 * up)]),
        'RIG_wing2_L': dict(rots=[(X, 28 * up * w)]),
        'RIG_wing1_R': dict(rots=[(X, -3)]),
        'RIG_tail': dict(rots=[(Z, 10 * up * w)]),
    }, 'expr': 6 if 0.12 < t < 0.88 else 0}


def joie(t):
    hop = abs(math.sin(TAU * 2 * t))
    flap = math.sin(TAU * 4 * t)
    return {'pose': {
        'RIG_root': dict(loc=(0, 0, 0.10 * hop)),
        'RIG_chest': dict(rots=[(Y, -3 * hop)]),
        'RIG_neck1': dict(rots=[(Y, -5 * hop)]),
        'RIG_head': dict(rots=[(Z, 8 * math.sin(TAU * 2 * t)), (Y, -4 * hop)]),
        'RIG_wing1_L': dict(rots=[(X, 70 + 22 * flap)]), 'RIG_wing1_R': dict(rots=[(X, -70 - 22 * flap)]),
        'RIG_wing2_L': dict(rots=[(X, 18 * flap)]), 'RIG_wing2_R': dict(rots=[(X, -18 * flap)]),
        'RIG_thigh_L': dict(rots=[(Y, -14 * hop)]), 'RIG_thigh_R': dict(rots=[(Y, -14 * hop)]),
        'RIG_tail': dict(rots=[(Y, 14 * hop)]),
    }, 'expr': 6}


def surprise(t):
    k = ease(t / 0.25) * (1 - ease((t - 0.7) / 0.3))
    return {'pose': {
        'RIG_root': dict(loc=(-0.04 * k, 0, 0.02 * k)),
        'RIG_chest': dict(rots=[(Y, -8 * k)]),
        'RIG_neck1': dict(rots=[(Y, -14 * k)]),
        'RIG_neck2': dict(rots=[(Y, -10 * k)]),
        'RIG_head': dict(rots=[(Y, 6 * k)]),
        'RIG_wing1_L': dict(rots=[(X, 38 * k)]), 'RIG_wing1_R': dict(rots=[(X, -38 * k)]),
        'RIG_wing2_L': dict(rots=[(X, 12 * k)]), 'RIG_wing2_R': dict(rots=[(X, -12 * k)]),
        'RIG_tail': dict(rots=[(Y, 22 * k)]),
    }, 'expr': 3 if 0.05 < t < 0.85 else 0}


def sommeil(t):
    s = math.sin(TAU * t)
    return {'pose': {
        'RIG_hips': dict(loc=(0, 0, -0.01 + 0.004 * sm(t))),
        'RIG_chest': dict(rots=[(Y, 4 + 1.5 * s)]),
        'RIG_neck1': dict(rots=[(Y, 14 - 2 * s)]),
        'RIG_neck2': dict(rots=[(Y, 12 - 2 * s)]),
        'RIG_head': dict(rots=[(Y, 8), (X, 10), (Z, 0)]),
        'RIG_wing1_L': dict(rots=[(X, -2)]), 'RIG_wing1_R': dict(rots=[(X, 2)]),
    }, 'expr': 5}


def clin_doeil(t):
    k = ease(t / 0.3) * (1 - ease((t - 0.75) / 0.25))
    return {'pose': {
        'RIG_neck1': dict(rots=[(X, 8 * k)]),
        'RIG_neck2': dict(rots=[(X, 6 * k)]),
        'RIG_head': dict(rots=[(X, 12 * k), (Z, -6 * k)]),
        'RIG_wing1_L': dict(rots=[(X, 10 * k)]),
    }, 'expr': 4 if 0.15 < t < 0.85 else 0}


def marche(t):
    a = math.sin(TAU * t)
    b = math.sin(TAU * t + math.pi)
    bob = abs(math.sin(TAU * t))
    return {'pose': {
        'RIG_root': dict(loc=(0, 0, 0.012 * bob)),
        'RIG_hips': dict(rots=[(Z, 5 * a)]),
        'RIG_chest': dict(rots=[(Z, -4 * a), (Y, 2 * bob)]),
        'RIG_neck1': dict(rots=[(Y, 4 * math.sin(TAU * t + 1.0))]),
        'RIG_neck2': dict(rots=[(Y, -3 * math.sin(TAU * t + 1.0))]),
        'RIG_head': dict(rots=[(Z, 3 * a)]),
        'RIG_thigh_L': dict(rots=[(Y, 26 * a)]), 'RIG_thigh_R': dict(rots=[(Y, 26 * b)]),
        'RIG_shin_L': dict(rots=[(Y, -18 * max(0.0, math.cos(TAU * t)))]), 'RIG_shin_R': dict(rots=[(Y, -18 * max(0.0, -math.cos(TAU * t)))]),
        'RIG_foot_L': dict(rots=[(Y, -26 * a + 10 * max(0.0, math.cos(TAU * t)))]), 'RIG_foot_R': dict(rots=[(Y, -26 * b + 10 * max(0.0, -math.cos(TAU * t)))]),
        'RIG_wing1_L': dict(rots=[(X, 3 + 2 * bob)]), 'RIG_wing1_R': dict(rots=[(X, -3 - 2 * bob)]),
        'RIG_tail': dict(rots=[(Z, 8 * a), (Y, 4 * bob)]),
    }, 'expr': 0}


def saut(t):
    crouch = ease(t / 0.2) * (1 - ease((t - 0.2) / 0.1))
    air = math.sin(math.pi * min(max((t - 0.3) / 0.45, 0.0), 1.0))
    land = ease((t - 0.75) / 0.1) * (1 - ease((t - 0.85) / 0.15))
    d = 0.6 * crouch + 0.4 * land
    return {'pose': {
        'RIG_root': dict(loc=(0, 0, 0.32 * air - 0.05 * d)),
        'RIG_hips': dict(rots=[(Y, 12 * d)]),
        'RIG_chest': dict(rots=[(Y, 8 * d - 10 * air)]),
        'RIG_neck1': dict(rots=[(Y, -6 * air)]),
        'RIG_thigh_L': dict(rots=[(Y, 34 * d - 28 * air)]), 'RIG_thigh_R': dict(rots=[(Y, 34 * d - 28 * air)]),
        'RIG_shin_L': dict(rots=[(Y, -40 * d + 30 * air)]), 'RIG_shin_R': dict(rots=[(Y, -40 * d + 30 * air)]),
        'RIG_foot_L': dict(rots=[(Y, 12 * d - 20 * air)]), 'RIG_foot_R': dict(rots=[(Y, 12 * d - 20 * air)]),
        'RIG_wing1_L': dict(rots=[(X, 8 * d + 62 * air)]), 'RIG_wing1_R': dict(rots=[(X, -8 * d - 62 * air)]),
        'RIG_tail': dict(rots=[(Y, 18 * air)]),
    }, 'expr': 6 if air > 0.1 else 0}


ACTIONS = {          # nom : (fonction, images, boucle)
    'idle': (idle, 48, True), 'parle': (parle, 24, True), 'salue': (salue, 48, False), 'joie': (joie, 48, True),
    'surprise': (surprise, 36, False), 'sommeil': (sommeil, 72, True), 'clin_doeil': (clin_doeil, 30, False),
    'marche': (marche, 24, True), 'saut': (saut, 36, False),
}


def all_fcurves(action):
    try:
        return list(action.fcurves)
    except Exception:
        out = []
        for layer in action.layers:
            for strip in layer.strips:
                for cb in strip.channelbags:
                    out += list(cb.fcurves)
        return out


def make_action(ao, name, fn, n, loop):
    for a in bpy.data.actions:
        if a.name == name:
            bpy.data.actions.remove(a)
    act = bpy.data.actions.new(name)
    act.use_fake_user = True
    if not ao.animation_data:
        ao.animation_data_create()
    ao.animation_data.action = act
    frames = range(0, n + 1) if loop else range(0, n + 1)
    for f in frames:
        t = (f / n) if loop else f / n
        if loop and f == n:
            t = 0.0                                          # la boucle se referme
        spec = fn(t)
        pose_reset(ao)
        for bone, d in spec['pose'].items():
            pb = ao.pose.bones[bone]
            if 'rots' in d:
                pose_rots(ao, bone, d['rots'])
            if 'loc' in d:
                pb.location = d['loc']
        for pb in ao.pose.bones:
            if pb.name in spec['pose']:
                pb.keyframe_insert('rotation_quaternion', frame=f + 1)
                pb.keyframe_insert('location', frame=f + 1)
        ao['expression'] = int(spec['expr'])
        ao.keyframe_insert('["expression"]', frame=f + 1)
    for fc in all_fcurves(act):
        if fc.data_path == '["expression"]':
            for kp in fc.keyframe_points:
                kp.interpolation = 'CONSTANT'
    act['loop'] = bool(loop)
    act['frames'] = n
    return act


def main(src, out):
    bpy.ops.wm.open_mainfile(filepath=os.path.abspath(src))
    ao = bpy.data.objects['ARM_gull']
    sc = bpy.context.scene
    sc.render.fps = FPS
    for nm, (fn, n, loop) in ACTIONS.items():
        make_action(ao, nm, fn, n, loop)
        print('action', nm, n, 'images', 'boucle' if loop else 'unique')
    pose_reset(ao)
    ao.animation_data.action = bpy.data.actions['idle']
    ao['expression'] = 0
    sc.frame_start, sc.frame_end = 1, 48
    bpy.ops.wm.save_as_mainfile(filepath=os.path.abspath(out))
    print('OK', out)


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
