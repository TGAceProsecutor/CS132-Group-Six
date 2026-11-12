"""Extract the study's results from raw-results/*.xlsx into assets/data/results.js.

Every number on the results pages comes from here; nothing is typed by hand.
Usage: python scripts/extract_results.py [repo root]  (default: current folder)
"""
import json, sys, os
import openpyxl

root = sys.argv[1] if len(sys.argv) > 1 else '.'
raw = os.path.join(root, 'raw-results')
wb1 = openpyxl.load_workbook(os.path.join(raw, 'CS 132 (RQ1).xlsx'), data_only=True, read_only=True)
wb2 = openpyxl.load_workbook(os.path.join(raw, 'CS 132 (RQ2).xlsx'), data_only=True, read_only=True)
wb3 = openpyxl.load_workbook(os.path.join(raw, 'CS 132 (RQ3).xlsx'), data_only=True, read_only=True)


def rows(ws):
    return [list(r) + [None] * (32 - len(r)) for r in ws.iter_rows(values_only=True)]


def find(rs, label, col=0):
    """Row whose cell `col` equals label (stripped)."""
    for r in rs:
        if len(r) > col and isinstance(r[col], str) and r[col].strip() == label:
            return r
    raise KeyError(label)


def r(x, n=4):
    return round(float(x), n)


out = {}

# ---------------------------------------------------------------- H1 (RQ1)
corr = rows(wb1['RQ1_Correlation'])
names = {
    'G (irradiance)': 'Solar irradiance', 'RH2M': 'Relative humidity', 'PRECTOTCORR': 'Precipitation',
    'T2DEW': 'Dew point', 'T2M': 'Air temperature', 'WS2M': 'Wind speed', 'PS': 'Surface pressure',
}
params = []
start = next(i for i, x in enumerate(corr) if x[0] == 'Sorted by |ρ| (descending)') + 2
for x in corr[start:start + 7]:
    params.append({'code': x[0], 'name': names[x[0]], 'unit': x[1], 'rho': r(x[3]),
                   'lo': r(x[10]), 'hi': r(x[11]), 'strength': x[12]})
h1test = rows(wb1['RQ1_H1_Test'])
per = rows(wb1['RQ1_PerPlant'])
hj = next(j for j, v in enumerate(per[2]) if v == '# plants where strongest')
pj = next(j for j, v in enumerate(per[2]) if v == 'Parameter')
strongest = {16: next(x[hj] for x in per[3:] if x[pj] == 'G')}
out['h1'] = {
    'n': int(find(h1test, 'n (pairs)')[1]),
    'plants': int(strongest[16]),
    'comparisons': int(find(h1test, 'Number of comparisons')[1]),
    'alpha': r(find(h1test, 'Bonferroni-adjusted α')[1], 4),
    'verdict': find(h1test, 'H1 supported?')[1],
    'params': params,
}
# scatter: a stable pseudo-random ~6% sample of the plant-days (RQ1_Data's own Sample_Key)
data = wb1['RQ1_Data']
hdr = None
pts = []
for x in data.iter_rows(values_only=True):
    if hdr is None:
        hdr = list(x); gi = hdr.index('G (kWh/m²/day)'); yi = hdr.index('Y_specific (kWh/kWp/day)')
        ri = hdr.index('RH2M (%)'); ki = hdr.index('Sample_Key (stable pseudo-random)')
        continue
    if x[gi] is None or x[ki] is None:
        continue
    if x[ki] < 0.06:
        pts.append([r(x[gi], 3), r(x[yi], 3), r(x[ri], 1)])
out['h1']['sample'] = pts

# ---------------------------------------------------------------- H2 (RQ2)
st = rows(wb2['Stats'])
hp = rows(wb2['Hypothesis_Plot'])
rq = rows(wb2['Research_Question'])
plants = []
i0 = next(i for i, x in enumerate(hp) if x[0] == 'Plant') + 1
for x in hp[i0:]:
    if x[0] is None or x[1] not in ('Luzon', 'Visayas', 'Mindanao'):
        continue
    plants.append({'name': x[0], 'island': x[1], 'x': r(x[2]), 'y': r(x[3], 3)})
islands = []
for name in ('Luzon', 'Visayas', 'Mindanao'):
    x = next(row for row in rq if row[0] == name)
    islands.append({'name': name, 'plants': int(x[1]), 'mw': r(x[2], 1), 'h': r(x[3], 3), 'yield': r(x[4], 1)})
anova_p = find(rq, 'p-value')[1]
yh = next(i for i, x in enumerate(rq) if x[0] == 'Plant' and x[1] == 'Rank by yield')
yields = [{'name': x[0], 'province': x[2], 'island': x[3], 'mw': r(x[4], 1), 'yield': r(x[6], 1)}
          for x in rq[yh + 1:] if x[0] and x[3] in ('Luzon', 'Visayas', 'Mindanao')]
out['h2'] = {
    'raw': {'r': r(find(st, 'Pearson r (E_d, H)')[1]), 'p': r(find(st, 'p-value (two-sided)')[1], 3)},
    'partial': {'r': r(find(st, 'Partial r (E_d, H | P)')[1]),
                'p': float(st[[i for i, x in enumerate(st) if x[0] == 'Partial r (E_d, H | P)'][0] + 2][1]),
                'slope': r(find(st, 'OLS: E_d = b0 + b1·H + b2·P   b1 (per kWh/m²/day)')[1], 2)},
    'anova': {'F': r(find(rq, 'F statistic')[1], 2), 'p': float(anova_p)},
    'islands': islands,
    'plants': plants,
    'yields': yields,
    'swing': {'season': r(find(rq, 'Highest / lowest ratio')[1], 2), 'place': r(rq[[i for i, x in enumerate(rq) if x[0] == 'Max / min ratio'][0]][3], 2)},
    'months': [{'month': x[0].strftime('%Y-%m'), 'all': r(x[4], 3)}
               for x in rq if hasattr(x[0], 'strftime') and isinstance(x[4], (int, float))],
    'yieldRange': [r(find(rq, 'Minimum')[2], 0), r(find(rq, 'Maximum')[2], 0)],
}

# ---------------------------------------------------------------- H3 (RQ3)
pl = rows(wb3['RQ3_Plants'])
cell_island, cell_names = {}, {}
for x in pl[1:]:
    if x[0] and str(x[0]).startswith('P') and x[14]:
        cell_island.setdefault(x[14], x[7])
cells_ws = rows(wb3['RQ3_Cells'])
cells = []
for x in cells_ws:
    if isinstance(x[0], str) and len(x[0]) == 3 and x[0].startswith('C') and x[0][1:].isdigit():
        cells.append({'id': x[0], 'provinces': x[1], 'plants': int(x[2]), 'mw': r(x[3], 1),
                      'island': cell_island[x[0]], 'dry': r(x[4], 1), 'wet': r(x[5], 1), 'diff': r(x[6], 1),
                      'pct': r(x[7], 4), 'dryMW': r(x[11], 3), 'wetMW': r(x[12], 3), 'diffMW': r(x[13], 3)})
chk = rows(wb3['RQ3_Cell_Checks'])
checks = []
labels = {
    'P': 'Main test: paired t-test on cell totals', 'S1': 'Wilcoxon signed-rank (ranks, not sizes)',
    'S2': 'Cluster bootstrap of the mean', 'S3': 'Excluding the largest cell (C01)',
    'S4': 'Mean per plant within each cell', 'S5': 'Generation per MW installed',
    'S7': 'Excluding the box-matched plant', 'PR75': 'Performance ratio 0.75', 'PR85': 'Performance ratio 0.85',
}
for x in chk:
    if x[0] in labels:
        wet = x[4]
        est, lo, hi = x[5], x[7], x[8]
        num = lambda v: isinstance(v, (int, float))
        checks.append({'id': x[0], 'label': labels[x[0]], 'n': int(x[2]), 'unit': x[15], 'dry': r(x[3], 2), 'wet': r(x[4], 2),
                       'est': r(est, 3), 'lo': r(lo, 3) if num(lo) else None, 'hi': r(hi, 3) if num(hi) else None,
                       'p': float(x[11]), 'decision': x[13],
                       'pct': r(est / wet * 100, 1), 'pctLo': r(lo / wet * 100, 1) if num(lo) else None,
                       'pctHi': r(hi / wet * 100, 1) if num(hi) else None})
P = checks[0]
summ = rows(wb3['RQ3_Summary'])
ttxt = find(summ, 't (df) / p / dz')[1]
out['h3'] = {
    'dry': 'Dec–May', 'wet': 'Jun–Nov',
    'mean': P['est'], 'lo': P['lo'], 'hi': P['hi'], 'p': P['p'], 'dryMean': P['dry'], 'wetMean': P['wet'],
    'tstat': ttxt.split(',')[0].strip(),
    'pct': r(find(cells_ws, 'Fleet total (19 cells = 57 plants)')[7] * 100, 1),
    'dryHigher': sum(c['diff'] > 0 for c in cells), 'cellsN': len(cells),
    'disagree': sum(c['decision'] != P['decision'] for c in checks[1:]), 'checksN': len(checks) - 1,
    'cells': cells, 'checks': checks,
    'c01share': r(next(c for c in cells if c['id'] == 'C01')['mw'] / sum(c['mw'] for c in cells) * 100, 0),
}
# plant locations for the hero map
out['plants'] = [{'id': x[0], 'name': x[2], 'mw': r(x[3], 1), 'province': x[4], 'island': x[7],
                  'lat': r(x[8], 4), 'lon': r(x[9], 4), 'cell': x[14]}
                 for x in pl[1:] if x[0] and str(x[0]).startswith('P') and isinstance(x[8], (int, float))]
out['meta'] = {'plants': 57, 'cells': len(cells), 'mw': r(sum(c['mw'] for c in cells), 0),
               'period': 'Sep 2025 – Aug 2026', 'pr': 0.80}

dst = os.path.join(root, 'assets', 'data')
os.makedirs(dst, exist_ok=True)
with open(os.path.join(dst, 'results.js'), 'w', encoding='utf8') as f:
    f.write('/* Generated from raw-results/*.xlsx by scripts/extract_results.py. Do not edit by hand. */\n')
    f.write('window.RESULTS = ' + json.dumps(out, ensure_ascii=False, separators=(',', ':')) + ';\n')

s = dict(out); s['h1'] = {k: v for k, v in out['h1'].items() if k != 'sample'}
s['h2'] = {k: v for k, v in out['h2'].items() if k not in ('plants', 'yields')}  # months printed below
s['h3'] = {k: v for k, v in out['h3'].items() if k not in ('cells',)}
print(json.dumps(s, ensure_ascii=False, indent=1)[:6000])
print('map plants', len(out['plants']), 'sample', len(out['h1']['sample']), 'plants', len(plants), 'yields', len(yields), 'cells', len(cells))
