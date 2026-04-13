import * as esbuild from 'esbuild';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const appRoot = join(__dirname, '..');

await esbuild.build({
  entryPoints: [join(appRoot, 'src/client/index.ts')],
  bundle: true,
  format: 'iife',
  platform: 'browser',
  target: ['es2022'],
  outfile: join(appRoot, 'public/assets/client.js'),
  sourcemap: true
});
