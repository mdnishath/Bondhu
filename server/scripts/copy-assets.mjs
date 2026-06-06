// Copy non-TS runtime assets into dist/ after tsc. tsc only emits compiled .js,
// so files read at runtime (the SQLite schema) must be copied explicitly — else
// the production build (node dist/index.js) crashes with ENOENT on schema.sql.
import { copyFileSync, mkdirSync } from 'fs';

mkdirSync('dist/db', { recursive: true });
copyFileSync('src/db/schema.sql', 'dist/db/schema.sql');
console.log('copied src/db/schema.sql -> dist/db/schema.sql');
