// 质控脚本：检查最终站点数据的语料/闭环/精读板块完整性
// 用法: node tools/check-content.js
const fs = require('fs');
const path = require('path');
const S = require('./stations.js');
let emptyWords = 0, emptyJu = 0, emptyRhet = 0, emptyAns = 0;
let totalWords = 0, totalJu = 0, totalRhet = 0, totalAns = 0;
const problems = [];
S.forEach(c => {
  const isKey = !!c.feature;
  (c.panels || []).forEach((p, gi) => {
    const v = p.study && p.study.vocab;
    if (!v) { problems.push('站' + c.id + ' 格' + (gi + 1) + ' 无vocab'); return; }
    (v.words || []).forEach(w => { totalWords++; if (!w.m || !w.m.trim()) emptyWords++; });
    (v.ju || []).forEach(j => { totalJu++; if (!j.m || !j.m.trim()) emptyJu++; if (!j.from) emptyJu++; });
    (v.rhet || []).forEach(r => { totalRhet++; if (!r.m || !r.m.trim()) emptyRhet++; });
  });
  (c.closure && c.closure.items || []).forEach(it => { totalAns++; if (!it.a || !it.a.trim()) emptyAns++; });
  if (isKey) {
    const f = c.feature;
    if (!f.yinyuan || f.yinyuan.length < 2) problems.push('站' + c.id + ' yinyuan<2');
    if (!f.shoufa || f.shoufa.length < 3) problems.push('站' + c.id + ' shoufa<3');
    if (!f.xiedu || f.xiedu.length < 3) problems.push('站' + c.id + ' xiedu<3');
    if (!f.tuozhan || f.tuozhan.length < 3) problems.push('站' + c.id + ' tuozhan<3');
  }
});
console.log('好词: ' + totalWords + ' (空释义 ' + emptyWords + ')');
console.log('佳句: ' + totalJu + ' (空点评 ' + emptyJu + ')');
console.log('修辞: ' + totalRhet + ' (空效果 ' + emptyRhet + ')');
console.log('读后答案: ' + totalAns + ' (空 ' + emptyAns + ')');
if (problems.length) console.log('⚠ 问题:\n' + problems.slice(0, 40).join('\n'));
else console.log('✓ 无结构性问题');
