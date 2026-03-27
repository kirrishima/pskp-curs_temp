import api from './axiosInstance';
import type { Hotel, Room, Service, RoomServiceEntry, RoomImage, PaginationInfo } from '@/types';

// ── Hotels ──────────────────────────────────────────────────────────────────

export async function getHotels(): Promise<{ hotels: Hotel[] }> {
  const { data } = await api.get('/hotels');
  return data;
}

export async function getHotel(hotelCode: string): Promise<{ hotel: Hotel }> {
  const { data } = await api.get(`/hotels/${hotelCode}`);
  return data;
}

export async function getHotelPublic(hotelCode: string): Promise<{ hotel: Hotel & { _count?: { rooms: number } } }> {
  const { data } = await api.get(`/hotels/public/${hotelCode}`);
  return data;
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

export async function getRoom(roomNo: string): Promise<{ room: Room }> {
  const { data } = await api.get(`/rooms/${roomNo}`);
  return data;
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

export async function getServices(): Promise<{ services: Service[] }> {
  const { data } = await api.get('/services');
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
