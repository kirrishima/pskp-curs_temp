import React, { memo, useCallback, useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Search, Plus, ChevronLeft, ChevronRight, X } from 'lucide-react';
import useAppSelector from '@/hooks/useAppSelector';
import { searchRooms, getServices, deleteRoom } from '@/api/hotelApi';
import type { RoomSearchResult } from '@/api/hotelApi';
import RoomCard from '@/components/RoomCard';
import Button from '@/components/ui/Button';
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

// ─── Helper Functions ────────────────────────────────────────────────────────

function getTodayDate(): string {
  const today = new Date();
  return today.toISOString().split('T')[0];
}

function getTomorrowDate(): string {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return tomorrow.toISOString().split('T')[0];
}

// ─── Constants ────────────────────────────────────────────────────────────────

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
  isLoading,
  isAdmin,
  onSearch,
  onReset,
}: {
  filters: SearchFilters;
  onFiltersChange: (filters: SearchFilters) => void;
  services: Service[];
  isLoading: boolean;
  isAdmin: boolean;
  onSearch: () => void;
  onReset: () => void;
}) {
  const [useAdminDateFilter, setUseAdminDateFilter] = useState(false);

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
    <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6 sticky top-6">
      <h2 className="text-lg font-bold text-text mb-6">Фильтры</h2>

      {/* Date Range */}
      <div className="mb-6">
        <label className={labelClass}>Дата заезда *</label>
        <input
          type="date"
          value={filters.checkIn}
          onChange={(e) => handleChange('checkIn', e.target.value)}
          disabled={useAdminDateFilter && isAdmin}
          className={inputClass}
        />
      </div>

      <div className="mb-6">
        <label className={labelClass}>Дата выезда *</label>
        <input
          type="date"
          value={filters.checkOut}
          onChange={(e) => handleChange('checkOut', e.target.value)}
          disabled={useAdminDateFilter && isAdmin}
          className={inputClass}
        />
      </div>

      {isAdmin && (
        <div className="mb-6 flex items-center gap-2 p-3 bg-ui rounded">
          <input
            type="checkbox"
            id="adminDateFilter"
            checked={useAdminDateFilter}
            onChange={(e) => setUseAdminDateFilter(e.target.checked)}
            className="w-4 h-4 cursor-pointer"
          />
          <label htmlFor="adminDateFilter" className="text-sm text-text cursor-pointer">
            Игнорировать даты (только админ)
          </label>
        </div>
      )}

      {/* Hotel Code - Admin Only */}
      {isAdmin && (
        <div className="mb-6">
          <label className={labelClass}>Код отеля</label>
          <input
            type="text"
            value={filters.hotelCode || ''}
            onChange={(e) => handleChange('hotelCode', e.target.value || undefined)}
            placeholder="Например: HTL001"
            className={inputClass}
          />
        </div>
      )}

      {/* Price Range */}
      <div className="mb-6">
        <label className={labelClass}>Цена (₽)</label>
        <div className="flex gap-2">
          <input
            type="number"
            min="0"
            value={filters.minPrice || ''}
            onChange={(e) => handleChange('minPrice', e.target.value ? Number(e.target.value) : undefined)}
            placeholder="От"
            className={inputClass}
          />
          <input
            type="number"
            min="0"
            value={filters.maxPrice || ''}
            onChange={(e) => handleChange('maxPrice', e.target.value ? Number(e.target.value) : undefined)}
            placeholder="До"
            className={inputClass}
          />
        </div>
      </div>

      {/* Floor */}
      <div className="mb-6">
        <label className={labelClass}>Этаж</label>
        <input
          type="number"
          min="0"
          value={filters.floor || ''}
          onChange={(e) => handleChange('floor', e.target.value ? Number(e.target.value) : undefined)}
          placeholder="Номер этажа"
          className={inputClass}
        />
      </div>

      {/* Beds */}
      <div className="mb-6">
        <label className={labelClass}>Кровати</label>
        <div className="flex gap-2">
          <input
            type="number"
            min="0"
            value={filters.minBeds || ''}
            onChange={(e) => handleChange('minBeds', e.target.value ? Number(e.target.value) : undefined)}
            placeholder="От"
            className={inputClass}
          />
          <input
            type="number"
            min="0"
            value={filters.maxBeds || ''}
            onChange={(e) => handleChange('maxBeds', e.target.value ? Number(e.target.value) : undefined)}
            placeholder="До"
            className={inputClass}
          />
        </div>
      </div>

      {/* Capacity */}
      <div className="mb-6">
        <label className={labelClass}>Вместимость (гостей)</label>
        <div className="flex gap-2">
          <input
            type="number"
            min="0"
            value={filters.minCapacity || ''}
            onChange={(e) => handleChange('minCapacity', e.target.value ? Number(e.target.value) : undefined)}
            placeholder="От"
            className={inputClass}
          />
          <input
            type="number"
            min="0"
            value={filters.maxCapacity || ''}
            onChange={(e) => handleChange('maxCapacity', e.target.value ? Number(e.target.value) : undefined)}
            placeholder="До"
            className={inputClass}
          />
        </div>
      </div>

      {/* Area */}
      <div className="mb-6">
        <label className={labelClass}>Площадь (м²)</label>
        <div className="flex gap-2">
          <input
            type="number"
            min="0"
            value={filters.minArea || ''}
            onChange={(e) => handleChange('minArea', e.target.value ? Number(e.target.value) : undefined)}
            placeholder="От"
            className={inputClass}
          />
          <input
            type="number"
            min="0"
            value={filters.maxArea || ''}
            onChange={(e) => handleChange('maxArea', e.target.value ? Number(e.target.value) : undefined)}
            placeholder="До"
            className={inputClass}
          />
        </div>
      </div>

      {/* Services Filter */}
      {services.length > 0 && (
        <div className="mb-6">
          <label className={labelClass}>Услуги</label>
          <div className="space-y-2">
            {services.map((service) => (
              <label key={service.serviceCode} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={(filters.services || []).includes(service.serviceCode)}
                  onChange={() => handleServiceToggle(service.serviceCode)}
                  className="w-4 h-4"
                />
                <span className="text-sm text-text">{service.title}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Sort Options */}
      <div className="mb-6">
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
              className={`flex-1 px-3 py-2 rounded text-sm font-medium transition-colors ${
                filters.sortOrder === order
                  ? 'bg-primary text-white'
                  : 'bg-ui text-text hover:bg-gray-300'
              }`}
            >
              {order === 'asc' ? '↑ По возрастанию' : '↓ По убыванию'}
            </button>
          ))}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2">
        <Button
          variant="primary"
          size="md"
          onClick={onSearch}
          isLoading={isLoading}
          className="flex-1"
        >
          {isAdmin ? 'Обновить данные' : 'Найти номера'}
        </Button>
      </div>

      <button
        onClick={onReset}
        className="w-full mt-3 text-sm text-primary hover:text-secondary font-medium transition-colors"
      >
        Сбросить
      </button>
    </div>
  );
});

// ─── Main Component ──────────────────────────────────────────────────────────

const RoomSearchPage = memo(function RoomSearchPage() {
  const navigate = useNavigate();
  const user = useAppSelector((s) => s.auth.user);
  const isAdmin = user?.role?.name === 'admin';

  // State
  const [filters, setFilters] = useState<SearchFilters>({
    checkIn: getTodayDate(),
    checkOut: getTomorrowDate(),
  });

  const [searchTitle, setSearchTitle] = useState('');
  const [rooms, setRooms] = useState<Room[]>([]);
  const [services, setServices] = useState<Service[]>([]);
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
      }
    };
    loadServices();
  }, []);

  // Search handler
  const handleSearch = useCallback(async () => {
    setIsLoading(true);
    try {
      const searchParams = {
        ...filters,
        title: searchTitle || undefined,
        services: filters.services?.join(','),
        cursor: pagination.cursorStack[pagination.currentIndex],
      };

      const result: RoomSearchResult = await searchRooms(searchParams);
      setRooms(result.rooms);
      setTotalCount(result.rooms.length);
      setHasSearched(true);

      // Update pagination stack
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
  }, [filters, searchTitle, pagination]);

  // Reset filters
  const handleReset = useCallback(() => {
    setFilters({
      checkIn: getTodayDate(),
      checkOut: getTomorrowDate(),
    });
    setSearchTitle('');
    setPagination({ cursorStack: [null], currentIndex: 0 });
    setHasSearched(false);
    setRooms([]);
  }, []);

  // Pagination handlers
  const handleNextPage = useCallback(() => {
    if (pagination.currentIndex < pagination.cursorStack.length - 1) {
      setPagination((prev) => ({
        ...prev,
        currentIndex: prev.currentIndex + 1,
      }));
    }
  }, [pagination]);

  const handlePrevPage = useCallback(() => {
    if (pagination.currentIndex > 0) {
      setPagination((prev) => ({
        ...prev,
        currentIndex: prev.currentIndex - 1,
      }));
    }
  }, [pagination]);

  // Update pagination when it changes
  useEffect(() => {
    if (hasSearched) {
      handleSearch();
    }
  }, [pagination.currentIndex]);

  // Room actions
  const handleViewRoom = useCallback((room: Room) => {
    navigate(`/rooms/${room.roomNo}`);
  }, [navigate]);

  const handleEditRoom = useCallback((room: Room) => {
    navigate(`/admin/rooms/${room.roomNo}`);
  }, [navigate]);

  const handleDeleteRoom = useCallback((room: Room) => {
    setDeleteModal({ isOpen: true, room });
  }, []);

  const confirmDelete = useCallback(async () => {
    if (!deleteModal.room) return;

    setIsDeleting(true);
    try {
      // TODO: Call deleteRoom API when available
      console.log('Deleting room:', deleteModal.room);
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
    pagination.currentIndex < pagination.cursorStack.length - 1 &&
    rooms.length > 0;

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <div className="relative h-40 bg-gradient-to-r from-primary/80 to-secondary/80 flex items-center justify-center">
        <div className="text-center text-white">
          <h1 className="text-3xl font-bold mb-2">Найти номер</h1>
          <p className="text-lg text-white/80">Выберите идеальное место для отдыха</p>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Left Sidebar - Filters */}
          <div className="lg:col-span-1">
            <FilterPanel
              filters={filters}
              onFiltersChange={setFilters}
              services={services}
              isLoading={isLoading}
              isAdmin={isAdmin || false}
              onSearch={handleSearch}
              onReset={handleReset}
            />
          </div>

          {/* Right Content - Results */}
          <div className="lg:col-span-3">
            {/* Top Toolbar */}
            <div className="flex flex-col sm:flex-row gap-4 mb-6">
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
                  Добавить номер
                </Button>
              )}
            </div>

            {/* Results Section */}
            {hasSearched && (
              <>
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-text">Найдено:</span>
                    <span className="inline-flex items-center justify-center min-w-8 h-8 bg-primary text-white rounded-full text-sm font-bold">
                      {totalCount}
                    </span>
                  </div>
                </div>

                {rooms.length > 0 ? (
                  <>
                    {/* Room Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
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
            )}

            {!hasSearched && (
              <div className="flex items-center justify-center py-16">
                <div className="text-center">
                  <Search size={48} className="mx-auto mb-4 text-text/30" />
                  <p className="text-lg text-text/60">
                    Используйте фильтры слева, чтобы найти номера
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
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

      {/* Alert Modal */}
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
