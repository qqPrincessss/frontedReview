import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

export interface CliConfig {
  token: string;
  server: string;
  username: string;
}

const CONFIG_DIR = join(homedir(), '.codereview');
const CONFIG_FILE = join(CONFIG_DIR, 'config.json');

const DEFAULT_CONFIG: CliConfig = {
  token: '',
  server: 'http://localhost:3000/api',
  username: '',
};

/**
 * 读取本地配置
 */
export function getConfig(): CliConfig {
  try {
    if (!existsSync(CONFIG_FILE)) {
      return { ...DEFAULT_CONFIG };
    }
    const raw = readFileSync(CONFIG_FILE, 'utf-8');
    return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

/**
 * 保存配置到本地文件
 */
export function saveConfig(config: Partial<CliConfig>): void {
  const current = getConfig();
  const merged = { ...current, ...config };

  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true });
  }

  writeFileSync(CONFIG_FILE, JSON.stringify(merged, null, 2), 'utf-8');
}
