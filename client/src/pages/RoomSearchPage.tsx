import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Search,
  Plus,
  Calendar,
  Users,
  MapPin,
  SlidersHorizontal,
  ArrowUpNarrowWide,
  ArrowDownWideNarrow,
} from 'lucide-react';
import { INPUT_CLASS, FILTER_LABEL_CLASS } from '@/utils/formStyles';
import { CURRENCY_SYMBOL } from '@/utils/currency';
import Checkbox from '@/components/ui/Checkbox';
import useAppSelector from '@/hooks/useAppSelector';
import { searchRooms, getServices, deleteRoom } from '@/api/hotelApi';
import type { RoomSearchResult } from '@/api/hotelApi';
import RoomCard from '@/components/RoomCard';
import Button from '@/components/ui/Button';
import Shimmer, { ShimmerRoomCard } from '@/components/ui/Shimmer';
import ConfirmModal from '@/components/modals/ConfirmModal';
import AlertModal from '@/components/modals/AlertModal';
import type { Room, Service } from '@/types';

// ─── Types ───────────────────────────────────────────────────────────────────

interface SearchFilters {
  checkIn: string;
  checkOut: string;
  hotelCode?: string;
  floor?: number;
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

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getTodayDate(): string {
  return new Date().toISOString().split('T')[0];
}

function getTomorrowDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().split('T')[0];
}

/** Parse URLSearchParams → SearchFilters + top-bar state */
function parseUrlParams(sp: URLSearchParams): {
  filters: SearchFilters;
  title: string;
  guests: number;
} {
  const n = (key: string): number | undefined => {
    const v = sp.get(key);
    return v !== null && v !== '' ? Number(v) : undefined;
  };
  const s = (key: string): string | undefined => sp.get(key) || undefined;

  const checkIn = sp.get('checkIn') || getTodayDate();
  const checkOut = sp.get('checkOut') || getTomorrowDate();
  const guests = Number(sp.get('guests') || '1');
  const servicesRaw = sp.get('services');

  return {
    filters: {
      checkIn,
      checkOut,
      minCapacity: n('minCapacity') ?? (guests > 0 ? guests : undefined),
      maxCapacity: n('maxCapacity'),
      hotelCode: s('hotelCode'),
      floor: n('floor'),
      minPrice: n('minPrice'),
      maxPrice: n('maxPrice'),
      minBeds: n('minBeds'),
      maxBeds: n('maxBeds'),
      minArea: n('minArea'),
      maxArea: n('maxArea'),
      services: servicesRaw ? servicesRaw.split(',').filter(Boolean) : undefined,
      sortBy: s('sortBy'),
      sortOrder: (s('sortOrder') as 'asc' | 'desc') || undefined,
    },
    title: s('title') || '',
    guests,
  };
}

/** Serialize SearchFilters + top-bar state → URLSearchParams */
function buildUrlParams(
  filters: SearchFilters,
  title: string,
  guests: number,
): URLSearchParams {
  const sp = new URLSearchParams();
  const set = (key: string, value: string | number | undefined | null) => {
    if (value !== undefined && value !== null && value !== '') {
      sp.set(key, String(value));
    }
  };

  set('checkIn', filters.checkIn);
  set('checkOut', filters.checkOut);
  set('guests', guests);
  if (title) set('title', title);
  if (filters.hotelCode) set('hotelCode', filters.hotelCode);
  if (filters.floor) set('floor', filters.floor);
  if (filters.minPrice) set('minPrice', filters.minPrice);
  if (filters.maxPrice) set('maxPrice', filters.maxPrice);
  if (filters.minBeds) set('minBeds', filters.minBeds);
  if (filters.maxBeds) set('maxBeds', filters.maxBeds);
  // minCapacity from guests is the default; only write it if it differs from guests
  if (filters.minCapacity && filters.minCapacity !== guests) {
    set('minCapacity', filters.minCapacity);
  }
  if (filters.maxCapacity) set('maxCapacity', filters.maxCapacity);
  if (filters.minArea) set('minArea', filters.minArea);
  if (filters.maxArea) set('maxArea', filters.maxArea);
  if (filters.services && filters.services.length > 0) {
    sp.set('services', filters.services.join(','));
  }
  if (filters.sortBy) set('sortBy', filters.sortBy);
  if (filters.sortOrder) set('sortOrder', filters.sortOrder);

  return sp;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const PAGE_SIZE = 30; // 10 rows × 3 cards per row

// Aliases for brevity inside JSX — values come from the shared formStyles module.
const inputClass = INPUT_CLASS;
const labelClass = FILTER_LABEL_CLASS;

const SORT_OPTIONS = [
  { value: 'basePrice', label: 'Цена' },
  { value: 'capacity', label: 'Вместимость' },
  { value: 'bedsCount', label: 'Кровати' },
  { value: 'floor', label: 'Этаж' },
  { value: 'area', label: 'Площадь' },
];

// ─── Filter Panel ─────────────────────────────────────────────────────────────

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
  onFiltersChange: (f: SearchFilters) => void;
  services: Service[];
  servicesLoading: boolean;
  isLoading: boolean;
  isAdmin: boolean;
  onSearch: () => void;
  onReset: () => void;
}) {
  const handleChange = useCallback(
    (key: keyof SearchFilters, value: any) => onFiltersChange({ ...filters, [key]: value }),
    [filters, onFiltersChange],
  );

  const handleServiceToggle = (code: string) => {
    const cur = filters.services || [];
    const updated = cur.includes(code) ? cur.filter((c) => c !== code) : [...cur, code];
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
          {/* ── Sort — first ──────────────────────────────────────────── */}
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
                  className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                    (filters.sortOrder || 'asc') === order
                      ? 'bg-primary text-white'
                      : 'bg-ui text-text hover:bg-gray-300'
                  }`}
                >
                  {order === 'asc' ? (
                    <ArrowUpNarrowWide size={14} />
                  ) : (
                    <ArrowDownWideNarrow size={14} />
                  )}
                  {order === 'asc' ? 'Возрастание' : 'Убывание'}
                </button>
              ))}
            </div>
          </div>

          {/* ── Price ────────────────────────────────────────────────── */}
          <div>
            <label className={labelClass}>Цена за ночь ({CURRENCY_SYMBOL})</label>
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

          {/* ── Floor ────────────────────────────────────────────────── */}
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

          {/* ── Beds ─────────────────────────────────────────────────── */}
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

          {/* ── Capacity ─────────────────────────────────────────────── */}
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

          {/* ── Area ─────────────────────────────────────────────────── */}
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

          {/* ── Hotel Code (admin) ────────────────────────────────────── */}
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

          {/* ── Services — auto height, no scroll ────────────────────── */}
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
              <div className="space-y-1.5 mt-2">
                {services.map((svc) => (
                  <label
                    key={svc.serviceCode}
                    className="flex items-center gap-2.5 cursor-pointer p-1.5 rounded hover:bg-ui transition-colors"
                  >
                    <Checkbox
                      checked={(filters.services || []).includes(svc.serviceCode)}
                      onChange={() => handleServiceToggle(svc.serviceCode)}
                    />
                    <span className="text-sm text-text">{svc.title}</span>
                  </label>
                ))}
              </div>
            ) : (
              <p className="text-xs text-text/40 mt-2">Нет доступных услуг</p>
            )}
          </div>

          {/* ── Apply ────────────────────────────────────────────────── */}
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

// ─── Row skeleton (exactly one row = 3 cards on xl) ──────────────────────────

function RowShimmer() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
      <ShimmerRoomCard />
      <ShimmerRoomCard />
      <ShimmerRoomCard />
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

const RoomSearchPage = memo(function RoomSearchPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const user = useAppSelector((s) => s.auth.user);
  const isAdmin = user?.role?.name === 'admin';

  // ── Parse initial state from URL ─────────────────────────────────────────
  const { filters: initialFilters, title: initialTitle, guests: initialGuests } =
    parseUrlParams(searchParams);

  // Top search bar
  const [topCheckIn, setTopCheckIn] = useState(initialFilters.checkIn);
  const [topCheckOut, setTopCheckOut] = useState(initialFilters.checkOut);
  const [topGuests, setTopGuests] = useState(initialGuests);

  // Sidebar filters
  const [filters, setFilters] = useState<SearchFilters>(initialFilters);
  const [searchTitle, setSearchTitle] = useState(initialTitle);

  // Results
  const [rooms, setRooms] = useState<Room[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [servicesLoading, setServicesLoading] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  // Infinite scroll cursor
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);

  // Sentinel for IntersectionObserver
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  // Mobile filter panel visibility
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Modals
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

  // ── Load services ─────────────────────────────────────────────────────────

  useEffect(() => {
    getServices()
      .then(({ services: s }) => setServices(s.filter((svc) => svc.isActive)))
      .catch((err) => console.error('Failed to load services:', err))
      .finally(() => setServicesLoading(false));
  }, []);

  // ── Core search ───────────────────────────────────────────────────────────

  const performSearch = useCallback(
    async (
      overrideFilters?: SearchFilters,
      overrideTitle?: string,
      overrideGuests?: number,
      cursor?: string | null,
      append = false,
    ) => {
      const f = overrideFilters ?? filters;
      const t = overrideTitle ?? searchTitle;
      const g = overrideGuests ?? topGuests;

      if (append) setIsLoadingMore(true);
      else setIsLoading(true);

      // Sync URL with current search state (only on fresh search, not append)
      if (!append) {
        setSearchParams(buildUrlParams(f, t, g), { replace: true });
      }

      try {
        const params = {
          ...f,
          title: t || undefined,
          services: f.services?.join(','),
          cursor: cursor ?? undefined,
          limit: PAGE_SIZE,
        };
        const result: RoomSearchResult = await searchRooms(params);

        if (append) {
          setRooms((prev) => [...prev, ...result.rooms]);
        } else {
          setRooms(result.rooms);
        }

        setHasMore(result.pagination.hasNextPage);
        setNextCursor(result.pagination.nextCursor);
        setHasSearched(true);
      } catch (err) {
        console.error('Search error:', err);
        setAlertModal({
          isOpen: true,
          title: 'Ошибка',
          message: 'Не удалось загрузить номера. Попробуйте позже.',
          type: 'error',
        });
      } finally {
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    },
    [filters, searchTitle, topGuests, setSearchParams],
  );

  // ── Auto-search on mount ──────────────────────────────────────────────────

  const initialSearchDone = useRef(false);
  useEffect(() => {
    if (!initialSearchDone.current) {
      initialSearchDone.current = true;
      performSearch(initialFilters, initialTitle, initialGuests, null, false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── IntersectionObserver ──────────────────────────────────────────────────

  useEffect(() => {
    if (!sentinelRef.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && hasMore && !isLoading && !isLoadingMore) {
          performSearch(undefined, undefined, undefined, nextCursor, true);
        }
      },
      { rootMargin: '200px' },
    );
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [hasMore, isLoading, isLoadingMore, nextCursor, performSearch]);

  // ── Top bar search ────────────────────────────────────────────────────────

  const handleTopSearch = useCallback(() => {
    const newFilters: SearchFilters = {
      ...filters,
      checkIn: topCheckIn,
      checkOut: topCheckOut,
      minCapacity: topGuests || undefined,
    };
    setFilters(newFilters);
    setRooms([]);
    setNextCursor(null);
    setHasMore(false);
    performSearch(newFilters, undefined, topGuests, null, false);
  }, [topCheckIn, topCheckOut, topGuests, filters, performSearch]);

  // ── Sidebar apply ─────────────────────────────────────────────────────────

  const handleSearch = useCallback(() => {
    setRooms([]);
    setNextCursor(null);
    setHasMore(false);
    performSearch(undefined, undefined, undefined, null, false);
  }, [performSearch]);

  // ── Reset ─────────────────────────────────────────────────────────────────

  const handleReset = useCallback(() => {
    const resetFilters: SearchFilters = {
      checkIn: topCheckIn,
      checkOut: topCheckOut,
      minCapacity: topGuests || undefined,
    };
    setFilters(resetFilters);
    setSearchTitle('');
    setRooms([]);
    setNextCursor(null);
    setHasMore(false);
    setHasSearched(false);
    setSearchParams(buildUrlParams(resetFilters, '', topGuests), { replace: true });
  }, [topCheckIn, topCheckOut, topGuests, setSearchParams]);

  // ── Room actions ──────────────────────────────────────────────────────────

  const handleViewRoom = useCallback(
    (room: Room) =>
      navigate(`/rooms/${room.roomNo}`, {
        state: { checkIn: topCheckIn, checkOut: topCheckOut },
      }),
    [navigate, topCheckIn, topCheckOut],
  );
  const handleEditRoom = useCallback(
    (room: Room) => navigate(`/admin/rooms/${room.roomNo}`),
    [navigate],
  );
  const handleDeleteRoom = useCallback((room: Room) => {
    setDeleteModal({ isOpen: true, room });
  }, []);

  const confirmDelete = useCallback(async () => {
    if (!deleteModal.room) return;
    setIsDeleting(true);
    try {
      await deleteRoom(deleteModal.room.roomNo);
      setAlertModal({ isOpen: true, title: 'Успешно', message: 'Номер удален.', type: 'success' });
      setDeleteModal({ isOpen: false });
      setRooms([]);
      setNextCursor(null);
      setHasMore(false);
      performSearch(undefined, undefined, undefined, null, false);
    } catch {
      setAlertModal({
        isOpen: true,
        title: 'Ошибка',
        message: 'Не удалось удалить номер.',
        type: 'error',
      });
    } finally {
      setIsDeleting(false);
    }
  }, [deleteModal, performSearch]);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background">
      {/* ── Top Search Bar ──────────────────────────────────────────── */}
      <div className="bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex flex-col md:flex-row gap-3 md:items-end">
            {/* Dates — side-by-side on mobile, flat flex items on desktop */}
            <div className="flex gap-2 md:contents">
              {/* Check-in */}
              <div className="flex-1 min-w-0">
                <label className={labelClass}>
                  <Calendar size={12} className="inline mr-1" />
                  Заезд
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
                  Выезд
                </label>
                <input
                  type="date"
                  value={topCheckOut}
                  min={topCheckIn}
                  onChange={(e) => setTopCheckOut(e.target.value)}
                  className={inputClass}
                />
              </div>
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

            {/* Search */}
            <Button
              variant="primary"
              size="md"
              icon={<Search size={18} />}
              onClick={handleTopSearch}
              isLoading={isLoading}
              className="w-full md:w-auto whitespace-nowrap"
            >
              Найти
            </Button>
          </div>
        </div>
      </div>

      {/* ── Main Content ────────────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Mobile filter toggle — hidden on lg+ */}
        <div className="lg:hidden mb-4">
          <Button
            variant={filtersOpen ? 'primary' : 'secondary'}
            size="sm"
            icon={<SlidersHorizontal size={16} />}
            onClick={() => setFiltersOpen((v) => !v)}
            className="w-full"
          >
            {filtersOpen ? 'Скрыть фильтры' : 'Фильтры'}
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar — always visible on lg+, toggleable on mobile */}
          <div className={`lg:col-span-1 ${filtersOpen ? 'block' : 'hidden'} lg:block`}>
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

          {/* Results */}
          <div className="lg:col-span-3">
            {/* Title search + admin button */}
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

            {/* Results area */}
            {isLoading && rooms.length === 0 ? (
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
                    Показано: <b>{rooms.length}</b>
                  </span>
                </div>

                {rooms.length > 0 ? (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
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

                    {/* Infinite scroll row skeleton */}
                    {isLoadingMore && (
                      <div className="mt-6">
                        <RowShimmer />
                      </div>
                    )}

                    {/* Sentinel */}
                    {hasMore && !isLoadingMore && (
                      <div ref={sentinelRef} className="h-4 mt-4" />
                    )}

                    {!hasMore && rooms.length > 0 && (
                      <p className="text-center text-text/40 text-sm mt-8 pb-4">
                        Все номера загружены
                      </p>
                    )}
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
        isDangerous
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
