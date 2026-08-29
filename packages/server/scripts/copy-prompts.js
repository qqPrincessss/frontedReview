const { cpSync, existsSync, mkdirSync } = require('fs');
const { join } = require('path');

const packageRoot = join(__dirname, '..');
const source = join(packageRoot, 'src', 'agent', 'prompts');
const destination = join(packageRoot, 'dist', 'agent', 'prompts');

if (!existsSync(source)) {
  throw new Error(`Prompt source directory not found: ${source}`);
}

mkdirSync(destination, { recursive: true });
cpSync(source, destination, { recursive: true });
console.log(`Copied prompt assets to ${destination}`);
