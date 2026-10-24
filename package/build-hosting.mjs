import { cp, mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
const staging = await mkdtemp(join(tmpdir(), 'mira-hosting-'));
const target = join(staging, 'mira');
await mkdir(target);
// فقط فهرست صریح فایل‌های عمومی بسته‌بندی می‌شود؛ هیچ فایل env یا داده واقعی کپی نمی‌شود.
for (const file of ['package.json', 'package-lock.json', 'LICENSE', 'NOTICE'])
  await cp(join(root, file), join(target, file));
for (const workspace of [
  'packages/shared-types',
  'apps/api',
  'apps/worker',
  'apps/widget',
  'apps/dashboard',
]) {
  await mkdir(join(target, workspace), { recursive: true });
  await cp(join(root, workspace, 'package.json'), join(target, workspace, 'package.json'));
}
for (const workspace of ['packages/shared-types', 'apps/api', 'apps/worker'])
  await cp(join(root, workspace, 'dist'), join(target, workspace, 'dist'), { recursive: true });
// داده‌های تست داخل public/widget-dist وارد بسته انتشار نمی‌شوند.
for (const file of ['chat.html', 'chat.css', 'chat.js']) {
  await mkdir(join(target, 'apps/api/public'), { recursive: true });
  await cp(join(root, 'apps/api/public', file), join(target, 'apps/api/public', file));
}
await mkdir(join(target, 'apps/api/public/widget-dist'), { recursive: true });
await cp(
  join(root, 'apps/widget/dist/widget.js'),
  join(target, 'apps/api/public/widget-dist/widget.js'),
);
await cp(join(root, 'apps/dashboard/dist'), join(target, 'apps/api/dashboard'), {
  recursive: true,
});
await cp(join(root, 'package/hosting'), target, { recursive: true });
await cp(join(root, 'package/HOSTING.md'), join(target, 'HOSTING.md'));
await cp(join(root, 'package/HOSTING.fa.md'), join(target, 'HOSTING.fa.md'));
await writeFile(
  join(target, 'apps/api/dashboard/config.js'),
  'window.__MIRA_API_URL__ = window.location.origin;\n',
);
const output = join(root, 'package/dist');
await mkdir(output, { recursive: true });
const archive = join(output, `mira-hosting-${manifest.version}.tar.gz`);
execFileSync('tar', ['-czf', archive, '-C', staging, 'mira'], { stdio: 'inherit' });
console.log(`Built: ${archive}`);
console.log(`Staging: ${target}`);
