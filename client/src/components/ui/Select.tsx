import React, { memo, forwardRef } from 'react';
import { ChevronDown } from 'lucide-react';
import { INPUT_CLASS, INPUT_ERROR_CLASS, FIELD_LABEL_CLASS } from '@/utils/formStyles';

export interface SelectOption {
  value: string | number;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  hint?: string;
  options: SelectOption[];
  placeholder?: string;
}

// Select needs appearance-none + extra right padding for the chevron icon,
// so we compose on top of the shared INPUT_CLASS constant.
const SELECT_BASE = INPUT_CLASS + ' appearance-none pr-9';
const SELECT_ERROR = INPUT_ERROR_CLASS + ' appearance-none pr-9';

const Select = memo(
  forwardRef<HTMLSelectElement, SelectProps>(function Select(
    { label, error, hint, options, placeholder, className, id, ...rest },
    ref,
  ) {
    const selectId = id ?? (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);
    const base = error ? SELECT_ERROR : SELECT_BASE;

    return (
      <div className="flex flex-col gap-1 w-full">
        {label && (
          <label htmlFor={selectId} className={FIELD_LABEL_CLASS}>
            {label}
          </label>
        )}

        <div className="relative">
          <select
            ref={ref}
            id={selectId}
            className={[base, 'cursor-pointer', className ?? ''].join(' ')}
            aria-invalid={!!error}
            {...rest}
          >
            {placeholder && (
              <option value="" disabled>
                {placeholder}
              </option>
            )}
            {options.map((opt) => (
              <option key={opt.value} value={opt.value} disabled={opt.disabled}>
                {opt.label}
              </option>
            ))}
          </select>

          {/* Custom chevron — pointer-events-none so clicks pass through */}
          <span className="absolute inset-y-0 right-0 flex items-center pr-3 text-text/50 pointer-events-none">
            <ChevronDown size={16} />
          </span>
        </div>

        {error && <p className="text-xs text-red-500 mt-0.5">{error}</p>}
        {!error && hint && <p className="text-xs text-text/50 mt-0.5">{hint}</p>}
      </div>
    );
  }),
);

export default Select;
