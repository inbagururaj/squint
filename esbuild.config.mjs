import { build } from 'esbuild';
import { copyFileSync, rmSync } from 'node:fs';

const outdir = 'dist';
rmSync(outdir, { recursive: true, force: true });

await build({
  entryPoints: {
    'content-script': 'src/content-script.ts',
    'background/service-worker': 'src/background/service-worker.ts',
    'popup/popup': 'src/popup/popup.ts',
  },
  bundle: true,
  outdir,
  format: 'iife',
  target: 'chrome110',
  sourcemap: true,
});

copyFileSync('manifest.json', `${outdir}/manifest.json`);
copyFileSync('src/popup/popup.html', `${outdir}/popup/popup.html`);
copyFileSync('src/popup/popup.css', `${outdir}/popup/popup.css`);

console.log('Build complete.');
