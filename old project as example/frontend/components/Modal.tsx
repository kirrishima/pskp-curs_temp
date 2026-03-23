
import React from 'react';
import { X } from 'lucide-react';
import Button, { ButtonVariant } from './Button';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidthClass?: string;
}

export default function Modal({ isOpen, onClose, title, children, footer, maxWidthClass = 'max-w-md' }: ModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity" 
        onClick={onClose}
      ></div>

      {/* Content */}
      <div className={`relative bg-white rounded-xl shadow-2xl ${maxWidthClass} w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200`}>
        <div className="flex justify-between items-center p-6 border-b border-gray-100">
          <h3 className="text-xl font-serif font-bold text-text">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-text transition-colors">
            <X size={24} />
          </button>
        </div>
        
        <div className="p-6 text-text/80">
          {children}
        </div>

        {footer && (
          <div className="p-6 bg-ui/30 border-t border-gray-100 flex justify-end gap-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isLoading?: boolean;
}

export function ConfirmModal({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title, 
  message, 
  confirmText = "Подтвердить", 
  cancelText = "Отмена",
  isLoading = false
}: ConfirmModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      footer={
        <>
          <Button 
            text={cancelText} 
            variant={ButtonVariant.Tertiary} 
            onClick={onClose}
            disabled={isLoading}
          />
          <Button 
            text={confirmText} 
            variant={ButtonVariant.Primary} 
            onClick={onConfirm}
            isLoading={isLoading}
          />
        </>
      }
    >
      <p>{message}</p>
    </Modal>
  );
}

interface AlertModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message: string;
}

export function AlertModal({ isOpen, onClose, title, message }: AlertModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      footer={
        <Button text="OK" variant={ButtonVariant.Primary} onClick={onClose} />
      }
    >
      <p>{message}</p>
    </Modal>
  );
}