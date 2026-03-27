import React, { memo, forwardRef } from 'react';
import { INPUT_CLASS, INPUT_ERROR_CLASS, FIELD_LABEL_CLASS } from '@/utils/formStyles';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
}

// Textarea keeps the same visual style as <input> but with resize and min-height.
const TEXTAREA_BASE = INPUT_CLASS + ' resize-y min-h-[80px]';
const TEXTAREA_ERROR = INPUT_ERROR_CLASS + ' resize-y min-h-[80px]';

const Textarea = memo(
  forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
    { label, error, hint, className, id, ...rest },
    ref,
  ) {
    const areaId = id ?? (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);
    const base   = error ? TEXTAREA_ERROR : TEXTAREA_BASE;

    return (
      <div className="flex flex-col gap-1 w-full">
        {label && (
          <label htmlFor={areaId} className={FIELD_LABEL_CLASS}>
            {label}
          </label>
        )}

        <textarea
          ref={ref}
          id={areaId}
          className={[base, className ?? ''].join(' ')}
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
