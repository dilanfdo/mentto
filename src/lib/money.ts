// Money is stored as integer minor units (e.g. cents) alongside an ISO 4217 currency code.

const formatters = new Map<string, Intl.NumberFormat>();

function formatter(currency: string, compact: boolean): Intl.NumberFormat {
  const key = `${currency}:${compact}`;
  let f = formatters.get(key);
  if (!f) {
    f = new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      currencyDisplay: 'narrowSymbol',
      ...(compact ? { maximumFractionDigits: 0, minimumFractionDigits: 0 } : {}),
    });
    formatters.set(key, f);
  }
  return f;
}

export function fractionDigits(currency: string): number {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).resolvedOptions()
      .maximumFractionDigits ?? 2;
  } catch {
    return 2;
  }
}

/**
 * Formats minor units for display. Whole amounts drop their decimals ("Rs 5,000" rather than
 * "Rs 5,000.00") since tutors almost always charge round numbers.
 */
export function formatMoney(minor: number, currency: string): string {
  const digits = fractionDigits(currency);
  const major = minor / 10 ** digits;
  try {
    return formatter(currency, Number.isInteger(major)).format(major);
  } catch {
    return `${currency} ${major.toLocaleString()}`;
  }
}

/** Parses user input like "5,000" or "1250.50" into minor units, or null if it isn't a valid amount. */
export function parseMoney(input: string, currency: string): number | null {
  const cleaned = input.replace(/[^\d.]/g, '');
  if (!cleaned || cleaned === '.' || (cleaned.match(/\./g) ?? []).length > 1) return null;
  const digits = fractionDigits(currency);
  const value = Number(cleaned);
  if (!Number.isFinite(value)) return null;
  return Math.round(value * 10 ** digits);
}

/** Minor units as a plain editable string, e.g. 500000 → "5000". */
export function toMoneyInput(minor: number, currency: string): string {
  const digits = fractionDigits(currency);
  const major = minor / 10 ** digits;
  return Number.isInteger(major) ? String(major) : major.toFixed(digits);
}

export function currencySymbol(currency: string): string {
  try {
    const part = formatter(currency, true)
      .formatToParts(0)
      .find((p) => p.type === 'currency');
    return part?.value ?? currency;
  } catch {
    return currency;
  }
}

/** "USD $", or just "LKR" when the currency has no separate symbol. */
export function currencyLabel(currency: string): string {
  const symbol = currencySymbol(currency);
  return symbol && symbol !== currency ? `${currency} ${symbol}` : currency;
}

export const COMMON_CURRENCIES = ['LKR', 'INR', 'USD', 'GBP', 'EUR', 'AUD', 'CAD', 'SGD', 'AED', 'NZD'];
