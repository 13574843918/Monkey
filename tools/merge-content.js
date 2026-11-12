// 合并子代理内容结果到 stations_v2 -> 写回 stations.js
// 用法: node tools/merge-content.js
const fs = require('fs');
const path = require('path');
const V = require('./stations_v2.js');
const groups = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
const merged = {};
const missing = [];
groups.forEach(g => {
  const f = path.join(__dirname, 'result_g_' + g + '.json');
  if (!fs.existsSync(f)) { missing.push('result_g_' + g + '.json'); return; }
  const r = JSON.parse(fs.readFileSync(f, 'utf8'));
  Object.assign(merged, r.stations || {});
});
if (missing.length) { console.error('缺失结果文件: ' + missing.join(', ')); process.exit(1); }

const noVocab = [], noClosure = [], noFeature = [];
V.forEach(c => {
  const r = merged[c.id];
  if (!r) { noVocab.push(c.id + '(无结果)'); return; }
  if (r.vocab) {
    (c.panels || []).forEach((p, i) => { if (p.study && r.vocab[i]) p.study.vocab = r.vocab[i]; });
  } else noVocab.push(c.id);
  if (r.closure && r.closure.items) c.closure = r.closure; else noClosure.push(c.id);
  if (c.feature && r.feature && r.feature.shoufa) c.feature = r.feature;
  if (c.feature && (!r.feature || !r.feature.shoufa)) noFeature.push(c.id);
});
if (noVocab.length) console.log('⚠ 无vocab: ' + noVocab.join(','));
if (noClosure.length) console.log('⚠ 无closure: ' + noClosure.join(','));
if (noFeature.length) console.log('⚠ 重点站feature不完整: ' + noFeature.join(','));

const orig = fs.readFileSync(path.join(__dirname, 'stations_orig.js'), 'utf8');
const styleLine = orig.split('\n').find(l => l.startsWith('const STYLE')) || '';
fs.writeFileSync(path.join(__dirname, 'stations.js'),
  (styleLine ? styleLine + '\n\n' : '') +
  '// 全量增强站点数据（merge-content.js 生成，勿手改）\nmodule.exports = ' + JSON.stringify(V, null, 2) + ';\n');
console.log('✓ 合并完成: ' + V.length + ' 站 -> tools/stations.js');
