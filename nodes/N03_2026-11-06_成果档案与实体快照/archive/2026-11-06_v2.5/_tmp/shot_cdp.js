/* CDP 真机尺寸截图：node shot_cdp.js <url> <width> <height> <out.png> */
const { spawn } = require('child_process');
const fs = require('fs');
const http = require('http');

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const [url, w, h, out] = process.argv.slice(2);
const W = +w, H = +h;

const port = 9333 + Math.floor(Math.random() * 200);
const udd = 'E:\\workbuddy 缓存\\质量管理工作台搭建\\_tmp\\cdp' + port;
const proc = spawn(EDGE, [
  '--headless=new', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
  '--remote-debugging-port=' + port, '--user-data-dir=' + udd, 'about:blank'
], { stdio: 'ignore' });

function get(path) {
  return new Promise((res, rej) => {
    http.get({ host: '127.0.0.1', port, path }, r => {
      let b = '';
      r.on('data', d => b += d);
      r.on('end', () => res(JSON.parse(b)));
    }).on('error', rej);
  });
}

async function waitWs() {
  for (let i = 0; i < 60; i++) {
    try { const v = await get('/json/version'); if (v.webSocketDebuggerUrl) return v.webSocketDebuggerUrl; }
    catch (e) { }
    await new Promise(r => setTimeout(r, 250));
  }
  throw new Error('devtools not ready');
}

(async () => {
  const wsUrl = await waitWs();
  const ws = new WebSocket(wsUrl);
  let id = 0;
  const pending = new Map();
  const send = (method, params, sessionId) => new Promise((res, rej) => {
    const mid = ++id;
    pending.set(mid, { res, rej });
    ws.send(JSON.stringify({ id: mid, method, params: params || {}, sessionId }));
  });
  const targets = [];
  ws.onmessage = ev => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) {
      const p = pending.get(m.id); pending.delete(m.id);
      m.error ? p.rej(new Error(JSON.stringify(m.error))) : p.res(m.result);
    } else if (m.method === 'Target.attachedToTarget') {
      targets.push(m.params.sessionId);
    }
  };
  await new Promise(r => ws.onopen = r);

  const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });

  await send('Emulation.setDeviceMetricsOverride', {
    width: W, height: H, deviceScaleFactor: 1, mobile: W < 600
  }, sessionId);
  await send('Page.enable', {}, sessionId);
  await send('Page.navigate', { url }, sessionId);
  await new Promise(r => setTimeout(r, 2600));

  const { data } = await send('Page.captureScreenshot', { format: 'png' }, sessionId);
  fs.writeFileSync(out, Buffer.from(data, 'base64'));

  const m = await send('Runtime.evaluate', {
    expression: 'JSON.stringify({iw:innerWidth,sw:document.documentElement.scrollWidth, mw:(document.querySelector(".modal")||{getBoundingClientRect:()=>({width:0,right:0})}).getBoundingClientRect().width})',
    returnByValue: true
  }, sessionId);
  console.log('metrics', m.result.value);
  ws.close();
  proc.kill();
  process.exit(0);
})().catch(e => { console.error('ERR', e.message); proc.kill(); process.exit(1); });
