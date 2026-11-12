/* Results charts. Data: window.RESULTS (assets/data/results.js, generated from raw-results/*.xlsx). */
(() => {
	const R = window.RESULTS;
	if (!R || !window.d3) return;

	const css = getComputedStyle(document.documentElement);
	const C = (n) => css.getPropertyValue('--' + n).trim();
	const COL = {
		dry: C('dry'), wet: C('wet'), ink: C('ink'), muted: C('muted'), grid: C('grid'), paper: C('paper'),
		green: C('green'), forest: C('forest'), dim: '#B9C4BC', line: '#B3BCB6',
		Luzon: C('luzon'), Visayas: C('visayas'), Mindanao: C('mindanao'),
	};
	const ISLANDS = ['Luzon', 'Visayas', 'Mindanao'];
	const minus = (s) => s.replace(/^-/, '−').replace(/(\s)-/g, '$1−');
	const fmt = (f) => (v) => minus(d3.format(f)(v));
	const f0 = fmt(',.0f'), f1 = fmt(',.1f'), f2 = fmt(',.2f'), f3 = fmt(',.3f');
	const s0 = fmt('+,.0f'), s1 = fmt('+,.1f'), s2 = fmt('+,.2f');
	const pct = (v) => s1(v * 100) + '%';
	const pFmt = (p) => (p < 0.001 ? 'p < 0.001' : 'p = ' + (p < 0.01 ? p.toFixed(4) : p.toFixed(4).replace(/0+$/, '')));

	/* ---------- tooltip ---------- */
	const tip = document.getElementById('tooltip');
	function showTip(rows, title, at) {
		tip.replaceChildren();
		if (title) { const t = document.createElement('span'); t.className = 'tt-title'; t.textContent = title; tip.append(t); }
		rows.forEach(([value, label, color]) => {
			const row = document.createElement('span'); row.className = 'tt-row';
			if (color) { const k = document.createElement('i'); k.className = 'tt-key'; k.style.background = color; row.append(k); }
			const b = document.createElement('b'); b.textContent = value;
			row.append(b, document.createTextNode(' ' + (label || '')));
			tip.append(row);
		});
		tip.hidden = false;
		const r = tip.getBoundingClientRect();
		let x = at.x + 14, y = at.y + 14;
		if (x + r.width > innerWidth - 8) x = at.x - r.width - 14;
		if (y + r.height > innerHeight - 8) y = at.y - r.height - 14;
		tip.style.left = Math.max(8, x) + 'px';
		tip.style.top = Math.max(8, y) + 'px';
	}
	const hideTip = () => { tip.hidden = true; };
	const at = (ev, el) => (ev && ev.clientX != null && ev.type !== 'focus'
		? { x: ev.clientX, y: ev.clientY }
		: (() => { const b = el.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top }; })());
	addEventListener('scroll', hideTip, { passive: true });

	/* ---------- helpers ---------- */
	function svgIn(plot, w, h) {
		d3.select(plot).selectAll('svg').remove();
		return d3.select(plot).append('svg').attr('viewBox', `0 0 ${w} ${h}`).attr('width', w).attr('height', h)
			.attr('role', 'img');
	}
	// horizontal bar, square at the baseline (x0), 4px round at the data end (x1)
	function hbar(x0, x1, y, h) {
		const r = Math.min(4, Math.abs(x1 - x0), h / 2);
		if (x1 >= x0) return `M${x0},${y}H${x1 - r}Q${x1},${y} ${x1},${y + r}V${y + h - r}Q${x1},${y + h} ${x1 - r},${y + h}H${x0}Z`;
		return `M${x0},${y}H${x1 + r}Q${x1},${y} ${x1},${y + r}V${y + h - r}Q${x1},${y + h} ${x1 + r},${y + h}H${x0}Z`;
	}
	const diamond = (s) => `M0,${-s}L${s},0L0,${s}L${-s},0Z`;
	function xAxis(g, x, h, ticks, f, title, w) {
		const ax = g.append('g').attr('class', 'axis').attr('transform', `translate(0,${h})`)
			.call(d3.axisBottom(x).ticks(ticks).tickSize(0).tickPadding(8).tickFormat(f));
		ax.select('.domain').remove();
		if (title) g.append('text').attr('class', 'axis-title').attr('x', w / 2).attr('y', h + 36).attr('text-anchor', 'middle').text(title);
	}
	function yAxis(g, y, ticks, f, title, h) {
		const ax = g.append('g').attr('class', 'axis').call(d3.axisLeft(y).ticks(ticks).tickSize(0).tickPadding(8).tickFormat(f));
		ax.select('.domain').remove();
		if (title) g.append('text').attr('class', 'axis-title').attr('transform', `translate(${-44},${h / 2}) rotate(-90)`).attr('text-anchor', 'middle').text(title);
	}
	function gridX(g, x, h, ticks) {
		g.append('g').attr('class', 'grid').selectAll('line').data(x.ticks(ticks)).join('line')
			.attr('x1', (d) => x(d)).attr('x2', (d) => x(d)).attr('y1', 0).attr('y2', h);
	}
	function gridY(g, y, w, ticks) {
		g.append('g').attr('class', 'grid').selectAll('line').data(y.ticks(ticks)).join('line')
			.attr('x1', 0).attr('x2', w).attr('y1', (d) => y(d)).attr('y2', (d) => y(d));
	}
	// nearest-point hover for scatter plots (24px+ effective hit area)
	function nearest(svg, g, pts, px, py, m, w, h, onHit, ringR) {
		const del = d3.Delaunay.from(pts, px, py);
		const ring = g.append('circle').attr('class', 'hover-ring').attr('r', ringR + 3).style('display', 'none');
		svg.append('rect').attr('x', m.left).attr('y', m.top).attr('width', w).attr('height', h)
			.attr('fill', 'transparent')
			.on('pointermove', (ev) => {
				const [mx, my] = d3.pointer(ev, g.node());
				const i = del.find(mx, my);
				const d = pts[i];
				if (Math.hypot(px(d) - mx, py(d) - my) > 28) { ring.style('display', 'none'); hideTip(); return; }
				ring.style('display', null).attr('cx', px(d)).attr('cy', py(d));
				onHit(d, { x: ev.clientX, y: ev.clientY });
			})
			.on('pointerleave', () => { ring.style('display', 'none'); hideTip(); });
	}
	// one data table per chart, built once
	function table(fig, caption, cols, rows) {
		if (fig.querySelector('.chart-table')) return;
		const det = document.createElement('details'); det.className = 'chart-table';
		const sum = document.createElement('summary'); sum.textContent = 'Show the data'; det.append(sum);
		const wrap = document.createElement('div'); wrap.className = 'table-scroll';
		const t = document.createElement('table');
		const cap = document.createElement('caption'); cap.className = 'sr-only'; cap.textContent = caption; t.append(cap);
		const tr = document.createElement('tr');
		cols.forEach(([label, , num]) => { const th = document.createElement('th'); th.scope = 'col'; th.textContent = label; if (num) th.className = 'num'; tr.append(th); });
		const thead = document.createElement('thead'); thead.append(tr); t.append(thead);
		const tb = document.createElement('tbody');
		rows.forEach((r) => {
			const row = document.createElement('tr');
			cols.forEach(([, get, num]) => { const td = document.createElement('td'); td.textContent = get(r); if (num) td.className = 'num'; row.append(td); });
			tb.append(row);
		});
		t.append(tb); wrap.append(t); det.append(wrap); fig.append(det);
	}
	function rowHover(sel, tipFor) {
		sel.attr('tabindex', 0)
			.on('pointermove', function (ev, d) { const [rows, title] = tipFor(d); showTip(rows, title, at(ev, this)); })
			.on('focus', function (ev, d) { const [rows, title] = tipFor(d); showTip(rows, title, at(ev, this)); })
			.on('pointerleave blur', hideTip);
	}

	/* ---------- 1. Nutshell: dry vs wet per MW, by grid cell ---------- */
	function nutshell(plot, W) {
		const narrow = W < 560;
		const m = { top: 4, right: narrow ? 14 : 130, bottom: 48, left: narrow ? 74 : 132 };
		const rowH = 26, headH = 30;
		const groups = ISLANDS.map((k) => ({ island: k, cells: R.h3.cells.filter((c) => c.island === k).sort((a, b) => b.diffMW - a.diffMW) }));
		const items = [];
		let yy = 0;
		groups.forEach((g) => { items.push({ head: g.island, y: yy }); yy += headH; g.cells.forEach((c) => { items.push({ cell: c, y: yy }); yy += rowH; }); });
		const h = yy, w = W - m.left - m.right;
		const svg = svgIn(plot, W, h + m.top + m.bottom).attr('aria-label', 'Dumbbell chart: dry and wet season estimated generation per MW for each of 19 grid cells. 18 cells are higher in the dry season; only C13 is higher in the wet season.');
		const g = svg.append('g').attr('transform', `translate(${m.left},${m.top})`);
		const vals = R.h3.cells.flatMap((c) => [c.dryMW, c.wetMW]);
		const x = d3.scaleLinear().domain([d3.min(vals) - 0.08, d3.max(vals) + 0.08]).nice().range([0, w]);
		gridX(g, x, h, narrow ? 4 : 8);
		xAxis(g, x, h, narrow ? 4 : 8, f1, narrow ? 'MWh/day per installed MW' : 'Estimated generation per installed MW (MWh/day per MW)', w);

		items.filter((d) => d.head).forEach((d) => {
			g.append('text').attr('class', 'group-label').attr('x', -m.left).attr('y', d.y + 20).text(d.head.toUpperCase());
			g.append('line').attr('x1', -m.left).attr('x2', w).attr('y1', d.y + 27).attr('y2', d.y + 27).attr('stroke', COL.grid);
		});
		const rows = g.selectAll('g.row').data(items.filter((d) => d.cell)).join('g').attr('class', 'row mark')
			.attr('transform', (d) => `translate(0,${d.y})`)
			.attr('aria-label', (d) => `${d.cell.id}, ${d.cell.island}: dry ${f2(d.cell.dryMW)}, wet ${f2(d.cell.wetMW)} MWh/day per MW`);
		rows.append('rect').attr('class', 'row-hit').attr('x', -m.left).attr('width', W - m.right + (narrow ? 0 : m.right - 8)).attr('height', rowH).attr('rx', 3);
		rows.append('text').attr('class', 'label').attr('x', -m.left).attr('y', rowH / 2 + 4).text((d) => d.cell.id);
		if (!narrow) rows.append('text').attr('class', 'label-muted').attr('x', -m.left + 36).attr('y', rowH / 2 + 4).text((d) => f0(d.cell.mw) + ' MW');
		rows.append('line').attr('x1', (d) => x(d.cell.wetMW)).attr('x2', (d) => x(d.cell.dryMW)).attr('y1', rowH / 2).attr('y2', rowH / 2)
			.attr('stroke', COL.line).attr('stroke-width', 2).attr('stroke-linecap', 'round');
		rows.append('path').attr('d', diamond(6)).attr('transform', (d) => `translate(${x(d.cell.wetMW)},${rowH / 2})`)
			.attr('fill', COL.wet).attr('stroke', COL.paper).attr('stroke-width', 2);
		rows.append('circle').attr('cx', (d) => x(d.cell.dryMW)).attr('cy', rowH / 2).attr('r', 5.5)
			.attr('fill', COL.dry).attr('stroke', COL.paper).attr('stroke-width', 2);
		if (!narrow) {
			rows.filter((d) => d.cell.diffMW < 0).append('text').attr('class', 'label-muted')
				.attr('x', (d) => x(Math.max(d.cell.dryMW, d.cell.wetMW)) + 14).attr('y', rowH / 2 + 4).text('only wet-higher cell');
			rows.filter((d) => d.cell.id === 'C01').append('text').attr('class', 'label-muted')
				.attr('x', (d) => x(d.cell.dryMW) + 14).attr('y', rowH / 2 + 4).text('40% of all capacity');
		}
		rowHover(rows, (d) => {
			const c = d.cell;
			return [[
				[f2(c.dryMW), 'dry, MWh/day per MW', COL.dry],
				[f2(c.wetMW), 'wet, MWh/day per MW', COL.wet],
				[s2(c.diffMW) + ' (' + pct(c.pct) + ')', 'dry − wet'],
				[`${c.plants} plant${c.plants > 1 ? 's' : ''}, ${f1(c.mw)} MW`, ''],
				[c.provinces, ''],
			], `${c.id} · ${c.island}`];
		});
		table(plot.closest('figure'), 'Dry and wet estimated generation per MW by grid cell', [
			['Cell', (d) => d.id], ['Island group', (d) => d.island], ['Provinces', (d) => d.provinces],
			['Plants', (d) => d.plants, 1], ['MW', (d) => f1(d.mw), 1], ['Dry per MW', (d) => f3(d.dryMW), 1],
			['Wet per MW', (d) => f3(d.wetMW), 1], ['Dry − wet per MW', (d) => fmt('+,.3f')(d.diffMW), 1], ['Dry − wet (% of wet)', (d) => pct(d.pct), 1],
		], groups.flatMap((g2) => g2.cells));
	}

	/* ---------- 2. H1: Spearman rho by weather parameter ---------- */
	function rho(plot, W) {
		const P = R.h1.params;
		const narrow = W < 420;
		const m = { top: 4, right: 16, bottom: 44, left: narrow ? 112 : 132 };
		const rowH = 38, h = P.length * rowH, w = W - m.left - m.right;
		const svg = svgIn(plot, W, h + m.top + m.bottom).attr('aria-label', 'Bar chart of Spearman correlation with estimated generation for seven weather parameters. Irradiance is highest at 0.999.');
		const g = svg.append('g').attr('transform', `translate(${m.left},${m.top})`);
		const x = d3.scaleLinear().domain([-1, 1]).range([0, w]);
		gridX(g, x, h, 4);
		xAxis(g, x, h, 4, (v) => minus(d3.format('.1f')(v)), 'Spearman ρ with estimated generation', w);
		g.append('line').attr('x1', x(0)).attr('x2', x(0)).attr('y1', 0).attr('y2', h).attr('stroke', COL.muted);
		const bh = 18;
		const rows = g.selectAll('g.row').data(P).join('g').attr('class', 'row mark').attr('transform', (d, i) => `translate(0,${i * rowH})`)
			.attr('aria-label', (d) => `${d.name}: rho ${f3(d.rho)}`);
		rows.append('rect').attr('class', 'row-hit').attr('x', -m.left).attr('width', W - 8).attr('height', rowH).attr('rx', 3);
		rows.append('text').attr('class', 'label').attr('x', -m.left).attr('y', rowH / 2 + 4).text((d) => d.name);
		rows.append('path').attr('d', (d) => hbar(x(0), x(d.rho), (rowH - bh) / 2, bh))
			.attr('fill', (d, i) => (i === 0 ? COL.green : COL.dim));
		rows.append('text').attr('class', 'label').attr('y', rowH / 2 + 4)
			.attr('x', (d) => (d.rho >= 0 ? Math.min(x(d.rho) + 6, w - 34) : x(d.rho) - 6))
			.attr('text-anchor', (d) => (d.rho >= 0 ? (x(d.rho) + 40 > w ? 'end' : 'start') : 'end'))
			.style('fill', (d) => (d.rho >= 0 && x(d.rho) + 40 > w ? COL.paper : null))
			.style('font-weight', (d, i) => (i === 0 ? 600 : null))
			.text((d) => fmt(Math.abs(d.rho) > 0.99 ? '+.3f' : '+.2f')(d.rho));
		rowHover(rows, (d) => [[
			[fmt('+.3f')(d.rho), 'Spearman ρ'],
			[`${minus(d.lo.toFixed(3))} to ${minus(d.hi.toFixed(3))}`, '95% CI'],
			[d.strength, d.rho >= 0 ? 'positive' : 'negative'],
		], `${d.name} (${d.unit})`]);
		table(plot.closest('figure'), 'Spearman correlation of each weather parameter with estimated generation', [
			['Parameter', (d) => d.name], ['NASA code', (d) => d.code.split(' ')[0]], ['Unit', (d) => d.unit],
			['ρ', (d) => fmt('+.4f')(d.rho), 1], ['95% CI', (d) => `${minus(d.lo.toFixed(4))} to ${minus(d.hi.toFixed(4))}`, 1], ['Strength', (d) => d.strength],
		], P);
	}

	/* ---------- 3. H1: irradiance vs specific yield (sample) ---------- */
	function irradiance(plot, W) {
		const pts = R.h1.sample;
		const m = { top: 8, right: 12, bottom: 48, left: 54 };
		const w = W - m.left - m.right, h = Math.round(Math.min(320, Math.max(220, w * 0.72)));
		const svg = svgIn(plot, W, h + m.top + m.bottom).attr('aria-label', 'Scatter plot: estimated generation rises almost exactly in step with irradiance.');
		const g = svg.append('g').attr('transform', `translate(${m.left},${m.top})`);
		const x = d3.scaleLinear().domain([0, d3.max(pts, (d) => d[0])]).nice().range([0, w]);
		const y = d3.scaleLinear().domain([0, d3.max(pts, (d) => d[1])]).nice().range([h, 0]);
		gridY(g, y, w, 5);
		xAxis(g, x, h, 5, f0, 'Irradiance (kWh/m²/day)', w);
		yAxis(g, y, 5, f0, 'Specific yield (kWh/kWp/day)', h);
		g.append('g').selectAll('circle').data(pts).join('circle')
			.attr('cx', (d) => x(d[0])).attr('cy', (d) => y(d[1])).attr('r', 2.6)
			.attr('fill', COL.green).attr('fill-opacity', 0.35);
		nearest(svg, g, pts, (d) => x(d[0]), (d) => y(d[1]), m, w, h, (d, p) => showTip([
			[f2(d[0]), 'kWh/m²/day irradiance'], [f2(d[1]), 'kWh/kWp/day specific yield'], [f1(d[2]) + '%', 'relative humidity'],
		], 'One plant-day', p), 2.6);
		table(plot.closest('figure'), 'Sampled plant-days: irradiance, specific yield and humidity', [
			['Irradiance (kWh/m²/day)', (d) => f3(d[0]), 1], ['Specific yield (kWh/kWp/day)', (d) => f3(d[1]), 1], ['Relative humidity (%)', (d) => f1(d[2]), 1],
		], pts);
	}

	/* ---------- 4. H2: partial regression (capacity removed) ---------- */
	function partial(plot, W) {
		const pts = R.h2.plants;
		const m = { top: 8, right: 14, bottom: 48, left: 54 };
		const w = W - m.left - m.right, h = Math.round(Math.min(340, Math.max(240, w * 0.62)));
		const svg = svgIn(plot, W, h + m.top + m.bottom).attr('aria-label', 'Scatter plot of irradiance and generation after removing plant size: points rise from lower left to upper right (partial r = 0.73).');
		const g = svg.append('g').attr('transform', `translate(${m.left},${m.top})`);
		const xe = d3.extent(pts, (d) => d.x), ye = d3.extent(pts, (d) => d.y);
		const x = d3.scaleLinear().domain([xe[0] - 0.03, xe[1] + 0.03]).nice().range([0, w]);
		const y = d3.scaleLinear().domain([ye[0] - 2, ye[1] + 2]).nice().range([h, 0]);
		gridY(g, y, w, 5);
		xAxis(g, x, h, 5, (v) => minus(d3.format('.1f')(v)), 'Irradiance, plant size removed (kWh/m²/day)', w);
		yAxis(g, y, 5, f0, 'Generation, size removed (MWh/day)', h);
		g.append('line').attr('x1', x(0)).attr('x2', x(0)).attr('y1', 0).attr('y2', h).attr('stroke', '#CBD2CC');
		g.append('line').attr('x1', 0).attr('x2', w).attr('y1', y(0)).attr('y2', y(0)).attr('stroke', '#CBD2CC');
		const b = R.h2.partial.slope;
		const [d0, d1] = x.domain();
		g.append('line').attr('x1', x(d0)).attr('y1', y(b * d0)).attr('x2', x(d1)).attr('y2', y(b * d1))
			.attr('stroke', COL.ink).attr('stroke-width', 1.5).attr('stroke-opacity', 0.6);
		g.append('text').attr('class', 'label-muted').attr('x', x(d1) - 4).attr('y', y(b * d1) + (y(b * d1) < 20 ? 16 : -8)).attr('text-anchor', 'end')
			.text(`slope +${Math.round(b)} MWh/day per kWh/m²/day`);
		g.append('g').selectAll('circle').data(pts).join('circle')
			.attr('cx', (d) => x(d.x)).attr('cy', (d) => y(d.y)).attr('r', 5)
			.attr('fill', (d) => COL[d.island]).attr('stroke', COL.paper).attr('stroke-width', 2);
		nearest(svg, g, pts, (d) => x(d.x), (d) => y(d.y), m, w, h, (d, p) => showTip([
			[fmt('+.3f')(d.x), 'kWh/m²/day irradiance vs expected', COL[d.island]], [s1(d.y), 'MWh/day generation vs expected'],
		], `${d.name} · ${d.island}`, p), 5);
		table(plot.closest('figure'), 'Partial-regression residuals per plant', [
			['Plant', (d) => d.name], ['Island group', (d) => d.island],
			['Irradiance residual (kWh/m²/day)', (d) => fmt('+.4f')(d.x), 1], ['Generation residual (MWh/day)', (d) => s2(d.y), 1],
		], pts);
	}

	/* ---------- 5. H2: specific yield by island group (strip plot) ---------- */
	function yieldStrip(plot, W) {
		const pts = R.h2.yields, isl = R.h2.islands;
		const m = { top: 8, right: 16, bottom: 48, left: 92 };
		const rowH = 64, h = rowH * 3, w = W - m.left - m.right;
		const svg = svgIn(plot, W, h + m.top + m.bottom).attr('aria-label', 'Strip plot of specific yield by island group. Mean yield: Luzon 1,414, Visayas 1,488, Mindanao 1,518 kWh per kWp per year.');
		const g = svg.append('g').attr('transform', `translate(${m.left},${m.top})`);
		const x = d3.scaleLinear().domain([1300, 1580]).range([0, w]);
		gridX(g, x, h, 4);
		xAxis(g, x, h, 4, f0, 'Specific yield (kWh per kWp per year)', w);
		const yi = (k) => ISLANDS.indexOf(k) * rowH;
		isl.forEach((d) => {
			const y0 = yi(d.name);
			g.append('text').attr('class', 'label').attr('x', -m.left).attr('y', y0 + rowH / 2 - 2).text(d.name);
			g.append('text').attr('class', 'label-muted').attr('x', -m.left).attr('y', y0 + rowH / 2 + 13).text(`${d.plants} plant${d.plants > 1 ? 's' : ''}`);
			g.append('rect').attr('x', x(d.yield) - 1.5).attr('width', 3).attr('y', y0 + 10).attr('height', rowH - 20).attr('rx', 1.5).attr('fill', COL.ink);
			g.append('text').attr('class', 'label').attr('x', x(d.yield)).attr('y', y0 + 6).attr('text-anchor', 'middle').style('font-weight', 600).text(f0(d.yield));
		});
		// deterministic jitter so the same plant always sits in the same spot
		const jit = (i) => ((Math.sin(i * 12.9898) * 43758.5453) % 1 + 1) % 1;
		pts.forEach((d, i) => { d._x = x(d.yield); d._y = yi(d.island) + rowH / 2 + (jit(i) - 0.5) * 26; });
		g.append('g').selectAll('circle').data(pts).join('circle')
			.attr('cx', (d) => d._x).attr('cy', (d) => d._y).attr('r', 4.5)
			.attr('fill', (d) => COL[d.island]).attr('fill-opacity', 0.85).attr('stroke', COL.paper).attr('stroke-width', 1.5);
		nearest(svg, g, pts, (d) => d._x, (d) => d._y, m, w, h, (d, p) => showTip([
			[f0(d.yield), 'kWh per kWp per year', COL[d.island]], [f1(d.mw) + ' MW', d.province],
		], d.name, p), 4.5);
		table(plot.closest('figure'), 'Specific yield per plant', [
			['Plant', (d) => d.name], ['Province', (d) => d.province], ['Island group', (d) => d.island],
			['MW', (d) => f1(d.mw), 1], ['Specific yield (kWh/kWp/yr)', (d) => f0(d.yield), 1],
		], [...pts].sort((a, b) => b.yield - a.yield));
	}

	/* ---------- 6. H3: dry vs wet, mean per grid cell ---------- */
	function seasons(plot, W) {
		const H = R.h3;
		const narrow = W < 520;
		const rows = [
			{ key: 'dry', label: 'Dry season', months: H.dry, v: H.dryMean, color: COL.dry },
			{ key: 'wet', label: 'Wet season', months: H.wet, v: H.wetMean, color: COL.wet },
		];
		const m = { top: 4, right: 70, bottom: 44, left: narrow ? 92 : 150 };
		const rowH = 48, bh = 24, h = rows.length * rowH + 44, w = W - m.left - m.right;
		const svg = svgIn(plot, W, h + m.top + m.bottom).attr('aria-label',
			`Bar chart: dry season ${f0(H.dryMean)} MWh/day, wet season ${f0(H.wetMean)} MWh/day per grid cell. The difference is not statistically significant (p = 0.0998).`);
		const g = svg.append('g').attr('transform', `translate(${m.left},${m.top})`);
		const x = d3.scaleLinear().domain([0, d3.max(rows, (d) => d.v)]).nice().range([0, w]);
		const axisY = rows.length * rowH;
		gridX(g, x, axisY, 4);
		g.append('g').attr('class', 'axis').attr('transform', `translate(0,${h})`)
			.call(d3.axisBottom(x).ticks(4).tickSize(0).tickPadding(8).tickFormat(f0)).select('.domain').remove();
		g.append('text').attr('class', 'axis-title').attr('x', w / 2).attr('y', h + 36).attr('text-anchor', 'middle').text('MWh/day per grid cell');
		const bars = g.selectAll('g.row').data(rows).join('g').attr('class', 'row mark').attr('transform', (d, i) => `translate(0,${i * rowH})`)
			.attr('aria-label', (d) => `${d.label} (${d.months}): ${f0(d.v)} MWh/day`);
		bars.append('rect').attr('class', 'row-hit').attr('x', -m.left).attr('width', W - 8).attr('height', rowH).attr('rx', 3);
		bars.append('text').attr('class', 'label').attr('x', -m.left).attr('y', rowH / 2 - 1).style('font-weight', 600).text((d) => d.label);
		bars.append('text').attr('class', 'label-muted').attr('x', -m.left).attr('y', rowH / 2 + 14).text((d) => d.months);
		bars.append('path').attr('d', (d) => hbar(0, x(d.v), (rowH - bh) / 2, bh)).attr('fill', (d) => d.color);
		bars.append('text').attr('class', 'label').attr('x', (d) => x(d.v) + 8).attr('y', rowH / 2 + 4).style('font-weight', 600).text((d) => f0(d.v));
		// the gap between the two bars, and the verdict on it
		const x0 = x(H.wetMean), x1 = x(H.dryMean), yb = axisY + 14;
		g.append('path').attr('d', `M${x0},${yb - 6}V${yb}H${x1}V${yb - 6}`).attr('fill', 'none').attr('stroke', COL.ink).attr('stroke-width', 1.5);
		g.append('text').attr('class', 'label').attr('x', x1).attr('y', yb + 18).attr('text-anchor', 'end')
			.text(`${s0(H.mean)} MWh/day · not significant (p = 0.0998)`);
		rowHover(bars, (d) => [[[f1(d.v) + ' MWh/day', 'mean per grid cell', d.color]], `${d.label} (${d.months})`]);
		table(plot.closest('figure'), 'Mean estimated generation per grid cell by season', [
			['Season', (d) => `${d.label} (${d.months})`], ['Mean per grid cell (MWh/day)', (d) => f1(d.v), 1],
		], rows);
	}

	/* ---------- 7. H3: monthly irradiance with the seasons shaded ---------- */
	function months(plot, W) {
		const M = R.h2.months;
		const isDry = (k) => { const mo = +k.slice(5); return mo === 12 || mo <= 5; };
		const date = (k) => new Date(+k.slice(0, 4), +k.slice(5) - 1, 15);
		const name = (k) => date(k).toLocaleString('en', { month: 'short' });
		const full = (k) => date(k).toLocaleString('en', { month: 'long', year: 'numeric' });
		const m = { top: 26, right: 12, bottom: 48, left: 40 };
		const w = W - m.left - m.right, h = Math.round(Math.min(260, Math.max(200, w * 0.45)));
		const svg = svgIn(plot, W, h + m.top + m.bottom).attr('aria-label',
			'Line chart of monthly mean irradiance from September 2025 to August 2026. It peaks in April during the dry season and is lowest in August; December to February are similar to the wet months.');
		const g = svg.append('g').attr('transform', `translate(${m.left},${m.top})`);
		const x = d3.scalePoint().domain(M.map((d) => d.month)).range([0, w]).padding(0.5);
		const step = x.step();
		const y = d3.scaleLinear().domain([0, 8]).range([h, 0]);
		// season bands: runs of consecutive months in the same season
		const runs = [];
		M.forEach((d) => {
			const dry = isDry(d.month), last = runs[runs.length - 1];
			if (last && last.dry === dry) last.end = d.month; else runs.push({ dry, start: d.month, end: d.month });
		});
		runs.forEach((r) => {
			const x0 = x(r.start) - step / 2, x1 = x(r.end) + step / 2;
			g.append('rect').attr('x', x0).attr('width', x1 - x0).attr('y', 0).attr('height', h)
				.attr('fill', r.dry ? COL.dry : COL.wet).attr('fill-opacity', r.dry ? 0.12 : 0.08);
			g.append('text').attr('class', 'label-muted').attr('x', (x0 + x1) / 2).attr('y', -9).attr('text-anchor', 'middle')
				.text(x1 - x0 > 70 ? (r.dry ? 'Dry season' : 'Wet season') : (r.dry ? 'Dry' : 'Wet'));
		});
		gridY(g, y, w, 4);
		g.append('g').attr('class', 'axis').attr('transform', `translate(0,${h})`)
			.call(d3.axisBottom(x).tickSize(0).tickPadding(8).tickFormat((k, i) => (w < 360 && i % 2 ? '' : name(k))))
			.select('.domain').remove();
		g.append('text').attr('class', 'axis-title').attr('x', w / 2).attr('y', h + 36).attr('text-anchor', 'middle').text('Sep 2025 – Aug 2026');
		yAxis(g, y, 4, f0, null, h);
		g.append('path').datum(M).attr('fill', 'none').attr('stroke', COL.ink).attr('stroke-width', 2)
			.attr('stroke-linejoin', 'round').attr('stroke-linecap', 'round')
			.attr('d', d3.line().x((d) => x(d.month)).y((d) => y(d.all)));
		const pts = g.selectAll('g.row').data(M).join('g').attr('class', 'row mark')
			.attr('aria-label', (d) => `${full(d.month)}: ${f1(d.all)} kWh/m²/day, ${isDry(d.month) ? 'dry' : 'wet'} season`);
		pts.append('rect').attr('class', 'row-hit').attr('x', (d) => x(d.month) - step / 2).attr('width', step).attr('y', 0).attr('height', h);
		pts.append('circle').attr('cx', (d) => x(d.month)).attr('cy', (d) => y(d.all)).attr('r', 4.5)
			.attr('fill', (d) => (isDry(d.month) ? COL.dry : COL.wet)).attr('stroke', COL.paper).attr('stroke-width', 2);
		const peak = M.reduce((a, b) => (b.all > a.all ? b : a));
		g.append('text').attr('class', 'label').attr('x', x(peak.month)).attr('y', y(peak.all) - 10).attr('text-anchor', 'middle')
			.style('font-weight', 600).text(f1(peak.all));
		rowHover(pts, (d) => [[
			[f2(d.all) + ' kWh/m²/day', 'mean irradiance', isDry(d.month) ? COL.dry : COL.wet],
			[isDry(d.month) ? 'Dry season' : 'Wet season', ''],
		], full(d.month)]);
		table(plot.closest('figure'), 'Monthly mean irradiance across all plant sites', [
			['Month', (d) => full(d.month)], ['Season', (d) => (isDry(d.month) ? 'Dry' : 'Wet')], ['Irradiance (kWh/m²/day)', (d) => f2(d.all), 1],
		], M);
	}

	/* ---------- 8. H3: dry − wet difference in each grid cell ---------- */
	function cellDiff(plot, W) {
		const cells = [...R.h3.cells].sort((a, b) => b.diff - a.diff);
		const narrow = W < 560;
		const m = { top: 4, right: narrow ? 16 : 150, bottom: 48, left: narrow ? 74 : 110 };
		const rowH = 24, bh = 14, h = cells.length * rowH, w = W - m.left - m.right;
		const svg = svgIn(plot, W, h + m.top + m.bottom).attr('aria-label',
			'Bar chart of the dry minus wet difference in each of 19 grid cells. 18 cells are higher in the dry season; C13 is slightly higher in the wet season. C01 is far larger than the rest at +1,481 MWh/day.');
		const g = svg.append('g').attr('transform', `translate(${m.left},${m.top})`);
		const xmax = d3.scaleLinear().domain([0, d3.max(cells, (d) => d.diff)]).nice().domain()[1];
		const x = d3.scaleLinear().domain([-xmax * 0.03, xmax]).range([0, w]);
		gridX(g, x, h, narrow ? 4 : 6);
		xAxis(g, x, h, narrow ? 4 : 6, (v) => (v === 0 ? '0' : s0(v)), 'Dry − wet estimated generation (MWh/day)', w);
		g.append('line').attr('x1', x(0)).attr('x2', x(0)).attr('y1', 0).attr('y2', h).attr('stroke', COL.muted);
		const rows = g.selectAll('g.row').data(cells).join('g').attr('class', 'row mark').attr('transform', (d, i) => `translate(0,${i * rowH})`)
			.attr('aria-label', (d) => `${d.id}: ${s0(d.diff)} MWh/day, ${d.diff >= 0 ? 'dry' : 'wet'} season higher`);
		rows.append('rect').attr('class', 'row-hit').attr('x', -m.left).attr('width', W - 8).attr('height', rowH).attr('rx', 3);
		rows.append('text').attr('class', 'label').attr('x', -m.left).attr('y', rowH / 2 + 4).text((d) => d.id);
		if (!narrow) rows.append('text').attr('class', 'label-muted').attr('x', -m.left + 36).attr('y', rowH / 2 + 4).text((d) => f0(d.mw) + ' MW');
		rows.append('path').attr('d', (d) => hbar(x(0), x(d.diff), (rowH - bh) / 2, bh)).attr('fill', (d) => (d.diff >= 0 ? COL.dry : COL.wet));
		// label only the two bars the story is about: the giant (C01) and the one wet-higher cell
		const top = cells[0];
		rows.filter((d) => d === top).append('text').attr('class', 'label').attr('y', rowH / 2 + 4)
			.attr('x', (d) => (narrow ? x(d.diff) - 6 : x(d.diff) + 8)).attr('text-anchor', narrow ? 'end' : 'start')
			.style('fill', narrow ? '#fff' : null)
			.text((d) => (narrow ? s0(d.diff) : `${s0(d.diff)} · 40% of all capacity`));
		rows.filter((d) => d.diff < 0).append('text').attr('class', 'label').attr('y', rowH / 2 + 4)
			.attr('x', (d) => x(Math.max(d.diff, 0)) + 8)
			.text('wet season higher');
		rowHover(rows, (d) => [[
			[s0(d.diff) + ' MWh/day', d.diff >= 0 ? 'dry season higher' : 'wet season higher', d.diff >= 0 ? COL.dry : COL.wet],
			[f0(d.dry) + ' / ' + f0(d.wet), 'dry / wet, MWh/day'],
			[`${d.plants} plant${d.plants > 1 ? 's' : ''}, ${f1(d.mw)} MW`, ''],
		], `${d.id} · ${d.island}`]);
		table(plot.closest('figure'), 'Dry and wet mean estimated generation in each grid cell', [
			['Cell', (d) => d.id], ['Island group', (d) => d.island], ['Plants', (d) => d.plants, 1], ['MW', (d) => f1(d.mw), 1],
			['Dry (MWh/day)', (d) => f1(d.dry), 1], ['Wet (MWh/day)', (d) => f1(d.wet), 1], ['Dry − wet', (d) => s1(d.diff), 1],
		], cells);
	}

	/* ---------- Hero: the 57 plants on a map of the Philippines ---------- */
	function heroMap() {
		const M = window.PH_MAP, host = document.querySelector('.hero-map-plot');
		if (!M || !host || !R.plants) return;
		const proj = d3.geoMercator().scale(M.scale).translate(M.translate);
		const r = d3.scaleSqrt().domain([0, d3.max(R.plants, (d) => d.mw)]).range([0, 13]);
		const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
		const svg = d3.select(host).append('svg').attr('viewBox', `0 0 ${M.width} ${M.height}`).attr('aria-hidden', 'true');
		svg.append('path').attr('class', 'land').attr('d', M.d);
		const pts = R.plants.map((d) => { const [x, y] = proj([d.lon, d.lat]); return { ...d, x, y, r: Math.max(2.5, r(d.mw)) }; })
			.sort((a, b) => b.mw - a.mw); // big first, so small dots stay on top
		const north = d3.max(pts, (d) => d.lat), south = d3.min(pts, (d) => d.lat);
		const dots = svg.append('g').selectAll('circle').data(pts).join('circle').attr('class', 'plant')
			.attr('cx', (d) => d.x).attr('cy', (d) => d.y).attr('r', (d) => d.r)
			.style('transform-box', 'fill-box').style('transform-origin', 'center');
		if (!reduce) {
			// plants appear once, north to south, after the hero has entered
			dots.style('animation', (d) => `plant-in .5s cubic-bezier(.2,.7,.2,1) ${(500 + (north - d.lat) / (north - south) * 900).toFixed(0)}ms both`);
		}
		// nearest-dot hover over the whole map
		const del = d3.Delaunay.from(pts, (d) => d.x, (d) => d.y);
		let current = null;
		const svgEl = svg.node();
		svg.on('pointermove', (ev) => {
			const pt = svgEl.createSVGPoint(); pt.x = ev.clientX; pt.y = ev.clientY;
			const p = pt.matrixTransform(svgEl.getScreenCTM().inverse());
			const d = pts[del.find(p.x, p.y)];
			const scale = svgEl.getBoundingClientRect().width / M.width;
			if (Math.hypot(d.x - p.x, d.y - p.y) * scale > Math.max(18, d.r * scale + 8)) { leave(); return; }
			if (current !== d) { dots.classed('is-hover', (e) => e === d); current = d; }
			showTip([[f1(d.mw) + ' MW', 'installed capacity', COL.dry], [d.province + ', ' + d.island, '']], d.name, { x: ev.clientX, y: ev.clientY });
		});
		const leave = () => { current = null; dots.classed('is-hover', false); hideTip(); };
		svg.on('pointerleave', leave);
	}
	heroMap();

	/* ---------- mount + resize ---------- */
	const charts = { nutshell, rho, irradiance, partial, yield: yieldStrip, seasons, months, celldiff: cellDiff };
	document.querySelectorAll('figure.chart[data-chart]').forEach((fig) => {
		const draw = charts[fig.dataset.chart];
		const plot = fig.querySelector('.chart-plot');
		if (!draw || !plot) return;
		let last = 0;
		const render = () => {
			const W = Math.round(plot.clientWidth);
			if (!W || Math.abs(W - last) < 2) return;
			last = W;
			hideTip();
			draw(plot, W);
		};
		new ResizeObserver(render).observe(plot);
		render();
	});
})();
