import { getCountries, getCountryCallingCode, parsePhoneNumberFromString, type CountryCode } from 'libphonenumber-js/core';
import metadata from 'libphonenumber-js/metadata.max.json';

const supportedCountries = getCountries(metadata);
const commonCountries: CountryCode[] = ['IL', 'US', 'GB', 'DE', 'FR', 'IT', 'ES', 'RU', 'CN', 'JP', 'KR', 'IN', 'AU', 'BR', 'MX'];

/** List supported calling codes, with the restaurant's country selected first. */
export function customerPhoneCountries(restaurantCountry?: string) {
  const requested = restaurantCountry?.trim().toUpperCase() as CountryCode;
  const home = supportedCountries.includes(requested) ? requested : 'IL';
  const seen = new Set<string>();
  return [home, ...commonCountries, ...supportedCountries].flatMap(country => {
    const code = '+' + getCountryCallingCode(country, metadata);
    if (seen.has(code)) return [];
    seen.add(code);
    const flag = String.fromCodePoint(...[...country].map(letter => 127397 + letter.charCodeAt(0)));
    return [{ code, country, flag }];
  });
}

/** Validate the whole input and return E.164, without asserting WhatsApp registration. */
export function normalizeCustomerPhone(value: string, callingCode = '+972'): string | null {
  const input = value.trim();
  if (!input || input.length > 80 || !/^[+0-9\s().-]+$/.test(input)) return null;
  let compact = input.replace(/[\s().-]/g, '');
  if (compact.startsWith('00')) compact = '+' + compact.slice(2);
  else if (compact.startsWith('972')) compact = '+' + compact;
  if (!/^\+?\d+$/.test(compact)) return null;
  const phone = parsePhoneNumberFromString(compact, {
    defaultCallingCode: callingCode.replace(/^\+/, ''),
    extract: false,
  }, metadata);
  return phone?.isValid() && !phone.ext ? phone.number : null;
}

/** Restore a saved contact's own calling code and preserve significant national zeros. */
export function customerPhoneParts(value: string, callingCode = '+972') {
  const normalized = normalizeCustomerPhone(value, callingCode);
  if (!normalized) return null;
  const phone = parsePhoneNumberFromString(normalized, metadata)!;
  return { callingCode: '+' + phone.countryCallingCode, nationalNumber: String(phone.nationalNumber) };
}
