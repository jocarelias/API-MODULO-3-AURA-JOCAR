"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.start = start;
require("dotenv/config");
const app_1 = require("./app");
const PORT = Number(process.env.G3_PORT) || 4100;
function start() {
    const app = (0, app_1.createApp)();
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
//# sourceMappingURL=main.js.map