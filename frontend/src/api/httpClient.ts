import { apiBaseUrl } from '../config/apiConfig';
import { viewerHeaders } from '../config/currency';
import { apiRequestError, type RequestKind } from '../utils/errorHandling';
import { beginProbe, endProbe } from '../utils/activityStore';
import { reportReachable, reportRequestFailure } from '../utils/connectivity';
import { submissionHeaders } from '../utils/submissionGuard';

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

interface HttpRequestOptions {
  method: HttpMethod;
  kind: RequestKind;
  body?: unknown;
}

const requestTimeoutMs = 30000;

async function sendRequest<ResponseBody>(
  path: string,
  options: HttpRequestOptions
): Promise<ResponseBody> {
  const url = `${apiBaseUrl}${path}`;
  const { method, kind, body } = options;
  const requestInit: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...viewerHeaders(),
      ...(method === 'GET' ? {} : await submissionHeaders()),
    },
    credentials: 'include',
  };
  if (body !== undefined) {
    requestInit.body = JSON.stringify(body);
  }
  const probesActivity = method !== 'GET';
  if (probesActivity) {
    beginProbe();
  }
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, requestTimeoutMs);
  try {
    let response: Response;
    try {
      response = await fetch(url, { ...requestInit, signal: controller.signal });
    } catch {
      reportRequestFailure();
      throw new Error('The server is not responding. Please try again.');
    } finally {
      clearTimeout(timeoutId);
    }
    reportReachable();
    if (!response.ok) {
      throw await apiRequestError(response, kind);
    }
    if (response.status === 204) {
      return undefined as ResponseBody;
    }
    return (await response.json()) as ResponseBody;
  } finally {
    if (probesActivity) {
      endProbe();
    }
  }
}

export const httpClient = {
  get<ResponseBody>(path: string): Promise<ResponseBody> {
    return sendRequest<ResponseBody>(path, { method: 'GET', kind: 'load' });
  },
  query<ResponseBody>(path: string, body: unknown): Promise<ResponseBody> {
    return sendRequest<ResponseBody>(path, { method: 'POST', body, kind: 'load' });
  },
  post<ResponseBody>(path: string, body: unknown): Promise<ResponseBody> {
    return sendRequest<ResponseBody>(path, { method: 'POST', body, kind: 'save' });
  },
  put<ResponseBody>(path: string, body: unknown): Promise<ResponseBody> {
    return sendRequest<ResponseBody>(path, { method: 'PUT', body, kind: 'save' });
  },
  delete<ResponseBody>(path: string): Promise<ResponseBody> {
    return sendRequest<ResponseBody>(path, { method: 'DELETE', kind: 'save' });
  },
};
