/**
 * Server-side validation utilities.
 * Mirror the client-side rules so both sides enforce the same constraints.
 */

const EMAIL_RE = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
const LATIN_NAME_RE = /^[A-Za-z][A-Za-z\s\-']{0,49}$/;
const PHONE_RE = /^\+[1-9]\d{6,14}$/;

// ISO 3166-1 alpha-2 codes
const VALID_COUNTRIES = new Set([
  'AF','AL','DZ','AD','AO','AG','AR','AM','AU','AT','AZ','BS','BH','BD','BB',
  'BY','BE','BZ','BJ','BT','BO','BA','BW','BR','BN','BG','BF','BI','KH','CM',
  'CA','CV','CF','TD','CL','CN','CO','KM','CG','CR','HR','CU','CY','CZ','DK',
  'DJ','DM','DO','EC','EG','SV','GQ','ER','EE','SZ','ET','FJ','FI','FR','GA',
  'GM','GE','DE','GH','GR','GD','GT','GN','GW','GY','HT','HN','HU','IS','IN',
  'ID','IR','IQ','IE','IL','IT','JM','JP','JO','KZ','KE','KI','KP','KR','KW',
  'KG','LA','LV','LB','LS','LR','LY','LI','LT','LU','MG','MW','MY','MV','ML',
  'MT','MH','MR','MU','MX','FM','MD','MC','MN','ME','MA','MZ','MM','NA','NR',
  'NP','NL','NZ','NI','NE','NG','MK','NO','OM','PK','PW','PA','PG','PY','PE',
  'PH','PL','PT','QA','RO','RU','RW','KN','LC','VC','WS','SM','ST','SA','SN',
  'RS','SC','SL','SG','SK','SI','SB','SO','ZA','SS','ES','LK','SD','SR','SE',
  'CH','SY','TW','TJ','TZ','TH','TL','TG','TO','TT','TN','TR','TM','TV','UG',
  'UA','AE','GB','US','UY','UZ','VU','VA','VE','VN','YE','ZM','ZW',
]);

const VALID_GENDERS = new Set(['male', 'female', 'other']);

function validateEmail(value) {
  if (!value || typeof value !== 'string') return 'Email is required';
  const v = value.trim();
  if (!v) return 'Email is required';
  if (!EMAIL_RE.test(v)) return 'Invalid email format';
  return null;
}

function validatePassword(value) {
  if (!value || typeof value !== 'string') return 'Password is required';
  if (value.length < 6) return 'Password must be at least 6 characters';
  if (value.length > 128) return 'Password must be at most 128 characters';
  return null;
}

function validateFirstName(value) {
  if (!value || typeof value !== 'string') return 'First name is required';
  const v = value.trim();
  if (!v) return 'First name is required';
  if (!LATIN_NAME_RE.test(v)) return 'First name must contain only Latin letters, hyphens, and apostrophes';
  return null;
}

function validateLastName(value) {
  if (!value || typeof value !== 'string') return 'Last name is required';
  const v = value.trim();
  if (!v) return 'Last name is required';
  if (!LATIN_NAME_RE.test(v)) return 'Last name must contain only Latin letters, hyphens, and apostrophes';
  return null;
}

function validatePhone(value) {
  if (!value) return null; // optional
  if (typeof value !== 'string') return 'Invalid phone';
  const cleaned = value.replace(/[\s\-()]/g, '');
  if (!PHONE_RE.test(cleaned)) return 'Phone must be in format +XXXXXXXXXXX (7–15 digits)';
  return null;
}

function normalizePhone(value) {
  if (!value) return null;
  return value.replace(/[\s\-()]/g, '');
}

function validateBirthDate(value) {
  if (!value) return null; // optional
  const date = new Date(value);
  if (isNaN(date.getTime())) return 'Invalid date';
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  if (date > today) return 'Birth date cannot be in the future';
  const minDate = new Date();
  minDate.setFullYear(minDate.getFullYear() - 150);
  if (date < minDate) return 'Invalid birth date';
  return null;
}

function validateGender(value) {
  if (!value) return null; // optional
  if (!VALID_GENDERS.has(value)) return 'Invalid gender value';
  return null;
}

function validateCitizenship(value) {
  if (!value) return null; // optional
  if (!VALID_COUNTRIES.has(value)) return 'Invalid country code';
  return null;
}

function validateDisplayName(value) {
  if (!value) return null; // optional
  if (typeof value !== 'string') return 'Invalid display name';
  const v = value.trim();
  if (v.length < 2) return 'Display name must be at least 2 characters';
  if (v.length > 50) return 'Display name must be at most 50 characters';
  return null;
}

/**
 * Collect all errors from a map of { field: validatorResult }.
 * Returns null if no errors, or an object of { field: message }.
 */
function collectErrors(results) {
  const errors = {};
  for (const [field, error] of Object.entries(results)) {
    if (error) errors[field] = error;
  }
  return Object.keys(errors).length > 0 ? errors : null;
}

module.exports = {
  validateEmail,
  validatePassword,
  validateFirstName,
  validateLastName,
  validatePhone,
  normalizePhone,
  validateBirthDate,
  validateGender,
  validateCitizenship,
  validateDisplayName,
  collectErrors,
  VALID_COUNTRIES,
  VALID_GENDERS,
};
