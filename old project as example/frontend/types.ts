export interface User {
  username: string;
  fullName: string;
  email: string;
  roleId: number;
  phone?: string;
  accountStatus?: string;
  createdAt?: string;
}

export interface Role {
  roleId: number;
  roleName: string;
  description?: string;
}

export interface Hotel {
  hotelCode: string;
  name: string;
  description: string;
  city: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  createdAt: string;
}

export interface RoomService {
  serviceCode: string;
  title: string;
  description: string;
}

export interface Room {
  roomNo: string;
  hotelCode: string;
  hotelName?: string;
  title: string;
  capacity: number;
  floor: number;
  status: 'AVAILABLE' | 'BOOKED' | 'MAINTENANCE';
  basePrice: number;
  description: string;
  mainImage?: string; // Main image URL from DB
  images?: { url: string; isMain: boolean; uploadedAt: string }[] | RoomImage[]; // Additional images
  imageUrl?: string | null; // Legacy/Fallback
  services?: RoomService[]; // New field for amenities
}

export interface RoomImage {
  imageId: number;
  imageUrl: string;
  roomNo: string | null;
  uploadedAt: Date;
}

export interface Booking {
  bookingId: string;
  username: string;
  roomNo: string;
  roomTitle?: string;
  startDate: string; // ISO Date
  endDate: string;   // ISO Date
  status: 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'CHECKED_IN' | 'CHECKED_OUT'
  totalAmount: number;
  createdAt: string;
  roomSnapshot?: Room; // Optional: full room details attached to booking
  notes?: string;
}

export interface CleaningTask {
  taskId: number;
  roomNo: string;
  scheduledDate: string; // ISO Date
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'SKIPPED';
  taskType: string; // e.g., 'DAILY', 'DEEP', 'CHECKOUT'
  assignedTo?: string;
  notes?: string;
}

export interface CleaningScheduleItem {
  roomNo: string;
  scheduledDate: string; // YYYY-MM-DD
  assignedTo?: string;
  status: string; // 'SCHEDULED', 'COMPLETED', etc.
  notes?: string;
}

export interface Review {
  reviewId: number;
  username: string;
  roomNo: string;
  rating: number;
  title: string;
  content: string;
  createdAt: string;
  avatarUrl?: string;
  bookingId?: string;
}

export interface DbResponse<T> {
  status: 'OK' | 'ALREADY_EXISTS' | 'NOT_FOUND' | 'INVALID_INPUT' | 'INVALID_LOGIN' | 'FORBIDDEN' | 'DB_ERROR' | 'ALREADY_CANCELLED' | 'VALIDATION_ERROR' | string;
  message: string;
  data?: T;
}


export interface Payment {
  paymentId: number;
  bookingId: string;
  amount: number;
  paymentDate: string; // ISO Date
  paymentMethod: string;
  status: string;
}

export interface PaymentDetails {
  isPaid: boolean | null;
  payments: Payment[];
}