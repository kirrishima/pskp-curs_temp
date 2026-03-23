import React, { useEffect, useState } from "react";
import { useParams, useLocation, useNavigate } from "react-router-dom";
import { Booking, CleaningTask, RoomService, Review, User } from "../types";
import {
  getCleaningSchedule,
  getRoomImages,
  getRoomServices,
  getUserReviews,
  addUserReview,
  updateUserReview,
  deleteUserReview,
} from "../services/oracleApiService";
import Button, { ButtonVariant } from "../components/Button";
import ReviewModal from "../components/ReviewModal";
import { ConfirmModal } from "../components/Modal";
import { getStatusColor, translateStatus } from "@/utils/BookingsUtils";
import {
  ArrowLeft,
  Calendar,
  CheckCircle,
  Clock,
  Wifi,
  Tv,
  Coffee,
  Droplets,
  Wind,
  XCircle,
  MessageSquare,
  Star,
  Edit2,
  Trash2,
  Image,
  CreditCard,
} from "lucide-react";

type RoomImage = {
  imageId?: number;
  imageUrl?: string | null;
  uploadedAt?: string | null;
  description?: string | null;
};

export default function BookingDetails() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  // booking may be passed in location.state from MyBookings
  const booking: Booking | undefined = location.state?.booking;
  // We need current user info to handle reviews
  const userStr = localStorage.getItem("session_user");
  const user: User | null = userStr ? JSON.parse(userStr) : null;

  const [cleaningTasks, setCleaningTasks] = useState<CleaningTask[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(false);

  const [roomServices, setRoomServices] = useState<RoomService[]>([]);
  const [roomImages, setRoomImages] = useState<RoomImage[]>([]);

  const [loadingServices, setLoadingServices] = useState(false);
  const [loadingImages, setLoadingImages] = useState(false);
  const [serviceError, setServiceError] = useState<string | null>(null);
  const [imagesError, setImagesError] = useState<string | null>(null);

  // Review State
  const [existingReview, setExistingReview] = useState<Review | null>(null);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [isDeleteReviewModalOpen, setIsDeleteReviewModalOpen] = useState(false);
  const [loadingReview, setLoadingReview] = useState(false);

  useEffect(() => {
    if (!booking || !user) {
      navigate("/my-bookings");
      return;
    }

    // --- Services and Images Loading Logic (Same as before) ---
    if (booking.roomSnapshot) {
      setRoomServices(booking.roomSnapshot.services || []);
      const snapAny: any = booking.roomSnapshot;
      if (Array.isArray(snapAny.images) && snapAny.images.length > 0) {
        const mapped = snapAny.images.map((img: any) => ({
          imageId: img.imageId || img.id || null,
          imageUrl: img.url || img.imageUrl || img.image || null,
          uploadedAt: img.uploadedAt || img.uploaded_at || null,
          description: img.description || null,
        }));
        setRoomImages(mapped);
      }
    } else if (booking.roomNo) {
      (async () => {
        setLoadingServices(true);
        setServiceError(null);
        try {
          const res = await getRoomServices(booking.roomNo);
          if (res && res.status === "OK" && Array.isArray(res.data)) {
            setRoomServices(res.data);
          } else {
            setServiceError(res?.message || "Не удалось загрузить услуги");
            setRoomServices([]);
          }
        } catch (e: any) {
          setServiceError(e?.message || "Ошибка при загрузке услуг");
        } finally {
          setLoadingServices(false);
        }
      })();

      (async () => {
        setLoadingImages(true);
        setImagesError(null);
        try {
          const res = await getRoomImages(booking.roomNo);
          if (res && res.status === "OK" && Array.isArray(res.data)) {
            const images = res.data.map((r: any) => ({
              imageId: r.imageId || r.IMAGE_ID || null,
              imageUrl: r.imageUrl || r.IMAGE_URL || r.image_url || null,
              uploadedAt: r.uploadedAt || r.UPLOADED_AT || null,
              description: r.description || r.DESCRIPTION || null,
            }));
            setRoomImages(images);
          } else {
            setImagesError(res?.message || "Не удалось загрузить изображения");
            setRoomImages([]);
          }
        } catch (e: any) {
          setImagesError(e?.message || "Ошибка при загрузке изображений");
        } finally {
          setLoadingImages(false);
        }
      })();
    }

    if (booking.status !== "CANCELLED") {
      fetchCleaningSchedule();
    }

    // --- Check for existing review if booking is completed ---
    if (booking.status === "CHECKED_OUT") {
      fetchUserReview();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [booking, id]);

  const fetchCleaningSchedule = async () => {
    if (!id) return;
    setLoadingTasks(true);
    try {
      const res = await getCleaningSchedule(id);
      if (res.status === "OK" && Array.isArray(res.data)) {
        setCleaningTasks(res.data);
      } else {
        setCleaningTasks([]);
      }
    } catch (e) {
      setCleaningTasks([]);
    } finally {
      setLoadingTasks(false);
    }
  };

  const fetchUserReview = async () => {
    if (!user || !booking) return;
    try {
      const res = await getUserReviews(user.username);
      if (res.status === "OK" && res.data) {
        // Find review for this specific booking
        const review = res.data.find((r) => r.bookingId === booking.bookingId);
        setExistingReview(review || null);
      }
    } catch (e) {
      console.error("Error fetching user reviews", e);
    }
  };

  const handleSaveReview = async (rating: number, title: string, content: string) => {
    if (!user || !booking) return;
    setLoadingReview(true);
    let res;

    if (existingReview) {
      // Update
      res = await updateUserReview(user.username, booking.bookingId, rating, title, content);
    } else {
      // Add
      res = await addUserReview(user.username, booking.bookingId, booking.roomNo, rating, title, content);
    }

    if (res.status === "OK") {
      await fetchUserReview();
      setIsReviewModalOpen(false);
    } else {
      alert(`Ошибка: ${res.message}`);
    }
    setLoadingReview(false);
  };

  const handleDeleteReview = async () => {
    if (!user || !booking || !existingReview) return;
    setLoadingReview(true);
    const res = await deleteUserReview(user.username, booking.bookingId);
    if (res.status === "OK") {
      setExistingReview(null);
      setIsDeleteReviewModalOpen(false);
    } else {
      alert(`Ошибка удаления: ${res.message}`);
    }
    setLoadingReview(false);
  };

  const getServiceIcon = (code?: string) => {
    if (!code) return <CheckCircle size={20} />;
    switch (code.toUpperCase()) {
      case "WIFI":
        return <Wifi size={20} />;
      case "TV":
        return <Tv size={20} />;
      case "MINIBAR":
        return <Coffee size={20} />;
      case "JACUZZI":
        return <Droplets size={20} />;
      case "AC":
        return <Wind size={20} />;
      default:
        return <CheckCircle size={20} />;
    }
  };

  if (!booking) return null;

  // prefer snapshot if present
  const services = booking.roomSnapshot?.services || roomServices || [];

  return (
    <div className="max-w-[1024px] mx-auto px-4 py-12">
      <Button
        text="Назад к бронированиям"
        variant={ButtonVariant.Tertiary}
        onClick={() => navigate("/my-bookings")}
        className="mb-8 pl-4 pr-6 gap-2"
      />

      <div className="flex flex-col gap-8">
        {/* Header Section */}
        <div className="bg-white p-8 rounded-xl shadow-sm border border-ui">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-gray-100 pb-6 mb-6">
            <div>
              <h1 className="text-3xl font-serif text-text mb-2">
                {booking.roomTitle || `Бронирование ${booking.bookingId}`}
              </h1>
              <p className="text-text/60 font-mono text-sm">ID: {booking.bookingId}</p>
            </div>
            <span
              className={`px-4 py-2 rounded-full font-bold text-sm tracking-wide ${getStatusColor(booking.status)}`}
            >
              {translateStatus(booking.status)}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="flex flex-col gap-1">
              <span className="text-sm text-text/50 uppercase tracking-wider font-bold">Даты пребывания</span>
              <div className="flex items-center gap-2 text-lg">
                <Calendar size={20} className="text-primary" />
                {new Date(booking.startDate).toISOString().slice(0, 10)} —{" "}
                {new Date(booking.endDate).toISOString().slice(0, 10)}
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-sm text-text/50 uppercase tracking-wider font-bold">Стоимость</span>
              <div className="flex items-center gap-2 text-lg font-medium">
                <CreditCard size={20} className="text-primary" /> {booking.totalAmount}р.
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-sm text-text/50 uppercase tracking-wider font-bold">Номер</span>
              <div className="text-lg">{booking.roomNo}</div>
            </div>
          </div>
        </div>

        {/* User Review Section - Only for CHECKED_OUT bookings */}
        {booking.status === "CHECKED_OUT" && (
          <div className="bg-white p-8 rounded-xl shadow-sm border border-ui">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-serif flex items-center gap-3">
                <MessageSquare className="text-primary" />
                Ваш отзыв
              </h2>
            </div>

            {existingReview ? (
              <div className="bg-ui/30 p-6 rounded-lg border border-ui">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <div className="flex gap-1 mb-2">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star
                          key={i}
                          size={16}
                          className={i < existingReview.rating ? "fill-primary text-primary" : "text-gray-300"}
                        />
                      ))}
                    </div>
                    <h3 className="font-bold text-lg text-text">{existingReview.title}</h3>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setIsReviewModalOpen(true)}
                      className="p-2 text-text/60 hover:text-primary hover:bg-white rounded-full transition-colors"
                      title="Редактировать"
                    >
                      <Edit2 size={18} />
                    </button>
                    <button
                      onClick={() => setIsDeleteReviewModalOpen(true)}
                      className="p-2 text-text/60 hover:text-red-500 hover:bg-white rounded-full transition-colors"
                      title="Удалить"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
                <p className="text-text/80 leading-relaxed whitespace-pre-wrap">{existingReview.content}</p>
                <div className="mt-4 text-xs text-text/40">
                  Опубликовано {new Date(existingReview.createdAt).toISOString().slice(0, 10)}
                </div>
              </div>
            ) : (
              <div className="text-center py-8 bg-ui/20 rounded-lg">
                <p className="text-text/60 mb-4">Поделитесь впечатлениями о вашем проживании.</p>
                <Button
                  text="Оставить отзыв"
                  variant={ButtonVariant.Primary}
                  onClick={() => setIsReviewModalOpen(true)}
                />
              </div>
            )}
          </div>
        )}

        {/* Room Images Section */}
        <div className="bg-white p-8 rounded-xl shadow-sm border border-ui">
          <h2 className="text-2xl font-serif mb-6 flex items-center gap-3">
            <Image className="text-primary" />
            Фотографии номера
          </h2>

          {loadingImages ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : imagesError ? (
            <p className="text-text/60 italic">Ошибка: {imagesError}</p>
          ) : roomImages.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {roomImages.map((img, idx) => (
                <div key={img.imageId ?? idx} className="overflow-hidden rounded-lg border border-ui">
                  {img.imageUrl ? (
                    <img
                      src={`${img.imageUrl}`}
                      alt={booking.roomTitle || `Room ${booking.roomNo}`}
                      className="object-cover w-full h-48"
                    />
                  ) : (
                    <div className="w-full h-48 flex items-center justify-center text-text/50 italic">
                      Нет изображения
                    </div>
                  )}
                  {img.description && <div className="p-3 text-sm text-text/70">{img.description}</div>}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-text/50 italic">Фотографии отсутствуют.</p>
          )}
        </div>

        {/* Room Services Section */}
        <div className="bg-white p-8 rounded-xl shadow-sm border border-ui">
          <h2 className="text-2xl font-serif mb-6 flex items-center gap-3">
            <CheckCircle className="text-primary" />
            Включенные услуги
          </h2>

          {loadingServices ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : serviceError ? (
            <p className="text-text/60 italic">Ошибка: {serviceError}</p>
          ) : services.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {services.map((service, idx) => (
                <div key={idx} className="flex items-center gap-4 p-4 bg-ui/50 rounded-lg border border-ui">
                  <div className="text-primary/80">{getServiceIcon(service.serviceCode)}</div>
                  <div>
                    <h4 className="font-bold text-text">{service.title}</h4>
                    {service.description && <p className="text-xs text-text/60">{service.description}</p>}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-text/50 italic">Информация об удобствах недоступна.</p>
          )}
        </div>

        {/* Cleaning Schedule Section */}
        {booking.status !== "CANCELLED" && (
          <div className="bg-white p-8 rounded-xl shadow-sm border border-ui">
            <h2 className="text-2xl font-serif mb-6 flex items-center gap-3">
              <Droplets className="text-primary" />
              График уборки
            </h2>

            {loadingTasks ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : cleaningTasks.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="py-3 px-4 text-sm font-bold text-text/60 uppercase">Дата</th>
                      <th className="py-3 px-4 text-sm font-bold text-text/60 uppercase">Примечания</th>
                      <th className="py-3 px-4 text-sm font-bold text-text/60 uppercase">Статус</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cleaningTasks.map((task) => (
                      <tr key={task.scheduledDate} className="border-b border-gray-100 last:border-0 hover:bg-gray-50/50">
                        <td className="py-4 px-4 font-mono text-sm">
                          {task.scheduledDate ? new Date(task.scheduledDate).toLocaleString() : "—"}
                        </td>
                        <td className="py-4 px-4">{task.notes || "—"}</td>
                        <td className="py-4 px-4">
                          {task.status === "COMPLETED" ? (
                            <span className="inline-flex items-center gap-1 text-green-700 bg-green-100 px-2 py-1 rounded text-xs font-bold">
                              <CheckCircle size={12} /> Выполнено
                            </span>
                          ) : task.status === "PENDING" ? (
                            <span className="inline-flex items-center gap-1 text-yellow-700 bg-yellow-100 px-2 py-1 rounded text-xs font-bold">
                              <Clock size={12} /> Ожидается
                            </span>
                          ) : (
                            <span className="text-gray-500 text-xs font-bold">{task.status}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-text/50 italic">График уборки пока не сформирован.</p>
            )}
          </div>
        )}

        {booking.status === "CANCELLED" && (
          <div className="bg-red-50 p-6 rounded-xl border border-red-200 flex items-center gap-4 text-red-800">
            <XCircle size={24} />
            <div>
              <h3 className="font-bold">Бронирование отменено</h3>
              <p className="text-sm opacity-80">
                График уборки и доступ к услугам отключены для отмененных бронирований.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Review Modals */}
      <ReviewModal
        isOpen={isReviewModalOpen}
        onClose={() => setIsReviewModalOpen(false)}
        onSubmit={handleSaveReview}
        initialData={existingReview}
        isLoading={loadingReview}
      />

      <ConfirmModal
        isOpen={isDeleteReviewModalOpen}
        onClose={() => setIsDeleteReviewModalOpen(false)}
        onConfirm={handleDeleteReview}
        title="Удалить отзыв?"
        message="Вы уверены, что хотите удалить свой отзыв? Это действие нельзя отменить."
        confirmText="Удалить"
        isLoading={loadingReview}
      />
    </div>
  );
}
