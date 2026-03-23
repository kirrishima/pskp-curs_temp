import { Booking, CleaningTask, DbResponse, Hotel, Review, Room, User, RoomService, RoomImage, PaymentDetails, Payment, CleaningScheduleItem, Role } from '../types';

// This URL must match where you run your Node.js server (see instructions)
export const API_BASE_URL = 'http://localhost:3001/api';
export const STATIC_IMAGES_URL = 'http://localhost:3001/static/images';

async function handleResponse<T>(response: Response): Promise<DbResponse<T>> {
  try {
    const result = await response.json();
    return result;
  } catch (error) {
    return {
      status: 'DB_ERROR',
      message: 'Не удалось обработать ответ сервера',
    };
  }
}

export const getUserInfo = async (username: string): Promise<DbResponse<User>> => {
  try {
    const res = await fetch(`${API_BASE_URL}/users/${encodeURIComponent(username)}`, {
      credentials: "include" // Important for cookie-based auth check
    });
    return handleResponse<User>(res);
  } catch (err) {
    return { status: 'DB_ERROR', message: 'Ошибка подключения к серверу' };
  }
};

export const authenticateUser = async (username: string, passwordHash: string): Promise<DbResponse<User>> => {
  try {
    const res = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, passwordHash }),
      credentials: "include",
    });
    
    const loginResult = await res.json();

    if (loginResult.status === 'OK') {
      // If the login endpoint returns data directly (old behavior), use it.
      if (loginResult.data) {
        return loginResult;
      }
      
      // New behavior: Login sets cookie, we must fetch user details separately
      return getUserInfo(username);
    }

    return loginResult;
  } catch (err) {
    return { status: 'DB_ERROR', message: 'Ошибка подключения к серверу' };
  }
};

export const registerUser = async (username: string, passwordHash: string, fullName: string, email: string): Promise<DbResponse<null>> => {
  try {
    const res = await fetch(`${API_BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, passwordHash, fullName, email }),
    });
    return handleResponse<null>(res);
  } catch (err) {
    return { status: 'DB_ERROR', message: 'Ошибка подключения к серверу' };
  }
};

// Unified Get Rooms Endpoint
export const getRooms = async (params: {
  roomNo?: string;
  hotelCode?: string;
  startDate?: string;
  endDate?: string;
  status?: string;
  minPrice?: number | string;
  maxPrice?: number | string;
  floor?: number | string;
  capacity?: number | string;
  hasPhoto?: boolean;
  includeImages?: boolean;
  includeServices?: boolean;
  index?: number;
  size?: number;
  title?: string;
}): Promise<DbResponse<Room[]>> => {
  try {
    const query = new URLSearchParams();
    
    // Helper to append only valid params
    const appendIfDefined = (key: string, val: any) => {
      if (val !== undefined && val !== null && val !== '') {
         // Special handling for booleans to 1/0
         if (typeof val === 'boolean') {
             query.append(key, val ? '1' : '0');
         } else {
             query.append(key, String(val));
         }
      }
    };

    appendIfDefined('roomNo', params.roomNo);
    appendIfDefined('hotelCode', params.hotelCode);
    appendIfDefined('startDate', params.startDate);
    appendIfDefined('endDate', params.endDate);
    appendIfDefined('status', params.status);
    appendIfDefined('minPrice', params.minPrice);
    appendIfDefined('maxPrice', params.maxPrice);
    appendIfDefined('floor', params.floor);
    appendIfDefined('capacity', params.capacity);
    appendIfDefined('hasPhoto', params.hasPhoto);
    appendIfDefined('includeImages', params.includeImages);
    appendIfDefined('includeServices', params.includeServices);
    appendIfDefined('index', params.index);
    appendIfDefined('size', params.size);
    appendIfDefined('title', params.title);

    const res = await fetch(`${API_BASE_URL}/room_utils/get_rooms?${query.toString()}`);
    const json = await res.json();

    if (json.status === 'OK') {
        const rooms: Room[] = json.rooms || [];
        const images = json.images || [];
        const services = json.services || [];

        // Map images
        const imagesByRoom = images.reduce((acc: any, img: any) => {
            if (!acc[img.roomNo]) acc[img.roomNo] = [];
            acc[img.roomNo].push({
                imageId: img.imageId,
                imageUrl: img.imageUrl,
                uploadedAt: img.uploadedAt,
                roomNo: img.roomNo
            });
            return acc;
        }, {});

        // Map services
        const servicesByRoom = services.reduce((acc: any, svc: any) => {
            if (!acc[svc.roomNo]) acc[svc.roomNo] = [];
            acc[svc.roomNo].push({
                serviceCode: svc.serviceCode,
                title: svc.title,
                description: svc.description
            });
            return acc;
        }, {});

        // Merge
        const mergedRooms = rooms.map(r => ({
            ...r,
            images: imagesByRoom[r.roomNo] || [],
            services: servicesByRoom[r.roomNo] || []
        }));

        return { status: 'OK', message: json.message, data: mergedRooms };
    }

    return { 
        status: json.status || 'DB_ERROR', 
        message: json.message || 'Failed to fetch rooms', 
        data: [] 
    };

  } catch (err: any) {
    return { status: 'DB_ERROR', message: err.message, data: [] };
  }
};

export const listAvailableRooms = async (startDate: string, endDate: string, index: number = 1): Promise<DbResponse<Room[]>> => {
  try {
    const res = await fetch(`${API_BASE_URL}/rooms/full?startDate=${startDate}&endDate=${endDate}&index=${index}`);
    return handleResponse<Room[]>(res);
  } catch (err) {
    return { status: 'DB_ERROR', message: 'Ошибка подключения к серверу' };
  }
};

export const createBooking = async (username: string, roomNo: string, startDate: string, endDate: string): Promise<DbResponse<string>> => {
  try {
    const res = await fetch(`${API_BASE_URL}/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, roomNo, startDate, endDate }),
    });
    return handleResponse<string>(res);
  } catch (err) {
    return { status: 'DB_ERROR', message: 'Ошибка подключения к серверу' };
  }
};

export const payBooking = async (
  username: string,
  bookingId: string,
  amount: number,
  method: 'CARD' | 'CASH',
  transactionRef: string
): Promise<DbResponse<{ paymentId: string }>> => {
  try {
    const res = await fetch(`${API_BASE_URL}/${encodeURIComponent(username)}/pay_booking/${encodeURIComponent(bookingId)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount, method, transactionRef }),
      credentials: "include",
    });
    return handleResponse<{ paymentId: string }>(res);
  } catch (err) {
    return { status: 'DB_ERROR', message: 'Ошибка подключения к серверу' };
  }
};

export const getUserBookings = async (username: string): Promise<DbResponse<Booking[]>> => {
  try {
    const res = await fetch(`${API_BASE_URL}/bookings/${username}`);
    return handleResponse<Booking[]>(res);
  } catch (err) {
    return { status: 'DB_ERROR', message: 'Ошибка подключения к серверу' };
  }
};

export const cancelBooking = async (username: string, bookingId: string): Promise<DbResponse<null>> => {
  try {
    const res = await fetch(`${API_BASE_URL}/bookings/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, bookingId }),
    });
    return handleResponse<null>(res);
  } catch (err) {
    return { status: 'DB_ERROR', message: 'Ошибка подключения к серверу' };
  }
};

// --- NEW ENDPOINT: Cleaning Schedule ---
export const getCleaningSchedule = async (bookingId: string): Promise<DbResponse<CleaningTask[]>> => {
  try {
    const res = await fetch(`${API_BASE_URL}/cleaning/${bookingId}`);
    return handleResponse<CleaningTask[]>(res);
  } catch (err) {
    return { status: 'DB_ERROR', message: 'Ошибка подключения к серверу' };
  }
};

export const getAllReviews = async (): Promise<DbResponse<Review[]>> => {
  try {
    const res = await fetch(`${API_BASE_URL}/reviews`);
    return handleResponse<Review[]>(res);
  } catch (err) {
    return { status: 'DB_ERROR', message: 'Ошибка подключения к серверу' };
  }
};

// --- User Reviews Management ---

export const addUserReview = async (
  username: string,
  bookingId: string,
  roomNo: string,
  rating: number,
  title: string,
  content: string
): Promise<DbResponse<null>> => {
  try {
    const res = await fetch(`${API_BASE_URL}/user/reviews`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, bookingId, roomNo, rating, title, content }),
    });
    return handleResponse<null>(res);
  } catch (err) {
    return { status: 'DB_ERROR', message: 'Ошибка подключения к серверу' };
  }
};

export const updateUserReview = async (
  username: string,
  bookingId: string,
  rating: number,
  title: string,
  content: string
): Promise<DbResponse<null>> => {
  try {
    const res = await fetch(`${API_BASE_URL}/user/reviews`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, bookingId, rating, title, content }),
    });
    return handleResponse<null>(res);
  } catch (err) {
    return { status: 'DB_ERROR', message: 'Ошибка подключения к серверу' };
  }
};

export const deleteUserReview = async (username: string, bookingId: string): Promise<DbResponse<null>> => {
  try {
    const res = await fetch(`${API_BASE_URL}/user/reviews`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, bookingId }),
    });
    return handleResponse<null>(res);
  } catch (err) {
    return { status: 'DB_ERROR', message: 'Ошибка подключения к серверу' };
  }
};

export const getUserReviews = async (username: string): Promise<DbResponse<Review[]>> => {
  try {
    const res = await fetch(`${API_BASE_URL}/user/reviews/${username}`);
    return handleResponse<Review[]>(res);
  } catch (err) {
    return { status: 'DB_ERROR', message: 'Ошибка подключения к серверу' };
  }
};

export const getHotelInfo = async (hotelCode: string): Promise<DbResponse<Hotel>> => {
  try {
    const res = await fetch(`${API_BASE_URL}/hotel/${hotelCode}`);
    return handleResponse<Hotel>(res);
  } catch (err) {
    return { status: 'DB_ERROR', message: 'Ошибка подключения к серверу' };
  }
};

// --- ADMIN: Hotel Management ---
export const listHotels = async (): Promise<DbResponse<Hotel[]>> => {
  try {
    // Try to list all hotels if endpoint exists
    const res = await fetch(`${API_BASE_URL}/admin/hotel_mgmt_pkg/list_hotels`);
    if (res.ok) {
       return handleResponse<Hotel[]>(res);
    }
    // If endpoint doesn't exist (404), fallback to MOONGLOW
    throw new Error("List endpoint unavailable");
  } catch (err) {
    console.warn("Falling back to default hotel");
    // Fallback: fetch default hotel
    const defaultHotelRes = await getHotelInfo('MOONGLOW');
    if (defaultHotelRes.status === 'OK' && defaultHotelRes.data) {
        return { status: 'OK', message: 'Default hotel loaded', data: [defaultHotelRes.data] };
    }
    return { status: 'DB_ERROR', message: 'Ошибка подключения к серверу' };
  }
};

export const createHotel = async (hotelData: Partial<Hotel>): Promise<DbResponse<{ hotelCode: string }>> => {
  try {
    const res = await fetch(`${API_BASE_URL}/admin/hotel_mgmt_pkg/create_hotel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(hotelData),
    });
    return handleResponse<{ hotelCode: string }>(res);
  } catch (err) {
    return { status: 'DB_ERROR', message: 'Ошибка подключения к серверу' };
  }
};

export const updateHotel = async (hotelData: Partial<Hotel>): Promise<DbResponse<null>> => {
  try {
    const res = await fetch(`${API_BASE_URL}/admin/hotel_mgmt_pkg/update_hotel`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(hotelData),
    });
    return handleResponse<null>(res);
  } catch (err) {
    return { status: 'DB_ERROR', message: 'Ошибка подключения к серверу' };
  }
};

export const deleteHotel = async (hotelCode: string): Promise<DbResponse<null>> => {
  try {
    const res = await fetch(`${API_BASE_URL}/admin/hotel_mgmt_pkg/delete_hotel/${encodeURIComponent(hotelCode)}`, {
      method: 'DELETE',
    });
    return handleResponse<null>(res);
  } catch (err) {
    return { status: 'DB_ERROR', message: 'Ошибка подключения к серверу' };
  }
};


export const getRoomServices = async (roomNo: string): Promise<DbResponse<RoomService[]>> => {
  try {
    const res = await fetch(`${API_BASE_URL}/rooms/${encodeURIComponent(roomNo)}/services`);
    return handleResponse<RoomService[]>(res);
  } catch (err: any) {
    return { status: "DB_ERROR", message: err.message, data: [] };
  }
};

export const getRoomImages = async (roomNo: string): Promise<DbResponse<RoomImage[]>> => {
  try {
    const res = await fetch(`${API_BASE_URL}/rooms/${encodeURIComponent(roomNo)}/images`);
    return handleResponse<RoomImage[]>(res);
  } catch (err: any) {
    return { status: "DB_ERROR", message: err.message, data: [] };
  }
};

// --- MANAGER: Rooms CRUD ---

export const createRoom = async (roomData: Partial<Room>): Promise<DbResponse<null>> => {
  try {
    const res = await fetch(`${API_BASE_URL}/manager/rooms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(roomData),
    });
    return handleResponse<null>(res);
  } catch (err) {
    return { status: 'DB_ERROR', message: 'Ошибка подключения к серверу' };
  }
};

export const updateRoom = async (roomNo: string, roomData: Partial<Room>): Promise<DbResponse<null>> => {
  try {
    const res = await fetch(`${API_BASE_URL}/manager/rooms/${encodeURIComponent(roomNo)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(roomData),
    });
    return handleResponse<null>(res);
  } catch (err) {
    return { status: 'DB_ERROR', message: 'Ошибка подключения к серверу' };
  }
};

export const deleteRoom = async (roomNo: string): Promise<DbResponse<null>> => {
  try {
    const res = await fetch(`${API_BASE_URL}/manager/rooms/${encodeURIComponent(roomNo)}`, {
      method: 'DELETE',
    });
    return handleResponse<null>(res);
  } catch (err) {
    return { status: 'DB_ERROR', message: 'Ошибка подключения к серверу' };
  }
};

export const getManagerRooms = async (roomNo?: string, hotelCode?: string, index: number = 1): Promise<DbResponse<Room[]>> => {
  try {
    const params = new URLSearchParams();
    if (roomNo) params.append('roomNo', roomNo);
    if (hotelCode) params.append('hotelCode', hotelCode);
    params.append('index', index.toString());
    const res = await fetch(`${API_BASE_URL}/manager/rooms?${params.toString()}`);
    return handleResponse<Room[]>(res);
  } catch (err) {
    return { status: 'DB_ERROR', message: 'Ошибка подключения к серверу' };
  }
};

// --- MANAGER: Room Images ---
export const uploadRoomImage = async (roomNo: string, file: File): Promise<DbResponse<{ filePath: string }>> => {
  try {
    const formData = new FormData();
    formData.append('roomNo', roomNo);
    formData.append('file', file);

    const res = await fetch(`${API_BASE_URL}/manager/room_images`, {
      method: 'POST',
      body: formData,
    });
    return handleResponse<{ filePath: string }>(res);
  } catch (err) {
    return { status: 'DB_ERROR', message: 'Ошибка подключения к серверу' };
  }
};

export const deleteRoomImage = async (imageId: number): Promise<DbResponse<null>> => {
  try {
    const res = await fetch(`${API_BASE_URL}/manager/room_images/${imageId}`, {
      method: 'DELETE',
    });
    return handleResponse<null>(res);
  } catch (err) {
    return { status: 'DB_ERROR', message: 'Ошибка подключения к серверу' };
  }
};

// --- MANAGER: Services CRUD (Global) ---
export const getManagerServices = async (serviceCode?: string): Promise<DbResponse<RoomService[]>> => {
  try {
    const params = new URLSearchParams();
    if (serviceCode) params.append('serviceCode', serviceCode);
    const res = await fetch(`${API_BASE_URL}/manager/services?${params.toString()}`);
    return handleResponse<RoomService[]>(res);
  } catch (err) {
    return { status: 'DB_ERROR', message: 'Ошибка подключения к серверу', data: [] };
  }
};

export const createManagerService = async (serviceData: { serviceCode: string; title: string; description?: string }): Promise<DbResponse<null>> => {
  try {
    const res = await fetch(`${API_BASE_URL}/manager/services`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(serviceData),
    });
    return handleResponse<null>(res);
  } catch (err) {
    return { status: 'DB_ERROR', message: 'Ошибка подключения к серверу' };
  }
};

export const updateManagerService = async (serviceCode: string, serviceData: { title: string; description?: string }): Promise<DbResponse<null>> => {
  try {
    const res = await fetch(`${API_BASE_URL}/manager/services/${encodeURIComponent(serviceCode)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(serviceData),
    });
    return handleResponse<null>(res);
  } catch (err) {
    return { status: 'DB_ERROR', message: 'Ошибка подключения к серверу' };
  }
}

export const deleteManagerService = async (serviceCode: string): Promise<DbResponse<null>> => {
  try {
    const res = await fetch(`${API_BASE_URL}/manager/services/${encodeURIComponent(serviceCode)}`, {
      method: 'DELETE',
    });
    return handleResponse<null>(res);
  } catch (err) {
    return { status: 'DB_ERROR', message: 'Ошибка подключения к серверу' };
  }
}


// --- MANAGER: Room-Service Association (Assumed Endpoints) ---

export const addServiceToRoom = async (roomNo: string, serviceCode: string): Promise<DbResponse<null>> => {
  try {
    // This is an assumed endpoint. The backend needs to implement it.
    // POST /api/manager/rooms/:roomNo/services with body { serviceCode }
    const res = await fetch(`${API_BASE_URL}/manager/room_services`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomNo, serviceCode }),
    });
    return handleResponse<null>(res);
  } catch (err) {
    return { status: 'DB_ERROR', message: 'Ошибка подключения к серверу' };
  }
};

export const removeServiceFromRoom = async (roomNo: string, serviceCode: string): Promise<DbResponse<null>> => {
  try {
    // This is an assumed endpoint. The backend needs to implement it.
    // DELETE /api/manager/rooms/:roomNo/services/:serviceCode
    const res = await fetch(`${API_BASE_URL}/manager/room_services/${encodeURIComponent(roomNo)}/${encodeURIComponent(serviceCode)}`, {
      method: 'DELETE',
    });
    return handleResponse<null>(res);
  } catch (err) {
    return { status: 'DB_ERROR', message: 'Ошибка подключения к серверу' };
  }
};

// --- MANAGER: Bookings Management ---

export const getManagerBookings = async (filters: {
  username?: string;
  roomNo?: string;
  statusFilter?: string;
  startFrom?: string;
  startTo?: string;
  offsetFrom?: number;
  offsetTo?: number;
  bookingId?: string;
}): Promise<DbResponse<Booking[]>> => {
  try {
    const params = new URLSearchParams();
    // Special handling for single booking ID search
    if (filters.bookingId) {
      params.append('bookingId', filters.bookingId);
    } else {
      if (filters.username) params.append('username', filters.username);
      if (filters.roomNo) params.append('roomNo', filters.roomNo);
      if (filters.statusFilter) params.append('statusFilter', filters.statusFilter);
      if (filters.startFrom) params.append('startFrom', filters.startFrom);
      if (filters.startTo) params.append('startTo', filters.startTo);
      if (filters.offsetFrom !== undefined) params.append('offsetFrom', String(filters.offsetFrom));
      if (filters.offsetTo !== undefined) params.append('offsetTo', String(filters.offsetTo));
    }

    const res = await fetch(`${API_BASE_URL}/manager/bookings?${params.toString()}`);
    const json = await res.json();
    if (res.ok && json.status === 'OK') {
      const bookings = Array.isArray(json.bookings) ? json.bookings.map((b: any) => ({
        bookingId: b.BOOKING_ID || b.bookingId,
        username: b.USERNAME || b.username,
        roomNo: b.ROOM_NO || b.roomNo,
        roomTitle: b.ROOM_TITLE || b.roomTitle,
        startDate: b.START_DATE || b.startDate,
        endDate: b.END_DATE || b.endDate,
        status: b.STATUS || b.status,
        totalAmount: b.TOTAL_AMOUNT || b.totalAmount,
        createdAt: b.CREATED_AT || b.createdAt,
        notes: b.NOTES || b.notes
      })) : [];
      return {
        status: 'OK',
        message: json.message,
        data: bookings,
      };
    } else {
      return {
        status: json.status || 'DB_ERROR',
        message: json.message || 'Server error',
        data: [],
      };
    }
  } catch (err) {
    return { status: 'DB_ERROR', message: 'Ошибка подключения к серверу' };
  }
};

export const updateManagerBooking = async (bookingData: {
  bookingId: string;
  roomNo?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  newStatus?: string | null;
  notes?: string | null;
}): Promise<DbResponse<null>> => {
  try {
    const res = await fetch(`${API_BASE_URL}/manager/bookings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bookingData),
    });
    return handleResponse<null>(res);
  } catch (err) {
    return { status: 'DB_ERROR', message: 'Ошибка подключения к серверу' };
  }
};

export const deleteManagerBooking = async (bookingId: string): Promise<DbResponse<null>> => {
  try {
    const res = await fetch(`${API_BASE_URL}/admin/bookings/${encodeURIComponent(bookingId)}`, {
      method: 'DELETE',
    });
    return handleResponse<null>(res);
  } catch (err) {
    return { status: 'DB_ERROR', message: 'Ошибка подключения к серверу' };
  }
};

export const getBookingPayments = async (bookingId: string): Promise<DbResponse<PaymentDetails>> => {
  try {
    const res = await fetch(`${API_BASE_URL}/manager/get_payments/${encodeURIComponent(bookingId)}`);
    const json = await res.json();
    if (res.ok && json.status === 'OK') {
      const mappedPayments: Payment[] = Array.isArray(json.payments) ? json.payments.map((p: any) => ({
        paymentId: p.PAYMENT_ID || p.paymentId,
        bookingId: p.BOOKING_ID || p.bookingId,
        amount: p.PAID_AMOUNT || p.paid_amount,
        paymentDate: p.PAID_AT || p.paid_at,
        paymentMethod: p.METHOD || p.method,
        status: p.STATUS || p.status
      })) : [];

      return {
        status: 'OK',
        message: json.message,
        data: {
          isPaid: json.isPaid,
          payments: mappedPayments,
        },
      };
    } else {
      return {
        status: json.status || 'DB_ERROR',
        message: json.message || 'Server error',
      };
    }
  } catch (err: any) {
    return { status: 'DB_ERROR', message: err.message || 'Ошибка подключения к серверу' };
  }
};

// --- MANAGER: Cleaning Schedules ---

export const getManagerCleaningSchedules = async (filters: {
  roomNo?: string;
  scheduledDate?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
}): Promise<DbResponse<CleaningScheduleItem[]>> => {
  try {
    const params = new URLSearchParams();
    if (filters.roomNo) params.append('roomNo', filters.roomNo);
    if (filters.scheduledDate) params.append('scheduledDate', filters.scheduledDate);
    if (filters.status) params.append('status', filters.status);
    if (filters.dateFrom) params.append('dateFrom', filters.dateFrom);
    if (filters.dateTo) params.append('dateTo', filters.dateTo);

    const res = await fetch(`${API_BASE_URL}/manager/cleaning_schedule?${params.toString()}`);
    return handleResponse<CleaningScheduleItem[]>(res);
  } catch (err) {
    return { status: 'DB_ERROR', message: 'Ошибка подключения к серверу' };
  }
};

export const createManagerCleaningSchedule = async (data: {
  roomNo: string;
  scheduledDate: string;
  assignedTo?: string;
  status?: string;
  notes?: string;
}): Promise<DbResponse<null>> => {
  try {
    const res = await fetch(`${API_BASE_URL}/manager/cleaning_schedule`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse<null>(res);
  } catch (err) {
    return { status: 'DB_ERROR', message: 'Ошибка подключения к серверу' };
  }
};

export const updateManagerCleaningSchedule = async (
  roomNo: string,
  scheduledDate: string,
  data: {
    assignedTo?: string;
    status?: string;
    notes?: string;
    newRoomNo?: string;
    newScheduledDate?: string;
  }
): Promise<DbResponse<null>> => {
  try {
    const res = await fetch(`${API_BASE_URL}/manager/cleaning_schedule/${encodeURIComponent(roomNo)}/${encodeURIComponent(scheduledDate)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse<null>(res);
  } catch (err) {
    return { status: 'DB_ERROR', message: 'Ошибка подключения к серверу' };
  }
};

export const deleteManagerCleaningSchedule = async (roomNo: string, scheduledDate: string): Promise<DbResponse<null>> => {
  try {
    const res = await fetch(`${API_BASE_URL}/manager/cleaning_schedule/${encodeURIComponent(roomNo)}/${encodeURIComponent(scheduledDate)}`, {
      method: 'DELETE',
    });
    return handleResponse<null>(res);
  } catch (err) {
    return { status: 'DB_ERROR', message: 'Ошибка подключения к серверу' };
  }
};

// --- ADMIN: Role Management ---

export const createRole = async (roleName: string, description?: string): Promise<DbResponse<{ roleId: number }>> => {
  try {
    const res = await fetch(`${API_BASE_URL}/admin/role_mgmt_pkg/create_role`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roleName, description }),
    });
    // Manually map the response since the server returns roleId at the root, not in data
    const json = await res.json();
    return { 
        status: json.status, 
        message: json.message, 
        data: json.roleId ? { roleId: json.roleId } : undefined 
    };
  } catch (err) {
    return { status: 'DB_ERROR', message: 'Ошибка подключения к серверу' };
  }
};

export const updateRole = async (roleId: number, roleName: string, description?: string): Promise<DbResponse<null>> => {
  try {
    const res = await fetch(`${API_BASE_URL}/admin/role_mgmt_pkg/update_role`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roleId, roleName, description }),
    });
    return handleResponse<null>(res);
  } catch (err) {
    return { status: 'DB_ERROR', message: 'Ошибка подключения к серверу' };
  }
};

export const deleteRole = async (roleId: number): Promise<DbResponse<null>> => {
  try {
    const res = await fetch(`${API_BASE_URL}/admin/role_mgmt_pkg/delete_role/${roleId}`, {
      method: 'DELETE',
    });
    return handleResponse<null>(res);
  } catch (err) {
    return { status: 'DB_ERROR', message: 'Ошибка подключения к серверу' };
  }
};

export const getRoleById = async (roleId: number): Promise<DbResponse<Role>> => {
  try {
    const res = await fetch(`${API_BASE_URL}/admin/role_mgmt_pkg/get_role_by_id/${roleId}`);
    return handleResponse<Role>(res);
  } catch (err) {
    return { status: 'DB_ERROR', message: 'Ошибка подключения к серверу' };
  }
};

export const listRoles = async (): Promise<DbResponse<Role[]>> => {
  try {
    const res = await fetch(`${API_BASE_URL}/admin/role_mgmt_pkg/list_roles`);
    return handleResponse<Role[]>(res);
  } catch (err) {
    return { status: 'DB_ERROR', message: 'Ошибка подключения к серверу' };
  }
};

export const assignRoleToUser = async (username: string, roleId: number): Promise<DbResponse<null>> => {
  try {
    const res = await fetch(`${API_BASE_URL}/admin/role_mgmt_pkg/assign_role_to_user`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, roleId }),
    });
    return handleResponse<null>(res);
  } catch (err) {
    return { status: 'DB_ERROR', message: 'Ошибка подключения к серверу' };
  }
};

export const getUserRole = async (username: string): Promise<DbResponse<{ roleId: number }>> => {
  try {
    const res = await fetch(`${API_BASE_URL}/admin/role_mgmt_pkg/get_user_role/${username}`);
    // Manually map response
    const json = await res.json();
    return {
        status: json.status,
        message: json.message,
        data: json.roleId !== undefined ? { roleId: json.roleId } : undefined
    };
  } catch (err) {
    return { status: 'DB_ERROR', message: 'Ошибка подключения к серверу' };
  }
};

// --- ADMIN: Stats & Analytics ---

export const getHotelStats = async (hotelCode: string): Promise<DbResponse<any[]>> => {
  try {
    const res = await fetch(`${API_BASE_URL}/admin/stats/hotel/${encodeURIComponent(hotelCode)}`, {
      credentials: "include"
    });
    return await handleResponse<any[]>(res);
  } catch (err) {
    return { status: 'DB_ERROR', message: 'Ошибка подключения к серверу' };
  }
};

export const getMonthlyStats = async (): Promise<DbResponse<any[]>> => {
  try {
    const res = await fetch(`${API_BASE_URL}/admin/stats/bookings-by-month`, {
       credentials: "include"
    });
    return await handleResponse<any[]>(res);
  } catch (err) {
    return { status: 'DB_ERROR', message: 'Ошибка подключения к серверу' };
  }
};

export const getTopRoomsStats = async (limit: number = 10): Promise<DbResponse<any[]>> => {
  try {
    const res = await fetch(`${API_BASE_URL}/admin/stats/top-rooms?limit=${limit}`, {
       credentials: "include"
    });
    return await handleResponse<any[]>(res);
  } catch (err) {
    return { status: 'DB_ERROR', message: 'Ошибка подключения к серверу' };
  }
};

// --- ADMIN: User Management ---

export const listUsers = async (): Promise<DbResponse<User[]>> => {
  try {
    const res = await fetch(`${API_BASE_URL}/admin/users_mgmt_pkg/list_users`, {
      credentials: "include"
    });
    const json = await res.json();
    
    if (res.ok && json.status === 'OK') {
        const users = Array.isArray(json.data) ? json.data.map((u: any) => ({
            username: u.USERNAME || u.username,
            fullName: u.FULL_NAME || u.fullName,
            email: u.EMAIL || u.email,
            roleId: u.ROLE_ID !== undefined ? u.ROLE_ID : u.roleId,
            phone: u.PHONE_NUMBER || u.phoneNumber || u.phone,
            accountStatus: u.STATUS || u.status || u.accountStatus, // Changed to prefer status from new list_users
            createdAt: u.CREATED_AT || u.createdAt
        })) : [];
        return { status: 'OK', message: json.message, data: users };
    }
    return { status: json.status || 'DB_ERROR', message: json.message || 'Error' };
  } catch (err) {
    return { status: 'DB_ERROR', message: 'Ошибка подключения к серверу' };
  }
};

export const updateUserStatus = async (username: string, status: string): Promise<DbResponse<null>> => {
  try {
    const res = await fetch(`${API_BASE_URL}/admin/users_mgmt_pkg/set_user_status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, status }),
      credentials: "include"
    });
    return handleResponse<null>(res);
  } catch (err) {
    return { status: 'DB_ERROR', message: 'Ошибка подключения к серверу' };
  }
};

export const deleteUser = async (username: string): Promise<DbResponse<null>> => {
  try {
    const res = await fetch(`${API_BASE_URL}/admin/users_mgmt_pkg/delete_user/${encodeURIComponent(username)}`, {
      method: 'DELETE',
      credentials: "include"
    });
    return handleResponse<null>(res);
  } catch (err) {
    return { status: 'DB_ERROR', message: 'Ошибка подключения к серверу' };
  }
};