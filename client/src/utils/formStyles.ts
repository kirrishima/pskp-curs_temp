/**
 * Canonical form-element style constants.
 *
 * All input, select, textarea, and checkbox elements across the application
 * derive their visual appearance from these strings.  Importing from this
 * module instead of repeating class lists inline ensures a single place to
 * update when the design changes.
 *
 * The INPUT_CLASS / INPUT_ERROR_CLASS strings are intentionally flat so they
 * can be spread directly into raw <input> / <select> className props (e.g.
 * inside filter panels or one-off forms) without going through the shared
 * Input component.  The shared Input / Select / Textarea components use the
 * same tokens internally.
 */

// ─── Text inputs & selects ────────────────────────────────────────────────────

export const INPUT_CLASS =
  'w-full px-3 py-2 bg-white border border-gray-300 rounded-md outline-none ' +
  'focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-shadow ' +
  'text-sm text-text placeholder-text/40 ' +
  'disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed';

export const INPUT_ERROR_CLASS =
  'w-full px-3 py-2 bg-white border border-red-400 rounded-md outline-none ' +
  'focus:ring-2 focus:ring-red-400/50 focus:border-red-500 transition-shadow ' +
  'text-sm text-text placeholder-text/40 ' +
  'disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed';

// ─── Checkboxes ───────────────────────────────────────────────────────────────

export const CHECKBOX_CLASS =
  'w-4 h-4 rounded border-gray-300 text-primary ' +
  'focus:ring-2 focus:ring-primary/50 cursor-pointer';

// ─── Labels (two variants) ───────────────────────────────────────────────────

/** Compact uppercase label used in filter panels / search bars. */
export const FILTER_LABEL_CLASS =
  'block text-xs font-bold text-text/50 uppercase tracking-wider mb-1';

/** Regular field label used inside forms (login, register, profile, editor). */
export const FIELD_LABEL_CLASS = 'text-sm font-medium text-text/80';
