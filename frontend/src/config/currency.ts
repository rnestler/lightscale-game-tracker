function installationCurrency(): string {
  const configured: unknown = import.meta.env.VITE_CURRENCY;
  if (typeof configured !== 'string' || configured.trim() === '') {
    throw new Error('VITE_CURRENCY is not set in .env');
  }
  return configured.trim();
}

const DECLARED_CURRENCY = installationCurrency() as string | null;
let viewerCurrency: string | null = null;

export function viewerHeaders(): Record<string, string> {
  return DECLARED_CURRENCY === null
    ? { 'X-Time-Zone': Intl.DateTimeFormat().resolvedOptions().timeZone }
    : {};
}

export function currencyLoaded(): boolean {
  return DECLARED_CURRENCY !== null || viewerCurrency !== null;
}

export function setViewerCurrency(currency: string): void {
  viewerCurrency = currency;
}

export function currencyCode(): string {
  const code = DECLARED_CURRENCY ?? viewerCurrency;
  if (code === null) {
    throw new Error('Currency read before it was loaded');
  }
  return code;
}

export function currencySymbol(): string {
  const code = currencyCode();
  if (!/^[A-Za-z]{3}$/.test(code)) {
    return code;
  }
  const parts = new Intl.NumberFormat('en', { style: 'currency', currency: code }).formatToParts(0);
  return parts.find((part) => part.type === 'currency')?.value ?? code;
}
