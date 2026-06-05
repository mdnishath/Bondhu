import { createContext } from './app-context.js';
import { createApp } from './api/server.js';
import { config } from './config.js';

const ctx = createContext(config.dbPath);
const app = createApp(ctx);
app.listen(config.port, () => {
  process.stderr.write(`[Bondhu] API listening on http://localhost:${config.port}\n`);
});
