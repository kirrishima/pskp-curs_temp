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

  isBlocked?: boolean;

  createdAt?: string;
  updatedAt?: string;
}

// Extended user type returned by /api/users (admin endpoints)
export interface AdminUser extends User {
  isBlocked: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: { bookings: number };
}

export interface UsersPagination {
  page: number;
  limit: number;
  totalCount: number;
  totalPages: number;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

// ─── Hotel Image ────────────────────────────────────────────────────────────

export interface HotelImage {
  imageId:    string;
  hotelCode:  string;
  ext:        string;
  isMain:     boolean;
  uploadedAt: string;
}

// ─── Hotel ──────────────────────────────────────────────────────────────────

export interface Hotel {
  hotelCode: string;
  name: string;
  description?: string | null;
  tagline?: string | null;
  aboutText?: string | null;
  imagesBase?: string;
  city?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  stars?: number | null;
  latitude?: number | null;
  longitude?: number | null;
  createdAt?: string;
  images?: HotelImage[];
  averageRating?: number | null;
  totalReviews?: number;
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
  imagesBase?: string;
  images?: RoomImage[];
  roomServices?: RoomServiceEntry[];
}

export interface RoomImage {
  imageId: string;
  roomNo: string;
  ext: string;
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

export type BookingStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'CANCELLED'
  | 'CHECKED_IN'
  | 'CHECKED_OUT'
  | 'NO_SHOW';

export type CancellationSource = 'GUEST' | 'ADMIN' | 'HOTEL' | 'SYSTEM';

export type RefundStatus =
  | 'NONE'
  | 'FULL'
  | 'PARTIAL'
  | 'PENDING'
  | 'FAILED'
  | 'ACTION_REQUIRED';

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

  // Cancellation fields
  cancelledAt?: string | null;
  cancelledByUserId?: string | null;
  cancellationSource?: CancellationSource | null;
  cancellationReason?: string | null;
  penaltyAmount?: number | null;
  refundStatus: RefundStatus;

  room?: Room;
  hold?: { holdId: string; status: string; expiresAt: string; startDate?: string; endDate?: string; createdAt?: string };
  payment?: Payment;
  bookingServices?: BookingServiceEntry[];

  // Staff-only: guest info attached by the server
  user?: { id: string; firstName: string; lastName: string; email: string; phone?: string | null };
}

export interface BookingsPagination {
  page: number;
  limit: number;
  totalCount: number;
  totalPages: number;
}

export interface BookingServiceEntry {
  bookingId: string;
  serviceCode: string;
  sourceState: RoomServiceState;
  priceSnapshot: number;
  service?: { serviceCode: string; title: string; priceType: ServicePriceType; icon?: string | null; iconUrl?: string | null };
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

  // Stripe audit trail (BR-S3)
  stripeChargeId?: string | null;
  stripeRefundId?: string | null;
  stripeRefundStatus?: string | null;
  refundAmount?: number | null;
}

// ─── Review ──────────────────────────────────────────────────────────────────

export interface ReviewImage {
  imageId:    string;
  reviewId:   string;
  ext:        string;
  uploadedAt: string;
}

export interface Review {
  reviewId:   string;
  bookingId:  string;
  userId:     string;
  roomNo:     string;
  rating:     number;
  text:       string | null;
  authorName: string;
  imagesBase?: string;
  images:     ReviewImage[];
  room?: {
    roomNo:    string;
    title:     string;
    hotelCode: string;
    hotel?:    { hotelCode: string; name: string };
  };
  createdAt:  string;
  updatedAt:  string;
}

export interface ReviewsPagination {
  page:       number;
  limit:      number;
  totalCount: number;
  totalPages: number;
}

export interface ReviewsStats {
  averageRating: number | null;
  totalReviews:  number;
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
