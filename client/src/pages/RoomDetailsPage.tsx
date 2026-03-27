import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
  ArrowLeft,
  Wifi,
  Users,
  DoorOpen,
  Maximize2,
  DollarSign,
  Trash2,
  Edit2,
} from 'lucide-react';

import useAppSelector from '@/hooks/useAppSelector';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import ConfirmModal from '@/components/modals/ConfirmModal';
import AlertModal from '@/components/modals/AlertModal';
import Input from '@/components/ui/Input';
import { API_BASE_URL } from '@/api/axiosInstance';

import { getRoom, deleteRoom } from '@/api/hotelApi';
import { getRoomServiceStateLabel } from '@/utils/roomServiceStates';
import type { Room } from '@/types';

// ─── Image URL Helper ───────────────────────────────────────────────────────

function resolveImageUrl(url: string): string {
  if (url.startsWith('/uploads/')) {
    const base = API_BASE_URL.replace(/\/api\/?$/, '');
    return base + url;
  }
  return url;
}

// ─── State Management ───────────────────────────────────────────────────────

interface DateSelection {
  checkIn: string;
  checkOut: string;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function RoomDetailsPage() {
  const { roomNo } = useParams<{ roomNo: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const user = useAppSelector((s) => s.auth.user);
  const isAdmin = user?.role?.name === 'admin';

  const [room, setRoom] = useState<Room | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dates, setDates] = useState<DateSelection>({ checkIn: '', checkOut: '' });

  // Modals
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [successAlertOpen, setSuccessAlertOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorAlertOpen, setErrorAlertOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Load room data
  useEffect(() => {
    const fetchRoom = async () => {
      if (!roomNo) {
        setError('Номер комнаты не найден');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const response = await getRoom(roomNo);
        setRoom(response.room);
        setError(null);
      } catch (err) {
        console.error('Failed to fetch room:', err);
        setError('Ошибка при загрузке информации о номере');
      } finally {
        setLoading(false);
      }
    };

    fetchRoom();
  }, [roomNo]);

  // Handle delete
  const handleDelete = useCallback(async () => {
    if (!roomNo) return;

    try {
      setDeleteLoading(true);
      await deleteRoom(roomNo);
      setSuccessMessage('Номер успешно удален');
      setSuccessAlertOpen(true);
      setTimeout(() => navigate('/rooms'), 1500);
    } catch (err) {
      console.error('Failed to delete room:', err);
      setErrorMessage('Ошибка при удалении номера');
      setErrorAlertOpen(true);
    } finally {
      setDeleteLoading(false);
      setDeleteConfirmOpen(false);
    }
  }, [roomNo, navigate]);

  // Handle booking
  const handleBooking = useCallback(() => {
    if (!dates.checkIn || !dates.checkOut) {
      setErrorMessage('Пожалуйста, выберите даты заезда и выезда');
      setErrorAlertOpen(true);
      return;
    }

    navigate('/checkout', {
      state: {
        room,
        checkInDate: dates.checkIn,
        checkOutDate: dates.checkOut,
      },
    });
  }, [room, dates, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background py-12">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex items-center justify-center h-96">
            <div className="animate-pulse text-text/50">Загрузка...</div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !room) {
    return (
      <div className="min-h-screen bg-background py-12">
        <div className="max-w-6xl mx-auto px-4">
          <Button
            variant="ghost"
            size="sm"
            icon={<ArrowLeft size={16} />}
            onClick={() => navigate('/rooms')}
          >
            Все номера
          </Button>
          <div className="mt-8 text-center text-red-600">{error}</div>
        </div>
      </div>
    );
  }

  // Get main image
  const mainImage = room.images?.find((img) => img.isMain) || room.images?.[0];
  const otherImages = room.images?.filter((img) => !img.isMain).slice(0, 4) || [];

  // Status badge config
  const statusConfig: Record<string, { label: string; variant: any }> = {
    ACTIVE: { label: 'Активен', variant: 'success' },
    MAINTENANCE: { label: 'На обслуживании', variant: 'warning' },
    CLOSED: { label: 'Закрыт', variant: 'danger' },
  };

  const statusBadge = statusConfig[room.status] || { label: room.status, variant: 'default' };

  return (
    <div className="min-h-screen bg-background py-12">
      <div className="max-w-6xl mx-auto px-4">
        {/* Back button */}
        <Button
          variant="ghost"
          size="sm"
          icon={<ArrowLeft size={16} />}
          onClick={() => navigate('/rooms')}
        >
          Все номера
        </Button>

        {/* Image Gallery */}
        <div className="mt-8 mb-10">
          {mainImage ? (
            <div className="grid grid-cols-5 gap-2">
              {/* Main image - large */}
              <div className="col-span-3 row-span-2">
                <img
                  src={resolveImageUrl(mainImage.imageUrl)}
                  alt={room.title}
                  className="w-full h-80 object-cover rounded-lg shadow-lg"
                />
              </div>

              {/* Other images */}
              {otherImages.slice(0, 4).map((img, idx) => (
                <div key={img.imageId} className={idx === 3 ? 'col-span-2' : ''}>
                  <img
                    src={resolveImageUrl(img.imageUrl)}
                    alt={`${room.title} ${idx + 2}`}
                    className="w-full h-36 object-cover rounded-lg shadow-md"
                  />
                </div>
              ))}

              {/* Placeholder if not enough images */}
              {otherImages.length < 4 && (
                <div className="flex items-center justify-center bg-ui rounded-lg shadow-md">
                  <span className="text-text/50 text-sm">Нет фото</span>
                </div>
              )}
            </div>
          ) : (
            <div className="w-full h-80 bg-ui rounded-lg shadow-lg flex items-center justify-center">
              <span className="text-text/50">Изображение недоступно</span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-3 gap-8">
          {/* Left column: Room info (2/3) */}
          <div className="col-span-2 space-y-6">
            {/* Room info card */}
            <div className="bg-white p-8 rounded-xl shadow-lg border border-ui">
              {/* Title and badges */}
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h1 className="text-3xl font-bold text-text">{room.title}</h1>
                  {isAdmin && (
                    <div className="flex gap-2 mt-2">
                      <Badge variant="default">{room.roomNo}</Badge>
                      <Badge variant={statusBadge.variant}>{statusBadge.label}</Badge>
                    </div>
                  )}
                </div>
              </div>

              {/* Price */}
              <div className="mb-6 pb-6 border-b border-ui">
                <div className="flex items-baseline gap-2">
                  <span className="text-sm text-text/50 uppercase tracking-wider">Цена за ночь</span>
                  <span className="text-3xl font-bold text-primary">${room.basePrice}</span>
                </div>
              </div>

              {/* Stats grid */}
              <div className="grid grid-cols-2 gap-4 mb-6 pb-6 border-b border-ui">
                <div className="flex items-center gap-3">
                  <DoorOpen size={20} className="text-primary" />
                  <div>
                    <p className="text-xs text-text/50 uppercase tracking-wider">Номер</p>
                    <p className="text-lg font-semibold text-text">{room.roomNo}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Users size={20} className="text-primary" />
                  <div>
                    <p className="text-xs text-text/50 uppercase tracking-wider">Вместимость</p>
                    <p className="text-lg font-semibold text-text">{room.capacity} гостей</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Maximize2 size={20} className="text-primary" />
                  <div>
                    <p className="text-xs text-text/50 uppercase tracking-wider">Площадь</p>
                    <p className="text-lg font-semibold text-text">
                      {room.area ? `${room.area} м²` : 'N/A'}
                    </p>
                  </div>
                </div>

                <div>
                  <p className="text-xs text-text/50 uppercase tracking-wider mb-1">Кровати</p>
                  <p className="text-lg font-semibold text-text">{room.bedsCount}</p>
                </div>
              </div>

              {/* Description */}
              {room.description && (
                <>
                  <h2 className="text-lg font-bold text-text mb-3">Описание</h2>
                  <p className="text-text/70 text-sm leading-relaxed mb-6 pb-6 border-b border-ui">
                    {room.description}
                  </p>
                </>
              )}

              {/* Services/Amenities */}
              {room.roomServices && room.roomServices.length > 0 && (
                <>
                  <h2 className="text-lg font-bold text-text mb-4">Услуги и удобства</h2>
                  <div className="grid grid-cols-2 gap-4">
                    {room.roomServices.map((entry) => {
                      const service = entry.service;
                      // Badge variant per state: INCLUDED = success, OPTIONAL_ON = info, OPTIONAL_OFF = default
                      const badgeVariant =
                        entry.defaultState === 'INCLUDED'
                          ? 'success'
                          : entry.defaultState === 'OPTIONAL_ON'
                            ? 'info'
                            : 'default';

                      return (
                        <div
                          key={entry.serviceCode}
                          className="p-3 border border-ui rounded-lg hover:bg-ui/50 transition"
                        >
                          <div className="flex items-start gap-2 mb-2">
                            {service.iconUrl && (
                              <img
                                src={resolveImageUrl(service.iconUrl)}
                                alt={service.title}
                                className="w-5 h-5 object-contain flex-shrink-0 mt-0.5"
                              />
                            )}
                            {service.icon && !service.iconUrl && (
                              <Wifi size={16} className="text-primary flex-shrink-0 mt-0.5" />
                            )}
                            <div className="flex-1">
                              <p className="font-semibold text-text text-sm">{service.title}</p>
                              {service.description && (
                                <p className="text-xs text-text/50 mt-0.5">{service.description}</p>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center justify-between">
                            <Badge variant={badgeVariant} className="text-xs">
                              {getRoomServiceStateLabel(entry.defaultState)}
                            </Badge>
                            <span className="text-xs text-text/60 font-medium">
                              {Number(service.basePrice).toFixed(2)} ₽{' '}
                              {service.priceType === 'PER_NIGHT' ? '/ ночь' : 'разово'}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Right column: Actions (1/3 sticky) */}
          <div className="col-span-1">
            <div className="sticky top-4 space-y-4">
              {isAdmin ? (
                // Admin controls
                <div className="bg-white p-6 rounded-xl shadow-lg border border-ui">
                  <h3 className="text-sm font-bold text-text uppercase tracking-wider mb-4">
                    Управление
                  </h3>

                  <div className="space-y-3">
                    <Button
                      variant="primary"
                      size="md"
                      className="w-full"
                      icon={<Edit2 size={16} />}
                      onClick={() => navigate(`/admin/rooms/${roomNo}`)}
                    >
                      Редактировать номер
                    </Button>

                    <Button
                      variant="danger"
                      size="md"
                      className="w-full"
                      icon={<Trash2 size={16} />}
                      onClick={() => setDeleteConfirmOpen(true)}
                    >
                      Удалить номер
                    </Button>
                  </div>
                </div>
              ) : (
                // User booking
                <div className="bg-white p-6 rounded-xl shadow-lg border border-ui">
                  <h3 className="text-sm font-bold text-text uppercase tracking-wider mb-4">
                    Забронировать
                  </h3>

                  <div className="space-y-3">
                    <Input
                      type="date"
                      label="Заезд"
                      value={dates.checkIn}
                      onChange={(e) => setDates((p) => ({ ...p, checkIn: e.target.value }))}
                      min={new Date().toISOString().split('T')[0]}
                    />

                    <Input
                      type="date"
                      label="Выезд"
                      value={dates.checkOut}
                      onChange={(e) => setDates((p) => ({ ...p, checkOut: e.target.value }))}
                      min={dates.checkIn || new Date().toISOString().split('T')[0]}
                    />

                    <Button
                      variant="primary"
                      size="md"
                      className="w-full"
                      onClick={handleBooking}
                      icon={<DollarSign size={16} />}
                    >
                      Перейти к оформлению
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      <ConfirmModal
        isOpen={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        onConfirm={handleDelete}
        title="Удалить номер"
        message={`Вы уверены, что хотите удалить номер ${room.roomNo}? Это действие необратимо.`}
        confirmText="Удалить"
        cancelText="Отмена"
        isDangerous={true}
        isLoading={deleteLoading}
      />

      <AlertModal
        isOpen={successAlertOpen}
        onClose={() => setSuccessAlertOpen(false)}
        title="Успех"
        message={successMessage}
        type="success"
        closeText="OK"
      />

      <AlertModal
        isOpen={errorAlertOpen}
        onClose={() => setErrorAlertOpen(false)}
        title="Ошибка"
        message={errorMessage}
        type="error"
        closeText="OK"
      />
    </div>
  );
}
