const { spawnSync } = require('child_process');
const { readdirSync } = require('fs');
const { join } = require('path');

const packageRoot = join(__dirname, '..');
const testDirectory = join(packageRoot, 'test');
const testFiles = readdirSync(testDirectory)
  .filter((file) => file.endsWith('.test.js'))
  .sort()
  .map((file) => join(testDirectory, file));

if (testFiles.length === 0) {
  console.error('No unit test files found.');
  process.exit(1);
}

const result = spawnSync(process.execPath, ['--test', ...testFiles], {
  cwd: packageRoot,
  stdio: 'inherit',
  env: process.env,
});

if (result.error) throw result.error;
process.exit(result.status ?? 1);
