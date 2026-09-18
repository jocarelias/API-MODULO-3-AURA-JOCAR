import 'dotenv/config';
import { createApp } from './app';

const PORT = Number(process.env.FINANCE_SERVICE_PORT) || 4104;

export function start() {
  const app = createApp();
  const server = app.listen(PORT, () => {
    console.log(`[finance] contrato de Situação Financeira em http://localhost:${PORT}/api/v1`);
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