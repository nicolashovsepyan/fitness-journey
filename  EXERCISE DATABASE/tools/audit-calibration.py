#!/usr/bin/env python3
"""
AUDIT THE CALIBRATION — Nicolas's numbers vs the research.

  python3 "EXERCISE DATABASE/tools/audit-calibration.py"

Compares every answer against two independent references and prints a verdict
per movement. Nothing is changed; the recommendation is a proposal.
"""
import json, os
HERE = os.path.dirname(os.path.abspath(__file__))
REF  = json.load(open(os.path.join(HERE, 'calibration-reference.json')))['movements']
DEC  = json.load(open(os.path.join(HERE, '..', 'workbook', '_decisions.json')))['calibration']

def num(v):
    if v in (None, '', 'n/a', 'N/A'): return None
    try: return float(str(v).strip())
    except ValueError: return None

def fmt(t):
    return '/'.join('-' if x is None else str(int(x)) for x in t)

rows, flags = [], []
for name, r in REF.items():
    mine = DEC.get(name)
    m = tuple(num(mine.get(k)) for k in ('beg','int','adv')) if mine else (None,None,None)
    res = tuple(r['research']) if r.get('research') else None
    csv = tuple(r['csv']) if r.get('csv') else None
    if not any(x is not None for x in m):
        rows.append((name, m, res, csv, r['unit'], 'BLANK', r['note'])); continue

    # how far is each tier from the nearest reference?
    verdict, worst = 'ok', 0.0
    for i in range(3):
        cand = [t[i] for t in (res, csv) if t]
        if not cand or m[i] is None: continue
        lo, hi = min(cand), max(cand)
        if m[i] < lo:  d = (lo - m[i]) / max(lo, 1)
        elif m[i] > hi: d = (m[i] - hi) / max(hi, 1)
        else: d = 0.0
        worst = max(worst, d)
    verdict = 'ok' if worst < 0.20 else ('check' if worst < 0.45 else 'OFF')
    rows.append((name, m, res, csv, r['unit'], verdict, r['note']))

order = {'OFF':0, 'check':1, 'ok':2, 'BLANK':3}
rows.sort(key=lambda x: (order[x[5]], x[0]))

print(f"{'MOVEMENT':28} {'YOURS':>12} {'RESEARCH':>12} {'CSV':>12}  {'':6} UNIT")
print('-'*92)
for name, m, res, csv, unit, v, note in rows:
    mark = {'OFF':'  OFF ','check':' check','ok':'    ok','BLANK':' blank'}[v]
    print(f"{name:28} {fmt(m):>12} {(fmt(res) if res else '-'):>12} {(fmt(csv) if csv else '-'):>12}  {mark} {unit}")

print()
for name, m, res, csv, unit, v, note in rows:
    if v in ('OFF','check'):
        print(f"* {name} — {note}")
