#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const formats = new Map([['.png','image/png'],['.jpg','image/jpeg'],['.jpeg','image/jpeg'],['.webp','image/webp'],['.gif','image/gif']]);
const inside = (root, target) => { const rel = path.relative(root, target); return rel === '' || (!rel.startsWith(`..${path.sep}`) && rel !== '..' && !path.isAbsolute(rel)); };

export async function packageNotes(input, outDir, moduleDir) {
  const source = await fs.realpath(input);
  if (path.extname(source).toLowerCase() !== '.md') throw new Error('输入必须是 .md 文件');
  const root = path.dirname(source);
  const output = path.resolve(outDir);
  const basename = path.basename(source, '.md');
  const requireFrom = createRequire(moduleDir ? path.join(path.resolve(moduleDir), '__meeting_resolver.cjs') : path.join(here, '..', 'package.json'));
  let marked, JSZip;
  try {
    ({ marked } = await import(pathToFileURL(requireFrom.resolve('marked')).href));
    ({ default: JSZip } = await import(pathToFileURL(requireFrom.resolve('jszip')).href));
  } catch { throw new Error('缺少 marked / jszip。请在 Skill 目录运行 npm install --ignore-scripts，或指定 --module-dir。'); }
  const markdown = await fs.readFile(source, 'utf8');
  const tokens = marked.lexer(markdown, { gfm: true });
  const headings = []; const imageTokens = [];
  marked.walkTokens(tokens, token => {
    if (token.type === 'heading') headings.push(token);
    if (token.type === 'image') imageTokens.push(token);
  });
  if (headings.filter(t => t.depth === 1).length !== 1 || headings.some(t => t.depth > 2)) throw new Error('需要一个一级标题，正文只使用二级标题');
  let fence;
  for (const line of markdown.split('\n')) {
    const open = line.match(/^ {0,3}(`{3,}|~{3,})(.*)$/);
    if (!open) continue;
    if (!fence) fence = { char: open[1][0], length: open[1].length };
    else if (open[1][0] === fence.char && open[1].length >= fence.length && !open[2].trim()) fence = undefined;
  }
  if (fence) throw new Error('存在未闭合代码块');
  const assets = new Map();
  for (const token of imageTokens) {
    const href = token.href;
    let decoded;
    try { decoded = decodeURIComponent(href); } catch { throw new Error(`图片地址编码无效：${href}`); }
    if (/^(?:[a-z][a-z0-9+.-]*:|\/|\\)/i.test(decoded) || decoded.includes('\\') || decoded.split('/').includes('..') || /[?#\0]/.test(decoded)) throw new Error(`图片需要目录内相对路径：${href}`);
    const target = path.resolve(root, decoded);
    if (!inside(root, target)) throw new Error(`图片路径越界：${href}`);
    const real = await fs.realpath(target);
    if (!inside(root, real)) throw new Error(`图片符号链接越界：${href}`);
    const type = formats.get(path.extname(real).toLowerCase());
    if (!type) throw new Error(`不支持的图片格式：${href}，请先导出 PNG 等位图`);
    if (!(await fs.stat(real)).isFile()) throw new Error(`图片不是文件：${href}`);
    const archivePath = path.relative(root, target).split(path.sep).join('/');
    if ([`${basename}.md`, `${basename}.html`, `${basename}.zip`].includes(archivePath)) throw new Error(`图片与交付文件重名：${href}`);
    const bytes = await fs.readFile(real);
    assets.set(href, { bytes, type, archivePath });
  }
  const renderer = Object.assign(new marked.Renderer(), {
    html({ text }) { return escape(text); },
    image({ href, text }) {
      const asset = assets.get(href);
      return `<img src="data:${asset.type};base64,${asset.bytes.toString('base64')}" alt="${escape(text)}" style="display:block;width:100%;height:auto;margin:18px auto;border:1px solid #e2e8f0;border-radius:8px">`;
    },
    link({ href, tokens }) {
      const label = this.parser.parseInline(tokens);
      return /^(https?:|mailto:|#)/i.test(href) ? `<a href="${escape(href)}" rel="noreferrer">${label}</a>` : label;
    }
  });
  const body = marked.parser(tokens, { gfm: true, renderer });
  const title = escape(headings.find(t => t.depth === 1).text);
  const html = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><style>
*{box-sizing:border-box}body{margin:0;background:#f3f5f8;color:#1e293b;font:16px/1.85 -apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif}header{position:sticky;top:0;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 24px;background:white;border-bottom:1px solid #e2e8f0}header span{font-size:13px;color:#64748b}button{border:0;border-radius:8px;background:#155eef;color:white;padding:10px 16px;font:inherit;cursor:pointer}article{max-width:1040px;margin:28px auto;padding:48px 56px;background:white;border-radius:12px}h1{font-size:32px;line-height:1.4}h2{font-size:23px;margin:38px 0 18px;padding-bottom:10px;border-bottom:2px solid #e2e8f0}table{border-collapse:collapse;width:100%;font-size:14px;margin:20px 0}th,td{border:1px solid #dbe3ee;padding:10px 12px;text-align:left;vertical-align:top}th{background:#f1f5f9}pre{overflow:auto;background:#f1f5f9;padding:16px}code{font-size:14px}a{color:#155eef}li{margin:5px 0}@media(max-width:700px){article{padding:24px 18px;margin:0}h1{font-size:27px}table{display:block;overflow:auto}header{padding:10px 14px}}@media print{header{display:none}body{background:white}article{margin:0;padding:0}img,table{break-inside:avoid}}
</style></head><body><header><span>会议助理 · 图文笔记</span><button id="copy">复制全部图文</button></header><article id="notes">${body}</article><script>
document.getElementById('copy').onclick=async function(){const a=document.getElementById('notes');try{await navigator.clipboard.write([new ClipboardItem({'text/html':new Blob([a.innerHTML],{type:'text/html'}),'text/plain':new Blob([a.innerText],{type:'text/plain'})})]);this.textContent='已复制';}catch{const s=getSelection(),r=document.createRange();r.selectNodeContents(a);s.removeAllRanges();s.addRange(r);this.textContent='已选中，请按 Ctrl+C / ⌘C';}};
</script></body></html>`;
  const zip = new JSZip();
  zip.file(`${basename}.md`, markdown); zip.file(`${basename}.html`, html);
  for (const asset of assets.values()) zip.file(asset.archivePath, asset.bytes);
  const zipBytes = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
  // Validate before writing; refuse replacing an existing delivery.
  const writes = [[`${basename}.md`, Buffer.from(markdown)], [`${basename}.html`, Buffer.from(html)], [`${basename}.zip`, zipBytes], ...[...assets.values()].map(a => [a.archivePath, a.bytes])];
  const plan = new Map();
  for (const [name, bytes] of writes) {
    const destination = path.join(output, name);
    if (!inside(output, destination)) throw new Error('输出路径越界');
    if (plan.has(destination)) continue;
    const current = await fs.lstat(destination).catch(e => { if (e.code !== 'ENOENT') throw e; return null; });
    if (current) {
      if (current.isSymbolicLink()) throw new Error(`拒绝写入符号链接：${destination}`);
      if (destination === source && current.isFile()) continue;
      throw new Error(`输出已存在，请使用新的目录：${destination}`);
    }
    plan.set(destination, bytes);
  }
  await fs.mkdir(output, { recursive: true });
  for (const [destination, bytes] of plan) {
    await fs.mkdir(path.dirname(destination), { recursive: true });
    const parent = await fs.realpath(path.dirname(destination));
    const outputReal = await fs.realpath(output);
    if (!inside(outputReal, parent)) throw new Error('输出父目录符号链接越界');
    await fs.writeFile(destination, bytes, { flag: 'wx' });
  }
  return { markdown: path.join(output, `${basename}.md`), html: path.join(output, `${basename}.html`), zip: path.join(output, `${basename}.zip`), images: assets.size };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2);
    const input = args.shift(); let output, modules;
    while (args.length) { const arg = args.shift(); if (arg === '--out-dir') output = args.shift(); else if (arg === '--module-dir') modules = args.shift(); else throw new Error(`未知参数：${arg}`); }
    if (!input || !output) throw new Error('用法：node package_notes.mjs notes.md --out-dir delivery [--module-dir node_modules]');
    console.log(JSON.stringify(await packageNotes(input, output, modules), null, 2));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
