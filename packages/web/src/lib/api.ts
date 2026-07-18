/**
 * API client for communicating with the Fastify backend.
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

interface ApiOptions {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
}

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private getToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('accessToken');
  }

  private async refreshToken(): Promise<string | null> {
    const refreshToken = localStorage.getItem('refreshToken');
    if (!refreshToken) return null;

    try {
      const res = await fetch(`${this.baseUrl}/api/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });

      if (!res.ok) return null;

      const data = await res.json();
      localStorage.setItem('accessToken', data.data.accessToken);
      if (data.data.refreshToken) {
        localStorage.setItem('refreshToken', data.data.refreshToken);
      }
      return data.data.accessToken;
    } catch {
      return null;
    }
  }

  async request<T = unknown>(path: string, options: ApiOptions = {}): Promise<T> {
    const { method = 'GET', body, headers = {} } = options;
    const token = this.getToken();

    const fetchHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      ...headers,
    };

    if (token) {
      fetchHeaders['Authorization'] = `Bearer ${token}`;
    }

    let res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: fetchHeaders,
      body: body ? JSON.stringify(body) : undefined,
    });

    // Handle token expiry — attempt refresh
    if (res.status === 401 && token) {
      const newToken = await this.refreshToken();
      if (newToken) {
        fetchHeaders['Authorization'] = `Bearer ${newToken}`;
        res = await fetch(`${this.baseUrl}${path}`, {
          method,
          headers: fetchHeaders,
          body: body ? JSON.stringify(body) : undefined,
        });
      } else {
        // Redirect to login
        if (typeof window !== 'undefined') {
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          window.location.href = '/login';
        }
      }
    }

    const data = await res.json();

    if (!res.ok) {
      throw new ApiError(data.message || 'Request failed', res.status, data);
    }

    return data as T;
  }

  // Convenience methods
  get<T = unknown>(path: string) { return this.request<T>(path); }
  post<T = unknown>(path: string, body?: unknown) { return this.request<T>(path, { method: 'POST', body }); }
  put<T = unknown>(path: string, body?: unknown) { return this.request<T>(path, { method: 'PUT', body }); }
  delete<T = unknown>(path: string) { return this.request<T>(path, { method: 'DELETE' }); }
}

export class ApiError extends Error {
  status: number;
  data: unknown;

  constructor(message: string, status: number, data: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

export const api = new ApiClient(API_URL);
