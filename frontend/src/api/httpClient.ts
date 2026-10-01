import { i18n } from '../i18n/text';
import { apiBaseUrl } from '../config/apiConfig';
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
const recordsPerRequest = 200;

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
      'X-Language': i18n.language,
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
      throw new Error(i18n.chrome.serverUnreachable);
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
  async records<Row>(path: string, ids: string[]): Promise<Row[]> {
    const rows: Row[] = [];
    for (let start = 0; start < ids.length; start += recordsPerRequest) {
      const body = { ids: ids.slice(start, start + recordsPerRequest) };
      rows.push(...(await sendRequest<Row[]>(path, { method: 'POST', body, kind: 'load' })));
    }
    return rows;
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
