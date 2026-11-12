// 数据增强脚本：为全部站点补 回目徽章/前后站导航/语料卡骨架/读后闭环骨架
// 输出:
//   tools/stations_v2.js            —— 结构升级后的站点数据
//   tools/content_tasks.json        —— 给内容创作子代理的任务（每站素材 + 需补字段）
// 用法: node tools/enhance-stations.js
const fs = require('fs');
const path = require('path');
const S = require('./stations.js');

// 重点站（含白虎岭特篇，已手工完成）——只列 stations.js 内的重点站
const KEY_ID = new Set(['03', '06', '08', '10', '15', '17', '20', '22', '23', '31', '42']);

// 重点站完整回目对联（供回目徽章显示）
const KEY_HUIMU = {
  '03': { hui: '第十四回　心猿归正　六贼无踪', known: '★★★★☆（初中常读）', exam: '★★★★☆' },
  '06': { hui: '第十八回　观音院唐僧脱难　高老庄行者降魔', known: '★★★★☆（经典收徒）', exam: '★★★★☆' },
  '08': { hui: '第二十二回　八戒大战流沙河　木叉奉法收悟净', known: '★★★★☆（收沙僧）', exam: '★★★★☆' },
  '10': { hui: '第二十四回　万寿山大仙留故友　五庄观行者窃人参', known: '★★★★☆（镇元大仙）', exam: '★★★★☆' },
  '15': { hui: '第四十回　婴儿戏化禅心乱　猿马刀归木母空', known: '★★★★★（红孩儿）', exam: '★★★★★' },
  '17': { hui: '第四十四回　法身元运逢车力　心正妖邪度脊关', known: '★★★★☆（斗法）', exam: '★★★★☆' },
  '20': { hui: '第五十四回　法性西来逢女国　心猿定计脱烟花', known: '★★★★★（女儿国）', exam: '★★★★☆' },
  '22': { hui: '第五十七回　真行者落伽山诉苦　假猴王水帘洞誊文', known: '★★★★★（真假美猴王）', exam: '★★★★★' },
  '23': { hui: '第五十九回　唐三藏路阻火焰山　孙行者一调芭蕉扇', known: '★★★★★（三借芭蕉扇）', exam: '★★★★★' },
  '31': { hui: '第七十四回　长庚传报魔头狠　行者施为变化能', known: '★★★★★（狮驼岭）', exam: '★★★★★' },
  '42': { hui: '第九十八回　猿熟马驯方脱壳　功成行满见真如', known: '★★★★★（灵山成真）', exam: '★★★★★' },
};

// 修辞手法关键词扫描（从 appreciate 里识别）
const RHET_KEYS = [
  ['对比', '对比'], ['反衬', '反衬'], ['衬托', '衬托'], ['排比', '排比'], ['对偶', '对偶'],
  ['比喻', '比喻'], ['拟人', '拟人'], ['夸张', '夸张'], ['白描', '白描'], ['细节', '细节描写'],
  ['环境', '环境描写'], ['伏笔', '伏笔'], ['悬念', '悬念'], ['铺垫', '铺垫'], ['渲染', '渲染'],
  ['衬托', '衬托'], ['个性化', '语言个性化'], ['心理', '心理描写'], ['动作', '动作描写'],
  ['三叠', '三叠式'], ['反复', '反复'], ['蒙太奇', '蒙太奇'], ['欲扬先抑', '欲扬先抑'],
  ['欲抑先扬', '欲抑先扬'], ['张力', '戏剧张力'], ['节奏', '节奏'], ['侧面', '侧面烘托'],
];

function stripTag(s) { return String(s || '').replace(/<[^>]+>/g, ''); }

// 从 sub 提取回目（普通站）
function huimuFromSub(sub) {
  const m = String(sub || '').match(/原著第[^<]+回/);
  return m ? m[0] : null;
}

// 半自动语料卡骨架：好词=短词(需释义) 佳句=长句/caption(需出处点评) 修辞=手法扫描(需效果)
function vocabSkeleton(p, hui) {
  const st = p.study || {};
  const phrases = st.phrases || [];
  const caption = p.caption || '';
  const bubbleTexts = (p.bubbles || []).map(b => b.text).filter(Boolean);
  const words = [];
  const ju = [];
  // 短词（<=8字，无标点）→ 好词；长句 → 佳句
  (phrases || []).forEach(ph => {
    const t = String(ph).trim();
    if (!t) return;
    if (t.length <= 8 && !/[，。；：！？、]/.test(t)) {
      words.push({ t: t, m: '' });
    } else {
      ju.push({ t: t, from: hui || '', m: '' });
    }
  });
  // caption 作佳句补充（若未满 2 条）
  if (caption && ju.length < 2) {
    ju.push({ t: caption, from: hui || '', m: '' });
  }
  // bubble 对白补充
  if (ju.length < 2 && bubbleTexts.length) {
    ju.push({ t: bubbleTexts[0], from: hui || '', m: '' });
  }
  // 修辞：扫描 appreciate
  const app = stripTag(st.appreciate || '');
  const rhet = [];
  RHET_KEYS.forEach(([k, name]) => {
    if (app.indexOf(k) >= 0 && !rhet.find(r => r.t === name)) rhet.push({ t: name, m: '' });
  });
  if (!rhet.length) rhet.push({ t: '语言生动', m: '' });
  return {
    words: words.slice(0, 4),
    ju: ju.slice(0, 2),
    rhet: rhet.slice(0, 3),
  };
}

// 从 lead 提取"带着问题读"的问题（①②③）
function questionsFromLead(lead) {
  const m = String(lead || '').match(/带着[^<]*读[：:]\s*(.*?)<\/p>/);
  if (!m) return [];
  const raw = stripTag(m[1]);
  const qs = [];
  // 匹配 ①..③ 或 数字.
  const re = /[①-⑨]|（?\d+[.、）]?/g;
  // 用 ① ② ③ 分割
  const parts = raw.split(/[①-⑨]/).map(s => s.trim()).filter(Boolean);
  parts.forEach(s => { if (s.length > 2) qs.push(s.replace(/^[.、）\s]+/, '').replace(/[。\s]+$/, '')); });
  return qs.slice(0, 3);
}

// ============ 主流程 ============
const tasks = { stations: {} };
const out = [];

S.forEach((s, si) => {
  const c = JSON.parse(JSON.stringify(s)); // 深拷贝
  const isKey = KEY_ID.has(c.id);
  const hui = isKey ? (KEY_HUIMU[c.id] ? KEY_HUIMU[c.id].hui : huimuFromSub(c.sub)) : huimuFromSub(c.sub);

  // 1) 回目徽章
  c.huimu = { hui: hui || '原著回目待考' };
  if (isKey && KEY_HUIMU[c.id]) {
    c.huimu.known = KEY_HUIMU[c.id].known;
    c.huimu.exam = KEY_HUIMU[c.id].exam;
  }

  // 2) 前后站导航（先占位，后按顺序回填）
  c.prev = null; c.next = null;

  // 3) 每格语料卡骨架
  (c.panels || []).forEach(p => {
    if (p.study && !p.study.vocab) {
      p.study.vocab = vocabSkeleton(p, hui);
    }
  });

  // 4) 读后闭环骨架（问题从 lead 提取）
  const qs = questionsFromLead(c.lead);
  c.closure = {
    title: '读完这一回，再看开篇的问题',
    items: (qs.length ? qs : ['这一回最打动你的是哪一幕？为什么？']).map(q => ({ q: q, a: '' })),
  };

  // 5) 重点站 feature 骨架（子代理填充）
  if (isKey) {
    c.feature = {
      yinyuan: [{ text: '', from: hui || '', note: '' }],
      shoufa: [], xiedu: [], tuozhan: [],
    };
  } else {
    c.feature = null;
  }

  out.push(c);

  // 6) 创作任务：素材
  tasks.stations[c.id] = {
    id: c.id, title: c.title, isKey: isKey,
    hui: hui,
    lead: c.lead,
    panels: (c.panels || []).map(p => ({
      caption: p.caption, bubbles: p.bubbles || [],
      appreciate: p.study && p.study.appreciate,
      vocab: (p.study && p.study.vocab) || null,
    })),
    closure: c.closure,
    feature: c.feature,
  };
});

// ============ 回填前后站导航（顺序 = 数组顺序，白虎岭插在 id=10 之后） ============
const order = out.map(c => ({ id: c.id, title: c.title, file: 'comic-' + c.id + '.html' }));
const idx10 = order.findIndex(o => o.id === '10');
order.splice(idx10 + 1, 0, { id: '11', title: '白虎岭 · 三打白骨精', file: 'comic-baihuling.html' });
order.forEach((o, i) => { o.no = '第 ' + (i + 1) + ' 站'; });
out.forEach((c, ci) => {
  const oi = order.findIndex(o => o.id === c.id);
  if (oi > 0) c.prev = { title: order[oi - 1].title, file: order[oi - 1].file, no: order[oi - 1].no };
  if (oi < order.length - 1) c.next = { title: order[oi + 1].title, file: order[oi + 1].file, no: order[oi + 1].no };
});

// 写 stations_v2.js
fs.writeFileSync(path.join(__dirname, 'stations_v2.js'),
  '// 结构升级后的站点数据（自动生成，勿手改）\nmodule.exports = ' + JSON.stringify(out, null, 2) + ';\n');

// 写 content_tasks.json
fs.writeFileSync(path.join(__dirname, 'content_tasks.json'),
  JSON.stringify(tasks, null, 2));

// 统计
let w = 0, j = 0, r = 0, key = 0;
out.forEach(c => (c.panels || []).forEach(p => {
  if (p.study && p.study.vocab) { w += p.study.vocab.words.length; j += p.study.vocab.ju.length; r += p.study.vocab.rhet.length; }
}));
key = out.filter(c => c.feature).length;
console.log('完成: 站点=' + out.length + ' 重点站=' + key);
console.log('语料骨架: 好词=' + w + ' 佳句=' + j + ' 修辞=' + r);
console.log('产出: tools/stations_v2.js, tools/content_tasks.json');
