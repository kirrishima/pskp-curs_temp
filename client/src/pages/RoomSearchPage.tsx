import React, { memo, useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import {
  Search,
  Plus,
  ChevronLeft,
  ChevronRight,
  Calendar,
  Users,
  MapPin,
  SlidersHorizontal,
} from 'lucide-react';
import useAppSelector from '@/hooks/useAppSelector';
import { searchRooms, getServices, deleteRoom } from '@/api/hotelApi';
import type { RoomSearchResult } from '@/api/hotelApi';
import RoomCard from '@/components/RoomCard';
import Button from '@/components/ui/Button';
import Shimmer, { ShimmerRoomCard, ShimmerFilterPanel } from '@/components/ui/Shimmer';
import ConfirmModal from '@/components/modals/ConfirmModal';
import AlertModal from '@/components/modals/AlertModal';
import type { Room, Service } from '@/types';

// ─── Types ───────────────────────────────────────────────────────────────────

interface SearchFilters {
  checkIn: string;
  checkOut: string;
  hotelCode?: string;
  floor?: number;
  title?: string;
  minPrice?: number;
  maxPrice?: number;
  minBeds?: number;
  maxBeds?: number;
  minCapacity?: number;
  maxCapacity?: number;
  minArea?: number;
  maxArea?: number;
  services?: string[];
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

interface PaginationState {
  cursorStack: (string | null)[];
  currentIndex: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getTodayDate(): string {
  return new Date().toISOString().split('T')[0];
}

function getTomorrowDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().split('T')[0];
}

// ─── Constants ───────────────────────────────────────────────────────────────

const inputClass =
  'w-full px-3 py-2 bg-white border border-gray-300 rounded-md outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-shadow text-sm text-text disabled:bg-gray-100 disabled:text-gray-400';

const labelClass =
  'block text-xs font-bold text-text/50 uppercase tracking-wider mb-1';

const SORT_OPTIONS = [
  { value: 'basePrice', label: 'Цена' },
  { value: 'capacity', label: 'Вместимость' },
  { value: 'bedsCount', label: 'Кровати' },
  { value: 'floor', label: 'Этаж' },
  { value: 'area', label: 'Площадь' },
];

// ─── Filter Panel Component ──────────────────────────────────────────────────

const FilterPanel = memo(function FilterPanel({
  filters,
  onFiltersChange,
  services,
  servicesLoading,
  isLoading,
  isAdmin,
  onSearch,
  onReset,
}: {
  filters: SearchFilters;
  onFiltersChange: (filters: SearchFilters) => void;
  services: Service[];
  servicesLoading: boolean;
  isLoading: boolean;
  isAdmin: boolean;
  onSearch: () => void;
  onReset: () => void;
}) {
  const handleChange = useCallback(
    (key: keyof SearchFilters, value: any) => {
      onFiltersChange({ ...filters, [key]: value });
    },
    [filters, onFiltersChange]
  );

  const handleServiceToggle = (serviceCode: string) => {
    const currentServices = filters.services || [];
    const updated = currentServices.includes(serviceCode)
      ? currentServices.filter((s) => s !== serviceCode)
      : [...currentServices, serviceCode];
    handleChange('services', updated.length > 0 ? updated : undefined);
  };

  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-100 sticky top-20 overflow-hidden">
      {/* Map Placeholder */}
      <div className="h-40 bg-gradient-to-br from-primary/5 to-secondary/10 flex items-center justify-center border-b border-gray-100">
        <div className="text-center text-text/30">
          <MapPin size={32} className="mx-auto mb-1" />
          <p className="text-xs">Просмотреть на карте</p>
        </div>
      </div>

      <div className="p-5">
        <div className="flex justify-between items-center mb-5 pb-3 border-b border-gray-100">
          <h3 className="font-bold text-base text-text flex items-center gap-2">
            <SlidersHorizontal size={16} /> Фильтры
          </h3>
          <button onClick={onReset} className="text-xs text-primary hover:underline">
            Сбросить
          </button>
        </div>

        <div className="space-y-5">
          {/* Price Range */}
          <div>
            <label className={labelClass}>Цена за ночь (₽)</label>
            <div className="flex gap-2">
              <input
                type="number"
                min="0"
                value={filters.minPrice || ''}
                onChange={(e) =>
                  handleChange('minPrice', e.target.value ? Number(e.target.value) : undefined)
                }
                placeholder="От"
                className={inputClass}
              />
              <input
                type="number"
                min="0"
                value={filters.maxPrice || ''}
                onChange={(e) =>
                  handleChange('maxPrice', e.target.value ? Number(e.target.value) : undefined)
                }
                placeholder="До"
                className={inputClass}
              />
            </div>
          </div>

          {/* Floor */}
          <div>
            <label className={labelClass}>Этаж</label>
            <input
              type="number"
              min="0"
              value={filters.floor || ''}
              onChange={(e) =>
                handleChange('floor', e.target.value ? Number(e.target.value) : undefined)
              }
              placeholder="Номер этажа"
              className={inputClass}
            />
          </div>

          {/* Beds */}
          <div>
            <label className={labelClass}>Кровати</label>
            <div className="flex gap-2">
              <input
                type="number"
                min="0"
                value={filters.minBeds || ''}
                onChange={(e) =>
                  handleChange('minBeds', e.target.value ? Number(e.target.value) : undefined)
                }
                placeholder="От"
                className={inputClass}
              />
              <input
                type="number"
                min="0"
                value={filters.maxBeds || ''}
                onChange={(e) =>
                  handleChange('maxBeds', e.target.value ? Number(e.target.value) : undefined)
                }
                placeholder="До"
                className={inputClass}
              />
            </div>
          </div>

          {/* Capacity */}
          <div>
            <label className={labelClass}>Вместимость (гостей)</label>
            <div className="flex gap-2">
              <input
                type="number"
                min="0"
                value={filters.minCapacity || ''}
                onChange={(e) =>
                  handleChange('minCapacity', e.target.value ? Number(e.target.value) : undefined)
                }
                placeholder="От"
                className={inputClass}
              />
              <input
                type="number"
                min="0"
                value={filters.maxCapacity || ''}
                onChange={(e) =>
                  handleChange('maxCapacity', e.target.value ? Number(e.target.value) : undefined)
                }
                placeholder="До"
                className={inputClass}
              />
            </div>
          </div>

          {/* Area */}
          <div>
            <label className={labelClass}>Площадь (м²)</label>
            <div className="flex gap-2">
              <input
                type="number"
                min="0"
                value={filters.minArea || ''}
                onChange={(e) =>
                  handleChange('minArea', e.target.value ? Number(e.target.value) : undefined)
                }
                placeholder="От"
                className={inputClass}
              />
              <input
                type="number"
                min="0"
                value={filters.maxArea || ''}
                onChange={(e) =>
                  handleChange('maxArea', e.target.value ? Number(e.target.value) : undefined)
                }
                placeholder="До"
                className={inputClass}
              />
            </div>
          </div>

          {/* Admin: Hotel Code */}
          {isAdmin && (
            <div>
              <label className={labelClass}>Код отеля</label>
              <input
                type="text"
                value={filters.hotelCode || ''}
                onChange={(e) => handleChange('hotelCode', e.target.value || undefined)}
                placeholder="Например: MOONGLOW"
                className={inputClass}
              />
            </div>
          )}

          {/* Services */}
          <div>
            <label className={labelClass}>Удобства</label>
            {servicesLoading ? (
              <div className="space-y-2 mt-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Shimmer className="h-4 w-4 rounded" />
                    <Shimmer className="h-4 flex-1" />
                  </div>
                ))}
              </div>
            ) : services.length > 0 ? (
              <div className="space-y-1.5 mt-2 max-h-48 overflow-y-auto">
                {services.map((service) => (
                  <label
                    key={service.serviceCode}
                    className="flex items-center gap-2.5 cursor-pointer p-1.5 rounded hover:bg-ui transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={(filters.services || []).includes(service.serviceCode)}
                      onChange={() => handleServiceToggle(service.serviceCode)}
                      className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary/50"
                    />
                    <span className="text-sm text-text">{service.title}</span>
                  </label>
                ))}
              </div>
            ) : (
              <p className="text-xs text-text/40 mt-2">Нет доступных услуг</p>
            )}
          </div>

          {/* Sort Options */}
          <div>
            <label className={labelClass}>Сортировка</label>
            <select
              value={filters.sortBy || 'basePrice'}
              onChange={(e) => handleChange('sortBy', e.target.value)}
              className={inputClass}
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <div className="flex gap-2 mt-2">
              {(['asc', 'desc'] as const).map((order) => (
                <button
                  key={order}
                  onClick={() => handleChange('sortOrder', order)}
                  className={`flex-1 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                    (filters.sortOrder || 'asc') === order
                      ? 'bg-primary text-white'
                      : 'bg-ui text-text hover:bg-gray-300'
                  }`}
                >
                  {order === 'asc' ? '↑ Возрастание' : '↓ Убывание'}
                </button>
              ))}
            </div>
          </div>

          {/* Apply */}
          <Button
            variant="primary"
            size="md"
            onClick={onSearch}
            isLoading={isLoading}
            className="w-full"
          >
            {isAdmin ? 'Обновить данные' : 'Применить'}
          </Button>
        </div>
      </div>
    </div>
  );
});

// ─── Main Component ──────────────────────────────────────────────────────────

const RoomSearchPage = memo(function RoomSearchPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const user = useAppSelector((s) => s.auth.user);
  const isAdmin = user?.role?.name === 'admin';

  // Parse URL params for initial values
  const urlCheckIn = searchParams.get('checkIn') || getTodayDate();
  const urlCheckOut = searchParams.get('checkOut') || getTomorrowDate();
  const urlGuests = searchParams.get('guests') || '2';

  // Top search bar state
  const [topCheckIn, setTopCheckIn] = useState(urlCheckIn);
  const [topCheckOut, setTopCheckOut] = useState(urlCheckOut);
  const [topGuests, setTopGuests] = useState(Number(urlGuests));

  // Sidebar filter state
  const [filters, setFilters] = useState<SearchFilters>({
    checkIn: urlCheckIn,
    checkOut: urlCheckOut,
    minCapacity: Number(urlGuests) || undefined,
  });

  const [searchTitle, setSearchTitle] = useState('');
  const [rooms, setRooms] = useState<Room[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [servicesLoading, setServicesLoading] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [totalCount, setTotalCount] = useState(0);

  const [pagination, setPagination] = useState<PaginationState>({
    cursorStack: [null],
    currentIndex: 0,
  });

  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; room?: Room }>({
    isOpen: false,
  });
  const [alertModal, setAlertModal] = useState<{
    isOpen: boolean;
    title?: string;
    message?: string;
    type?: 'info' | 'success' | 'error';
  }>({ isOpen: false });
  const [isDeleting, setIsDeleting] = useState(false);

  // Load services on mount
  useEffect(() => {
    const loadServices = async () => {
      try {
        const { services: loadedServices } = await getServices();
        setServices(loadedServices.filter((s) => s.isActive));
      } catch (error) {
        console.error('Failed to load services:', error);
      } finally {
        setServicesLoading(false);
      }
    };
    loadServices();
  }, []);

  // Auto-search on mount if coming from homepage with params
  useEffect(() => {
    if (searchParams.get('checkIn')) {
      handleSearch();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync top search bar → filters
  const handleTopSearch = useCallback(() => {
    setFilters((prev) => ({
      ...prev,
      checkIn: topCheckIn,
      checkOut: topCheckOut,
      minCapacity: topGuests || undefined,
    }));
    // We need to trigger the search after state update.
    // We'll use a flag or just call search directly
    setPagination({ cursorStack: [null], currentIndex: 0 });
    setHasSearched(true);

    // Perform search with new params
    performSearch({
      ...filters,
      checkIn: topCheckIn,
      checkOut: topCheckOut,
      minCapacity: topGuests || undefined,
    });
  }, [topCheckIn, topCheckOut, topGuests, filters]);

  // Core search
  const performSearch = useCallback(
    async (overrideFilters?: SearchFilters, cursor?: string | null) => {
      setIsLoading(true);
      try {
        const f = overrideFilters || filters;
        const searchParams = {
          ...f,
          title: searchTitle || undefined,
          services: f.services?.join(','),
          cursor: cursor ?? pagination.cursorStack[pagination.currentIndex] ?? undefined,
        };

        const result: RoomSearchResult = await searchRooms(searchParams);
        setRooms(result.rooms);
        setTotalCount(result.rooms.length);
        setHasSearched(true);

        if (pagination.currentIndex === pagination.cursorStack.length - 1) {
          setPagination((prev) => ({
            ...prev,
            cursorStack: [
              ...prev.cursorStack,
              result.pagination.hasNextPage ? result.pagination.nextCursor : null,
            ],
          }));
        }
      } catch (error) {
        console.error('Search error:', error);
        setAlertModal({
          isOpen: true,
          title: 'Ошибка',
          message: 'Не удалось загрузить номера. Попробуйте позже.',
          type: 'error',
        });
      } finally {
        setIsLoading(false);
      }
    },
    [filters, searchTitle, pagination]
  );

  const handleSearch = useCallback(() => {
    setPagination({ cursorStack: [null], currentIndex: 0 });
    performSearch(undefined, null);
  }, [performSearch]);

  const handleReset = useCallback(() => {
    setFilters({
      checkIn: topCheckIn,
      checkOut: topCheckOut,
      minCapacity: topGuests || undefined,
    });
    setSearchTitle('');
    setPagination({ cursorStack: [null], currentIndex: 0 });
    setHasSearched(false);
    setRooms([]);
  }, [topCheckIn, topCheckOut, topGuests]);

  // Pagination
  const handleNextPage = useCallback(() => {
    if (pagination.currentIndex < pagination.cursorStack.length - 1) {
      setPagination((prev) => ({ ...prev, currentIndex: prev.currentIndex + 1 }));
    }
  }, [pagination]);

  const handlePrevPage = useCallback(() => {
    if (pagination.currentIndex > 0) {
      setPagination((prev) => ({ ...prev, currentIndex: prev.currentIndex - 1 }));
    }
  }, [pagination]);

  useEffect(() => {
    if (hasSearched && pagination.currentIndex > 0) {
      performSearch();
    }
  }, [pagination.currentIndex]);

  // Room actions
  const handleViewRoom = useCallback(
    (room: Room) => navigate(`/rooms/${room.roomNo}`),
    [navigate]
  );
  const handleEditRoom = useCallback(
    (room: Room) => navigate(`/admin/rooms/${room.roomNo}`),
    [navigate]
  );
  const handleDeleteRoom = useCallback((room: Room) => {
    setDeleteModal({ isOpen: true, room });
  }, []);

  const confirmDelete = useCallback(async () => {
    if (!deleteModal.room) return;
    setIsDeleting(true);
    try {
      await deleteRoom(deleteModal.room.roomNo);
      setAlertModal({
        isOpen: true,
        title: 'Успешно',
        message: 'Номер удален.',
        type: 'success',
      });
      setDeleteModal({ isOpen: false });
      handleSearch();
    } catch (error) {
      console.error('Delete error:', error);
      setAlertModal({
        isOpen: true,
        title: 'Ошибка',
        message: 'Не удалось удалить номер.',
        type: 'error',
      });
    } finally {
      setIsDeleting(false);
    }
  }, [deleteModal, handleSearch]);

  const canGoBack = pagination.currentIndex > 0;
  const canGoNext =
    pagination.currentIndex < pagination.cursorStack.length - 1 && rooms.length > 0;

  return (
    <div className="min-h-screen bg-background">
      {/* ── Top Search Bar ──────────────────────────────────────────────── */}
      <div className="bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex flex-col md:flex-row gap-3 items-end">
            {/* Check-in */}
            <div className="flex-1 min-w-0">
              <label className={labelClass}>
                <Calendar size={12} className="inline mr-1" />
                Дата заезда
              </label>
              <input
                type="date"
                value={topCheckIn}
                min={getTodayDate()}
                onChange={(e) => {
                  setTopCheckIn(e.target.value);
                  if (e.target.value >= topCheckOut) {
                    const next = new Date(e.target.value);
                    next.setDate(next.getDate() + 1);
                    setTopCheckOut(next.toISOString().split('T')[0]);
                  }
                }}
                className={inputClass}
              />
            </div>

            {/* Check-out */}
            <div className="flex-1 min-w-0">
              <label className={labelClass}>
                <Calendar size={12} className="inline mr-1" />
                Дата выезда
              </label>
              <input
                type="date"
                value={topCheckOut}
                min={topCheckIn}
                onChange={(e) => setTopCheckOut(e.target.value)}
                className={inputClass}
              />
            </div>

            {/* Guests */}
            <div className="w-full md:w-36">
              <label className={labelClass}>
                <Users size={12} className="inline mr-1" />
                Гостей
              </label>
              <select
                value={topGuests}
                onChange={(e) => setTopGuests(Number(e.target.value))}
                className={inputClass}
              >
                {[1, 2, 3, 4, 5, 6].map((n) => (
                  <option key={n} value={n}>
                    {n} {n === 1 ? 'гость' : n < 5 ? 'гостя' : 'гостей'}
                  </option>
                ))}
              </select>
            </div>

            {/* Search button */}
            <div>
              <Button
                variant="primary"
                size="md"
                icon={<Search size={18} />}
                onClick={handleTopSearch}
                isLoading={isLoading}
                className="whitespace-nowrap"
              >
                Найти
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Main Content ────────────────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Left Sidebar - Filters */}
          <div className="lg:col-span-1">
            <FilterPanel
              filters={filters}
              onFiltersChange={setFilters}
              services={services}
              servicesLoading={servicesLoading}
              isLoading={isLoading}
              isAdmin={isAdmin || false}
              onSearch={handleSearch}
              onReset={handleReset}
            />
          </div>

          {/* Right Content - Results */}
          <div className="lg:col-span-3">
            {/* Title search bar + Admin button */}
            <div className="flex flex-col sm:flex-row gap-3 mb-6">
              <div className="flex-1 flex gap-2">
                <input
                  type="text"
                  placeholder="Поиск по названию номера..."
                  value={searchTitle}
                  onChange={(e) => setSearchTitle(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  className={inputClass}
                />
                <button
                  onClick={handleSearch}
                  disabled={isLoading}
                  className="px-4 py-2 bg-primary text-white rounded-md hover:bg-secondary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Search size={18} />
                </button>
              </div>

              {isAdmin && (
                <Button
                  variant="primary"
                  size="md"
                  icon={<Plus size={18} />}
                  onClick={() => navigate('/admin/rooms/new')}
                >
                  Добавить
                </Button>
              )}
            </div>

            {/* Results */}
            {isLoading && !hasSearched ? (
              // Initial loading shimmer
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {Array.from({ length: 6 }).map((_, i) => (
                  <ShimmerRoomCard key={i} />
                ))}
              </div>
            ) : hasSearched ? (
              <>
                <div className="flex items-center justify-between mb-5">
                  <h2 className="text-xl font-semibold text-text">Результаты поиска</h2>
                  <span className="text-sm text-text/60 bg-white px-3 py-1 rounded-full border border-gray-200">
                    Показано: <b>{totalCount}</b>
                  </span>
                </div>

                {isLoading ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <ShimmerRoomCard key={i} />
                    ))}
                  </div>
                ) : rooms.length > 0 ? (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 mb-8">
                      {rooms.map((room) => (
                        <RoomCard
                          key={room.roomNo}
                          room={room}
                          onView={handleViewRoom}
                          onEdit={isAdmin ? handleEditRoom : undefined}
                          onDelete={isAdmin ? handleDeleteRoom : undefined}
                          isAdmin={isAdmin}
                        />
                      ))}
                    </div>

                    {/* Pagination */}
                    <div className="flex items-center justify-between pt-6 border-t border-gray-200">
                      <Button
                        variant="tertiary"
                        size="sm"
                        icon={<ChevronLeft size={16} />}
                        onClick={handlePrevPage}
                        disabled={!canGoBack}
                      >
                        Назад
                      </Button>

                      <span className="text-sm text-text/60">
                        Страница {pagination.currentIndex + 1}
                      </span>

                      <Button
                        variant="tertiary"
                        size="sm"
                        icon={<ChevronRight size={16} />}
                        iconPosition="right"
                        onClick={handleNextPage}
                        disabled={!canGoNext}
                      >
                        Вперед
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="flex items-center justify-center py-16">
                    <div className="text-center">
                      <Search size={48} className="mx-auto mb-4 text-text/20" />
                      <p className="text-lg text-text/60 mb-2">Номера не найдены</p>
                      <button
                        onClick={handleReset}
                        className="text-primary hover:text-secondary font-medium transition-colors"
                      >
                        Попробуйте изменить фильтры
                      </button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="flex items-center justify-center py-16">
                <div className="text-center">
                  <Search size={48} className="mx-auto mb-4 text-text/30" />
                  <p className="text-lg text-text/60">
                    Выберите даты и нажмите «Найти» для поиска номеров
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modals */}
      <ConfirmModal
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal({ isOpen: false })}
        onConfirm={confirmDelete}
        title="Удалить номер?"
        message={`Вы уверены, что хотите удалить номер "${deleteModal.room?.title}"? Это действие невозможно отменить.`}
        isDangerous={true}
        isLoading={isDeleting}
        confirmText="Удалить"
        cancelText="Отмена"
      />

      <AlertModal
        isOpen={alertModal.isOpen}
        onClose={() => setAlertModal({ isOpen: false })}
        title={alertModal.title || 'Уведомление'}
        message={alertModal.message || ''}
        type={alertModal.type || 'info'}
        closeText="OK"
      />
    </div>
  );
});

export default RoomSearchPage;
