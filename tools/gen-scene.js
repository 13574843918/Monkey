/**
 * gen-scene.js — 用 Agnes AI 接口为《西游记》42 站生成国潮场景插画
 * 用法: node tools/gen-scene.js [起始索引1based] [结束索引1based]   (默认全部 1..42)
 * 特性: 断点续跑(已存在则跳过) / 单图失败重试一次 / 串行限流
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const https = require('https');

const ROOT = path.join(__dirname, '..');
const SECRET = JSON.parse(fs.readFileSync(path.join(ROOT, '.secret/api.json'), 'utf8'));
const BASE = SECRET.base_url.replace(/\/$/, '');
const KEY = SECRET.api_key;
const MODEL = 'sensenova-u1.5-lite';
const SIZE = '1536x1024';
const OUT_DIR = path.join(ROOT, 'assets/scenes');
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

// ---- 载入站点数据 ----
const src = fs.readFileSync(path.join(ROOT, 'js/data.js'), 'utf8');
const ctx = { window: {}, console };
ctx.global = ctx;
vm.createContext(ctx);
vm.runInContext(src, ctx);
const W = ctx.window.XIYOU_DATA.WAYPOINTS;

// ---- 统一画风前缀 ----
const STYLE = '新中式国潮插画，唐代壁画工笔重彩风格，金色勾线，描金设色，华丽细腻，电影感横构图，高细节，人物与场景自然融合，大气磅礴，';

// 队伍常驻角色描写
const TEAM = '唐僧身披朱红描金袈裟手持九环锡杖、孙悟空锁子黄金甲虎皮裙手持金箍棒火眼金睛、猪八戒黑袍九齿钉耙、沙僧降妖宝杖';

// 区域色调
function paletteOf(i) {
  const r = ctx.window.XIYOU_DATA.regionAt(W[i].x);
  if (r === 'datang' || r === 'tang') return '以朱红石青为主，大唐气象';
  if (r === 'xiyu') return '以赭石大漠金辉为主，西域苍茫';
  if (r === 'tianzhu') return '以暖金宝蓝为主，天竺佛国';
  return '以朱红石青描金为主';
}

// 抽取妖怪主名
function demonName(w) {
  const d = (w.demons || [])[0] || '';
  return d.replace(/（.*?）/g, '').replace(/\(.*?\)/g, '').trim();
}
function helperName(w) {
  const h = (w.helpers || [])[0];
  if (!h) return '';
  const n = (typeof h === 'string') ? h : (h.w || h.name || '');
  return n.replace(/（.*?）/g, '').replace(/\(.*?\)/g, '').trim();
}

// 8 个重点站的精修提示词（其余用模板）
const CUSTOM = {
  1: STYLE + '大唐长安城，晨光中繁华市井与宫殿楼阁，唐王于朱红宫门外为唐僧赠通关文牒送行，唐僧拜别，城门旌旗，祥云缭绕，' + paletteOf(0) + '。',
  3: STYLE + '两界山五行山下，孙悟空自山石崩裂中破封腾跃而出，金光迸发，唐僧骑马惊愕回望，山林震撼，' + paletteOf(2) + '。',
  6: STYLE + '高老庄宅院，猪八戒现出长嘴大耳黑袍巨汉原形欲强娶，孙悟空隐身戏弄，高老员外惊惧，灯火宅院，' + paletteOf(5) + '。',
  11: STYLE + '夜色白虎岭，冷月当空，远山云雾，孙悟空腾跃扑击金箍棒寒光，白骨精现白骨骷髅原形缠绿妖气，唐僧朱红描金袈裟惊立，' + paletteOf(10) + '。',
  20: STYLE + '西梁女国宫殿，女儿国女王雍容华贵含情相望唐僧，唐僧合十回避面露为难，宫娥簇拥，牡丹锦绣，' + paletteOf(19) + '。',
  22: STYLE + '真假美猴王，两个孙悟空金甲相对各持金箍棒激斗，毫光四射难分彼此，唐僧与众神惊视，天地变色，' + paletteOf(21) + '。',
  23: STYLE + '火焰山烈焰冲天，铁扇公主罗刹女持芭蕉扇凌空，牛魔王现巨牛原形，孙悟空借扇灭火腾跃，火云翻涌，' + paletteOf(22) + '。',
  42: STYLE + '灵山大雷音寺，金光万道宝相庄严，如来佛祖端坐莲台，唐僧师徒四人受封成佛金身，祥云梵音，' + paletteOf(41) + '。'
};

function buildPrompt(i) {
  const w = W[i];
  if (CUSTOM[i + 1]) return CUSTOM[i + 1];
  const d = demonName(w);
  const h = helperName(w);
  const loc = w.name;
  let p = STYLE + loc + '，' + TEAM;
  if (d) p += '，妖魔' + d + '作祟';
  if (h) p += '，' + h + '显圣相助';
  p += '，' + paletteOf(i) + '。';
  return p;
}

// ---- HTTP 请求 ----
function postJSON(urlPath, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const u = new URL(BASE + urlPath);
    const req = https.request({
      method: 'POST', hostname: u.hostname, path: u.pathname,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + KEY,
        'Content-Length': Buffer.byteLength(data)
      }
    }, (res) => {
      let s = '';
      res.on('data', d => s += d);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, json: JSON.parse(s) }); }
        catch (e) { reject(new Error('bad json: ' + s.slice(0, 200))); }
      });
    });
    req.on('error', reject);
    req.setTimeout(150000, () => req.destroy(new Error('timeout')));
    req.write(data);
    req.end();
  });
}
function download(url, dest) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = https.get({ hostname: u.hostname, path: u.pathname + u.search, headers: {} }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return download(res.headers.location, dest).then(resolve, reject);
      }
      if (res.statusCode !== 200) { reject(new Error('dl ' + res.statusCode)); return; }
      const f = fs.createWriteStream(dest);
      res.pipe(f); f.on('finish', () => f.close(() => resolve(dest)));
    });
    req.on('error', reject);
    req.setTimeout(120000, () => req.destroy(new Error('dl timeout')));
  });
}

async function genOne(i) {
  const nn = String(i + 1).padStart(2, '0');
  const out = path.join(OUT_DIR, 'scene-' + nn + '.png');
  if (fs.existsSync(out)) { console.log('#' + nn + ' 已存在，跳过'); return 'skip'; }
  const prompt = buildPrompt(i);
  let lastErr = null;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const { status, json } = await postJSON('/images/generations', { model: MODEL, prompt, size: SIZE, n: 1, output_format: 'png', response_format: 'url', watermark: false, prompt_extend: false });
      if (status !== 200 || !json.data || !json.data[0] || !json.data[0].url) {
        throw new Error('resp ' + status + ' ' + JSON.stringify(json).slice(0, 200));
      }
      await download(json.data[0].url, out);
      console.log('#' + nn + ' ' + W[i].name + ' ✓ (' + json.data[0].url.slice(0, 40) + '...)');
      return 'ok';
    } catch (e) { lastErr = e; console.log('#' + nn + ' 尝试' + attempt + '失败: ' + e.message); }
  }
  console.log('#' + nn + ' ✗ ' + (lastErr && lastErr.message));
  return 'fail';
}

(async () => {
  let idxs;
  if (process.argv[2] === '--custom') {
    idxs = Object.keys(CUSTOM).map(Number).sort((x, y) => x - y).map(n => n - 1);
  } else if (process.argv[2] && process.argv[2].indexOf(',') >= 0) {
    idxs = process.argv[2].split(',').map(s => parseInt(s, 10) - 1);
  } else {
    const a = parseInt(process.argv[2] || '1', 10);
    const b = parseInt(process.argv[3] || '42', 10);
    idxs = [];
    for (let i = a - 1; i < b; i++) idxs.push(i);
  }
  let ok = 0, skip = 0, fail = 0;
  for (const i of idxs) {
    const r = await genOne(i);
    if (r === 'ok') ok++; else if (r === 'skip') skip++; else fail++;
    await new Promise(r => setTimeout(r, 800));
  }
  console.log('\n完成: ok=' + ok + ' skip=' + skip + ' fail=' + fail);
})();
