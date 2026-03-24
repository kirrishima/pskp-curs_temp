// ─── Role ────────────────────────────────────────────────────────────────────

export interface Role {
  id: string;
  name: 'user' | 'manager' | 'admin';
}

// ─── Auth ────────────────────────────────────────────────────────────────────

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  roleId: string;
  role: Role;

  // Optional profile fields
  phone?: string | null;
  birthDate?: string | null;
  gender?: 'male' | 'female' | 'other' | null;
  citizenship?: string | null;
  displayName?: string | null;

  createdAt?: string;
  updatedAt?: string;
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
