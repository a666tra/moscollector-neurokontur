/** Small fetch helpers: JSON in/out and human-readable error messages (FastAPI `detail`). */

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function detailToText(detail: unknown, status: number): string {
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    // Pydantic validation errors: [{loc, msg}, ...]
    const fields = detail.map((d: any) => (Array.isArray(d?.loc) ? d.loc[d.loc.length - 1] : '')).filter(Boolean);
    if (fields.some((f: string) => String(f).includes('pin'))) return 'PIN должен состоять из 6 цифр.';
    if (fields.some((f: string) => String(f).includes('badge'))) return 'Табельный номер в формате ДИСП-0000.';
    return 'Проверьте заполнение полей.';
  }
  if (status === 401) return 'Неверный табельный номер или PIN.';
  if (status === 403) return 'Недостаточно прав для этого действия.';
  return `Ошибка сервера (${status}).`;
}

export async function api<T = any>(url: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const { json, ...rest } = init || {};
  const res = await fetch(url, {
    ...rest,
    headers: json !== undefined ? { 'Content-Type': 'application/json', ...(rest.headers || {}) } : rest.headers,
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new ApiError(res.status, detailToText(body?.detail, res.status));
  }
  return res.json() as Promise<T>;
}

export const fmtInt = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v.toLocaleString('ru-RU') : '—');
export const fmtPct = (v: unknown, digits = 0) =>
  typeof v === 'number' && Number.isFinite(v) ? `${(v * 100).toFixed(digits).replace('.', ',')} %` : '—';
export const fmtNum = (v: unknown, digits = 2) =>
  typeof v === 'number' && Number.isFinite(v) ? v.toFixed(digits).replace('.', ',') : '—';
