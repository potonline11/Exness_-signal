import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createApiApp } from './serverApp';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = createApiApp();
const PORT: number = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

// Setup Vite or static serving
async function startServer() {
  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Exness XAUUSD Scalping Pro Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
