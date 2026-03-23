import React, { memo } from 'react';

export type BadgeVariant = 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'info';

const VARIANT_STYLES: Record<BadgeVariant, string> = {
  default: 'bg-ui text-text',
  primary: 'bg-primary/15 text-primary',
  success: 'bg-green-100 text-green-800',
  warning: 'bg-amber-100 text-amber-800',
  danger:  'bg-red-100 text-red-700',
  info:    'bg-blue-100 text-blue-800',
};

export interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  className?: string;
}

const Badge = memo(function Badge({ children, variant = 'default', className }: BadgeProps) {
  return (
    <span
      className={[
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
        VARIANT_STYLES[variant],
        className ?? '',
      ].join(' ')}
    >
      {children}
    </span>
  );
});

export default Badge;
