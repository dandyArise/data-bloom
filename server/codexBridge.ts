import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Plugin } from 'vite';

export function codexBridge(): Plugin {
  return {
    name: 'databloom-codex',
    configureServer(server) {
      server.middlewares.use('/api/codex', async (req, res) => {
        const fail = (status: number, error: string) => {
          res.statusCode = status;
          res.end(JSON.stringify({ error }));
        };
        res.setHeader('Content-Type', 'application/json');
        const host = req.headers.host ?? '';
        if (!/^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(host)
          || !['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress ?? '')
          || req.headers.origin !== 'http://' + host) return fail(403, 'Accès local requis.');
        if (req.method !== 'POST' || req.headers['content-type'] !== 'application/json') return fail(400, 'Requête JSON attendue.');
        let dir: string | undefined;
        try {
          const chunks: Buffer[] = [];
          let size = 0;
          for await (const chunk of req) {
            size += chunk.length;
            if (size > 512_000) return fail(413, 'Contexte trop volumineux.');
            chunks.push(chunk);
          }
          const { prompt, schema } = JSON.parse(Buffer.concat(chunks).toString());
          if (typeof prompt !== 'string' || schema?.type !== 'object') return fail(400, 'Contexte ou schéma invalide.');
          dir = await mkdtemp(join(tmpdir(), 'databloom-'));
          await writeFile(join(dir, 'schema.json'), JSON.stringify(schema));
          const args = ['exec', '--ephemeral', '--ignore-user-config', '--skip-git-repo-check',
            '--sandbox', 'read-only', '--disable', 'shell_tool', '--disable', 'unified_exec',
            '--disable', 'apps', '-c', 'web_search="disabled"', '--output-schema', 'schema.json',
            '--output-last-message', 'response.json', '-'];
          await new Promise<void>((resolve, reject) => {
            const child = execFile('codex', args, { cwd: dir, timeout: 180_000, windowsHide: true }, (err) => {
              if (err) reject(new Error(err.code === 'ENOENT' ? 'CLI Codex introuvable dans PATH.' : 'Codex a échoué. Vérifiez codex login status, la connexion et votre quota.'));
              else resolve();
            });
            child.stdin?.on('error', () => {});
            child.stdin?.end(prompt);
          });
          res.end(JSON.stringify({ content: await readFile(join(dir, 'response.json'), 'utf8') }));
        } catch (error) {
          fail(502, error instanceof Error ? error.message : 'Codex indisponible.');
        } finally {
          if (dir) await rm(dir, { recursive: true, force: true });
        }
      });
    },
  };
}
