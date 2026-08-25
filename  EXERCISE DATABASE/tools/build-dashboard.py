#!/usr/bin/env python3
"""
BUILD THE DASHBOARD

  node "EXERCISE DATABASE/tools/derive.mjs"        # first
  python3 "EXERCISE DATABASE/tools/build-dashboard.py"

Inlines the movement data into dashboard.template.html and writes
EXERCISE DATABASE/DASHBOARD.html — self-contained, no external requests.
"""
import json, os

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, '..')

with open(os.path.join(ROOT, 'workbook', '_derived.json')) as f:
    rows = json.load(f)

def split(s):
    return [x.strip() for x in s.split(',') if x.strip()]

web = [{
    'n': r['name'],
    'd': r['modality'],
    'fn': r['functional'] == 'TRUE',
    'b': r['bridges_to'],
    'p': split(r['patterns']),
    'l': r['level'] or '',
    'x': r['diff'] if r['diff'] != '' else None,
    'e': split(r['equipment']),
    'r': split(r['role']),
    't': r['track'] or '',
    's': r['status'],
    'k': r['is_skill'] == 'TRUE',
    'a': r['art'],
    'f': r['fundamental'],
    'ld': r.get('ladder',''),
    'lr': r.get('ladder_role',''),
    'lp': r.get('ladder_pos',''),
} for r in rows]

# the ladders, with each rung resolved to its display name and level
with open(os.path.join(HERE, 'fundamental-ladders.json')) as f:
    LAD = json.load(f)
byid = {r['id']: r for r in rows}
def rung(mid):
    r = byid.get(mid)
    return None if not r else {'n': r['name'], 'l': r['level'], 'd': r['diff'], 'a': r['art']}
with open(os.path.join(HERE, 'gym-lanes.json')) as f:
    GYM = json.load(f)

def lane_of(lid):
    l = GYM['lanes'].get(lid)
    if not l:
        return {'none': GYM['no_lane'].get(lid, '')}
    return {'easier': [x for x in (rung(m) for m in l['easier']) if x],
            'anch':   rung(l['anchor']),
            'harder': [x for x in (rung(m) for m in l['harder']) if x],
            'why':    l['why']}

GROUP = {'squat':'Lower','hinge':'Lower','glute':'Lower','single-leg':'Lower',
         'h-push':'Push','v-push':'Push',
         'h-pull':'Pull','v-pull':'Pull','straight-arm-pull':'Pull',
         'carry-grip':'Carry & grip',
         'core-static':'Core','core-dynamic':'Core','rotation':'Core','anti-rotation':'Core',
         'explosive':'Power & conditioning','full-body':'Power & conditioning',
         'mobility':'Mobility'}
SPECIAL = {'lateral':'Lower', 'core_lateral':'Core'}

ladders = [{
    'name': name, 'family': family, 'tier': tier,
    'reg':  [x for x in (rung(m) for m in regs) if x],
    'anch': rung(anchor),
    'prog': [x for x in (rung(m) for m in progs) if x],
    'gym':  lane_of(lid),
    'grp':  SPECIAL.get(lid) or GROUP.get(family, 'Other'),
} for lid, name, family, tier, anchor, regs, progs in LAD['ladders']]

# the fifty, with the database name appended so the page can look up artwork
byid = {r['id']: r['name'] for r in rows}
with open(os.path.join(HERE, 'fundamentals.json')) as f:
    fund = [row + [byid.get(row[4]) if row[4] else None]
            for row in json.load(f)['list']]

with open(os.path.join(HERE, 'dashboard.template.html')) as f:
    html = f.read()

assert '__DATA__' in html, 'template lost its __DATA__ placeholder'
# ensure_ascii is the default and is what we want — the data lands as \uXXXX
html = html.replace('__DATA__', json.dumps(web, separators=(',', ':')))
assert '__FUND__' in html, 'template lost its __FUND__ placeholder'
html = html.replace('__FUND__', json.dumps(fund, separators=(',', ':')))
assert '__LADDERS__' in html, 'template lost its __LADDERS__ placeholder'
html = html.replace('__LADDERS__', json.dumps(ladders, separators=(',', ':')))

# ---- make the whole file pure ASCII -------------------------------------
# The page has no <head> of its own (the Artifact wrapper supplies it) and a
# plain static file server sends no charset, so an em-dash arrives as mojibake.
# Escaping sidesteps the question entirely — but the escape differs by context:
# numeric entities in markup, \uXXXX inside script. Every non-ASCII character
# in the script block sits inside a quoted string, so \u is safe there.
def ascii_markup(s):
    return ''.join(c if ord(c) < 128 else f'&#{ord(c)};' for c in s)

def ascii_script(s):
    return ''.join(c if ord(c) < 128 else f'\\u{ord(c):04x}' for c in s)

parts, out_parts, i = [], [], 0
while True:
    a = html.find('<script', i)
    if a < 0:
        out_parts.append(ascii_markup(html[i:]))
        break
    b = html.index('</script>', a) + len('</script>')
    out_parts.append(ascii_markup(html[i:a]))
    out_parts.append(ascii_script(html[a:b]))
    i = b
html = ''.join(out_parts)
assert all(ord(c) < 128 for c in html), 'non-ASCII survived'

out = os.path.join(ROOT, 'DASHBOARD.html')
with open(out, 'w', encoding='ascii') as f:
    f.write(html)

print(f'wrote {out}  ({os.path.getsize(out)//1024} KB, {len(web)} movements, pure ASCII)')
