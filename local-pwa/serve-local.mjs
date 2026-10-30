import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('.', import.meta.url)));
const port = 8765;
const configuredApiBase = (process.env.ULTRON_API_BASE_URL || '').trim().replace(/\/$/, '');
let apiOrigin = '';
if (configuredApiBase) {
  const apiUrl = new URL(configuredApiBase);
  if ((apiUrl.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(apiUrl.hostname)) || apiUrl.username || apiUrl.password) {
    throw new Error('ULTRON_API_BASE_URL must be an HTTPS URL without embedded credentials.');
  }
  apiOrigin = apiUrl.origin;
}
const mime = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon'
};

const server = createServer(async (request, response) => {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.writeHead(405, { 'Content-Type': 'text/plain; charset=utf-8', 'Allow': 'GET, HEAD' });
    response.end('Local ULTRON app only serves files.');
    return;
  }
  try {
    let pathname = decodeURIComponent(new URL(request.url || '/', `http://127.0.0.1:${port}`).pathname);
    if (pathname === '/') pathname = '/index.html';
    const target = resolve(root, `.${pathname}`);
    if (target !== root && !target.startsWith(`${root}${sep}`)) throw new Error('Invalid path');
    const info = await stat(target);
    if (!info.isFile()) throw new Error('Not a file');
    let bytes = await readFile(target);
    if (pathname === '/index.html' && configuredApiBase) {
      const safeBase = configuredApiBase.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;');
      const html = bytes.toString('utf8').replace(
        /(<meta\s+name="ultron-api-base-url"\s+content=")[^"]*(">)/i,
        `$1${safeBase}$2`
      );
      bytes = Buffer.from(html, 'utf8');
    }
    const connectSources = ["'self'", apiOrigin].filter(Boolean).join(' ');
    response.writeHead(200, {
      'Content-Type': mime[extname(target)] || 'application/octet-stream',
      'Content-Length': bytes.length,
      'Cache-Control': 'no-cache',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
      'Content-Security-Policy': `default-src 'self' data: blob:; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src ${connectSources}; media-src 'self' blob:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'`
    });
    response.end(request.method === 'HEAD' ? undefined : bytes);
  } catch {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
    response.end('Not found');
  }
});

server.listen(port, '127.0.0.1', () => {
  const url = `http://127.0.0.1:${port}`;
  process.stdout.write(`ULTRON runs on this device: ${url}\nKeep this window open. Press Ctrl+C to stop.\n`);
  if (process.platform === 'win32') spawn('cmd.exe', ['/d', '/s', '/c', 'start', '', url], { stdio: 'ignore', windowsHide: true });
});

for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(() => process.exit(0)));
