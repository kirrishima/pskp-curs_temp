import React, { memo, forwardRef } from 'react';
import { ChevronDown } from 'lucide-react';

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

const BASE =
  'w-full appearance-none bg-white border rounded-md text-text text-sm pl-3 pr-9 py-2.5 ' +
  'transition-colors duration-150 cursor-pointer ' +
  'focus:outline-none ' +
  'disabled:opacity-50 disabled:cursor-not-allowed';

const Select = memo(
  forwardRef<HTMLSelectElement, SelectProps>(function Select(
    { label, error, hint, options, placeholder, className, id, ...rest },
    ref,
  ) {
    const selectId = id ?? (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);
    const border   = error
      ? 'border-red-400 focus:border-red-500 focus:ring-[3px] focus:ring-red-400/20'
      : 'border-gray-200 focus:border-primary focus:ring-[3px] focus:ring-primary/20';

    return (
      <div className="flex flex-col gap-1 w-full">
        {label && (
          <label htmlFor={selectId} className="text-sm font-medium text-text/80">
            {label}
          </label>
        )}

        <div className="relative">
          <select
            ref={ref}
            id={selectId}
            className={[BASE, border, className ?? ''].join(' ')}
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
