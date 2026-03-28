/**
 * Application-wide currency constants.
 *
 * Change CURRENCY_CODE / CURRENCY_SYMBOL here to update the entire app.
 */

/** ISO 4217 currency code sent to the payment API. */
export const CURRENCY_CODE = 'byn';

/** Display symbol shown next to prices throughout the UI. */
export const CURRENCY_SYMBOL = 'BYN';

/** Formats a numeric amount with the app currency symbol. */
export function fmtPrice(amount: number): string {
  return `${amount.toLocaleString('ru-RU', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })} ${CURRENCY_SYMBOL}`;
}
