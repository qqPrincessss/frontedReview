import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

export interface CliConfig {
  token: string;
  server: string;
  username: string;
}

const CONFIG_DIR = join(homedir(), '.codereview');
const CONFIG_FILE = join(CONFIG_DIR, 'config.json');
const DEFAULT_SERVER = 'http://localhost:3000/api';

const DEFAULT_CONFIG: CliConfig = {
  token: '',
  server: DEFAULT_SERVER,
  username: '',
};

/**
 * 读取本地配置。环境变量只覆盖当前进程，不会自动写入配置文件。
 */
export function getConfig(): CliConfig {
  let storedConfig = { ...DEFAULT_CONFIG };

  try {
    if (existsSync(CONFIG_FILE)) {
      const raw = readFileSync(CONFIG_FILE, 'utf-8');
      storedConfig = { ...storedConfig, ...JSON.parse(raw) };
    }
  } catch {
    storedConfig = { ...DEFAULT_CONFIG };
  }

  const environmentServer = process.env.CODEREVIEW_API_URL?.trim();
  return {
    ...storedConfig,
    ...(environmentServer
      ? { server: environmentServer.replace(/\/+$/, '') }
      : {}),
  };
}

/**
 * 校验并持久化 API 地址。地址应包含服务端全局前缀，例如 /api。
 */
export function setServerUrl(server: string): string {
  const normalized = normalizeServerUrl(server);
  saveConfig({ server: normalized });
  return normalized;
}

/**
 * 保存配置到本地文件。
 */
export function saveConfig(config: Partial<CliConfig>): void {
  const current = getConfig();
  const merged = { ...current, ...config };

  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true });
  }

  writeFileSync(CONFIG_FILE, JSON.stringify(merged, null, 2), {
    encoding: 'utf-8',
    mode: 0o600,
  });
}

function normalizeServerUrl(server: string): string {
  const normalized = server.trim().replace(/\/+$/, '');
  let url: URL;

  try {
    url = new URL(normalized);
  } catch {
    throw new Error('服务端地址必须是合法 URL，例如 https://example.com/api');
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('服务端地址只支持 http:// 或 https://');
  }

  return normalized;
}
