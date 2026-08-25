import { getConfig } from './config';

/**
 * 简易 HTTP 客户端（基于 fetch，避免额外依赖）
 */
class ApiClient {
  private getBaseUrl(): string {
    return getConfig().server || 'http://localhost:3000/api';
  }

  async get(path: string, options?: { params?: Record<string, any>; headers?: Record<string, string> }) {
    const url = new URL(path, this.getBaseUrl());
    if (options?.params) {
      Object.entries(options.params).forEach(([key, value]) => {
        url.searchParams.set(key, String(value));
      });
    }

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      const error: any = new Error(body.message || `HTTP ${response.status}`);
      error.response = { data: body };
      throw error;
    }

    return { data: await response.json() };
  }

  async post(path: string, body: any, options?: { headers?: Record<string, string> }) {
    const url = new URL(path, this.getBaseUrl());

    const response = await fetch(url.toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      const error: any = new Error(data.message || `HTTP ${response.status}`);
      error.response = { data };
      throw error;
    }

    return { data: await response.json() };
  }
}

export const apiClient = new ApiClient();
