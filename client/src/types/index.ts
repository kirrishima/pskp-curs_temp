// ─── Auth ────────────────────────────────────────────────────────────────────

export interface User {
  id: number;
  username: string;
  fullName: string;
  email: string;
  roleId: number;
  phone?: string;
  accountStatus?: string;
  createdAt?: string;
}

// Tokens returned by the server on login / refresh
export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

// ─── API response wrapper ────────────────────────────────────────────────────

export type ApiStatus =
  | 'OK'
  | 'CREATED'
  | 'NOT_FOUND'
  | 'ALREADY_EXISTS'
  | 'INVALID_INPUT'
  | 'INVALID_LOGIN'
  | 'FORBIDDEN'
  | 'UNAUTHORIZED'
  | 'VALIDATION_ERROR'
  | 'SERVER_ERROR'
  | string;

export interface ApiResponse<T = unknown> {
  status: ApiStatus;
  message: string;
  data?: T;
}
