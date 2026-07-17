import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { promises as dns } from 'node:dns';
import { execFile } from 'node:child_process';
import { fileURLToPath, URL } from 'node:url';

const probeTarget = (value: string) => {
  const target = value.trim();
  if (!/^[a-zA-Z0-9.-]+$/.test(target) || target.length > 253) throw new Error('Cible DNS ou ping invalide.');
  return target;
};

const runPing = (target: string) => new Promise<{ status: 'up' | 'down'; latencyMs?: number; message: string }>((resolve) => {
  const startedAt = Date.now();
  execFile('ping.exe', ['-n', '1', '-w', '3000', target], { windowsHide: true, timeout: 4_000 }, (error, stdout) => {
    const latencyMs = Date.now() - startedAt;
    const match = stdout.match(/(?:temps|time)[=<](\d+)ms/i);
    resolve(error ? { status: 'down', latencyMs, message: 'Ping sans réponse' } : { status: 'up', latencyMs: Number(match?.[1] ?? latencyMs), message: 'Ping reçu' });
  });
});

const monitorProbe = () => ({
  name: 'databloom-monitor-probe',
  configureServer(server: { middlewares: { use: (path: string, handler: (request: { url?: string }, response: { setHeader: (name: string, value: string) => void; end: (value: string) => void }) => void) => void } }) {
    server.middlewares.use('/monitor/probe', (request, response) => {
      void (async () => {
        try {
          const query = new URL(request.url ?? '', 'http://localhost').searchParams;
          const type = query.get('type');
          const target = probeTarget(query.get('target') ?? '');
          const startedAt = Date.now();
          const result = type === 'dns'
            ? await dns.resolve4(target).then((addresses) => ({ status: 'up' as const, latencyMs: Date.now() - startedAt, message: `DNS résolu : ${addresses[0] ?? target}` }))
            : type === 'ping' ? await runPing(target) : { status: 'down' as const, message: 'Type de sonde invalide.' };
          response.setHeader('Content-Type', 'application/json');
          response.end(JSON.stringify(result));
        } catch (error) {
          response.setHeader('Content-Type', 'application/json');
          response.end(JSON.stringify({ status: 'down', message: error instanceof Error ? error.message : 'Sonde impossible' }));
        }
      })();
    });
  },
});

export default defineConfig({
  plugins: [react(), monitorProbe()],
  resolve: {
    alias: {
      '@bloom': fileURLToPath(new URL('./src/bloom', import.meta.url)),
    },
  },
  build: {
    rollupOptions: {
      input: {
        app: fileURLToPath(new URL('./index.html', import.meta.url)),
        bloom: fileURLToPath(new URL('./src/bloom/dev/harness.html', import.meta.url)),
      },
    },
  },
  server: {
    proxy: {
      '/lmstudio': {
        target: 'http://127.0.0.1:1234',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/lmstudio/, ''),
      },
    },
  },
});
