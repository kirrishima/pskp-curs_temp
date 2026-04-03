import api from './axiosInstance';
import type { Hotel, Room, Service, RoomServiceEntry, RoomImage, PaginationInfo, BookingsPagination, AdminUser, UsersPagination, Review, ReviewsPagination, ReviewsStats } from '@/types';

// ── Module-level promise cache ───────────────────────────────────────────────
// Caches the promise itself (not just the resolved value) so that concurrent
// callers — including React 18 StrictMode's intentional double-mount — share
// a single in-flight request and receive the same result without extra round
// trips to the server.  Entries expire after CACHE_TTL_MS milliseconds so
// data stays reasonably fresh across navigation within a session.

interface CacheEntry<T> {
  promise: Promise<T>;
  expiresAt: number;
}

const _cache = new Map<string, CacheEntry<unknown>>();
const CACHE_TTL_MS = 5000; /* * 60 * 1000 */ // 3 secs

function withCache<T>(key: string, fetcher: () => Promise<T>, ttl = CACHE_TTL_MS): Promise<T> {
  const now = Date.now();
  const entry = _cache.get(key);
  if (entry && entry.expiresAt > now) {
    return entry.promise as Promise<T>;
  }
  const promise = fetcher().catch((err: unknown) => {
    // Remove failed entry so the next caller retries instead of reusing a
    // rejected promise indefinitely.
    _cache.delete(key);
    throw err;
  });
  _cache.set(key, { promise, expiresAt: now + ttl });
  return promise;
}

/** Manually invalidate a cached entry (e.g. after a mutation). */
export function invalidateCache(key: string): void {
  _cache.delete(key);
}

// ── Hotels ──────────────────────────────────────────────────────────────────

export async function getHotels(): Promise<{ hotels: Hotel[] }> {
  const { data } = await api.get('/hotels');
  return data;
}

export async function getHotel(hotelCode: string): Promise<{ hotel: Hotel }> {
  const { data } = await api.get(`/hotels/${hotelCode}`);
  return data;
}

export function getHotelPublic(
  hotelCode: string,
): Promise<{ hotel: Hotel & { _count?: { rooms: number } } }> {
  return withCache(`hotel:public:${hotelCode}`, () =>
    api.get(`/hotels/public/${hotelCode}`).then((r) => r.data),
  );
}

export async function createHotel(payload: Partial<Hotel>): Promise<{ hotel: Hotel }> {
  const { data } = await api.post('/hotels', payload);
  return data;
}

export async function updateHotel(hotelCode: string, payload: Partial<Hotel>): Promise<{ hotel: Hotel }> {
  const { data } = await api.patch(`/hotels/${hotelCode}`, payload);
  return data;
}

export async function deleteHotel(hotelCode: string): Promise<{ message: string }> {
  const { data } = await api.delete(`/hotels/${hotelCode}`);
  return data;
}

// ── Rooms ───────────────────────────────────────────────────────────────────

export interface RoomSearchParams {
  checkIn: string;
  checkOut: string;
  hotelCode?: string;
  floor?: number | string;
  title?: string;
  /** Exact roomNo match — filters the search to a single room (used for availability checks). */
  roomNo?: string;
  minPrice?: number | string;
  maxPrice?: number | string;
  minBeds?: number | string;
  maxBeds?: number | string;
  minCapacity?: number | string;
  maxCapacity?: number | string;
  minArea?: number | string;
  maxArea?: number | string;
  services?: string; // comma-separated
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  cursor?: string;
  limit?: number;
}

export interface RoomSearchResult {
  rooms: Room[];
  pagination: PaginationInfo;
}

export async function searchRooms(params: RoomSearchParams): Promise<RoomSearchResult> {
  // Remove empty/undefined params
  const query: Record<string, string> = {};
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      query[key] = String(value);
    }
  }
  const { data } = await api.get('/rooms/search', { params: query });
  return data;
}

export function getRoom(roomNo: string): Promise<{ room: Room }> {
  return withCache(`room:${roomNo}`, () =>
    api.get(`/rooms/${roomNo}`).then((r) => r.data),
  );
}

export async function createRoom(payload: Partial<Room>): Promise<{ room: Room }> {
  const { data } = await api.post('/rooms', payload);
  return data;
}

export async function updateRoom(roomNo: string, payload: Partial<Room>): Promise<{ room: Room }> {
  const { data } = await api.patch(`/rooms/${roomNo}`, payload);
  return data;
}

export async function deleteRoom(roomNo: string): Promise<{ message: string }> {
  const { data } = await api.delete(`/rooms/${roomNo}`);
  return data;
}

// ── Room Images ─────────────────────────────────────────────────────────────

export async function uploadRoomImages(
  roomNo: string,
  files: File[],
  isMain = false
): Promise<{ images: RoomImage[] }> {
  const formData = new FormData();
  files.forEach((f) => formData.append('images', f));
  if (isMain) formData.append('isMain', 'true');

  const { data } = await api.post(`/uploads/rooms/${roomNo}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}

export async function deleteRoomImage(roomNo: string, imageId: number): Promise<{ message: string }> {
  const { data } = await api.delete(`/uploads/rooms/${roomNo}/${imageId}`);
  return data;
}

// ── Services ────────────────────────────────────────────────────────────────

export function getServices(): Promise<{ services: Service[] }> {
  return withCache('services:all', () => api.get('/services').then((r) => r.data));
}

/**
 * Admin-only: returns ALL services, including inactive ones.
 * Results are intentionally not cached so the admin panel always sees live data.
 */
export async function getAllServicesAdmin(): Promise<{ services: Service[] }> {
  const { data } = await api.get('/services/all');
  return data;
}

export async function getService(serviceCode: string): Promise<{ service: Service }> {
  const { data } = await api.get(`/services/${serviceCode}`);
  return data;
}

export async function createService(payload: Partial<Service>): Promise<{ service: Service }> {
  const { data } = await api.post('/services', payload);
  return data;
}

export async function updateService(
  serviceCode: string,
  payload: Partial<Service>
): Promise<{ service: Service }> {
  const { data } = await api.patch(`/services/${serviceCode}`, payload);
  return data;
}

export async function deleteService(serviceCode: string): Promise<{ message: string }> {
  const { data } = await api.delete(`/services/${serviceCode}`);
  return data;
}

export async function uploadServiceIcon(
  serviceCode: string,
  file: File
): Promise<{ service: Service }> {
  const formData = new FormData();
  formData.append('icon', file);
  const { data } = await api.post(`/uploads/services/${serviceCode}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}

// ── Room-Services ───────────────────────────────────────────────────────────

export async function getRoomServices(roomNo: string): Promise<{ roomServices: RoomServiceEntry[] }> {
  const { data } = await api.get(`/room-services/${roomNo}`);
  return data;
}

export async function addRoomService(
  roomNo: string,
  serviceCode: string,
  defaultState: string
): Promise<{ roomService: RoomServiceEntry }> {
  const { data } = await api.post(`/room-services/${roomNo}`, { serviceCode, defaultState });
  return data;
}

export async function updateRoomService(
  roomNo: string,
  serviceCode: string,
  defaultState: string
): Promise<{ roomService: RoomServiceEntry }> {
  const { data } = await api.patch(`/room-services/${roomNo}/${serviceCode}`, { defaultState });
  return data;
}

export async function removeRoomService(
  roomNo: string,
  serviceCode: string
): Promise<{ message: string }> {
  const { data } = await api.delete(`/room-services/${roomNo}/${serviceCode}`);
  return data;
}

export async function bulkSetRoomServices(
  roomNo: string,
  services: Array<{ serviceCode: string; defaultState: string }>
): Promise<{ roomServices: RoomServiceEntry[] }> {
  const { data } = await api.put(`/room-services/${roomNo}`, { services });
  return data;
}

// ── Payments / Bookings ──────────────────────────────────────────────────────

export interface CreatePaymentIntentParams {
  roomNo: string;
  checkIn: string;
  checkOut: string;
  selectedServices?: Record<string, boolean>;
  notes?: string;
  currency?: string;
}

export interface CreatePaymentIntentResult {
  bookingId: string;
  holdId: string;
  paymentId: string;
  clientSecret: string;
  totalAmount: number;
  currency: string;
  nights: number;
  services: Array<{ serviceCode: string; sourceState: string; priceSnapshot: number }>;
  /** ISO timestamp until which the hold is active. Falls back to 5 min if absent. */
  expiresAt?: string;
}

export async function createPaymentIntent(
  params: CreatePaymentIntentParams,
): Promise<CreatePaymentIntentResult> {
  const { data } = await api.post('/payments/create-intent', params);
  return data;
}

export async function getBooking(
  bookingId: string,
): Promise<import('@/types').Booking> {
  const { data } = await api.get(`/payments/${bookingId}`);
  return data.booking;
}

export async function cancelBooking(bookingId: string): Promise<{ message: string }> {
  const { data } = await api.post(`/payments/cancel/${bookingId}`);
  return data;
}

export async function getStripeConfig(): Promise<{ stripePublishableKey: string }> {
  const { data } = await api.get('/payments/config');
  return data;
}

/**
 * Checks whether a specific room is available for the given date range.
 * Passes the roomNo as an exact filter so the backend returns at most one
 * record instead of fetching the entire hotel's room list.
 */
export async function checkRoomAvailability(
  roomNo: string,
  checkIn: string,
  checkOut: string,
  hotelCode: string,
): Promise<boolean> {
  const result = await searchRooms({ checkIn, checkOut, hotelCode, roomNo, limit: 1 });
  return result.rooms.length > 0;
}

// ── Bookings ─────────────────────────────────────────────────────────────────

export interface GetBookingsParams {
  status?: string;
  /** Admin/manager only: filter by a specific user's bookings. */
  userId?: string;
  /** Page number (1-based). */
  page?: number;
  /** Items per page. */
  limit?: number;
  /** Search by booking ID fragment. */
  search?: string;
  /** Filter by check-in date from (ISO string). */
  dateFrom?: string;
  /** Filter by check-out date to (ISO string). */
  dateTo?: string;
  /** Sort field. */
  sortBy?: string;
  /** Sort direction. */
  sortOrder?: 'asc' | 'desc';
}

export interface CancelBookingParams {
  source: 'GUEST' | 'ADMIN' | 'HOTEL';
  /** Admin only: whether to apply a 1-night penalty. */
  applyPenalty?: boolean;
  /** Required when source=ADMIN, optional otherwise. */
  reason?: string;
}

export interface CancelBookingResult {
  message: string;
  refundAmount: number;
  penaltyAmount: number;
  refundStatus: string;
}

export async function getMyBookings(
  params?: GetBookingsParams,
  signal?: AbortSignal,
): Promise<{ bookings: import('@/types').Booking[]; pagination?: BookingsPagination }> {
  const { data } = await api.get('/bookings', { params, signal });
  return data;
}

export async function getBookingById(
  bookingId: string,
  signal?: AbortSignal,
): Promise<{ booking: import('@/types').Booking }> {
  const { data } = await api.get(`/bookings/${bookingId}`, { signal });
  return data;
}

export async function cancelBookingWithRefund(
  bookingId: string,
  params: CancelBookingParams,
): Promise<CancelBookingResult> {
  const { data } = await api.post(`/bookings/${bookingId}/cancel`, params);
  return data;
}

// ── Admin: User management ───────────────────────────────────────────────────

export interface GetUsersParams {
  page?: number;
  limit?: number;
  search?: string;
  role?: string;
  status?: 'active' | 'blocked' | '';
}

export interface GetUsersResult {
  users: AdminUser[];
  pagination: UsersPagination;
}

export async function getUsers(params: GetUsersParams = {}, signal?: AbortSignal): Promise<GetUsersResult> {
  const p: Record<string, string | number> = {};
  if (params.page)   p.page  = params.page;
  if (params.limit)  p.limit = params.limit;
  if (params.search) p.search = params.search;
  if (params.role)   p.role   = params.role;
  if (params.status) p.status = params.status;
  const { data } = await api.get('/users', { params: p, signal });
  return data;
}

export async function getAdminUser(userId: string): Promise<{ user: AdminUser }> {
  const { data } = await api.get(`/users/${userId}`);
  return data;
}

export async function blockUser(userId: string): Promise<{ user: AdminUser }> {
  const { data } = await api.patch(`/users/${userId}/block`);
  return data;
}

export async function unblockUser(userId: string): Promise<{ user: AdminUser }> {
  const { data } = await api.patch(`/users/${userId}/unblock`);
  return data;
}

export async function changeUserRole(userId: string, roleName: string): Promise<{ user: AdminUser }> {
  const { data } = await api.patch(`/users/${userId}/role`, { roleName });
  return data;
}

// ── Reviews ──────────────────────────────────────────────────────────────────

export interface ReviewsResult {
  reviews:    Review[];
  pagination: ReviewsPagination;
  stats:      ReviewsStats;
}

export async function getRoomReviews(
  roomNo: string,
  params: { page?: number; limit?: number } = {},
  signal?: AbortSignal,
): Promise<ReviewsResult> {
  const { data } = await api.get(`/reviews/room/${encodeURIComponent(roomNo)}`, { params, signal });
  return data;
}

export async function getHotelReviews(
  hotelCode: string,
  params: { page?: number; limit?: number } = {},
  signal?: AbortSignal,
): Promise<ReviewsResult> {
  const { data } = await api.get(`/reviews/hotel/${encodeURIComponent(hotelCode)}`, { params, signal });
  return data;
}

export async function getBookingReview(bookingId: string): Promise<{ review: Review }> {
  const { data } = await api.get(`/reviews/booking/${bookingId}`);
  return data;
}

export async function createReview(payload: {
  bookingId: string;
  rating: number;
  text?: string;
}): Promise<{ review: Review }> {
  const { data } = await api.post('/reviews', payload);
  return data;
}

export async function updateReview(
  reviewId: string,
  payload: { rating?: number; text?: string },
): Promise<{ review: Review }> {
  const { data } = await api.patch(`/reviews/${reviewId}`, payload);
  return data;
}

export async function deleteReview(reviewId: string): Promise<void> {
  await api.delete(`/reviews/${reviewId}`);
}

export async function uploadReviewImages(
  bookingId: string,
  formData: FormData,
): Promise<{ images: { imageId: string; reviewId: string; imageUrl: string; uploadedAt: string }[] }> {
  const { data } = await api.post(`/uploads/reviews/${bookingId}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}

export async function deleteReviewImage(bookingId: string, imageId: string): Promise<void> {
  await api.delete(`/uploads/reviews/${bookingId}/${imageId}`);
}
