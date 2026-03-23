import React from 'react';
import { AlertCircle } from 'lucide-react';

interface ErrorAlertProps {
  error: { status: string; message: string } | null;
}

export default function ErrorAlert({ error }: ErrorAlertProps) {
  if (!error) return null;
  
  return (
    <div className="bg-red-50 text-red-800 p-4 rounded-md border border-red-200 flex items-start gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
      <AlertCircle className="mt-0.5 flex-shrink-0" size={20} />
      <div className="flex flex-col gap-1">
        <p className="font-bold text-sm uppercase tracking-wide opacity-80">Status: {error.status}</p>
        <p className="font-medium">Message: {error.message}</p>
      </div>
    </div>
  );
}