/**
 * Shared validation utilities.
 * Each validator returns an error message string or empty string if valid.
 */

// ─── Email ───────────────────────────────────────────────────────────────────

const EMAIL_RE = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

export function validateEmail(value: string): string {
  const v = value.trim();
  if (!v) return 'Email обязателен';
  if (!EMAIL_RE.test(v)) return 'Некорректный формат email';
  return '';
}

// ─── Password ────────────────────────────────────────────────────────────────

export function validatePassword(value: string): string {
  if (!value) return 'Пароль обязателен';
  if (value.length < 6) return 'Минимум 6 символов';
  if (value.length > 128) return 'Максимум 128 символов';
  return '';
}

export function validateConfirmPassword(password: string, confirm: string): string {
  if (!confirm) return 'Подтвердите пароль';
  if (password !== confirm) return 'Пароли не совпадают';
  return '';
}

// ─── Name (Latin only) ──────────────────────────────────────────────────────

const LATIN_NAME_RE = /^[A-Za-z][A-Za-z\s\-']{0,49}$/;

export function validateFirstName(value: string): string {
  const v = value.trim();
  if (!v) return 'Имя обязательно';
  if (!LATIN_NAME_RE.test(v)) return 'Только латинские буквы, дефис и апостроф';
  return '';
}

export function validateLastName(value: string): string {
  const v = value.trim();
  if (!v) return 'Фамилия обязательна';
  if (!LATIN_NAME_RE.test(v)) return 'Только латинские буквы, дефис и апостроф';
  return '';
}

// ─── Verification code ──────────────────────────────────────────────────────

export function validateCode(value: string): string {
  const v = value.trim();
  if (!v) return 'Введите код';
  if (v.length !== 6 || !/^\d{6}$/.test(v)) return 'Код должен состоять из 6 цифр';
  return '';
}

// ─── Phone (international E.164-like: + then 7–15 digits) ───────────────────

const PHONE_RE = /^\+[1-9]\d{6,14}$/;

export function validatePhone(value: string): string {
  const v = value.trim();
  if (!v) return ''; // optional field — empty is OK
  // Remove spaces, dashes, parentheses for validation
  const cleaned = v.replace(/[\s\-()]/g, '');
  if (!PHONE_RE.test(cleaned)) return 'Формат: +7XXXXXXXXXX (7–15 цифр после +)';
  return '';
}

/** Strip non-digits (except leading +) for storage */
export function normalizePhone(value: string): string {
  const v = value.trim();
  if (!v) return '';
  return v.replace(/[\s\-()]/g, '');
}

// ─── Birth date ─────────────────────────────────────────────────────────────

export function validateBirthDate(value: string): string {
  if (!value) return ''; // optional
  const date = new Date(value);
  if (isNaN(date.getTime())) return 'Некорректная дата';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (date >= today) return 'Дата рождения не может быть в будущем';
  const minDate = new Date();
  minDate.setFullYear(minDate.getFullYear() - 150);
  if (date < minDate) return 'Некорректная дата рождения';
  return '';
}

/** Max date attribute value for <input type="date"> — yesterday */
export function getMaxBirthDate(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().split('T')[0];
}

// ─── Display name ───────────────────────────────────────────────────────────

export function validateDisplayName(value: string): string {
  const v = value.trim();
  if (!v) return ''; // optional
  if (v.length < 2) return 'Минимум 2 символа';
  if (v.length > 50) return 'Максимум 50 символов';
  return '';
}

// ─── Citizenship ────────────────────────────────────────────────────────────

import { COUNTRY_CODES } from './countries';

export function validateCitizenship(value: string): string {
  if (!value) return ''; // optional
  if (!COUNTRY_CODES.has(value)) return 'Выберите страну из списка';
  return '';
}

// ─── Gender ─────────────────────────────────────────────────────────────────

const VALID_GENDERS = new Set(['', 'male', 'female', 'other']);

export function validateGender(value: string): string {
  if (!VALID_GENDERS.has(value)) return 'Некорректное значение';
  return '';
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Run all validators at once and return a Record of field → error.
 * Fields with empty error strings are removed.
 */
export function validateAll<T extends Record<string, string>>(
  validators: Record<keyof T, () => string>,
): Partial<Record<keyof T, string>> {
  const errors: Partial<Record<keyof T, string>> = {};
  for (const key of Object.keys(validators) as (keyof T)[]) {
    const err = validators[key]();
    if (err) errors[key] = err;
  }
  return errors;
}
