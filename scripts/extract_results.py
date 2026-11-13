"""Extract the exploratory data analysis (EDA) figures from raw-results/*.xlsx into assets/data/results.js.

Every number on the EDA pages comes from here; nothing is typed by hand.
Only descriptive statistics are exported (means, ratios, correlations, distributions);
hypothesis-test outputs in the workbooks (p-values, confidence intervals, verdicts) are left out.
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
    params.append({'code': x[0], 'name': names[x[0]], 'unit': x[1], 'rho': r(x[3]), 'strength': x[12]})
per = rows(wb1['RQ1_PerPlant'])
hj = next(j for j, v in enumerate(per[2]) if v == '# plants where strongest')
pj = next(j for j, v in enumerate(per[2]) if v == 'Parameter')
strongest = {16: next(x[hj] for x in per[3:] if x[pj] == 'G')}
out['h1'] = {
    'n': sum(1 for x in wb1['RQ1_Data'].iter_rows(min_row=2, values_only=True) if x[0] is not None),
    'plants': int(strongest[16]),
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
rq = rows(wb2['Research_Question'])
islands = []
for name in ('Luzon', 'Visayas', 'Mindanao'):
    x = next(row for row in rq if row[0] == name)
    islands.append({'name': name, 'plants': int(x[1]), 'mw': r(x[2], 1), 'h': r(x[3], 3), 'yield': r(x[4], 1)})
yh = next(i for i, x in enumerate(rq) if x[0] == 'Plant' and x[1] == 'Rank by yield')
yields = [{'name': x[0], 'province': x[2], 'island': x[3], 'mw': r(x[4], 1), 'yield': r(x[6], 1)}
          for x in rq[yh + 1:] if x[0] and x[3] in ('Luzon', 'Visayas', 'Mindanao')]
out['h2'] = {
    'islands': islands,
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
dry_mean = sum(c['dry'] for c in cells) / len(cells)
wet_mean = sum(c['wet'] for c in cells) / len(cells)
out['h3'] = {
    'dry': 'Dec–May', 'wet': 'Jun–Nov',
    'dryMean': r(dry_mean, 2), 'wetMean': r(wet_mean, 2), 'mean': r(dry_mean - wet_mean, 3),
    'pct': r(find(cells_ws, 'Fleet total (19 cells = 57 plants)')[7] * 100, 1),
    'dryHigher': sum(c['diff'] > 0 for c in cells), 'dryHigherMW': sum(c['diffMW'] > 0 for c in cells),
    'cellsN': len(cells),
    'cells': cells,
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
s['h2'] = {k: v for k, v in out['h2'].items() if k not in ('yields',)}  # months printed below
s['h3'] = {k: v for k, v in out['h3'].items() if k not in ('cells',)}
print(json.dumps(s, ensure_ascii=False, indent=1)[:6000])
print('map plants', len(out['plants']), 'sample', len(out['h1']['sample']), 'yields', len(yields), 'cells', len(cells))
