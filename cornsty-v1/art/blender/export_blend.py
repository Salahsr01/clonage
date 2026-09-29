"""CORNSTY - exporte la scene finale en un .blend propre (une seule scene, textures empaquetees), pret a ouvrir dans Blender.
usage : python3 export_blend.py sortie.blend
"""
import sys, os, glob, importlib.util
spec = importlib.util.find_spec('bpy')
_root = list(spec.submodule_search_locations)[0]
_cfg = glob.glob(os.path.join(_root, '*', 'datafiles', 'colormanagement', 'config.ocio'))
if _cfg:
    os.environ.setdefault('OCIO', _cfg[0])
    os.environ.setdefault('BLENDER_SYSTEM_RESOURCES', os.path.dirname(os.path.dirname(os.path.dirname(_cfg[0]))))
import bpy

A = os.path.dirname(os.path.abspath(__file__)) + '/'
ns = {'ASSET_DIR': A[:-1], 'ENGINE': 'CYCLES', 'QUALITY': 'final', '__name__': 'build'}
for f in ('cs_lib.py', 'gull.py', 'build_final.py'):
    exec(compile(open(A + f).read(), f, 'exec'), ns)
sc = bpy.data.scenes['CORNSTY_Depart_Final']
for s in list(bpy.data.scenes):                      # on ne garde que la scene finale
    if s != sc:
        for o in list(s.objects):
            bpy.data.objects.remove(o, do_unlink=True)
        bpy.data.scenes.remove(s)
for img in bpy.data.images:                          # textures empaquetees : le fichier est autonome
    if img.source == 'FILE' and not img.packed_file:
        try:
            img.pack()
        except Exception as e:
            print('pack failed', img.name, e)
out = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else 'cornsty-depart-final.blend')
bpy.ops.wm.save_as_mainfile(filepath=out, compress=True)
print('SAVED', out, round(os.path.getsize(out) / 1e6, 1), 'Mo,', len([i for i in bpy.data.images if i.packed_file]), 'images empaquetees')
