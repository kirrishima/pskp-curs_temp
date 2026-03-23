import React, { memo, useEffect, useCallback } from 'react';
import { X } from 'lucide-react';
import { createPortal } from 'react-dom';

// ─── Props ───────────────────────────────────────────────────────────────────

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  /** Rendered inside the footer strip (e.g. action buttons) */
  footer?: React.ReactNode;
  /** Tailwind max-width class. Default: "max-w-md" */
  maxWidthClass?: string;
  /** When true, clicking the backdrop does NOT close the modal */
  disableBackdropClose?: boolean;
}

// ─── Component ───────────────────────────────────────────────────────────────

const Modal = memo(function Modal({
  isOpen,
  onClose,
  title,
  children,
  footer,
  maxWidthClass = 'max-w-md',
  disableBackdropClose = false,
}: ModalProps) {
  // Close on Escape key
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose],
  );

  useEffect(() => {
    if (!isOpen) return;
    document.addEventListener('keydown', handleKeyDown);
    // Prevent background scroll while modal is open
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={disableBackdropClose ? undefined : onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        className={[
          'relative bg-white rounded-xl shadow-2xl w-full overflow-hidden',
          'animate-zoom-in-95',
          maxWidthClass,
        ].join(' ')}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h3 id="modal-title" className="text-xl font-semibold text-text">
            {title}
          </h3>
          <button
            onClick={onClose}
            className="text-text/40 hover:text-text transition-colors rounded-full p-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
            aria-label="Закрыть"
          >
            <X size={22} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 text-text/80">{children}</div>

        {/* Footer */}
        {footer && (
          <div className="p-4 bg-ui/30 border-t border-gray-100 flex justify-end gap-3">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
});

export default Modal;
