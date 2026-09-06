/** Reproduce connected walkable-area evidence: node --import tsx tools/measure-area.mts */
import { readFileSync } from 'node:fs';
import { Navigation, WALK_AREAS, WORLD, type Obstacle, type WalkArea } from '../src/simulation.ts';

const original = JSON.parse(readFileSync(new URL('../tests/fixtures/original-obstacles.json', import.meta.url), 'utf8')) as { obstacles: Obstacle[] };
const current = JSON.parse(readFileSync(new URL('../public/assets/models/manifest.json', import.meta.url), 'utf8')) as { obstacles: Obstacle[] };
const originalAreas = WORLD.districts.filter(d => ['courtyard', 'passage', 'ridge'].includes(d.id)).map(d => d.bounds);

function unionArea(rectangles: WalkArea[]): number {
  const xs = [...new Set(rectangles.flatMap(r => [r.minX, r.maxX]))].sort((a, b) => a - b);
  const zs = [...new Set(rectangles.flatMap(r => [r.minZ, r.maxZ]))].sort((a, b) => a - b);
  let area = 0;
  for (let i = 1; i < xs.length; i++) for (let j = 1; j < zs.length; j++) {
    const x = (xs[i - 1] + xs[i]) / 2, z = (zs[j - 1] + zs[j]) / 2;
    if (rectangles.some(r => x >= r.minX && x <= r.maxX && z >= r.minZ && z <= r.maxZ)) area += (xs[i] - xs[i - 1]) * (zs[j] - zs[j - 1]);
  }
  return Math.round(area * 100) / 100;
}

function measure(obstacles: Obstacle[], areas: WalkArea[], radius: number, step: number) {
  const nav = new Navigation(obstacles, radius, areas);
  const minX = Math.min(...areas.map(a => a.minX)), maxX = Math.max(...areas.map(a => a.maxX));
  const minZ = Math.min(...areas.map(a => a.minZ)), maxZ = Math.max(...areas.map(a => a.maxZ));
  const nx = Math.round((maxX - minX) / step), nz = Math.round((maxZ - minZ) / step);
  const free = new Uint8Array(nx * nz);
  let count = 0;
  for (let x = 0; x < nx; x++) for (let z = 0; z < nz; z++) {
    if (nav.isFree({ x: minX + (x + 0.5) * step, z: minZ + (z + 0.5) * step })) { free[z * nx + x] = 1; count++; }
  }
  const origin = Math.floor((6 - minZ) / step) * nx + Math.floor((3 - minX) / step);
  if (!free[origin]) throw new Error('Original starting courtyard position must remain collision free.');
  const queue = new Int32Array(nx * nz);
  let head = 0, tail = 1; queue[0] = origin; free[origin] = 2;
  while (head < tail) {
    const id = queue[head++], x = id % nx, z = Math.floor(id / nx);
    for (const next of [x ? id - 1 : -1, x + 1 < nx ? id + 1 : -1, z ? id - nx : -1, z + 1 < nz ? id + nx : -1]) {
      if (next >= 0 && free[next] === 1) { free[next] = 2; queue[tail++] = next; }
    }
  }
  return { total: Math.round(count * step * step * 100) / 100, connected: Math.round(tail * step * step * 100) / 100 };
}

const results = [];
for (const radius of [0.42, 0.48]) for (const sampleStep of [0.1, 0.05]) {
  const oldArea = measure(original.obstacles, originalAreas, radius, sampleStep);
  const newArea = measure(current.obstacles, WALK_AREAS, radius, sampleStep);
  results.push({ radius, sampleStep, oldUsableSquareMetres: oldArea, newUsableSquareMetres: newArea, ratio: newArea.connected / oldArea.connected });
}
const oldFootprint = unionArea(originalAreas), newFootprint = unionArea(WALK_AREAS);
console.log(JSON.stringify({
  method: 'Exact rectangle-union footprint; approximate usable-center area sampled at 10 cm and 5 cm, with actual Navigation.isFree actor clearance and four-neighbor flood fill from (3,6). All units are metres / square metres. Fine-grid values are the reported estimates; coarse-grid values show sampling sensitivity.',
  oldObstacles: original.obstacles.length, newObstacles: current.obstacles.length,
  oldFootprintSquareMetres: oldFootprint, newFootprintSquareMetres: newFootprint, footprintRatio: newFootprint / oldFootprint,
  results,
}, null, 2));
