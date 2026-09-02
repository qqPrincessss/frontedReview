import { getConfig } from './config';

interface RequestOptions {
  headers?: Record<string, string>;
  params?: Record<string, unknown>;
}

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

class ApiClient {
  private buildUrl(path: string, params?: Record<string, unknown>): URL {
    const baseUrl = (getConfig().server || 'http://localhost:3000/api').replace(
      /\/+$/,
      '',
    );
    const endpoint = path.replace(/^\/+/, '');
    const url = new URL(`${baseUrl}/${endpoint}`);

    Object.entries(params || {}).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.set(key, String(value));
      }
    });

    return url;
  }

  async get(path: string, options: RequestOptions = {}) {
    return this.request(path, {
      method: 'GET',
      headers: options.headers,
      params: options.params,
    });
  }

  async post(
    path: string,
    body: unknown,
    options: RequestOptions = {},
  ) {
    return this.request(path, {
      method: 'POST',
      headers: options.headers,
      body,
    });
  }

  async put(
    path: string,
    body: unknown,
    options: RequestOptions = {},
  ) {
    return this.request(path, {
      method: 'PUT',
      headers: options.headers,
      body,
    });
  }

  async delete(path: string, options: RequestOptions = {}) {
    return this.request(path, {
      method: 'DELETE',
      headers: options.headers,
    });
  }

  private async request(
    path: string,
    options: RequestOptions & { method: HttpMethod; body?: unknown },
  ) {
    const response = await fetch(this.buildUrl(path, options.params), {
      method: options.method,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = this.getErrorMessage(data, response.status);
      const error = new Error(message) as Error & {
        response?: { data: unknown };
      };
      error.response = { data };
      throw error;
    }

    return { data };
  }

  private getErrorMessage(data: unknown, status: number): string {
    if (typeof data === 'object' && data !== null && 'message' in data) {
      const message = (data as { message?: unknown }).message;
      if (Array.isArray(message)) return message.join('; ');
      if (typeof message === 'string') return message;
    }

    return `HTTP ${status}`;
  }
}

export const apiClient = new ApiClient();
