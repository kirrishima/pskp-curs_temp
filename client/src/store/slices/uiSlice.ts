import { createSlice, PayloadAction } from '@reduxjs/toolkit';

// ─── Types ───────────────────────────────────────────────────────────────────

/**
 * Each modal is identified by a unique string key.
 * Payload data for a given modal is stored as `unknown` and narrowed
 * by the component that reads it.
 */
export interface ModalState {
  isOpen: boolean;
  payload?: unknown;
}

interface UiState {
  modals: Record<string, ModalState>;
  globalLoading: boolean;
  // Add other global UI flags here as needed
}

// ─── Initial state ───────────────────────────────────────────────────────────

const initialState: UiState = {
  modals: {},
  globalLoading: false,
};

// ─── Slice ───────────────────────────────────────────────────────────────────

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    openModal(state, action: PayloadAction<{ key: string; payload?: unknown }>) {
      state.modals[action.payload.key] = {
        isOpen:  true,
        payload: action.payload.payload,
      };
    },

    closeModal(state, action: PayloadAction<string>) {
      const modal = state.modals[action.payload];
      if (modal) modal.isOpen = false;
    },

    // Convenience: close every open modal at once
    closeAllModals(state) {
      Object.keys(state.modals).forEach((key) => {
        state.modals[key].isOpen = false;
      });
    },

    setGlobalLoading(state, action: PayloadAction<boolean>) {
      state.globalLoading = action.payload;
    },
  },
});

export const { openModal, closeModal, closeAllModals, setGlobalLoading } = uiSlice.actions;
export default uiSlice.reducer;
