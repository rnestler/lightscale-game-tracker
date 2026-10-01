import { i18n } from '../i18n/text';
function installationCurrency(): string {
  const configured: unknown = import.meta.env.VITE_CURRENCY;
  if (typeof configured !== 'string' || configured.trim() === '') {
    throw new Error('VITE_CURRENCY is not set in .env');
  }
  return configured.trim();
}

const DECLARED_CURRENCY = installationCurrency();

export function currencyCode(): string {
  return DECLARED_CURRENCY;
}

export function currencySymbol(): string {
  const code = currencyCode();
  if (!/^[A-Za-z]{3}$/.test(code)) {
    return code;
  }
  const parts = new Intl.NumberFormat(i18n.locale, {
    style: 'currency',
    currency: code,
  }).formatToParts(0);
  return parts.find((part) => part.type === 'currency')?.value ?? code;
}
