import React, { memo, forwardRef } from 'react';

// ─── Props ───────────────────────────────────────────────────────────────────

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  /** Node rendered inside the left side of the input (e.g. an icon) */
  leftAddon?: React.ReactNode;
  /** Node rendered inside the right side of the input (e.g. a clear button) */
  rightAddon?: React.ReactNode;
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const BASE_INPUT =
  'w-full bg-white border rounded-md text-text placeholder-text/40 text-sm ' +
  'transition-colors duration-150 focus:outline-none ' +
  'disabled:opacity-50 disabled:cursor-not-allowed';

const NORMAL_BORDER = 'border-gray-200 focus:border-primary focus:ring-[3px] focus:ring-primary/20';
const ERROR_BORDER  = 'border-red-400 focus:border-red-500 focus:ring-[3px] focus:ring-red-400/20';

// ─── Component ───────────────────────────────────────────────────────────────

const Input = memo(
  forwardRef<HTMLInputElement, InputProps>(function Input(
    { label, error, hint, leftAddon, rightAddon, className, id, ...rest },
    ref,
  ) {
    const inputId = id ?? (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    const paddingLeft  = leftAddon  ? 'pl-10' : 'pl-3';
    const paddingRight = rightAddon ? 'pr-10' : 'pr-3';
    const borderClass  = error ? ERROR_BORDER : NORMAL_BORDER;

    return (
      <div className="flex flex-col gap-1 w-full">
        {label && (
          <label htmlFor={inputId} className="text-sm font-medium text-text/80">
            {label}
          </label>
        )}

        <div className="relative">
          {leftAddon && (
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-text/50 pointer-events-none">
              {leftAddon}
            </span>
          )}

          <input
            ref={ref}
            id={inputId}
            className={[BASE_INPUT, borderClass, paddingLeft, paddingRight, 'py-2.5', className ?? ''].join(' ')}
            aria-invalid={!!error}
            aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
            {...rest}
          />

          {rightAddon && (
            <span className="absolute inset-y-0 right-0 flex items-center pr-3 text-text/50">
              {rightAddon}
            </span>
          )}
        </div>

        {error && (
          <p id={`${inputId}-error`} className="text-xs text-red-500 mt-0.5">
            {error}
          </p>
        )}
        {!error && hint && (
          <p id={`${inputId}-hint`} className="text-xs text-text/50 mt-0.5">
            {hint}
          </p>
        )}
      </div>
    );
  }),
);

export default Input;
