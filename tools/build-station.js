// 通用漫画导读生成器（批量版）
// 用法: node tools/build-station.js            -> 处理 stations.js 全部
//       node tools/build-station.js 01         -> 只处理 id=01
//       node tools/build-station.js 01,03,06   -> 只处理指定
const fs = require('fs');
const path = require('path');
const https = require('https');
const ROOT = path.join(__dirname, '..');
const SECRET = JSON.parse(fs.readFileSync(path.join(ROOT, '.secret/api.json'), 'utf8'));
const BASE = SECRET.base_url.replace(/\/$/, '');
const KEY = SECRET.api_key;
const MODEL = 'sensenova-u1.5-lite';
const SIZE = '1536x1024';
const OUT_DIR = path.join(ROOT, 'assets/scenes');
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

const STATIONS = require('./stations.js');

function postJSON(urlPath, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const u = new URL(BASE + urlPath);
    const req = https.request({
      method: 'POST', hostname: u.hostname, path: u.pathname,
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + KEY, 'Content-Length': Buffer.byteLength(data) }
    }, (res) => {
      let s = ''; res.on('data', d => s += d);
      res.on('end', () => { try { resolve({ status: res.statusCode, json: JSON.parse(s) }); } catch (e) { reject(new Error('bad json ' + s.slice(0,200))); } });
    });
    req.on('error', reject); req.setTimeout(290000, () => req.destroy(new Error('timeout')));
    req.write(data); req.end();
  });
}
function download(url, dest) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = https.get({ hostname: u.hostname, path: u.pathname + u.search }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) return download(res.headers.location, dest).then(resolve, reject);
      if (res.statusCode !== 200) { reject(new Error('dl ' + res.statusCode)); return; }
      const f = fs.createWriteStream(dest);
      res.pipe(f); f.on('finish', () => f.close(() => resolve(dest)));
    });
    req.on('error', reject); req.setTimeout(120000, () => req.destroy(new Error('dl timeout')));
  });
}
// 全局限速：两次 API 调用之间至少间隔 MIN_GAP，避免触发 429 限流
let LAST_REQ = 0;
const MIN_GAP = 1500;
async function rateGate() {
  const el = Date.now() - LAST_REQ;
  if (el < MIN_GAP) await new Promise(r => setTimeout(r, MIN_GAP - el));
  LAST_REQ = Date.now();
}
function validPNG(f) {
  try { const b = fs.readFileSync(f); return b.length > 5000 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47; }
  catch (e) { return false; }
}
async function genImage(file, prompt) {
  if (fs.existsSync(file) && validPNG(file)) { console.log('  图已存在，跳过: ' + path.basename(file)); return 'skip'; }
  if (fs.existsSync(file)) { console.log('  发现残缺文件，删除重生成: ' + path.basename(file)); try { fs.unlinkSync(file); } catch (_) {} }
  let backoff = 6000;
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      await rateGate();
      const { status, json } = await postJSON('/images/generations', { model: MODEL, prompt, size: SIZE, n: 1, output_format: 'png', response_format: 'url', watermark: false, prompt_extend: false });
      if (status === 429) throw new Error('429 限流');
      if (status !== 200 || !json.data || !json.data[0] || !json.data[0].url) throw new Error('resp ' + status);
      await download(json.data[0].url, file);
      if (!validPNG(file)) throw new Error('下载文件非有效PNG');
      console.log('  生成: ' + path.basename(file) + ' (' + (fs.statSync(file).size / 1024 | 0) + 'KB)');
      return 'ok';
    } catch (e) {
      console.log('  尝试' +attempt+'失败: ' + e.message);
      if (fs.existsSync(file)) { try { fs.unlinkSync(file); } catch (_) {} }
      if (attempt < 5) { await new Promise(r => setTimeout(r, backoff)); backoff = Math.min(backoff * 2, 30000); }
    }
  }
  return 'fail';
}

function buildHTML(cfg) {
  let tpl = fs.readFileSync(path.join(__dirname, '_comic_template.html'), 'utf8');
  const chars = (cfg.characters || []).map(c => '<div class="card"><h3>' + c.name + '</h3><p>' + c.text + '</p></div>').join('');
  const themes = (cfg.themes || []).map(t => '<h3>' + t.h + '</h3><p>' + t.p + '</p>').join('');
  const tips = (cfg.tips || []).map(t => '<li><b>' + t.h + '：</b>' + t.p + '</li>').join('');
  tpl = tpl
    .replace(/__TITLE__/g, cfg.title || '')
    .replace(/__SUB__/g, cfg.sub || '')
    .replace(/__SEAL__/g, cfg.seal || '西游导读')
    .replace(/__LEAD__/g, cfg.lead || '')
    .replace(/__CHARS__/g, chars)
    .replace(/__THEMES__/g, themes)
    .replace(/__TIPS__/g, tips)
    .replace('__DATA__', JSON.stringify({ panels: cfg.panels }));
  const out = path.join(ROOT, 'comic-' + cfg.id + '.html');
  fs.writeFileSync(out, tpl);
  console.log('  产出: ' + out);
}

(async () => {
  let want = process.argv[2];
  let list = STATIONS;
  if (want) {
    const ids = want.split(',').map(s => s.trim());
    list = STATIONS.filter(s => ids.indexOf(s.id) >= 0);
  }
  let ok = 0, skip = 0, fail = 0; const failed = [];
  for (const cfg of list) {
    console.log('\n=== 站点 ' + cfg.id + ' · ' + cfg.title + ' ===');
    for (const b of (cfg.beats || [])) {
      const f = path.isAbsolute(b.file) ? b.file : path.join(ROOT, b.file);
      const r = await genImage(f, b.prompt);
      if (r === 'ok') ok++; else if (r === 'skip') skip++; else { fail++; failed.push(path.basename(f)); }
    }
    buildHTML(cfg);
  }
  console.log('\n完成: 新生成=' + ok + ' 跳过=' + skip + ' 失败=' + fail);
  if (failed.length) console.log('失败列表(可重跑本脚本自动补完):\n' + failed.join('\n'));
})();
