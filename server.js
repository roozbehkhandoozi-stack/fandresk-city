const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');

const PORT = process.env.PORT || 3000;
const GAME = path.join(__dirname, 'fandersk-city-online.html');

const server = http.createServer((req, res) => {
  if (req.url === '/' || req.url.startsWith('/?')) {
    fs.readFile(GAME, (err, data) => {
      if (err) { res.writeHead(500); return res.end('Game file not found'); }
      res.writeHead(200, {'Content-Type':'text/html; charset=utf-8', 'Cache-Control':'no-store'});
      res.end(data);
    });
    return;
  }
  res.writeHead(404); res.end('Not found');
});

const wss = new WebSocketServer({ server, path: '/ws' });
const clients = new Map();
let seq = 1;

function snapshot() {
  return [...clients.entries()].map(([ws, p]) => ({ id:p.id, presence:p.presence || {} }));
}
function send(ws, obj) {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(obj));
}
function broadcast(obj, except=null) {
  for (const ws of clients.keys()) if (ws !== except) send(ws, obj);
}
function peers() { broadcast({type:'peers', peers:snapshot()}); }

wss.on('connection', (ws) => {
  const p = { id:'p'+(seq++).toString(36)+Date.now().toString(36).slice(-4), presence:{} };
  clients.set(ws, p);
  send(ws, {type:'hello', id:p.id, peers:snapshot()});
  peers();

  ws.on('message', raw => {
    let m; try { m = JSON.parse(String(raw)); } catch { return; }
    if (m.type === 'presence' && m.data && typeof m.data === 'object') {
      p.presence = m.data;
      peers();
    } else if (m.type === 'event' && typeof m.event === 'string') {
      broadcast({type:'event', event:m.event, data:m.data}, null);
    }
  });
  ws.on('close', () => { clients.delete(ws); peers(); });
});

server.listen(PORT, '0.0.0.0', () => console.log(`Fandersk City: http://localhost:${PORT}`));
