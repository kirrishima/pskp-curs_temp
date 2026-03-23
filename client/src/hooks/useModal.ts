import { useCallback } from 'react';
import { createSelector }  from '@reduxjs/toolkit';
import useAppDispatch from './useAppDispatch';
import useAppSelector from './useAppSelector';
import { openModal, closeModal } from '@/store/slices/uiSlice';
import type { RootState } from '@/store';

/**
 * Convenience hook for a single named modal.
 *
 * Usage:
 *   const { isOpen, payload, open, close } = useModal<MyPayload>('deleteConfirm');
 */
export function useModal<TPayload = unknown>(key: string) {
  const dispatch = useAppDispatch();

  // Memoised per-modal selector — avoids re-renders when other modals change
  const selectModal = useCallback(
    createSelector(
      (state: RootState) => state.ui.modals[key],
      (modal) => modal ?? { isOpen: false, payload: undefined },
    ),
    [key],
  );

  const modal = useAppSelector(selectModal);

  const open  = useCallback((payload?: TPayload) => dispatch(openModal({ key, payload })), [dispatch, key]);
  const close = useCallback(() => dispatch(closeModal(key)), [dispatch, key]);

  return {
    isOpen:  modal.isOpen,
    payload: modal.payload as TPayload | undefined,
    open,
    close,
  };
}
