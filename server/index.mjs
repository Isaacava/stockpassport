import http from 'node:http';

const handlers = {
  '/api/data': () => import('../api/data.ts'),
  '/api/mainnet/prices': () => import('../api/mainnet/prices.ts'),
  '/api/devnet/quote': () => import('../api/devnet/quote.ts'),
  '/api/devnet/faucet': () => import('../api/devnet/faucet.ts'),
  '/api/devnet/settle': () => import('../api/devnet/settle.ts'),
};

const allowedOrigin = process.env.FRONTEND_ORIGIN || '';

function applyCors(res, origin) {
  const allowed = allowedOrigin && origin === allowedOrigin ? allowedOrigin : allowedOrigin ? allowedOrigin : '*';
  res.setHeader('Access-Control-Allow-Origin', allowed);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString('utf8');
}

const server = http.createServer(async (req, res) => {
  const origin = req.headers.origin || '';
  applyCors(res, origin);

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  try {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    if (url.pathname === '/health') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ ok: true, service: 'stockpassport-market', network: 'devnet', priceSource: 'mainnet-jupiter-price-v3' }));
      return;
    }
    const load = handlers[url.pathname];
    if (!load) { res.writeHead(404, { 'content-type': 'application/json' }); res.end(JSON.stringify({ error: 'Not found' })); return; }

    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers)) if (typeof value === 'string') headers.set(key, value);
    const body = req.method === 'GET' || req.method === 'HEAD' ? undefined : await readBody(req);
    const request = new Request(url, { method: req.method, headers, body: body || undefined });
    const module = await load();
    const response = await module.default(request);
    const responseBody = Buffer.from(await response.arrayBuffer());
    res.writeHead(response.status, Object.fromEntries(response.headers.entries()));
    res.end(responseBody);
  } catch (error) {
    res.writeHead(500, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: error instanceof Error ? error.message : 'Server error' }));
  }
});

server.listen(Number(process.env.PORT || 10000), '0.0.0.0', () => {
  console.log(`StockPassport server listening on ${process.env.PORT || 10000}`);
});
