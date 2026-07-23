import fs from "node:fs";
import { config } from "./config.js";
import { app } from "./server.js";

fs.mkdirSync(config.agentWorkdir, { recursive: true });

app.listen(config.port, () => {
  console.log(`Listening on port ${config.port}, webhook path ${config.telegramWebhookPath}`);
});
