import React, { memo } from 'react';
import { AlertCircle, CheckCircle, Info } from 'lucide-react';
import Modal from './Modal';
import Button from '@/components/ui/Button';

export type AlertType = 'info' | 'success' | 'error';

const ALERT_CONFIG: Record<AlertType, { icon: React.ReactNode; color: string }> = {
  info:    { icon: <Info    size={20} />, color: 'text-blue-500'  },
  success: { icon: <CheckCircle size={20} />, color: 'text-green-500' },
  error:   { icon: <AlertCircle size={20} />, color: 'text-red-500'   },
};

export interface AlertModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message: React.ReactNode;
  type?: AlertType;
  closeText?: string;
}

const AlertModal = memo(function AlertModal({
  isOpen,
  onClose,
  title,
  message,
  type      = 'info',
  closeText = 'OK',
}: AlertModalProps) {
  const { icon, color } = ALERT_CONFIG[type];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      footer={
        <Button variant="primary" onClick={onClose}>
          {closeText}
        </Button>
      }
    >
      <div className="flex items-start gap-3">
        <span className={['mt-0.5 flex-shrink-0', color].join(' ')} aria-hidden="true">
          {icon}
        </span>
        <div className="text-text/80">{message}</div>
      </div>
    </Modal>
  );
});

export default AlertModal;
