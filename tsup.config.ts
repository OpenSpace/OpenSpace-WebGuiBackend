import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['backend.ts', 'showbuilder.ts'],
  format: ['cjs'],
  target: 'node20',
  outDir: 'dist',
  minify: true,
  bundle: true
});
