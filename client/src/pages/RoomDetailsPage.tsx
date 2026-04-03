import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Users,
  DoorOpen,
  Maximize2,
  DollarSign,
  Trash2,
  Edit2,
  Star,
  MessageSquare,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  X,
  Loader2,
  AlertCircle,
} from 'lucide-react';

import useAppSelector from '@/hooks/useAppSelector';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import ConfirmModal from '@/components/modals/ConfirmModal';
import AlertModal from '@/components/modals/AlertModal';
import Input from '@/components/ui/Input';
import { API_BASE_URL } from '@/api/axiosInstance';

import { getRoom, deleteRoom, checkRoomAvailability, getRoomReviews } from '@/api/hotelApi';
import { getRoomServiceStateLabel } from '@/utils/roomServiceStates';
import { getFeatureIcon } from '@/utils/featureIcons';
import { CURRENCY_SYMBOL } from '@/utils/currency';
import type { Room, Review, ReviewsPagination, ReviewsStats } from '@/types';

// ─── Image URL Helper ───────────────────────────────────────────────────────

function resolveImageUrl(url: string): string {
  if (url.startsWith('/uploads/')) {
    const base = API_BASE_URL.replace(/\/api\/?$/, '');
    return base + url;
  }
  return url;
}

// ─── Star display ────────────────────────────────────────────────────────────

function Stars({ rating, size = 14 }: { rating: number; size?: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          size={size}
          className={i <= rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300 fill-gray-100'}
        />
      ))}
    </div>
  );
}

// ─── Review card ─────────────────────────────────────────────────────────────

function ReviewCard({ review, onImageClick }: { review: Review; onImageClick: (url: string) => void }) {
  const date = new Date(review.createdAt).toLocaleDateString('ru-RU', {
    day: 'numeric', month: 'long', year: 'numeric',
  });

  return (
    <div className="p-5 border border-gray-100 rounded-2xl bg-white space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-medium text-text text-sm">{review.authorName}</p>
          <p className="text-xs text-text/40 mt-0.5">{date}</p>
        </div>
        <Stars rating={review.rating} />
      </div>
      {review.text && (
        <p className="text-sm text-text/70 leading-relaxed">{review.text}</p>
      )}
      {review.images.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {review.images.slice(0, 4).map((img) => (
            <button
              key={img.imageId}
              type="button"
              onClick={() => onImageClick(resolveImageUrl(img.imageUrl))}
              className="w-16 h-16 rounded-lg overflow-hidden border border-gray-100 hover:opacity-90 transition-opacity"
            >
              <img
                src={resolveImageUrl(img.imageUrl)}
                alt="Фото отзыва"
                className="w-full h-full object-cover"
              />
            </button>
          ))}
          {review.images.length > 4 && (
            <div className="w-16 h-16 rounded-lg bg-gray-100 flex items-center justify-center text-xs text-text/50 font-medium border border-gray-100">
              +{review.images.length - 4}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Room Reviews section ─────────────────────────────────────────────────────

function RoomReviewsSection({ roomNo, hotelCode }: { roomNo: string; hotelCode: string }) {
  const [reviews, setReviews]     = useState<Review[]>([]);
  const [pagination, setPagination] = useState<ReviewsPagination | null>(null);
  const [stats, setStats]         = useState<ReviewsStats | null>(null);
  const [page, setPage]           = useState(1);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  useEffect(() => {
    const ac = new AbortController();
    setLoading(true);
    setError(null);
    getRoomReviews(roomNo, { page, limit: 5 }, ac.signal)
      .then((res) => {
        if (ac.signal.aborted) return;
        setReviews(res.reviews);
        setPagination(res.pagination);
        setStats(res.stats);
      })
      .catch((e) => { if (!ac.signal.aborted) setError('Не удалось загрузить отзывы'); })
      .finally(() => { if (!ac.signal.aborted) setLoading(false); });
    return () => ac.abort();
  }, [roomNo, page]);

  // Lightbox Escape
  useEffect(() => {
    if (!lightboxUrl) return;
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') setLightboxUrl(null); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [lightboxUrl]);

  const totalReviews = stats?.totalReviews ?? 0;

  return (
    <div className="bg-white p-8 rounded-xl shadow-lg border border-ui mt-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-bold text-text">Отзывы</h2>
          {stats && totalReviews > 0 && (
            <div className="flex items-center gap-2">
              <Stars rating={Math.round(stats.averageRating ?? 0)} size={16} />
              <span className="text-sm font-semibold text-text">{stats.averageRating?.toFixed(1)}</span>
              <span className="text-sm text-text/40">· {totalReviews} {
                totalReviews === 1 ? 'отзыв' : totalReviews < 5 ? 'отзыва' : 'отзывов'
              }</span>
            </div>
          )}
        </div>
        {totalReviews > 0 && (
          <Link
            to={`/hotels/${hotelCode}/reviews`}
            className="text-sm text-primary hover:underline font-medium"
          >
            Все отзывы отеля →
          </Link>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="animate-spin text-primary" size={24} />
        </div>
      ) : error ? (
        <div className="flex items-center gap-2 text-sm text-text/50 py-6 justify-center">
          <AlertCircle size={18} className="text-red-400" />
          {error}
        </div>
      ) : reviews.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-10 text-center">
          <MessageSquare size={32} className="text-gray-300" />
          <p className="text-sm text-text/50">Отзывов пока нет</p>
          <p className="text-xs text-text/30">Будьте первым, кто оставит отзыв после проживания</p>
        </div>
      ) : (
        <>
          <div className="space-y-4">
            {reviews.map((r) => (
              <ReviewCard key={r.reviewId} review={r} onImageClick={setLightboxUrl} />
            ))}
          </div>

          {/* Pagination */}
          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-between mt-6 text-sm">
              <p className="text-text/40">
                {(pagination.page - 1) * pagination.limit + 1}–{Math.min(pagination.page * pagination.limit, pagination.totalCount)} из {pagination.totalCount}
              </p>
              <div className="flex items-center gap-1">
                <button type="button" onClick={() => setPage(1)} disabled={pagination.page === 1}
                  className="p-1.5 rounded-lg hover:bg-ui disabled:opacity-30 transition-colors">
                  <ChevronsLeft size={16} />
                </button>
                <button type="button" onClick={() => setPage(p => p - 1)} disabled={pagination.page === 1}
                  className="p-1.5 rounded-lg hover:bg-ui disabled:opacity-30 transition-colors">
                  <ChevronLeft size={16} />
                </button>
                <span className="px-3 py-1 text-text/60">{pagination.page} / {pagination.totalPages}</span>
                <button type="button" onClick={() => setPage(p => p + 1)} disabled={pagination.page === pagination.totalPages}
                  className="p-1.5 rounded-lg hover:bg-ui disabled:opacity-30 transition-colors">
                  <ChevronRight size={16} />
                </button>
                <button type="button" onClick={() => setPage(pagination.totalPages)} disabled={pagination.page === pagination.totalPages}
                  className="p-1.5 rounded-lg hover:bg-ui disabled:opacity-30 transition-colors">
                  <ChevronsRight size={16} />
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Lightbox */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setLightboxUrl(null)}
        >
          <button
            type="button"
            onClick={() => setLightboxUrl(null)}
            className="absolute top-4 right-4 p-2 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
          >
            <X size={20} />
          </button>
          <img
            src={lightboxUrl}
            alt="Фото отзыва"
            className="max-w-full max-h-[90vh] rounded-xl object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
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
  const isManager = user?.role?.name === 'manager';
  const isStaff = isAdmin || isManager;

  // Dates can be pre-filled when coming from the search page.
  const locationState = location.state as { checkIn?: string; checkOut?: string } | null;

  const [room, setRoom] = useState<Room | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dates, setDates] = useState<DateSelection>({
    checkIn: locationState?.checkIn ?? '',
    checkOut: locationState?.checkOut ?? '',
  });
  const [checkingAvailability, setCheckingAvailability] = useState(false);

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

  // Handle booking — checks availability before navigating
  const handleBooking = useCallback(async () => {
    if (!room) return;

    if (!dates.checkIn || !dates.checkOut) {
      setErrorMessage('Пожалуйста, выберите даты заезда и выезда');
      setErrorAlertOpen(true);
      return;
    }

    if (new Date(dates.checkOut) <= new Date(dates.checkIn)) {
      setErrorMessage('Дата выезда должна быть позже даты заезда');
      setErrorAlertOpen(true);
      return;
    }

    setCheckingAvailability(true);
    try {
      const available = await checkRoomAvailability(
        room.roomNo,
        dates.checkIn,
        dates.checkOut,
        room.hotelCode,
      );

      if (!available) {
        setErrorMessage('К сожалению, этот номер уже занят на выбранные даты. Попробуйте другие даты.');
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
    } catch {
      // If availability check fails, proceed optimistically — the server will
      // catch conflicts at payment-intent creation time.
      navigate('/checkout', {
        state: {
          room,
          checkInDate: dates.checkIn,
          checkOutDate: dates.checkOut,
        },
      });
    } finally {
      setCheckingAvailability(false);
    }
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

  // Get main image — prefer the one flagged isMain, otherwise fall back to index 0.
  // Exclude the selected main image from the "other" list by imageId so it never
  // appears twice even when no image has isMain === true.
  const mainImage = room.images?.find((img) => img.isMain) ?? room.images?.[0];
  const otherImages = mainImage
    ? (room.images?.filter((img) => img.imageId !== mainImage.imageId).slice(0, 4) ?? [])
    : [];

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
            <>
              {/* Mobile: single full-width image */}
              <div className="lg:hidden">
                <img
                  src={resolveImageUrl(mainImage.imageUrl)}
                  alt={room.title}
                  className="w-full h-64 object-cover rounded-xl shadow-lg"
                />
              </div>

              {/* Desktop: main image + thumbnails grid */}
              <div className="hidden lg:grid grid-cols-5 gap-2">
                <div className="col-span-3 row-span-2">
                  <img
                    src={resolveImageUrl(mainImage.imageUrl)}
                    alt={room.title}
                    className="w-full h-80 object-cover rounded-lg shadow-lg"
                  />
                </div>
                {otherImages.slice(0, 4).map((img, idx) => (
                  <div key={img.imageId} className={idx === 3 ? 'col-span-2' : ''}>
                    <img
                      src={resolveImageUrl(img.imageUrl)}
                      alt={`${room.title} ${idx + 2}`}
                      className="w-full h-36 object-cover rounded-lg shadow-md"
                    />
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="w-full h-64 lg:h-80 bg-ui rounded-xl shadow-lg flex items-center justify-center">
              <span className="text-text/50">Изображение недоступно</span>
            </div>
          )}
        </div>

        {/* Responsive grid: single column on mobile, 3-col on desktop */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
          {/* Left column: Room info — full width on mobile, 2/3 on desktop (full width for manager) */}
          <div className={`${isManager ? 'lg:col-span-3' : 'lg:col-span-2'} order-2 lg:order-1 space-y-6`}>
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
                <div className="flex items-baseline gap-3 flex-wrap">
                  <span className="text-sm text-text/50 uppercase tracking-wider">Цена за ночь</span>
                  <span className="text-3xl font-bold text-primary">{room.basePrice} {CURRENCY_SYMBOL}</span>
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
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                            <span className="flex-shrink-0 mt-0.5">
                              {getFeatureIcon({ iconUrl: service.iconUrl, icon: service.icon, size: 16 })}
                            </span>
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
                              {Number(service.basePrice).toFixed(2)} {CURRENCY_SYMBOL}{' '}
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

          {/* Right column: booking / admin — hidden for manager, full width on mobile (shows first), 1/3 on desktop */}
          {!isManager && (
          <div className="lg:col-span-1 order-1 lg:order-2">
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
                // Regular user booking
                <div className="bg-white p-6 rounded-xl shadow-lg border border-ui">
                  <h3 className="text-sm font-bold text-text uppercase tracking-wider mb-4">
                    Забронировать
                  </h3>

                  <div className="space-y-3">
                    {/* Dates — side-by-side on all screen sizes */}
                    <div className="flex gap-2">
                      <div className="flex-1 min-w-0">
                        <Input
                          type="date"
                          label="Заезд"
                          value={dates.checkIn}
                          onChange={(e) => setDates((p) => ({ ...p, checkIn: e.target.value }))}
                          min={new Date().toISOString().split('T')[0]}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <Input
                          type="date"
                          label="Выезд"
                          value={dates.checkOut}
                          onChange={(e) => setDates((p) => ({ ...p, checkOut: e.target.value }))}
                          min={dates.checkIn || new Date().toISOString().split('T')[0]}
                        />
                      </div>
                    </div>

                    <Button
                      variant="primary"
                      size="md"
                      className="w-full"
                      onClick={handleBooking}
                      disabled={checkingAvailability}
                      isLoading={checkingAvailability}
                      icon={!checkingAvailability ? <DollarSign size={16} /> : undefined}
                    >
                      {checkingAvailability ? 'Проверяем доступность…' : 'Перейти к оформлению'}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
          )}
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
