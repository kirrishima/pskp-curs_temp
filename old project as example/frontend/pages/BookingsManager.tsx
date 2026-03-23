import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Booking, PaymentDetails, Payment } from "../types";
import {
  getManagerBookings,
  updateManagerBooking,
  deleteManagerBooking,
  getBookingPayments,
} from "../services/oracleApiService";
import Button, { ButtonVariant } from "../components/Button";
import ErrorAlert from "../components/ErrorAlert";
import Modal, { ConfirmModal, AlertModal } from "../components/Modal";
import { getStatusColor, translateStatus } from "@/utils/BookingsUtils";
import {
  Search,
  Filter,
  X,
  Edit,
  Trash2,
  CreditCard,
  Eye,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  CheckCircle,
  Calendar,
} from "lucide-react";

const INITIAL_FILTERS = {
  username: "",
  roomNo: "",
  statusFilter: "",
  startFrom: "",
  startTo: "",
};

const BOOKING_STATUSES = ["PENDING", "CONFIRMED", "CANCELLED", "CHECKED_IN", "CHECKED_OUT"];
const PAGE_SIZE = 15;

export default function BookingsManager() {
  const navigate = useNavigate();

  // Data State
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<{ status: string; message: string } | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // UI Inputs State
  const [filters, setFilters] = useState(INITIAL_FILTERS);
  const [searchId, setSearchId] = useState("");

  // Active Query State (What is actually currently fetched)
  const [activeQuery, setActiveQuery] = useState<{
    mode: "filter" | "id";
    filters: typeof INITIAL_FILTERS;
    id: string;
  }>({
    mode: "filter",
    filters: INITIAL_FILTERS,
    id: "",
  });

  // Pagination State
  const [page, setPage] = useState(1);
  const [hasNextPage, setHasNextPage] = useState(false);

  // Modals State
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isPaymentsModalOpen, setIsPaymentsModalOpen] = useState(false);

  const [editFormData, setEditFormData] = useState<Partial<Booking>>({});
  const [paymentDetails, setPaymentDetails] = useState<PaymentDetails | null>(null);
  const [isActionLoading, setIsActionLoading] = useState(false);

  // Fetch Logic
  const fetchBookings = useCallback(async (query: typeof activeQuery, pageNum: number) => {
    setLoading(true);
    setError(null);
    const params: any = {
      offsetFrom: (pageNum - 1) * PAGE_SIZE,
      offsetTo: pageNum * PAGE_SIZE,
    };

    if (query.mode === "id" && query.id) {
      params.bookingId = query.id;
      // Ensure other filters are ignored in the request just in case
    } else {
      Object.entries(query.filters).forEach(([key, value]) => {
        if (value) params[key] = value;
      });
    }

    // Fetch one extra item to check for next page
    params.offsetTo = params.offsetFrom + PAGE_SIZE + 1;

    const res = await getManagerBookings(params);
    if (res.status === "OK" && res.data) {
      setHasNextPage(res.data.length > PAGE_SIZE);
      setBookings(res.data.slice(0, PAGE_SIZE));
    } else {
      setError({ status: res.status, message: res.message });
      setBookings([]);
    }
    setLoading(false);
  }, []);

  // Effect: Only triggers when activeQuery or page changes (Button click or Pagination)
  useEffect(() => {
    fetchBookings(activeQuery, page);
  }, [activeQuery, page, fetchBookings]);

  // Handlers
  const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFilters((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const applyFilters = () => {
    setPage(1);
    setActiveQuery({
      mode: "filter",
      filters: { ...filters },
      id: "",
    });
    setSearchId(""); // Clear ID input visually to avoid confusion
  };

  const handleSearchById = () => {
    if (!searchId) return;
    setPage(1);
    setActiveQuery({
      mode: "id",
      filters: INITIAL_FILTERS,
      id: searchId,
    });
    // Don't clear filters visually, but they are disabled
  };

  const resetFilters = () => {
    setFilters(INITIAL_FILTERS);
    setSearchId("");
    setPage(1);
    setActiveQuery({
      mode: "filter",
      filters: INITIAL_FILTERS,
      id: "",
    });
  };

  // --- CRUD Handlers ---

  const handleEditClick = (booking: Booking) => {
    setSelectedBooking(booking);
    setEditFormData({
      roomNo: booking.roomNo,
      startDate: booking.startDate.split("T")[0],
      endDate: booking.endDate.split("T")[0],
      status: booking.status,
      notes: booking.notes || "",
    });
    setIsEditModalOpen(true);
  };

  const handleUpdateBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBooking) return;
    setIsActionLoading(true);
    const res = await updateManagerBooking({
      bookingId: selectedBooking.bookingId,
      ...editFormData,
      newStatus: editFormData.status,
    });
    if (res.status === "OK") {
      setSuccess("Бронирование успешно обновлено");
      setIsEditModalOpen(false);
      fetchBookings(activeQuery, page);
    } else {
      alert(`Ошибка: ${res.message}`);
    }
    setIsActionLoading(false);
  };

  const handleDeleteClick = (booking: Booking) => {
    setSelectedBooking(booking);
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!selectedBooking) return;
    setIsActionLoading(true);
    const res = await deleteManagerBooking(selectedBooking.bookingId);
    if (res.status === "OK") {
      setSuccess("Бронирование успешно удалено");
      setIsDeleteModalOpen(false);
      fetchBookings(activeQuery, page);
    } else {
      alert(`Ошибка: ${res.message}`);
    }
    setIsActionLoading(false);
  };

  const handlePaymentsClick = async (booking: Booking) => {
    setSelectedBooking(booking);
    setIsPaymentsModalOpen(true);
    setIsActionLoading(true);
    setPaymentDetails(null);
    const res = await getBookingPayments(booking.bookingId);
    if (res.status === "OK" && res.data) {
      setPaymentDetails(res.data);
    } else {
      alert(`Ошибка загрузки платежей: ${res.message}`);
    }
    setIsActionLoading(false);
  };

  // --- Styles ---
  const inputClass =
    "w-full px-2 py-2 bg-white border border-gray-300 rounded-md outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-shadow text-sm text-text disabled:bg-gray-100 disabled:text-gray-400";
  const labelClass = "block text-xs font-bold text-text/50 uppercase tracking-wider mb-1";

  // When ID search is active (typed in), disable other filters
  const isIdSearchActive = searchId.length > 0;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-serif mb-8 text-text border-b border-ui pb-4">Управление бронированиями</h1>

      {/* Filters and Search Container */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-ui mb-8 space-y-6">
        <div className="flex flex-col xl:flex-row gap-8">
          {/* Filters Section */}
          <div className="flex-1 space-y-4">
            <h3 className="font-bold text-sm text-text/70 flex items-center gap-2">
              <Filter size={16} /> Фильтры поиска
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <label className={labelClass}>Пользователь</label>
                <input
                  name="username"
                  value={filters.username}
                  onChange={handleFilterChange}
                  placeholder="Имя пользователя"
                  className={inputClass}
                  disabled={isIdSearchActive}
                />
              </div>
              <div>
                <label className={labelClass}>Комната (room_no)</label>
                <input
                  name="roomNo"
                  value={filters.roomNo}
                  onChange={handleFilterChange}
                  placeholder="Номер комнаты"
                  className={inputClass}
                  disabled={isIdSearchActive}
                />
              </div>
              <div>
                <label className={labelClass}>Статус</label>
                <select
                  name="statusFilter"
                  value={filters.statusFilter}
                  onChange={handleFilterChange}
                  className={inputClass}
                  disabled={isIdSearchActive}
                >
                  <option value="">Все статусы</option>
                  {BOOKING_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {translateStatus(s)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Заезд с</label>
                <div className="relative">
                  <Calendar size={14} className="absolute left-3 top-3 text-gray-400" />
                  <input
                    name="startFrom"
                    type="date"
                    value={filters.startFrom}
                    onChange={handleFilterChange}
                    className={`${inputClass} pl-9`}
                    disabled={isIdSearchActive}
                  />
                </div>
              </div>
              <div>
                <label className={labelClass}>Заезд по</label>
                <div className="relative">
                  <Calendar size={14} className="absolute left-3 top-3 text-gray-400" />
                  <input
                    name="startTo"
                    type="date"
                    value={filters.startTo}
                    onChange={handleFilterChange}
                    className={`${inputClass} pl-9`}
                    disabled={isIdSearchActive}
                  />
                </div>
              </div>
            </div>

            <div className="pt-2 flex flex-wrap gap-2">
              <Button
                text="Применить фильтры"
                variant={ButtonVariant.Primary}
                icon={<RefreshCw size={16} />}
                onClick={applyFilters}
                disabled={isIdSearchActive || loading}
                className="py-2 px-4 text-sm"
              />
              <Button
                text="Сбросить все"
                variant={ButtonVariant.Tertiary}
                icon={<X size={16} />}
                onClick={resetFilters}
                className="py-2 px-4 text-sm"
              />
            </div>
          </div>

          <div className="w-full xl:w-px bg-gray-200 xl:mx-2 h-px xl:h-auto"></div>

          {/* ID Search Section */}
          <div className="xl:w-1/3 flex flex-col space-y-4">
            <h3 className="font-bold text-sm text-text/70 flex items-center gap-2">
              <Search size={16} /> Поиск по ID
            </h3>
            <div className="bg-ui/30 p-4 rounded-lg border border-ui">
              <label className={labelClass}>ID Бронирования</label>
              <div className="flex gap-2">
                <input
                  value={searchId}
                  onChange={(e) => setSearchId(e.target.value)}
                  placeholder="Напр. BK-2023-..."
                  className={`${inputClass} flex-grow`}
                />
                <Button
                  text="Найти"
                  icon={<Search size={16} />}
                  onClick={handleSearchById}
                  className="py-2 px-4"
                  disabled={!searchId || loading}
                />
              </div>
              <p className="text-xs text-text/50 mt-2">
                Ввод ID отключает остальные фильтры. Нажмите "Найти" для загрузки.
              </p>
            </div>
          </div>
        </div>
      </div>

      <ErrorAlert error={error} />
      <AlertModal isOpen={!!success} onClose={() => setSuccess(null)} title="Успех" message={success || ""} />

      {/* Bookings Table */}
      <div className="bg-white rounded-xl shadow-sm border border-ui overflow-hidden">
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
        ) : bookings.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left border-collapse">
              <thead className="bg-ui/50 text-xs text-text/60 uppercase font-semibold">
                <tr>
                  <th className="p-4 border-b border-ui">ID</th>
                  <th className="p-4 border-b border-ui">Гость</th>
                  <th className="p-4 border-b border-ui">Номер</th>
                  <th className="p-4 border-b border-ui">Даты</th>
                  <th className="p-4 border-b border-ui">Статус</th>
                  <th className="p-4 border-b border-ui text-right">Сумма</th>
                  <th className="p-4 border-b border-ui text-center">Действия</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ui">
                {bookings.map((b) => (
                  <tr key={b.bookingId} className="hover:bg-gray-50/80 transition-colors">
                    <td className="p-4 font-mono text-xs text-text/70">{b.bookingId}</td>
                    <td className="p-4 font-medium text-text">{b.username}</td>
                    <td className="p-4">{b.roomTitle || <span className="text-text/50 font-mono">{b.roomNo}</span>}</td>
                    <td className="whitespace-nowrap p-4">
                      <div className="text-xs whitespace-nowrap flex flex-col">
                        <span>{new Date(b.startDate).toLocaleDateString()}</span>
                        <span className="text-text/40 rotate-90 w-3 self-center">|</span>
                        <span>{new Date(b.endDate).toLocaleDateString()}</span>
                      </div>
                    </td>

                    <td className="p-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${getStatusColor(
                          b.status
                        )}`}
                      >
                        {translateStatus(b.status)}
                      </span>
                    </td>
                    <td className="p-4 font-medium text-right whitespace-nowrap">{b.totalAmount.toLocaleString()} ₽</td>
                    <td className="p-4">
                      <div className="flex justify-center gap-1">
                        <button
                          onClick={() => handleEditClick(b)}
                          title="Редактировать"
                          className="btn-icon text-blue-600 hover:bg-blue-50"
                        >
                          <Edit size={16} />
                        </button>
                        <button
                          onClick={() => handlePaymentsClick(b)}
                          title="Платежи"
                          className="btn-icon text-green-600 hover:bg-green-50"
                        >
                          <CreditCard size={16} />
                        </button>
                        <button
                          onClick={() => navigate(`/room/${b.roomNo}`)}
                          title="Просмотр номера"
                          className="btn-icon text-gray-600 hover:bg-gray-100"
                        >
                          <Eye size={16} />
                        </button>
                        <button
                          onClick={() => handleDeleteClick(b)}
                          title="Удалить"
                          className="btn-icon text-red-500 hover:bg-red-50"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-20 bg-gray-50/30">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-white border border-ui mb-4">
              <Search size={24} className="text-text/30" />
            </div>
            <h3 className="font-bold text-lg text-text">Бронирования не найдены</h3>
            <p className="text-text/50 mt-1 max-w-sm mx-auto">
              По вашему запросу ничего не найдено. Попробуйте изменить параметры поиска или сбросить фильтры.
            </p>
            <Button text="Сбросить фильтры" variant={ButtonVariant.Tertiary} onClick={resetFilters} className="mt-6" />
          </div>
        )}
      </div>

      {/* Pagination */}
      <div className="flex justify-between items-center mt-6">
        <Button
          text="Назад"
          variant={ButtonVariant.Tertiary}
          icon={<ChevronLeft size={16} />}
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          disabled={page === 1 || loading}
          className="pl-2 pr-4"
        />
        <span className="text-sm text-text/60 font-medium font-mono bg-white px-4 py-2 rounded border border-ui">
          Страница {page}
        </span>
        <Button
          text="Вперед"
          variant={ButtonVariant.Tertiary}
          icon={<ChevronRight size={16} />}
          onClick={() => setPage((p) => p + 1)}
          disabled={!hasNextPage || loading}
          className="pl-4 pr-2 flex-row-reverse"
        />
      </div>

      {/* Modals */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title={`Редактирование: ${selectedBooking?.bookingId}`}
        maxWidthClass="max-w-lg"
      >
        <form onSubmit={handleUpdateBooking} className="space-y-4">
          <div>
            <label className={labelClass}>Номер комнаты</label>
            <input
              value={editFormData.roomNo || ""}
              onChange={(e) => setEditFormData((p) => ({ ...p, roomNo: e.target.value }))}
              className={inputClass}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Дата заезда</label>
              <input
                type="date"
                value={editFormData.startDate || ""}
                onChange={(e) => setEditFormData((p) => ({ ...p, startDate: e.target.value }))}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Дата выезда</label>
              <input
                type="date"
                value={editFormData.endDate || ""}
                onChange={(e) => setEditFormData((p) => ({ ...p, endDate: e.target.value }))}
                className={inputClass}
              />
            </div>
          </div>
          <div>
            <label className={labelClass}>Статус</label>
            <select
              value={editFormData.status || ""}
              onChange={(e) => setEditFormData((p) => ({ ...p, status: e.target.value as Booking["status"] }))}
              className={inputClass}
            >
              {BOOKING_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {translateStatus(s)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Заметки</label>
            <textarea
              value={editFormData.notes || ""}
              onChange={(e) => setEditFormData((p) => ({ ...p, notes: e.target.value }))}
              className={inputClass}
              rows={3}
            />
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t border-ui mt-6">
            <Button
              text="Отмена"
              type="button"
              variant={ButtonVariant.Tertiary}
              onClick={() => setIsEditModalOpen(false)}
            />
            <Button text="Сохранить изменения" type="submit" isLoading={isActionLoading} />
          </div>
        </form>
      </Modal>

      <ConfirmModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={confirmDelete}
        title="Удалить бронирование?"
        message={`Вы уверены, что хотите удалить бронирование ${selectedBooking?.bookingId}? Это действие нельзя отменить.`}
        confirmText="Удалить"
        isLoading={isActionLoading}
      />

      <Modal
        isOpen={isPaymentsModalOpen}
        onClose={() => setIsPaymentsModalOpen(false)}
        title={`Платежи по бронированию`}
        maxWidthClass="max-w-3xl"
      >
        <div className="mb-4 text-sm text-text/60 font-mono">ID: {selectedBooking?.bookingId}</div>
        {isActionLoading ? (
          <div className="flex justify-center items-center h-40">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : paymentDetails ? (
          <div className="space-y-6">
            <div
              className={`p-4 rounded-lg flex items-center justify-center gap-2 font-bold text-lg ${
                paymentDetails.isPaid ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"
              }`}
            >
              {paymentDetails.isPaid ? <CheckCircle size={24} /> : <RefreshCw size={24} />}
              {paymentDetails.isPaid ? "ОПЛАЧЕНО ПОЛНОСТЬЮ" : "ОЖИДАЕТ ОПЛАТЫ"}
            </div>

            <div>
              <h4 className="font-bold text-text/70 mb-3 uppercase text-xs tracking-wider">История транзакций</h4>
              {paymentDetails.payments.length > 0 ? (
                <div className="border border-ui rounded-lg overflow-hidden">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-ui/50 text-xs uppercase text-text/60 font-semibold">
                      <tr>
                        <th className="p-3 border-b border-ui">ID Транзакции</th>
                        <th className="p-3 border-b border-ui">Сумма</th>
                        <th className="p-3 border-b border-ui">Дата</th>
                        <th className="p-3 border-b border-ui">Метод</th>
                        <th className="p-3 border-b border-ui">Статус</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-ui bg-gray-50/30">
                      {paymentDetails.payments.map((p: Payment) => (
                        <tr key={p.paymentId}>
                          <td className="p-3 font-mono text-xs">{p.paymentId}</td>
                          <td className="p-3 font-medium">{p.amount.toLocaleString()} ₽</td>
                          <td className="p-3 text-text/70">{new Date(p.paymentDate).toLocaleString()}</td>
                          <td className="p-3">{p.paymentMethod}</td>
                          <td className="p-3">
                            <span className="px-2 py-1 bg-gray-200 rounded text-xs font-bold text-gray-700">
                              {p.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-8 text-center bg-gray-50 rounded-lg border border-dashed border-gray-300 text-text/50">
                  Транзакции отсутствуют
                </div>
              )}
            </div>
          </div>
        ) : (
          <p className="text-center text-text/60 italic py-4">Не удалось загрузить информацию о платежах.</p>
        )}
      </Modal>
    </div>
  );
}
