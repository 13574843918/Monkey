// 批量按分镜 beats 生成独立场景图
// 用法: node tools/gen-beats.js <beats.json>
const fs = require('fs');
const https = require('https');
const cfg = JSON.parse(fs.readFileSync('./.secret/api.json', 'utf8'));
const KEY = cfg.api_key;
const HOST = 'token.sensenova.cn';
const MODEL = 'sensenova-u1.5-lite';

function post(pathname, body) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const r = https.request({
      hostname: HOST, path: pathname, method: 'POST',
      headers: { 'Authorization': 'Bearer ' + KEY, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }
    }, (res) => {
      let s = ''; res.on('data', d => s += d);
      res.on('end', () => { try { resolve({ status: res.statusCode, json: JSON.parse(s) }); } catch (e) { resolve({ status: res.statusCode, raw: s }); } });
    });
    r.on('error', reject); r.write(payload); r.end();
  });
}
function get(url) {
  return new Promise((resolve, reject) => {
    const r = https.get(url, (res) => {
      const f = fs.createWriteStream('_tmp_dl'); // temp, renamed after
      res.pipe(f); f.on('finish', () => resolve('_tmp_dl'));
    });
    r.on('error', reject);
  });
}
function sleep(ms){return new Promise(r=>setTimeout(r,ms));}

(async () => {
  const beats = JSON.parse(fs.readFileSync(process.argv[2] || 'tools/beats-baihuling.json', 'utf8'));
  let ok = 0, fail = 0;
  for (let i = 0; i < beats.length; i++) {
    const b = beats[i];
    console.log(`\n[${i+1}/${beats.length}] 生成 ${b.file}`);
    const c = await post('/v1/images/generations', { model: MODEL, prompt: b.prompt, size: '1536x1024', n: 1, output_format: 'png', response_format: 'url', watermark: false, prompt_extend: false });
    const data = (c.json && c.json.data) ? c.json.data : null;
    if (c.status === 200 && data && data[0] && data[0].url) {
      const url = data[0].url;
      console.log('  图片URL就绪，下载中...');
      await get(url);
      fs.renameSync('_tmp_dl', b.file);
      console.log('  已存:', b.file, '(' + fs.statSync(b.file).size + ' bytes)');
      ok++;
    } else {
      console.log('  失败:', JSON.stringify(c.json || c.raw).slice(0, 300));
      fail++;
    }
    await sleep(700);
  }
  console.log(`\n完成: ok=${ok} fail=${fail}`);
})();
