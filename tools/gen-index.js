// 生成 comic-index.html（总览页），列出全部 42 站漫画导读入口
// 用法: node tools/gen-index.js
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const ST = require('./stations.js');

const items = [];
// 重点精读站（含白虎岭特篇）
const KEY = new Set(['03', '06', '08', '10', '11', '15', '17', '20', '22', '23', '31', '42']);
const STAR = {
  '03': '★★★★☆', '06': '★★★★☆', '08': '★★★★☆', '10': '★★★★☆', '11': '★★★★★',
  '15': '★★★★★', '17': '★★★★☆', '20': '★★★★★', '22': '★★★★★', '23': '★★★★★',
  '31': '★★★★★', '42': '★★★★★'
};

// 第 11 站白虎岭（三打白骨精）单独成页
items.push({
  id: '11', file: 'comic-baihuling.html', hero: 'assets/scenes/baihuling-1.png',
  name: '白虎岭 · 三打白骨精', chapter: '第 11 站 · 第二十七至三十一回', tag: '经典',
  key: 1, star: STAR['11']
});

ST.forEach(c => {
  const sub = c.sub || '';
  const m = sub.match(/第\s*\d+\s*站\s*·\s*([^<]+)/);
  const chap = (m ? m[1] : '').trim();
  const seg = (sub.split('<br>')[1] || '').replace(/<span[\s\S]*$/, '').trim();
  const tag = seg.length > 9 ? seg.slice(0, 9) + '…' : seg;
  items.push({
    id: c.id,
    file: 'comic-' + c.id + '.html',
    hero: 'assets/scenes/comic-' + c.id + '-1.png',
    name: c.title,
    chapter: '第 ' + c.id + ' 站 · ' + chap,
    tag: tag || '导读',
    key: KEY.has(c.id) ? 1 : 0,
    star: STAR[c.id] || ''
  });
});
items.sort((a, b) => (+a.id) - (+b.id));

const itemsStr = 'const ITEMS = [\n' + items.map(it =>
  "  { id:'" + it.id + "', file:'" + it.file + "', hero:'" + it.hero +
  "', name:'" + it.name + "', chapter:'" + it.chapter + "', tag:'" + it.tag +
  "', key:" + (it.key || 0) + ", star:'" + (it.star || '') + "' }"
).join(',\n') + '\n];';

let html = fs.readFileSync(path.join(ROOT, 'comic-index.html'), 'utf8');
html = html.replace(/const ITEMS = \[[\s\S]*?\];/, itemsStr);
html = html.replace(
  '站点选取自《西游记》42 站中的经典名段；后续可继续补齐其余各站。',
  '已覆盖《西游记》42 站全部经典名段，点击任意一站即可进入漫画分镜与逐格研读。'
);
fs.writeFileSync(path.join(ROOT, 'comic-index.html'), html);
console.log('comic-index.html 生成，共 ' + items.length + ' 站入口');
