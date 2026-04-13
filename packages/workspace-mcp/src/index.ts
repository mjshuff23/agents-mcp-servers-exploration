import path from 'node:path';
import { WorkspaceMcpRuntime } from './runtime.js';

const runtime = new WorkspaceMcpRuntime({
  cwd: process.cwd(),
  dataDir: path.resolve(process.env.AGENTS_DATA_DIR ?? path.join(process.cwd(), '.studio-data'))
});

runtime
  .initialize()
  .then(() => runtime.start())
  .catch(error => {
    console.error('[workspace-mcp] fatal error');
    console.error(error);
    process.exit(1);
  });
