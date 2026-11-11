import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { researchSources } from './server/research-core.js';

// A local development implementation of the same /api/research endpoint
// provided by Vercel serverless functions after deployment.
const localResearchAPI = () => ({
  name: 'local-public-research-api',
  configureServer(server) {
    server.middlewares.use('/api/research', async (req, res, next) => {
      if (req.method !== 'GET') {
        res.statusCode = 405;
        res.end(JSON.stringify({ error: 'GET only.' }));
        return;
      }
      const q = new URL(req.url || '/', 'http://localhost').searchParams.get('q') || '';
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      try {
        const result = await researchSources(q);
        res.statusCode = 200;
        res.end(JSON.stringify(result));
      } catch {
        res.statusCode = 502;
        res.end(JSON.stringify({ error: 'Public research sources could not be reached.' }));
      }
    });
  }
});

export default defineConfig({
  plugins: [react(), localResearchAPI()],
  build: { target: 'es2022', chunkSizeWarningLimit: 1700 }
});
