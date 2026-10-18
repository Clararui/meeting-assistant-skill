import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { packageNotes } from '../scripts/package_notes.mjs';

const modules = process.env.MEETING_TEST_MODULE_DIR;
async function fixture(t) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'meeting-assistant-test-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  await fs.mkdir(path.join(dir, 'assets'));
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jZ1kAAAAASUVORK5CYII=', 'base64');
  await fs.writeFile(path.join(dir, 'assets', 'example.png'), png);
  return dir;
}
test('produces offline HTML and a ZIP with only referenced assets', async t => {
  const dir = await fixture(t);
  await fs.writeFile(path.join(dir, 'private-recording.txt'), 'must not be packaged');
  const md = '# 测试笔记\n\n## 原理\n\n![示意图](assets/example.png)\n\n<script>globalThis.pwned = true</script>\n';
  const input = path.join(dir, 'notes.md'); await fs.writeFile(input, md);
  const result = await packageNotes(input, path.join(dir, 'delivery'), modules);
  const html = await fs.readFile(result.html, 'utf8');
  assert.ok(html.includes('data:image/png;base64,'));
  assert.ok(!html.includes('<script>globalThis.pwned'));
  assert.ok(html.includes('&lt;script&gt;'));
  assert.equal(result.images, 1);
  assert.equal(await fs.readFile(result.markdown, 'utf8'), md);
  assert.deepEqual(await fs.readFile(path.join(dir, 'delivery/assets/example.png')), await fs.readFile(path.join(dir, 'assets/example.png')));
  const { createRequire } = await import('node:module');
  const require = createRequire(modules ? path.join(path.resolve(modules), '__test.cjs') : import.meta.url);
  const JSZip = require('jszip');
  const zip = await JSZip.loadAsync(await fs.readFile(result.zip));
  assert.ok(zip.file('notes.md')); assert.ok(zip.file('notes.html')); assert.ok(zip.file('assets/example.png'));
  assert.ok(!zip.file('private-recording.txt'));
});
test('refuses traversal and symlink escapes instead of leaking files', async t => {
  const dir = await fixture(t); const input = path.join(dir, 'notes.md');
  await fs.writeFile(input, '# 测试\n\n![秘密](../secret.png)\n');
  await assert.rejects(packageNotes(input, path.join(dir, 'out'), modules), /目录内相对路径/);
  const outside = await fs.mkdtemp(path.join(os.tmpdir(), 'meeting-outside-'));
  t.after(() => fs.rm(outside, { recursive: true, force: true }));
  await fs.writeFile(path.join(outside, 'secret.png'), 'outside');
  await fs.symlink(path.join(outside, 'secret.png'), path.join(dir, 'assets', 'escape.png'));
  await fs.writeFile(input, '# 测试\n\n![秘密](assets/escape.png)\n');
  await assert.rejects(packageNotes(input, path.join(dir, 'out'), modules), /符号链接越界/);
});
test('rejects missing images, deep headings and unclosed fences', async t => {
  const dir = await fixture(t); const input = path.join(dir, 'notes.md');
  await fs.writeFile(input, '# 测试\n\n![缺图](assets/missing.png)\n');
  await assert.rejects(packageNotes(input, path.join(dir, 'out'), modules), /ENOENT/);
  await fs.writeFile(input, '# 测试\n\n### 三级标题\n');
  await assert.rejects(packageNotes(input, path.join(dir, 'out'), modules), /二级标题/);
  await fs.writeFile(input, '# 测试\n\n```text\n未结束\n');
  await assert.rejects(packageNotes(input, path.join(dir, 'out'), modules), /未闭合/);
});
test('refuses to replace an existing delivery', async t => {
  const dir = await fixture(t); const input = path.join(dir, 'notes.md');
  await fs.writeFile(input, '# 测试\n\n## 内容\n\n一段笔记。\n');
  const out = path.join(dir, 'out'); const result = await packageNotes(input, out, modules);
  const before = await fs.readFile(result.html);
  await assert.rejects(packageNotes(input, out, modules), /输出已存在/);
  assert.deepEqual(await fs.readFile(result.html), before);
});
