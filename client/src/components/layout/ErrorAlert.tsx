import React, { memo } from 'react';
import { AlertCircle } from 'lucide-react';

interface ErrorAlertProps {
  error: { status?: string; message: string } | string | null;
  className?: string;
}

const ErrorAlert = memo(function ErrorAlert({ error, className }: ErrorAlertProps) {
  if (!error) return null;

  const message = typeof error === 'string' ? error : error.message;
  const status  = typeof error === 'object' ? error.status : undefined;

  return (
    <div
      className={[
        'bg-red-50 text-red-800 p-4 rounded-md border border-red-200 flex items-start gap-3',
        'animate-slide-top',
        className ?? '',
      ].join(' ')}
      role="alert"
    >
      <AlertCircle className="mt-0.5 flex-shrink-0" size={20} aria-hidden="true" />
      <div className="flex flex-col gap-0.5">
        {status && (
          <p className="font-bold text-xs uppercase tracking-wide opacity-70">{status}</p>
        )}
        <p className="text-sm font-medium">{message}</p>
      </div>
    </div>
  );
});

export default ErrorAlert;
