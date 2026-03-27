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

  phone?: string | null;
  birthDate?: string | null;
  gender?: 'male' | 'female' | 'other' | null;
  citizenship?: string | null;
  displayName?: string | null;

  createdAt?: string;
  updatedAt?: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

// ─── Hotel ──────────────────────────────────────────────────────────────────

export interface Hotel {
  hotelCode: string;
  name: string;
  description?: string | null;
  tagline?: string | null;
  aboutText?: string | null;
  heroImageUrl?: string | null;
  city?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  stars?: number | null;
  latitude?: number | null;
  longitude?: number | null;
  createdAt?: string;
  rooms?: RoomSummary[];
}

export interface RoomSummary {
  roomNo: string;
  title: string;
  capacity: number;
  bedsCount: number;
  floor: number | null;
  basePrice: number;
  status: RoomStatus;
}

// ─── Room ───────────────────────────────────────────────────────────────────

export type RoomStatus = 'ACTIVE' | 'MAINTENANCE' | 'CLOSED';

export interface Room {
  roomNo: string;
  hotelCode: string;
  title: string;
  description?: string | null;
  capacity: number;
  bedsCount: number;
  floor?: number | null;
  area?: number | null;
  basePrice: number;
  status: RoomStatus;
  createdAt?: string;

  hotel?: { hotelCode: string; name: string; city?: string | null };
  images?: RoomImage[];
  roomServices?: RoomServiceEntry[];
}

export interface RoomImage {
  imageId: number;
  roomNo: string;
  imageUrl: string;
  isMain: boolean;
  uploadedAt?: string;
}

// ─── Service ────────────────────────────────────────────────────────────────

export type ServicePriceType = 'PER_NIGHT' | 'ONE_TIME';

export interface Service {
  serviceCode: string;
  title: string;
  description?: string | null;
  basePrice: number;
  priceType: ServicePriceType;
  icon?: string | null;
  iconUrl?: string | null;
  isActive: boolean;
  createdAt?: string;
}

// ─── Room ↔ Service ─────────────────────────────────────────────────────────

export type RoomServiceState = 'INCLUDED' | 'OPTIONAL_ON' | 'OPTIONAL_OFF';

export interface RoomServiceEntry {
  roomNo: string;
  serviceCode: string;
  defaultState: RoomServiceState;
  service: Service;
}

// ─── Booking ────────────────────────────────────────────────────────────────

export type BookingStatus = 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'CHECKED_IN' | 'CHECKED_OUT';

export interface Booking {
  bookingId: string;
  holdId: string;
  userId: string;
  roomNo: string;
  startDate: string;
  endDate: string;
  status: BookingStatus;
  totalAmount: number;
  createdAt: string;
  notes?: string | null;

  room?: Room;
  hold?: { holdId: string; status: string; expiresAt: string };
  payment?: Payment;
  bookingServices?: BookingServiceEntry[];
}

export interface BookingServiceEntry {
  bookingId: string;
  serviceCode: string;
  sourceState: RoomServiceState;
  priceSnapshot: number;
  service?: { serviceCode: string; title: string; priceType: ServicePriceType };
}

// ─── Payment ────────────────────────────────────────────────────────────────

export type PaymentStatus = 'PENDING' | 'SUCCEEDED' | 'FAILED' | 'CANCELLED';

export interface Payment {
  id: string;
  stripePaymentIntentId: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  bookingId: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Pagination ─────────────────────────────────────────────────────────────

export interface PaginationInfo {
  limit: number;
  hasNextPage: boolean;
  nextCursor: string | null;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
}

// ─── API response wrapper ───────────────────────────────────────────────────

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
