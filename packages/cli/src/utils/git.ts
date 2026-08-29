import { execFileSync } from 'child_process';

export function getDiff(base: string = 'HEAD', head?: string): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      verifyRef(base);
      if (head) verifyRef(head);

      const range = head
        ? `${base}...${head}`
        : base === 'HEAD'
          ? 'HEAD'
          : `${base}...HEAD`;

      const diff = execFileSync('git', ['diff', range], {
        encoding: 'utf-8',
        maxBuffer: 1024 * 1024,
      });
      resolve(diff);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      reject(new Error(`git diff 执行失败: ${message}`));
    }
  });
}

export function getCurrentBranch(): string {
  return execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
    encoding: 'utf-8',
  }).trim();
}

export function detectLanguage(diff: string): string | undefined {
  const fileExtensions = diff.match(/\+\+\+ b\/.*?\.(ts|tsx|js|jsx|vue)/g);
  if (!fileExtensions) return undefined;

  const counts: Record<string, number> = {};
  fileExtensions.forEach((match) => {
    const extension = match.split('.').pop();
    if (extension) counts[extension] = (counts[extension] || 0) + 1;
  });

  const extension = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0];
  const languages: Record<string, string> = {
    ts: 'typescript',
    tsx: 'typescript',
    js: 'javascript',
    jsx: 'javascript',
    vue: 'vue',
  };

  return extension ? languages[extension] : undefined;
}

function verifyRef(ref: string): void {
  execFileSync('git', ['rev-parse', '--verify', `${ref}^{commit}`], {
    encoding: 'utf-8',
    stdio: 'pipe',
  });
}
