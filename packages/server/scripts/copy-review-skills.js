const { copyFileSync, mkdirSync } = require('fs');
const { join, resolve } = require('path');

const REVIEW_SKILL_NAMES = ['review-code-quality', 'frontend-review'];
const repositoryRoot = resolve(__dirname, '../../..');
const sourceRoot = join(repositoryRoot, '.agents', 'skills');
const destinationRoot = join(
  repositoryRoot,
  'packages',
  'server',
  'dist',
  'agent',
  'skills',
);

for (const skillName of REVIEW_SKILL_NAMES) {
  const destinationDirectory = join(destinationRoot, skillName);
  mkdirSync(destinationDirectory, { recursive: true });
  copyFileSync(
    join(sourceRoot, skillName, 'SKILL.md'),
    join(destinationDirectory, 'SKILL.md'),
  );
}

console.log(`Copied ${REVIEW_SKILL_NAMES.length} review Skills to dist`);
