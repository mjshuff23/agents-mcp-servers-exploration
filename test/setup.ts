// Tests get their own data dir so recipe persistence never leaks across runs.
process.env.AGENTS_DATA_DIR ??= '.studio-data/test';
process.env.AGENTS_DEFAULT_MODE ??= 'deterministic';
