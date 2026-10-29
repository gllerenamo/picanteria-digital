/**
 * Verifica el Principio II de la constitución: cada criterio de aceptación `AC-x.y` de
 * `specs/NNN-*\/spec.md` debe aparecer en al menos una prueba con el título `[NNN] AC-x.y`.
 *
 * Uso: `npm run check:ac -- 001 003`. Sin argumentos revisa las features que ya tienen
 * alguna prueba etiquetada.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = join(__dirname, '..');
const specsDir = join(root, 'specs');
const testFilePattern = /\.(spec|test)\.tsx?$/;
const testRoots = [
  ...['apps', 'packages'].flatMap((group) => {
    const groupDir = join(root, group);
    if (!existsSync(groupDir)) return [];
    return readdirSync(groupDir).flatMap((pkg) =>
      ['src', 'test', 'tests', 'e2e'].map((sub) => join(groupDir, pkg, sub)),
    );
  }),
];

function walk(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((entry) => {
    if (entry === 'node_modules' || entry === 'dist') return [];
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return walk(full);
    return testFilePattern.test(entry) ? [full] : [];
  });
}

function unique(values: Iterable<string>): string[] {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b, 'es', { numeric: true }));
}

const testFiles = testRoots.flatMap(walk);
const tagged = new Map<string, Set<string>>();
for (const file of testFiles) {
  for (const match of readFileSync(file, 'utf8').matchAll(/\[(\d{3})\] (AC-\d+\.\d+)/g)) {
    const [, feature, id] = match;
    if (!feature || !id) continue;
    const ids = tagged.get(feature) ?? new Set<string>();
    ids.add(id);
    tagged.set(feature, ids);
  }
}

const requested = process.argv.slice(2).filter((arg) => /^\d{3}$/.test(arg));
const features = requested.length > 0 ? unique(requested) : unique(tagged.keys());
const specFolders = existsSync(specsDir) ? readdirSync(specsDir) : [];

if (features.length === 0) {
  console.log('No hay pruebas etiquetadas con [NNN] AC-x.y; no hay nada que revisar.');
  process.exit(0);
}

let failed = false;
for (const feature of features) {
  const folder = specFolders.find((name) => name.startsWith(`${feature}-`));
  const specPath = folder ? join(specsDir, folder, 'spec.md') : undefined;
  if (!specPath || !existsSync(specPath)) {
    console.error(`✗ ${feature}: no se encontró specs/${feature}-*/spec.md`);
    failed = true;
    continue;
  }
  const spec = readFileSync(specPath, 'utf8');
  // Se toman los criterios definidos en negrita; si no hay, cualquier mención.
  const defined = [...spec.matchAll(/\*\*(AC-\d+\.\d+)\*\*/g)].map((m) => m[1] ?? '');
  const ids = unique(defined.length > 0 ? defined : [...spec.matchAll(/\bAC-\d+\.\d+\b/g)].map((m) => m[0]));
  if (ids.length === 0) {
    console.error(`✗ ${feature}: ${relative(root, specPath)} no tiene criterios AC-x.y`);
    failed = true;
    continue;
  }
  const covered = tagged.get(feature) ?? new Set<string>();
  const missing = ids.filter((id) => !covered.has(id));
  console.log(`${missing.length === 0 ? '✓' : '✗'} ${folder}: ${ids.length - missing.length}/${ids.length} criterios cubiertos`);
  if (missing.length > 0) {
    console.log(`  Sin prueba: ${missing.join(', ')}`);
    failed = true;
  }
}

process.exit(failed ? 1 : 0);
