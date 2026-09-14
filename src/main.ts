import path from 'node:path';
import 'dotenv/config';
import { createApp } from './app';

const PORT = Number(process.env.G3_PORT) || 4100;

export function start() {
  const app = createApp();
  const server = app.listen(PORT, () => {
    console.log(`G3 (Avaliações e Horários) ouvindo em http://localhost:${PORT}/api/v1`);
    console.log(`OpenAPI disponível em http://localhost:${PORT}/api/docs`);
  });

  const shutdown = () => {
    server.close(() => process.exit(0));
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  return server;
}

if (require.main === module) {
  start();
}