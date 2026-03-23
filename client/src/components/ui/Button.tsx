import React, { memo } from 'react';

// ─── Variants ────────────────────────────────────────────────────────────────

export type ButtonVariant = 'primary' | 'secondary' | 'tertiary' | 'danger' | 'warning' | 'ghost';
export type ButtonSize    = 'sm' | 'md' | 'lg';

const VARIANT_STYLES: Record<ButtonVariant, string> = {
  primary:   'bg-primary text-white hover:bg-secondary',
  secondary: 'bg-secondary text-text hover:opacity-80',
  tertiary:  'bg-ui text-text border border-gray-200 hover:bg-gray-200',
  danger:    'bg-red-500 text-white hover:bg-red-600',
  warning:   'bg-amber-500 text-white hover:bg-amber-600',
  ghost:     'bg-transparent text-text hover:bg-ui',
};

const SIZE_STYLES: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-6 py-3 text-base',
  lg: 'px-8 py-4 text-lg',
};

const BASE =
  'inline-flex items-center justify-center rounded-md font-medium transition-all duration-200 ' +
  'disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50';

// ─── Spinner ─────────────────────────────────────────────────────────────────

const SpinnerIcon = () => (
  <svg
    className="animate-spin -ml-1 mr-2 h-4 w-4 text-current"
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    aria-hidden="true"
  >
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path
      className="opacity-75"
      fill="currentColor"
      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
    />
  </svg>
);

// ─── Props ───────────────────────────────────────────────────────────────────

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
}

// ─── Component ───────────────────────────────────────────────────────────────

const Button = memo(function Button({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  icon,
  iconPosition = 'left',
  disabled,
  className,
  ...rest
}: ButtonProps) {
  const classes = [BASE, VARIANT_STYLES[variant], SIZE_STYLES[size], className ?? '']
    .join(' ')
    .trim();

  return (
    <button className={classes} disabled={disabled || isLoading} {...rest}>
      {isLoading && <SpinnerIcon />}
      {!isLoading && icon && iconPosition === 'left' && (
        <span className={children ? 'mr-2 flex items-center' : 'flex items-center'}>{icon}</span>
      )}
      {children}
      {!isLoading && icon && iconPosition === 'right' && (
        <span className={children ? 'ml-2 flex items-center' : 'flex items-center'}>{icon}</span>
      )}
    </button>
  );
});

export default Button;
