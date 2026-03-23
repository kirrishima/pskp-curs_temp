import React, { useEffect, useState, useMemo } from "react";
import { Room, User } from "../types";
import {
  deleteRoom,
  STATIC_IMAGES_URL,
  getRooms,
} from "../services/oracleApiService";
import RoomCard from "../components/RoomCard";
import Button, { ButtonVariant } from "../components/Button";
import ErrorAlert from "../components/ErrorAlert";
import { ConfirmModal, AlertModal } from "../components/Modal";
import { useNavigate, Link } from "react-router-dom";
import { Calendar, Search, Plus, Filter, SlidersHorizontal, Image as ImageIcon, ChevronLeft, ChevronRight, ToggleLeft, ToggleRight, Check } from "lucide-react";

interface HomeProps {
  user: User | null;
}

const ITEMS_PER_PAGE = 30;

// Styles copied from BookingsManager for consistency
const inputClass = "w-full px-3 py-2 bg-white border border-gray-300 rounded-md outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-shadow text-sm text-text disabled:bg-gray-100 disabled:text-gray-400";
const labelClass = "block text-xs font-bold text-text/50 uppercase tracking-wider mb-1";

export default function Home({ user }: HomeProps) {
  const navigate = useNavigate();

  // Raw data from API (which corresponds to the current page from server)
  const [rawRooms, setRawRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<{ status: string; message: string } | null>(null);

  // Search & Filter State
  const [searchTitle, setSearchTitle] = useState("");
  const [filters, setFilters] = useState({
    startDate: new Date().toISOString().split("T")[0],
    endDate: new Date(Date.now() + 86400000).toISOString().split("T")[0],
    minPrice: "",
    maxPrice: "",
    floor: "",
    capacity: "",
    hasPhotos: false,
    status: "", // Manager only
    hotelCode: "",
  });

  // Manager specific: Date filter toggle
  const [useDateFilter, setUseDateFilter] = useState(true);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);

  // Modal State
  const [roomToDelete, setRoomToDelete] = useState<Room | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Update: Check for Manager (1) OR Admin (0)
  const isManager = user?.roleId === 1 || user?.roleId === 0;

  // Modified fetchRooms to accept overrides. This allows "Reset" to fetch immediately with new values
  // before state updates trigger a re-render.
  const fetchRooms = async (
    overrideFilters = filters,
    overrideTitle = searchTitle,
    overrideUseDate = useDateFilter
  ) => {
    setLoading(true);
    setError(null);

    try {
      // Base params
      const params: any = {
        index: currentPage,
        size: ITEMS_PER_PAGE,
        includeImages: true,
        includeServices: true,
        title: overrideTitle, // Always pass title if present
      };

      // 1. Role & Status Logic
      if (isManager) {
        // Manager can filter by status and hotel code
        if (overrideFilters.status) params.status = overrideFilters.status;
        if (overrideFilters.hotelCode) params.hotelCode = overrideFilters.hotelCode;
      } else {
        // Regular user: force AVAILABLE status
        params.status = 'AVAILABLE';
      }

      // 2. Date Logic
      // Manager can toggle dates off. User always uses dates.
      const shouldIncludeDates = isManager ? overrideUseDate : true;
      if (shouldIncludeDates) {
        params.startDate = overrideFilters.startDate;
        params.endDate = overrideFilters.endDate;
      }

      // 3. Attribute Filters Logic
      // If title is entered, ignore secondary filters to avoid over-constraining
      if (!overrideTitle) {
        if (overrideFilters.minPrice) params.minPrice = overrideFilters.minPrice;
        if (overrideFilters.maxPrice) params.maxPrice = overrideFilters.maxPrice;
        if (overrideFilters.floor) params.floor = overrideFilters.floor;
        if (overrideFilters.capacity) params.capacity = overrideFilters.capacity;
        if (overrideFilters.hasPhotos) params.hasPhoto = overrideFilters.hasPhotos;
      }

      const res = await getRooms(params);

      if (res.status === "OK" && res.data) {
        setRawRooms(res.data);
      } else {
        setError({ status: res.status, message: res.message });
        setRawRooms([]);
      }
    } catch (err) {
      setError({ status: "ERROR", message: "Ошибка загрузки данных" });
      setRawRooms([]);
    } finally {
      setLoading(false);
    }
  };

  // Fetch only when page changes (pagination) or explicitly called
  useEffect(() => {
    fetchRooms();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, user]); 

  // Handler to trigger search/update
  const handleUpdate = () => {
    if (currentPage === 1) {
      fetchRooms();
    } else {
      setCurrentPage(1); // This triggers useEffect -> fetchRooms
    }
  };

  const handlePageChange = (newPage: number) => {
    if (newPage < 1) return;
    setCurrentPage(newPage);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleBookClick = (room: Room) => {
    if (!user) {
      navigate("/login");
      return;
    }
    // Navigate to Checkout page with state
    navigate('/checkout', { 
      state: { 
        room, 
        startDate: filters.startDate, 
        endDate: filters.endDate 
      } 
    });
  };

  const handleEditRoom = (room: Room) => {
    navigate(`/manager/room/${room.roomNo}`);
  };

  const handleDeleteRoom = (room: Room) => {
    setRoomToDelete(room);
  };

  const confirmDelete = async () => {
    if (!roomToDelete) return;
    const res = await deleteRoom(roomToDelete.roomNo);
    if (res.status === "OK") {
      setRoomToDelete(null);
      setSuccessMessage(`Номер ${roomToDelete.roomNo} успешно удален`);
      fetchRooms();
    } else {
      alert(`Ошибка удаления: ${res.message}`);
      setRoomToDelete(null);
    }
  };

  const clearFilters = () => {
    const resetFilters = {
      startDate: new Date().toISOString().split("T")[0],
      endDate: new Date(Date.now() + 86400000).toISOString().split("T")[0],
      minPrice: "",
      maxPrice: "",
      floor: "",
      capacity: "",
      hasPhotos: false,
      status: "",
      hotelCode: "",
    };
    
    // Update State
    setFilters(resetFilters);
    setSearchTitle("");
    setUseDateFilter(true);
    setCurrentPage(1);

    // Immediate Fetch with reset values
    fetchRooms(resetFilters, "", true);
  };

  return (
    <div className="flex flex-col gap-8 pb-24">
      {/* Hero Section */}
      <section className="relative h-[400px] w-full bg-gray-900 text-white overflow-hidden">
        <div className="absolute inset-0 bg-black/40 z-10"></div>
        <img
          src={`${STATIC_IMAGES_URL}/hero_home.png`}
          alt="Luxury Lobby"
          className="absolute inset-0 w-full h-full object-cover"
          onError={(e) => {
            (e.target as HTMLImageElement).src = "https://picsum.photos/1920/1080?grayscale";
          }}
        />
        <div className="relative z-20 h-full flex flex-col items-center justify-center text-center px-4 max-w-4xl mx-auto gap-6">
          <h1 className="text-4xl md:text-5xl font-light tracking-tight font-serif">
            Почувствуйте <span className="italic text-secondary">Искусство</span> Жизни
          </h1>
        </div>
      </section>

      {/* Main Content Area */}
      <section className="max-w-[1440px] mx-auto px-4 w-full -mt-20 relative z-30">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Left Sidebar Filters */}
          <aside className="w-full lg:w-1/4 flex-shrink-0 space-y-6">
            <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100 sticky top-24">
              <div className="flex justify-between items-center mb-4 pb-4 border-b border-gray-100">
                <h3 className="font-bold text-lg text-text flex items-center gap-2">
                  <SlidersHorizontal size={18} /> Фильтры
                </h3>
                <button onClick={clearFilters} className="text-xs text-primary hover:underline">
                  Сбросить
                </button>
              </div>

              <div className="space-y-6">
                {/* Dates */}
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <label className={labelClass}>
                      Даты проживания
                    </label>
                    {isManager && (
                      <button 
                        onClick={() => setUseDateFilter(!useDateFilter)}
                        className={`text-xs flex items-center gap-1 ${useDateFilter ? 'text-primary' : 'text-gray-400'}`}
                        title={useDateFilter ? "Фильтр по датам включен" : "Фильтр по датам выключен"}
                      >
                        {useDateFilter ? <ToggleRight size={24} /> : <ToggleLeft size={24} />}
                      </button>
                    )}
                  </div>
                  
                  <div className={`space-y-2 transition-opacity ${(!useDateFilter && isManager) ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
                    <div className="relative">
                      <Calendar size={14} className="absolute left-3 top-3 text-text/50" />
                      <input
                        type="date"
                        className={`${inputClass} pl-9`}
                        value={filters.startDate}
                        onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                        disabled={isManager && !useDateFilter}
                      />
                    </div>
                    <div className="relative">
                      <Calendar size={14} className="absolute left-3 top-3 text-text/50" />
                      <input
                        type="date"
                        className={`${inputClass} pl-9`}
                        value={filters.endDate}
                        onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                        disabled={isManager && !useDateFilter}
                      />
                    </div>
                  </div>
                  <Button
                    text={isManager ? "Обновить данные" : "Найти номера"}
                    className="w-full py-2 text-sm"
                    onClick={handleUpdate}
                    isLoading={loading}
                  />
                </div>

                <div className="h-px bg-gray-100" />

                {/* Status (Manager) */}
                {isManager && (
                  <div className="space-y-2">
                    <label className={labelClass}>Статус номера</label>
                    <select
                      className={inputClass}
                      value={filters.status}
                      onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                    >
                      <option value="">Все статусы</option>
                      <option value="AVAILABLE">Свободен</option>
                      <option value="BOOKED">Занят</option>
                      <option value="MAINTENANCE">Обслуживание</option>
                    </select>
                  </div>
                )}

                {/* Hotel Code (Manager) */}
                {isManager && (
                  <div className="space-y-2">
                    <label className={labelClass}>Код отеля</label>
                    <input
                      type="text"
                      placeholder="Напр. MOONGLOW"
                      className={inputClass}
                      value={filters.hotelCode}
                      onChange={(e) => setFilters({ ...filters, hotelCode: e.target.value })}
                    />
                  </div>
                )}

                {/* Price Range */}
                <div className="space-y-2">
                  <label className={labelClass}>Цена за ночь (₽)</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      placeholder="От"
                      className={inputClass}
                      value={filters.minPrice}
                      onChange={(e) => setFilters({ ...filters, minPrice: e.target.value })}
                    />
                    <span className="text-gray-400">-</span>
                    <input
                      type="number"
                      placeholder="До"
                      className={inputClass}
                      value={filters.maxPrice}
                      onChange={(e) => setFilters({ ...filters, maxPrice: e.target.value })}
                    />
                  </div>
                </div>

                {/* Characteristics */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className={labelClass}>Этаж</label>
                    <input
                      type="number"
                      className={inputClass}
                      value={filters.floor}
                      onChange={(e) => setFilters({ ...filters, floor: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className={labelClass}>Мест</label>
                    <input
                      type="number"
                      className={inputClass}
                      value={filters.capacity}
                      onChange={(e) => setFilters({ ...filters, capacity: e.target.value })}
                    />
                  </div>
                </div>

                {/* Has Photos Checkbox */}
                <div className="pt-2">
                  <label className="flex items-center gap-3 p-3 border border-gray-200 rounded-md cursor-pointer hover:bg-gray-50 transition-colors bg-white">
                    <div className="relative flex items-center justify-center">
                        <input
                            type="checkbox"
                            className="peer appearance-none w-5 h-5 border border-gray-300 rounded checked:bg-primary checked:border-primary focus:outline-none transition-colors"
                            checked={filters.hasPhotos}
                            onChange={(e) => setFilters({ ...filters, hasPhotos: e.target.checked })}
                        />
                        <Check size={14} className="absolute text-white opacity-0 peer-checked:opacity-100 pointer-events-none transition-opacity" strokeWidth={3} />
                    </div>
                    <span className="text-sm font-medium text-text select-none">Только с фото</span>
                    <ImageIcon size={16} className="text-text/40 ml-auto" />
                  </label>
                </div>
              </div>
            </div>
          </aside>

          {/* Right Content */}
          <div className="w-full lg:w-3/4 flex flex-col gap-6">
            {/* Search Bar & Toolbar */}
            <div className="bg-white p-4 rounded-xl shadow-lg border border-gray-100 flex flex-col md:flex-row gap-4 justify-between items-center">
              <div className="flex-grow w-full flex items-center gap-2">
                <div className="relative flex-grow">
                    <input
                        type="text"
                        placeholder="Поиск по названию номера..."
                        className={inputClass}
                        value={searchTitle}
                        onChange={(e) => setSearchTitle(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") {
                                handleUpdate();
                            }
                        }}
                    />
                </div>
                <Button
                    text=""
                    variant={ButtonVariant.Primary}
                    icon={<Search size={20} />}
                    className="p-3 w-12 h-12 flex items-center justify-center !px-0"
                    onClick={handleUpdate}
                />
              </div>
              {isManager && (
                <Link to="/manager/room/new" className="flex-shrink-0 w-full md:w-auto">
                  <Button
                    text="Добавить номер"
                    variant={ButtonVariant.Primary}
                    icon={<Plus size={18} />}
                    className="w-full"
                  />
                </Link>
              )}
            </div>

            {/* Results */}
            <div id="room-results">
              <div className="flex justify-between items-end mb-4">
                <h2 className="text-2xl font-serif text-text">
                  {isManager ? "Управление номерами" : "Результаты поиска"}
                </h2>
                <span className="text-sm text-text/60 bg-white px-3 py-1 rounded-full border border-gray-200">
                  {rawRooms.length > 0 ? "Показано на странице" : "Найдено"}: <b>{rawRooms.length}</b>
                </span>
              </div>

              <ErrorAlert error={error} />

              {loading ? (
                <div className="flex justify-center py-20 bg-white rounded-xl shadow-sm border border-gray-100">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
                </div>
              ) : rawRooms.length > 0 ? (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                    {rawRooms.map((room) => (
                      <RoomCard
                        key={room.roomNo}
                        room={room}
                        onBook={handleBookClick}
                        onEdit={handleEditRoom}
                        onDelete={handleDeleteRoom}
                        userRole={user?.roleId}
                      />
                    ))}
                  </div>

                  {/* Server-Side Pagination Controls */}
                  <div className="flex justify-center items-center mt-8 gap-4">
                    <Button
                      text="Назад"
                      variant={ButtonVariant.Tertiary}
                      icon={<ChevronLeft size={16} />}
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={currentPage === 1 || loading}
                      className="pl-2 pr-4"
                    />
                    <span className="text-sm font-medium text-text/60 bg-white px-4 py-2 rounded-md border border-ui">
                      Страница {currentPage}
                    </span>
                    <Button
                      text="Вперед"
                      variant={ButtonVariant.Tertiary}
                      icon={<ChevronRight size={16} />}
                      onClick={() => handlePageChange(currentPage + 1)}
                      // Disable Next if we received fewer items than requested size, implying end of list
                      disabled={rawRooms.length < ITEMS_PER_PAGE || loading}
                      className="pl-4 pr-2 flex-row-reverse"
                    />
                  </div>
                </>
              ) : (
                <div className="text-center py-20 bg-white rounded-xl shadow-sm border border-gray-100">
                  <Filter size={48} className="mx-auto text-text/20 mb-4" />
                  <h3 className="text-xl font-bold text-text/70">Номера не найдены</h3>
                  <p className="text-text/50">Попробуйте изменить параметры поиска или перейти на другую страницу.</p>
                  {currentPage > 1 && (
                     <Button 
                       text="На первую страницу"
                       variant={ButtonVariant.Tertiary}
                       className="mt-4"
                       onClick={() => handlePageChange(1)}
                     />
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Modals */}
      <ConfirmModal
        isOpen={!!roomToDelete}
        onClose={() => setRoomToDelete(null)}
        onConfirm={confirmDelete}
        title="Удаление номера"
        message={`Вы уверены, что хотите удалить номер ${roomToDelete?.roomNo}? Это действие нельзя отменить.`}
        confirmText="Удалить"
        cancelText="Отмена"
      />

      <AlertModal
        isOpen={!!successMessage}
        onClose={() => setSuccessMessage(null)}
        title="Успешно"
        message={successMessage || ""}
      />
    </div>
  );
}