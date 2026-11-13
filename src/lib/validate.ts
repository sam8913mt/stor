import { latinDigits } from './phone';

/** Iranian national ID (کد ملی): 10 digits + checksum. */
export function isValidNationalId(input: string): boolean {
  const v = latinDigits(input).trim();
  if (!/^\d{10}$/.test(v) || /^(\d)\1{9}$/.test(v)) return false;
  const sum = v.split('').slice(0, 9).reduce((a, d, i) => a + Number(d) * (10 - i), 0) % 11;
  const check = Number(v[9]);
  return sum < 2 ? check === sum : check === 11 - sum;
}
export const isValidPostalCode = (input: string) => /^\d{10}$/.test(latinDigits(input).trim());
export const digitsOnly = (input: string) => latinDigits(input).replace(/\D/g, '');
