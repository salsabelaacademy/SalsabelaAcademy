import { getCountries, getCountryCallingCode, isSupportedCountry, parsePhoneNumberFromString, type CountryCode } from 'libphonenumber-js/max';
export { getCountries, getCountryCallingCode, isSupportedCountry };
export type { CountryCode };
/** Checks numbering-plan rules, not ownership or reachability. */
export function validateCountryPhone(country: string, input: string): { country: CountryCode; phone: string } | null {
  if (!isSupportedCountry(country) || input.length > 40) return null;
  let value = input.trim().replace(/[٠-٩]/g, d => String(d.charCodeAt(0) - 1632)).replace(/[۰-۹]/g, d => String(d.charCodeAt(0) - 1776));
  if (!/^[+\d\s().-]+$/.test(value)) return null;
  if (value.startsWith('00')) value = '+' + value.slice(2);
  const phone = parsePhoneNumberFromString(value, { defaultCountry: country as CountryCode, extract: false });
  if (!phone || phone.country !== country || !phone.isValid() || phone.ext || /^(\d)\1+$/.test(phone.nationalNumber)) return null;
  return { country: country as CountryCode, phone: phone.number };
}
