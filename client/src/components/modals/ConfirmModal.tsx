import React, { memo } from 'react';
import Modal from './Modal';
import Button from '@/components/ui/Button';

export interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  isLoading?: boolean;
  /** Changes confirm button to danger variant */
  isDangerous?: boolean;
}

const ConfirmModal = memo(function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Подтвердить',
  cancelText  = 'Отмена',
  isLoading   = false,
  isDangerous = false,
}: ConfirmModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      disableBackdropClose={isLoading}
      footer={
        <>
          <Button variant="tertiary" disabled={isLoading} onClick={onClose}>
            {cancelText}
          </Button>
          <Button
            variant={isDangerous ? 'danger' : 'primary'}
            isLoading={isLoading}
            onClick={onConfirm}
          >
            {confirmText}
          </Button>
        </>
      }
    >
      <div className="text-text/80">{message}</div>
    </Modal>
  );
});

export default ConfirmModal;
