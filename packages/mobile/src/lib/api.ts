/**
 * API client for React Native.
 * Uses AsyncStorage for token management.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = __DEV__
  ? 'http://localhost:3000'
  : 'https://api.travel-companion.app';

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private async getToken(): Promise<string | null> {
    return AsyncStorage.getItem('accessToken');
  }

  private async refreshToken(): Promise<string | null> {
    const refreshToken = await AsyncStorage.getItem('refreshToken');
    if (!refreshToken) return null;

    try {
      const res = await fetch(`${this.baseUrl}/api/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });

      if (!res.ok) return null;

      const data = await res.json();
      await AsyncStorage.setItem('accessToken', data.data.accessToken);
      if (data.data.refreshToken) {
        await AsyncStorage.setItem('refreshToken', data.data.refreshToken);
      }
      return data.data.accessToken;
    } catch {
      return null;
    }
  }

  async request<T = unknown>(
    path: string,
    options: { method?: string; body?: unknown } = {},
  ): Promise<T> {
    const { method = 'GET', body } = options;
    const token = await this.getToken();

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    let res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    // Handle token expiry
    if (res.status === 401 && token) {
      const newToken = await this.refreshToken();
      if (newToken) {
        headers['Authorization'] = `Bearer ${newToken}`;
        res = await fetch(`${this.baseUrl}${path}`, {
          method,
          headers,
          body: body ? JSON.stringify(body) : undefined,
        });
      }
    }

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || 'Request failed');
    }
    return data as T;
  }

  get<T = unknown>(path: string) { return this.request<T>(path); }
  post<T = unknown>(path: string, body?: unknown) { return this.request<T>(path, { method: 'POST', body }); }
  put<T = unknown>(path: string, body?: unknown) { return this.request<T>(path, { method: 'PUT', body }); }
  delete<T = unknown>(path: string) { return this.request<T>(path, { method: 'DELETE' }); }
}

export const api = new ApiClient(API_URL);
