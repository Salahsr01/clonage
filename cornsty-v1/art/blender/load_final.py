"""CORNSTY - charge la scene finale dans le Blender ouvert.

Mode d'emploi : dans Blender, onglet « Scripting » > « Nouveau » > coller ce fichier > « Executer le script » (Alt+P).
Il telecharge cs_lib.py, gull.py et build_final.py depuis le depot GitHub, puis les execute dans un meme espace de noms.
La scene `CORNSTY_Depart_Final` est ajoutee au fichier ouvert : rien n'est enregistre, les autres scenes ne sont pas touchees.
Reglages : ENGINE = 'CYCLES' (rendu final) ou 'EEVEE' (apercu rapide) ; QUALITY = 'final' (2048 x 1152) ou 'draft' (1024 x 576).
"""
import time
import urllib.request

BASE = 'https://raw.githubusercontent.com/Salahsr01/clonage/claude/elegant-newton-96gjm5/cornsty-v1/art/blender/'
ENGINE = 'CYCLES'
QUALITY = 'final'

ns = {'ENGINE': ENGINE, 'QUALITY': QUALITY, '__name__': 'cornsty_final'}
stamp = str(int(time.time()))                       # evite le cache du CDN de GitHub
for name in ('cs_lib.py', 'gull.py', 'build_final.py'):
    src = urllib.request.urlopen(BASE + name + '?t=' + stamp, timeout=60).read().decode('utf-8')
    exec(compile(src, name, 'exec'), ns)
print('CORNSTY_Depart_Final :', ns['result'])
