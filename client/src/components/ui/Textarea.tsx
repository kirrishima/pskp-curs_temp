import React, { memo, forwardRef } from 'react';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
}

const BASE =
  'w-full bg-white border rounded-md text-text placeholder-text/40 text-sm px-3 py-2.5 ' +
  'transition-colors duration-150 resize-y min-h-[80px] ' +
  'focus:outline-none ' +
  'disabled:opacity-50 disabled:cursor-not-allowed';

const Textarea = memo(
  forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
    { label, error, hint, className, id, ...rest },
    ref,
  ) {
    const areaId   = id ?? (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);
    const border   = error
      ? 'border-red-400 focus:border-red-500 focus:ring-[3px] focus:ring-red-400/20'
      : 'border-gray-200 focus:border-primary focus:ring-[3px] focus:ring-primary/20';

    return (
      <div className="flex flex-col gap-1 w-full">
        {label && (
          <label htmlFor={areaId} className="text-sm font-medium text-text/80">
            {label}
          </label>
        )}

        <textarea
          ref={ref}
          id={areaId}
          className={[BASE, border, className ?? ''].join(' ')}
          aria-invalid={!!error}
          {...rest}
        />

        {error && <p className="text-xs text-red-500 mt-0.5">{error}</p>}
        {!error && hint && <p className="text-xs text-text/50 mt-0.5">{hint}</p>}
      </div>
    );
  }),
);

export default Textarea;
