import React, { memo, forwardRef } from 'react';
import { INPUT_CLASS, INPUT_ERROR_CLASS, FIELD_LABEL_CLASS } from '@/utils/formStyles';

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

// ─── Component ───────────────────────────────────────────────────────────────

const Input = memo(
  forwardRef<HTMLInputElement, InputProps>(function Input(
    { label, error, hint, leftAddon, rightAddon, className, id, ...rest },
    ref,
  ) {
    const inputId = id ?? (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    const paddingLeft  = leftAddon  ? 'pl-10' : 'pl-3';
    const paddingRight = rightAddon ? 'pr-10' : 'pr-3';

    // Base style comes from the shared constant; override px only when addons
    // are present (left/right padding is already px-3 in INPUT_CLASS).
    const baseWithoutPx = (error ? INPUT_ERROR_CLASS : INPUT_CLASS).replace('px-3 ', '');

    return (
      <div className="flex flex-col gap-1 w-full">
        {label && (
          <label htmlFor={inputId} className={FIELD_LABEL_CLASS}>
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
            className={[
              baseWithoutPx,
              paddingLeft,
              paddingRight,
              className ?? '',
            ].join(' ')}
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
