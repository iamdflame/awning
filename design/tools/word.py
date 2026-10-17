# Outline a word from a static TTF to an SVG path (y-down, baseline at size*0.78). Usage: python word.py font.ttf text size tracking_em
import sys, json
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
font = TTFont(sys.argv[1]); text = sys.argv[2]; size = float(sys.argv[3]); tr = float(sys.argv[4])
gs = font.getGlyphSet(); cmap = font.getBestCmap(); upm = font['head'].unitsPerEm; s = size / upm
x = 0; d = ''
for i, ch in enumerate(text):
    name = cmap[ord(ch)]
    pen = SVGPathPen(gs)
    tp = TransformPen(pen, (s, 0, 0, -s, x, size * 0.78))
    gs[name].draw(tp)
    d += pen.getCommands()
    x += gs[name].width * s + (tr * size if i < len(text) - 1 else 0)
print(json.dumps({'d': d, 'width': x}))
