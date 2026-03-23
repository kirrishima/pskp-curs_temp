import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { User, AuthTokens } from '@/types';

// ─── State ───────────────────────────────────────────────────────────────────

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isInitialized: boolean; // true after initial hydration from storage
}

// Hydrate from localStorage once at module load (avoids re-reading on every render)
function loadFromStorage(): Pick<AuthState, 'user' | 'accessToken' | 'refreshToken'> {
  try {
    return {
      user:         JSON.parse(localStorage.getItem('auth_user') ?? 'null'),
      accessToken:  localStorage.getItem('auth_access_token'),
      refreshToken: localStorage.getItem('auth_refresh_token'),
    };
  } catch {
    return { user: null, accessToken: null, refreshToken: null };
  }
}

const initialState: AuthState = {
  ...loadFromStorage(),
  isInitialized: true,
};

// ─── Slice ───────────────────────────────────────────────────────────────────

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    // Called after a successful login
    loginSuccess(state, action: PayloadAction<{ user: User; tokens: AuthTokens }>) {
      const { user, tokens } = action.payload;
      state.user         = user;
      state.accessToken  = tokens.accessToken;
      state.refreshToken = tokens.refreshToken;

      localStorage.setItem('auth_user',          JSON.stringify(user));
      localStorage.setItem('auth_access_token',  tokens.accessToken);
      localStorage.setItem('auth_refresh_token', tokens.refreshToken);
    },

    // Called by the Axios response interceptor after a successful token refresh
    tokenRefreshed(state, action: PayloadAction<AuthTokens>) {
      state.accessToken  = action.payload.accessToken;
      state.refreshToken = action.payload.refreshToken;

      localStorage.setItem('auth_access_token',  action.payload.accessToken);
      localStorage.setItem('auth_refresh_token', action.payload.refreshToken);
    },

    // Called on logout or after a failed refresh
    logout(state) {
      state.user         = null;
      state.accessToken  = null;
      state.refreshToken = null;

      localStorage.removeItem('auth_user');
      localStorage.removeItem('auth_access_token');
      localStorage.removeItem('auth_refresh_token');
    },

    // Update user profile data without touching tokens
    updateUser(state, action: PayloadAction<Partial<User>>) {
      if (state.user) {
        state.user = { ...state.user, ...action.payload };
        localStorage.setItem('auth_user', JSON.stringify(state.user));
      }
    },
  },
});

export const { loginSuccess, tokenRefreshed, logout, updateUser } = authSlice.actions;
export default authSlice.reducer;
