/* Bake the Philippines outline for the hero map into assets/data/ph-map.js.
 *
 * Source: Natural Earth 1:50m admin-0 countries (public domain), via the world-atlas package:
 *   https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-50m.json
 * Needs: npm i d3-geo@3.1.1 topojson-client@3.1.0 (run from any folder that has them)
 * Usage: node scripts/bake_map.mjs <countries-50m.json> <out.js>
 *
 * The page projects plant coordinates with d3.geoMercator().scale(scale).translate(translate),
 * the same projection used here, so dots and outline line up.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(process.cwd() + '/');
const { geoMercator, geoPath } = require('d3-geo');
const { feature } = require('topojson-client');

const [src, out] = process.argv.slice(2);
const world = JSON.parse(readFileSync(src, 'utf8'));
const ph = feature(world, world.objects.countries).features.find((f) => f.properties.name === 'Philippines');
if (!ph) throw new Error('Philippines not found');

const W = 440, pad = 6;
const proj = geoMercator().fitWidth(W - pad * 2, ph);
const [[x0, y0], [x1, y1]] = geoPath(proj).bounds(ph);
proj.translate([proj.translate()[0] - x0 + pad, proj.translate()[1] - y0 + pad]);
const H = Math.ceil(y1 - y0 + pad * 2);
const d = geoPath(proj).digits(1)(ph);

const data = { width: W, height: H, scale: +proj.scale().toFixed(4), translate: proj.translate().map((v) => +v.toFixed(3)), d };
writeFileSync(out, '/* Philippines outline: Natural Earth 1:50m (public domain), baked by scripts/bake_map.mjs. */\n'
	+ 'window.PH_MAP = ' + JSON.stringify(data) + ';\n');
console.log(`ok ${W}x${H}, path ${(d.length / 1024).toFixed(1)} KB`);
