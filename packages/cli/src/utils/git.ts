import { execSync } from 'child_process';

/**
 * 采集 git diff
 * @param base - 基准（默认 HEAD）
 * @param head - 目标分支（可选）
 */
export function getDiff(base: string = 'HEAD', head?: string): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      let command: string;

      if (head) {
        // 对比两个分支
        command = `git diff ${base}...${head}`;
      } else if (base === 'HEAD') {
        // 对比工作区和 HEAD
        command = 'git diff HEAD';
      } else {
        // 对比指定 base 到当前 HEAD
        command = `git diff ${base}...HEAD`;
      }

      const diff = execSync(command, {
        encoding: 'utf-8',
        maxBuffer: 1024 * 1024, // 1MB
      });

      resolve(diff);
    } catch (error: any) {
      reject(new Error(`git diff 执行失败: ${error.message}`));
    }
  });
}

/**
 * 获取当前分支名
 */
export function getCurrentBranch(): string {
  return execSync('git rev-parse --abbrev-ref HEAD', {
    encoding: 'utf-8',
  }).trim();
}

/**
 * 检测文件变更中的主要语言
 */
export function detectLanguage(diff: string): string | undefined {
  const fileExtensions = diff.match(/\+\+\+ b\/.*?\.(ts|tsx|js|jsx|vue)/g);
  if (!fileExtensions) return undefined;

  const extCount: Record<string, number> = {};
  fileExtensions.forEach((match) => {
    const ext = match.split('.').pop() || '';
    extCount[ext] = (extCount[ext] || 0) + 1;
  });

  const sorted = Object.entries(extCount).sort((a, b) => b[1] - a[1]);
  const topExt = sorted[0]?.[0];

  const langMap: Record<string, string> = {
    ts: 'typescript',
    tsx: 'typescript',
    js: 'javascript',
    jsx: 'javascript',
    vue: 'vue',
  };

  return topExt ? langMap[topExt] : undefined;
}
