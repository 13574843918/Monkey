// Agnes 视频生成（keyframe 图生视频）+ 轮询 + 下载
// 用法: node tools/gen-video.js <sceneIdx> "<prompt>" [lastFrameSceneIdx]
//   sceneIdx: 使用 assets/scenes/scene-<idx>.png 作为首帧
//   lastFrameSceneIdx: 可选，作为尾帧（同一目录 scene-<n>.png）
const fs = require('fs');
const https = require('https');
const path = require('path');

const cfg = JSON.parse(fs.readFileSync('./.secret/api.json', 'utf8'));
const KEY = cfg.api_key;
const HOST = 'api.agnes-ai.cn';
const MODEL = 'agnes-video-2.5';

function req(method, pathname, body) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const r = https.request({
      hostname: HOST, path: pathname, method,
      headers: Object.assign({ 'Authorization': 'Bearer ' + KEY },
        payload ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } : {})
    }, (res) => {
      let s = ''; res.on('data', d => s += d);
      res.on('end', () => { try { resolve({ status: res.statusCode, json: JSON.parse(s) }); } catch (e) { resolve({ status: res.statusCode, raw: s }); } });
    });
    r.on('error', reject);
    if (payload) r.write(payload);
    r.end();
  });
}

function localToDataUri(p) {
  const b64 = fs.readFileSync(p).toString('base64');
  const ext = path.extname(p).slice(1).toLowerCase();
  const mime = ext === 'jpg' ? 'image/jpeg' : 'image/png';
  return 'data:image/' + (ext === 'jpg' ? 'jpeg' : 'png') + ';base64,' + b64;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function createTask(firstFrame, lastFrame, prompt, seconds) {
  const body = {
    model: MODEL, prompt, mode: 'keyframe',
    seconds: String(seconds || 5), size: '720P', aspect_ratio: '16:9',
    first_frame: firstFrame
  };
  if (lastFrame) body.last_frame = lastFrame;
  return req('POST', '/v1/videos', body);
}

async function poll(videoId, maxMs = 600000) {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    const r = await req('GET', '/agnesapi?video_id=' + encodeURIComponent(videoId) + '&model_name=' + MODEL);
    const j = r.json || {};
    const st = j.status;
    console.log('  poll:', st, 'progress=' + (j.progress ?? '?'));
    if (st === 'completed') return j;
    if (st === 'failed') return j;
    await sleep(4000);
  }
  throw new Error('polling timeout');
}

(async () => {
  const sceneIdx = process.argv[2];
  const prompt = process.argv[3] || '镜头缓慢推移，人物衣袂与毛发随风轻动，妖气缭绕翻涌，电影质感';
  const lastIdx = process.argv[4];
  if (!sceneIdx) { console.log('用法: node tools/gen-video.js <sceneIdx> "<prompt>" [lastFrameIdx]'); process.exit(1); }

  const firstPath = `assets/scenes/scene-${sceneIdx}.png`;
  if (!fs.existsSync(firstPath)) { console.log('缺少首帧:', firstPath); process.exit(1); }
  const firstFrame = localToDataUri(firstPath);
  let lastFrame = null;
  if (lastIdx) {
    const lp = `assets/scenes/scene-${lastIdx}.png`;
    if (fs.existsSync(lp)) lastFrame = localToDataUri(lp);
  }

  console.log('创建视频任务: scene-' + sceneIdx + (lastIdx ? ' + scene-' + lastIdx : '') + ' ...');
  const c = await createTask(firstFrame, lastFrame, prompt, 5);
  console.log('  创建响应:', JSON.stringify(c.json || c.raw).slice(0, 500));
  if (c.status !== 200 || !c.json || (!c.json.video_id && !c.json.id)) {
    console.log('  创建失败，停止。'); process.exit(1);
  }
  const videoId = c.json.video_id || c.json.id;
  console.log('  video_id =', videoId, '，开始轮询...');
  const res = await poll(videoId);
  if (res.status === 'completed' && res.url) {
    const out = `assets/scenes/video-${sceneIdx}.mp4`;
    const f = fs.createWriteStream(out);
    await new Promise((resolve, reject) => {
      const dl = https.get(res.url, (r) => { r.pipe(f); r.on('end', resolve); });
      dl.on('error', reject);
    });
    console.log('  视频已保存:', out, '(' + fs.statSync(out).size + ' bytes)');
  } else {
    console.log('  视频生成失败:', JSON.stringify(res).slice(0, 500));
  }
})();
