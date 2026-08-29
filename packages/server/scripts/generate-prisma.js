const { spawnSync } = require('child_process');
const { join } = require('path');

const packageRoot = join(__dirname, '..');
const prismaCli = join(packageRoot, 'node_modules', 'prisma', 'build', 'index.js');
const schema = join(packageRoot, 'prisma', 'schema.prisma');

// `prisma generate` only parses the URL; it does not connect to the database.
const env = {
  ...process.env,
  INIT_CWD: packageRoot,
  DATABASE_URL:
    process.env.DATABASE_URL ||
    'postgresql://placeholder:placeholder@localhost:5432/codereview_ai',
};

const result = spawnSync(process.execPath, [prismaCli, 'generate', '--schema', schema], {
  cwd: packageRoot,
  env,
  encoding: 'utf8',
});

if (result.stdout) process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status || 1);
