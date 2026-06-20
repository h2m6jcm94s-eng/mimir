import { DEFAULT_API_URL } from './extract';
import type { CapturePayload, CaptureResult } from './types';

export interface ApiConfig {
  baseUrl: string;
}

export async function getConfig(): Promise<ApiConfig> {
  if (typeof chrome === 'undefined' || !chrome.storage) {
    return { baseUrl: DEFAULT_API_URL };
  }
  const stored = await chrome.storage.sync.get(['mimirApiUrl']);
  return { baseUrl: stored.mimirApiUrl || DEFAULT_API_URL };
}

export async function saveConfig(config: ApiConfig): Promise<void> {
  if (typeof chrome === 'undefined' || !chrome.storage) return;
  await chrome.storage.sync.set({ mimirApiUrl: config.baseUrl });
}

async function getCookieHeader(url: string): Promise<string> {
  if (typeof chrome === 'undefined' || !chrome.cookies) {
    return '';
  }
  const cookies = await chrome.cookies.getAll({ url });
  return cookies.map((c) => `${c.name}=${c.value}`).join('; ');
}

export async function postCapture(
  payload: CapturePayload,
  config?: ApiConfig
): Promise<CaptureResult> {
  const { baseUrl } = config ?? (await getConfig());
  const url = new URL('/v1/capture', baseUrl).toString();
  const cookieHeader = await getCookieHeader(baseUrl);

  const res = await fetch(url, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'content-type': 'application/json',
      ...(cookieHeader ? { cookie: cookieHeader } : {}),
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => 'Unknown error');
    throw new Error(`Capture failed (${res.status}): ${text}`);
  }

  return res.json() as Promise<CaptureResult>;
}
