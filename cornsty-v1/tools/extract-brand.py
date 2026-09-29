#!/usr/bin/env python3
"""
Extracts the *real vector artwork* of the Cornsty brand book (mascot, icon, wordmark, quatrefoil)
from the PDF and writes it as a small JS data module: src/js/art-data.js

  python3 tools/extract-brand.py /path/to/CORNSTY-brandbook.pdf

The PDF is NOT part of the repository. Only the generated art-data.js is committed.
Requires PyMuPDF (pip install pymupdf).

Each asset is a list of parts {id, d, role, z}. `role` is a colour slot the CSS fills in
(ink, cream, hat, beak, quat, dark ...), so the whole cast can be recoloured without touching the paths.
Coordinates are translated so that every asset has a convenient local origin (documented below).
"""
import json
import re
import sys
import pymupdf

if len(sys.argv) < 2:
    sys.exit('usage: python3 tools/extract-brand.py /path/to/CORNSTY-brandbook.pdf [out.js]')
PDF = sys.argv[1]
OUT = sys.argv[2] if len(sys.argv) > 2 else 'src/js/art-data.js'
doc = pymupdf.open(PDF)


def fmt(v):
    s = ('%.1f' % v).rstrip('0').rstrip('.')
    return '0' if s in ('-0', '') else s


def path_d(items, dx=0.0, dy=0.0):
    out, last = [], None

    def pt(p):
        return fmt(p.x + dx) + ' ' + fmt(p.y + dy)

    for it in items:
        k = it[0]
        if k == 'l':
            p1, p2 = it[1], it[2]
            if last is None or abs(last.x - p1.x) > .01 or abs(last.y - p1.y) > .01:
                out.append('M' + pt(p1))
            out.append('L' + pt(p2))
            last = p2
        elif k == 'c':
            p1, c1, c2, p2 = it[1], it[2], it[3], it[4]
            if last is None or abs(last.x - p1.x) > .01 or abs(last.y - p1.y) > .01:
                out.append('M' + pt(p1))
            out.append('C' + pt(c1) + ' ' + pt(c2) + ' ' + pt(p2))
            last = p2
        elif k == 're':
            r = it[1]
            out.append('M%s %sH%sV%sH%sZ' % (fmt(r.x0 + dx), fmt(r.y0 + dy), fmt(r.x1 + dx), fmt(r.y1 + dy), fmt(r.x0 + dx)))
            last = None
        elif k == 'qu':
            q = it[1]
            out.append('M' + pt(q.ul) + 'L' + pt(q.ur) + 'L' + pt(q.lr) + 'L' + pt(q.ll) + 'Z')
            last = None
    return ''.join(out)


def hx(c):
    return None if c is None else '#%02x%02x%02x' % tuple(int(round(v * 255)) for v in c)


_cache = {}


def drawings(page_no):
    if page_no not in _cache:
        _cache[page_no] = doc[page_no - 1].get_drawings()
    return _cache[page_no]


# fill colour in the (grayscale) PDF -> colour role used by the site
ROLE = {'#2a2a2a': 'ink', '#e3e3e3': 'hat', '#e0e0e0': 'cream', '#000000': 'beak', '#393939': 'quat', '#141414': 'ink'}


def part(page_no, idx, pid, ox, oy, role=None):
    d = drawings(page_no)[idx]
    fill = hx(d.get('fill'))
    r = role or ROLE.get(fill, 'ink')
    return {'id': pid, 'd': path_d(d['items'], -ox, -oy), 'role': r, 'src': '%d/%d' % (page_no, idx)}


def bbox_of(page_no, idxs):
    xs0, ys0, xs1, ys1 = [], [], [], []
    for i in idxs:
        r = drawings(page_no)[i]['rect']
        xs0.append(r.x0); ys0.append(r.y0); xs1.append(r.x1); ys1.append(r.y1)
    return min(xs0), min(ys0), max(xs1), max(ys1)


art = {}

# ---------------------------------------------------------------- GULL (page 17, pose 1 = walking with surfboard)
# origin = centre of the feet line: (390, 769) in page units
GX, GY = 390.0, 769.0
p = 17
gull = {
    'origin': [GX, GY],
    'parts': {
        # hat: crown, band, seams, tuft, brim (front)
        'crown': part(p, 49, 'crown', GX, GY), 'crownL': part(p, 50, 'crownL', GX, GY),
        'band': part(p, 51, 'band', GX, GY), 'bandL': part(p, 52, 'bandL', GX, GY),
        'seam1': part(p, 53, 'seam1', GX, GY), 'seam2': part(p, 54, 'seam2', GX, GY),
        'tuft': part(p, 55, 'tuft', GX, GY),
        'brim': part(p, 70, 'brim', GX, GY), 'brimL': part(p, 71, 'brimL', GX, GY),
        # face
        'glasses': part(p, 72, 'glasses', GX, GY),
        'faceL': part(p, 73, 'faceL', GX, GY), 'faceR': part(p, 74, 'faceR', GX, GY),
        'beak': part(p, 75, 'beak', GX, GY), 'beakL': part(p, 76, 'beakL', GX, GY),
        'mouthF': part(p, 77, 'mouthF', GX, GY, 'ink'), 'mouthL': part(p, 78, 'mouthL', GX, GY),
        # torso
        'body': part(p, 56, 'body', GX, GY), 'wingTop': part(p, 57, 'wingTop', GX, GY), 'wingIn': part(p, 58, 'wingIn', GX, GY),
        'tail': part(p, 59, 'tail', GX, GY), 'chest': part(p, 60, 'chest', GX, GY), 'neckL': part(p, 61, 'neckL', GX, GY),
        # legs (A = left one, B = right one)
        'legA': part(p, 62, 'legA', GX, GY), 'toeA1': part(p, 64, 'toeA1', GX, GY), 'toeA2': part(p, 66, 'toeA2', GX, GY), 'kneeA': part(p, 68, 'kneeA', GX, GY),
        'legB': part(p, 63, 'legB', GX, GY), 'toeB1': part(p, 65, 'toeB1', GX, GY), 'toeB2': part(p, 67, 'toeB2', GX, GY), 'kneeB': part(p, 69, 'kneeB', GX, GY),
        # surf board (pose 1) - used as a prop / easter egg
        'board': part(p, 47, 'board', GX, GY, 'board'), 'boardL': part(p, 48, 'boardL', GX, GY),
    },
}
art['gull'] = gull

# wing (pose 3, near wing, fill + outline). origin = root of the wing (left end, middle)
wx0, wy0, wx1, wy1 = bbox_of(17, [85, 86])
WX, WY = wx0 + 6, (wy0 + wy1) / 2 - 8
art['wing'] = {'origin': [WX, WY], 'w': wx1 - wx0, 'h': wy1 - wy0,
               'parts': [part(17, 85, 'wingF', WX, WY), part(17, 86, 'wingL', WX, WY)]}

# ---------------------------------------------------------------- pose sprites (page 17): swim ring (pose 2) and snowboard (pose 3)
def pose(idxs, name):
    x0, y0, x1, y1 = bbox_of(17, idxs)
    cx, cy = (x0 + x1) / 2, y1
    return {'origin': [cx, cy], 'w': x1 - x0, 'h': y1 - y0,
            'parts': [part(17, i, '%s%d' % (name, i), cx, cy, 'ring' if hx(drawings(17)[i].get('fill')) == '#393939' else None) for i in idxs]}


art['poseRing'] = pose(list(range(6, 47)), 'r')
art['poseBoard'] = pose(list(range(79, 110)), 'b')
art['poseSurf'] = pose(list(range(47, 79)), 's')

# ---------------------------------------------------------------- ICON (page 14, final lock-up: quatrefoil + front-facing gull head)
ix0, iy0, ix1, iy1 = bbox_of(14, [7])
IX, IY = (ix0 + ix1) / 2, iy0
icon_idx = [7] + list(range(9, 30))
art['icon'] = {'origin': [IX, IY], 'w': ix1 - ix0, 'h': iy1 - iy0,
               'parts': [part(14, i, 'i%d' % i, IX, IY, 'quat' if i == 7 else None) for i in icon_idx]}

# ---------------------------------------------------------------- QUATREFOIL (page 21, 9-item bezier path)
qx0, qy0, qx1, qy1 = bbox_of(21, [13])
art['quat'] = {'w': qx1 - qx0, 'h': qy1 - qy0, 'd': path_d(drawings(21)[13]['items'], -qx0, -qy0)}

# ---------------------------------------------------------------- WORDMARK (page 12): c o r n s t y + the little quatrefoil inside the c
order = [6, 7, 8, 9, 11, 10, 12]  # c o r n s t y
wx0, wy0, wx1, wy1 = bbox_of(12, order + [13])
art['wordmark'] = {'w': wx1 - wx0, 'h': wy1 - wy0,
                   'letters': [part(12, i, 'wm%d' % i, wx0, wy0, 'word') for i in order],
                   'mark': part(12, 13, 'wmq', wx0, wy0, 'wordq')}


# ---------------------------------------------------------------- LONG-NECK GULL (page 18, "seagull brush", 3rd bird = the one on the packs)
lx0, ly0, lx1, ly1 = bbox_of(18, list(range(74, 103)))
LX, LY = (lx0 + lx1) / 2, ly1
art['gullLong'] = {'origin': [LX, LY], 'w': lx1 - lx0, 'h': ly1 - ly0,
                   'parts': [part(18, i, 'l%d' % i, LX, LY) for i in range(74, 103)]}
# 2nd bird of page 18 = medium neck (the one standing on the packs)
mx0, my0, mx1, my1 = bbox_of(18, list(range(45, 74)))
MX, MY = (mx0 + mx1) / 2, my1
art['gullMid'] = {'origin': [MX, MY], 'w': mx1 - mx0, 'h': my1 - my0,
                  'parts': [part(18, i, 'm%d' % i, MX, MY) for i in range(45, 74)]}
# the standing bird with the open beak (page 18, 1st bird) - used for small side-view spots
sx0, sy0, sx1, sy1 = bbox_of(18, list(range(8, 37)))
SX, SY = (sx0 + sx1) / 2, sy1
art['gullSide'] = {'origin': [SX, SY], 'w': sx1 - sx0, 'h': sy1 - sy0,
                   'parts': [part(18, i, 's%d' % i, SX, SY) for i in range(8, 37)]}

js = ('/* GENERATED by tools/extract-brand.py from the Cornsty brand book vectors - do not edit by hand. */\n'
      '(function (C) { C.art = ' + json.dumps(art, separators=(',', ':')) + '; })(window.Cornsty = window.Cornsty || {});\n')
with open(OUT, 'w') as f:
    f.write(js)
print('wrote', OUT, len(js) // 1024, 'KB')
