const fs = require('fs');
const vm = require('vm');
const src = fs.readFileSync(__dirname + '/../js/data.js', 'utf8');
const ctx = { window: {}, console: console };
ctx.global = ctx; // browser-like: global === window
vm.createContext(ctx);
vm.runInContext(src, ctx);
const D = ctx.window.XIYOU_DATA;
if (!D) { console.log('XIYOU_DATA still undefined; winKeys=', Object.keys(ctx.window)); process.exit(1); }
const W = D.WAYPOINTS, S = D.SCENES, R = D.REGIONS;
console.log('WAYPOINTS:', W.length, 'SCENES:', S ? S.length : 0, 'REGIONS:', R.length);
for (let i = 0; i < W.length; i++) {
  const w = W[i], s = S && S[i];
  console.log((i + 1) + '. [' + (s ? s.set : '?') + '] ' + w.name +
    ' | 妖:' + (w.demons || []).join('/') +
    ' 神:' + (w.helpers || []).join('/') +
    ' 回:' + (w.chapters || '').toString());
}
