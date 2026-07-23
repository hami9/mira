import * as esbuild from 'esbuild';

const watch = process.argv.includes('--watch');

const options = {
  entryPoints: ['src/index.ts'],
  outfile: 'dist/widget.js',
  bundle: true,
  minify: true,
  sourcemap: false,
  format: 'iife',
  target: ['es2018'],
  platform: 'browser',
};

if (watch) {
  const ctx = await esbuild.context(options);
  await ctx.watch();
  console.log('میرا widget — در حالت watch...');
} else {
  await esbuild.build(options);
  console.log('میرا widget build شد: dist/widget.js');
}
