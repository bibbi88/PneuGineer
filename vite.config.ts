import { defineConfig, type Plugin } from 'vitest/config';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, sep } from 'node:path';
import prettier from 'prettier';

const PROJECT_ROOT = resolve(import.meta.dirname);
const COMPONENTS_ROOT = resolve(import.meta.dirname, 'src/components') + sep;

/** Finds the `export const <exportName> ... = { ... };` object literal in `source` and returns
 * its brace span - used by the symbol lab's save endpoint below to replace just that one
 * object's contents without disturbing the rest of the file. Assumes (true for every geometry
 * object this is used on) the object's own values never contain a nested `{`/`}` themselves. */
function findExportObjectSpan(
  source: string,
  exportName: string,
): { braceStart: number; braceEnd: number } {
  const marker = `export const ${exportName}`;
  const markerIdx = source.indexOf(marker);
  if (markerIdx === -1) throw new Error(`Export ${exportName} not found`);
  const eqIdx = source.indexOf('=', markerIdx);
  const braceStart = source.indexOf('{', eqIdx);
  let depth = 0;
  let i = braceStart;
  for (; i < source.length; i++) {
    if (source[i] === '{') depth++;
    else if (source[i] === '}') {
      depth--;
      if (depth === 0) break;
    }
  }
  return { braceStart, braceEnd: i };
}

/**
 * Dev-only endpoint for the symbol lab (symbol-lab.html): saving a tuned geometry writes it
 * straight back into the component's own source file, so the lab's "current default" and the
 * app's actual default never drift apart and there's nothing to copy/paste by hand. Only runs
 * under `vite dev` (registered in configureServer, never in the production build), and only
 * ever touches files under src/components - this is a localhost developer tool, not something
 * exposed to end users of the built app.
 */
function symbolLabSavePlugin(): Plugin {
  return {
    name: 'symbol-lab-save',
    configureServer(server) {
      server.middlewares.use('/__symbol_lab_save__', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end('Method not allowed');
          return;
        }
        let body = '';
        req.on('data', (chunk) => (body += chunk));
        req.on('end', () => {
          void (async () => {
            try {
              const { sourceFile, exportName, geometry } = JSON.parse(body) as {
                sourceFile: string;
                exportName: string;
                geometry: Record<string, number>;
              };
              if (typeof sourceFile !== 'string' || typeof exportName !== 'string') {
                throw new Error('Invalid request body');
              }
              if (!/^[A-Z][A-Z0-9_]*$/.test(exportName)) {
                throw new Error('Invalid export name');
              }
              const absPath = resolve(PROJECT_ROOT, sourceFile);
              if (!absPath.startsWith(COMPONENTS_ROOT) || !absPath.endsWith('.ts')) {
                throw new Error('Refusing to write outside src/components');
              }

              const original = readFileSync(absPath, 'utf-8');
              const { braceStart, braceEnd } = findExportObjectSpan(original, exportName);
              const body2 = Object.entries(geometry)
                .map(([k, v]) => `  ${k}: ${v},`)
                .join('\n');
              const rewritten =
                original.slice(0, braceStart) + `{\n${body2}\n}` + original.slice(braceEnd + 1);

              const config = (await prettier.resolveConfig(absPath)) ?? {};
              const formatted = await prettier.format(rewritten, { ...config, filepath: absPath });
              writeFileSync(absPath, formatted, 'utf-8');

              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ ok: true }));
            } catch (err) {
              res.statusCode = 400;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ ok: false, error: (err as Error).message }));
            }
          })();
        });
      });
    },
  };
}

export default defineConfig({
  root: '.',
  plugins: [viteSingleFile(), symbolLabSavePlugin()],
  build: {
    outDir: 'dist',
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.ts'],
  },
});
