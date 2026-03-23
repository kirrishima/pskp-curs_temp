import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Room, RoomImage, RoomService, User, CleaningScheduleItem } from "../types";
import {
  deleteRoom,
  getManagerCleaningSchedules,
  getRooms,
} from "../services/oracleApiService";
import ErrorAlert from "../components/ErrorAlert";
import Button, { ButtonVariant } from "../components/Button";
import { ConfirmModal, AlertModal } from "../components/Modal";
import { translateCleaningStatus, getCleaningStatusColor } from "../utils/BookingsUtils";
import {
  ArrowLeft,
  Layers,
  Users,
  Wifi,
  Tv,
  Wind,
  Coffee,
  Droplets,
  CheckCircle,
  Edit,
  Trash2,
  Coins,
  Image as ImageIcon,
} from "lucide-react";

interface RoomDetailsProps {
  user: User | null;
}

export default function RoomDetails({ user }: RoomDetailsProps) {
  const { roomNo } = useParams<{ roomNo: string }>();
  const navigate = useNavigate();

  const [room, setRoom] = useState<Room | null>(null);
  const [cleaningSchedules, setCleaningSchedules] = useState<CleaningScheduleItem[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<{ status: string; message: string } | null>(null);

  // Booking state
  const [dates, setDates] = useState({
    startDate: new Date().toISOString().split("T")[0],
    endDate: new Date(Date.now() + 86400000).toISOString().split("T")[0],
  });

  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Manager Actions State
  const [roomToDelete, setRoomToDelete] = useState<Room | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Update: Check for Manager (1) OR Admin (0)
  const isManager = user?.roleId === 1 || user?.roleId === 0;

  useEffect(() => {
    if (!roomNo) {
      navigate("/");
      return;
    }
    fetchRoomData(roomNo);
  }, [roomNo, navigate]);

  const fetchRoomData = async (rNo: string) => {
    setLoading(true);
    setError(null);
    try {
      // Use the new getRooms endpoint which fetches room, images, and services together
      const roomRes = await getRooms({
        roomNo: rNo,
        includeImages: true,
        includeServices: true,
        // No status filter here: we want to see details even if it's booked/maintenance (unless strict requirement otherwise)
      });

      if (roomRes.status === "OK" && roomRes.data && roomRes.data.length > 0) {
        setRoom(roomRes.data[0]);
      } else {
        setError({ status: "NOT_FOUND", message: "Номер не найден" });
      }

      // Fetch cleaning schedules if manager
      if (isManager) {
        const scheduleRes = await getManagerCleaningSchedules({ roomNo: rNo });
        if (scheduleRes.status === "OK" && scheduleRes.data) {
          setCleaningSchedules(scheduleRes.data);
        }
      }
    } catch (e: any) {
      setError({ status: "ERROR", message: e.message || "Ошибка загрузки данных" });
    } finally {
      setLoading(false);
    }
  };

  const handleBookClick = () => {
    if (!user) {
      navigate("/login");
      return;
    }
    if (!room) return;

    // Navigate to checkout
    navigate("/checkout", {
      state: {
        room,
        startDate: dates.startDate,
        endDate: dates.endDate,
      },
    });
  };

  const handleEditClick = () => {
    if (!room) return;
    navigate(`/manager/room/${room.roomNo}`);
  };

  const handleDeleteClick = () => {
    if (!room) return;
    setRoomToDelete(room);
  };

  const confirmDelete = async () => {
    if (!roomToDelete) return;
    setIsDeleting(true);
    setError(null);
    const res = await deleteRoom(roomToDelete.roomNo);
    setIsDeleting(false);
    setRoomToDelete(null);

    if (res.status === "OK") {
      setSuccessMessage("Номер успешно удален. Вы будете перенаправлены на главную страницу.");
      setTimeout(() => navigate("/"), 2000);
    } else {
      setError({ status: res.status, message: res.message || "Ошибка удаления номера." });
    }
  };

  const getServiceIcon = (code: string) => {
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

  if (loading) {
    return (
      <div className="flex justify-center items-center h-[calc(100vh-80px)]">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error && !room) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12">
        <Button
          text="Назад к номерам"
          variant={ButtonVariant.Tertiary}
          onClick={() => navigate("/")}
          className="mb-8"
          icon={<ArrowLeft size={16} />}
        />
        <ErrorAlert error={error} />
      </div>
    );
  }

  if (!room) return null;

  const images = room.images || [];
  const services = room.services || [];

  const allImages = [
    ...(room.imageUrl ? [room.imageUrl] : []),
    ...images
      .map((i: any) => i.imageUrl)
      .filter(Boolean)
      .filter((url: string) => url !== room.imageUrl),
  ] as string[];

  if (allImages.length === 0) {
    allImages.push("/no-image-placeholder.png");
  }

  return (
    <div className="pb-24">
      <div className="max-w-6xl mx-auto px-4 pt-12">
        <div className="mb-8">
          <Button
            text="Все номера"
            variant={ButtonVariant.Secondary}
            onClick={() => navigate("/")}
            className="pl-4 pr-6 gap-2 bg-white/80 backdrop-blur-sm shadow-lg"
            icon={<ArrowLeft size={16} />}
          />
        </div>

        {/* Image Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {allImages.slice(0, 5).map((src, index) => (
            <div
              key={index}
              className={`overflow-hidden rounded-xl shadow-md border border-ui
                            ${index === 0 ? "col-span-2 row-span-2" : ""}
                        `}
            >
              <img
                src={src}
                alt={`Room ${room.title} view ${index + 1}`}
                className="w-full h-full object-cover aspect-[4/3]"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = "/load-error-placeholder.png";
                }}
              />
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Main Info */}
          <div className="lg:col-span-2 space-y-8">
            <div className="bg-white p-8 rounded-xl shadow-lg border border-ui">
              <div className="flex flex-row items-center space-x-2 mb-4">
                <h1 className="text-4xl font-serif text-text mb-0">{room.title}</h1>
                {isManager && (
                  <div className="bg-background/90 backdrop-blur-sm px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider shadow-sm">
                    {room.status === "AVAILABLE" ? "Свободен" : room.status}
                  </div>
                )}
                {isManager && (
                  <div className="bg-background/90 backdrop-blur-sm px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider shadow-sm">
                    room_no: {room.roomNo}
                  </div>
                )}
              </div>
              <div className="flex flex-wrap gap-x-6 gap-y-2 text-text/70 mb-6 border-b border-ui pb-6">
                <div className="flex items-center gap-2">
                  <Layers size={18} className="text-primary" /> <span>Этаж {room.floor}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Users size={18} className="text-primary" /> <span>До {room.capacity} гостей</span>
                </div>
                <div className="flex items-center gap-2">
                  <Coins size={18} className="text-primary" />{" "}
                  <span className="font-bold text-text">{room.basePrice}р. за ночь</span>
                </div>
              </div>

              <ErrorAlert error={error} />

              <div className="prose prose-lg max-w-none text-text/80 whitespace-pre-wrap leading-relaxed mt-4">
                <h2 className="font-serif">Описание номера</h2>
                <p>{room.description || "Подробное описание номера скоро появится."}</p>
              </div>

              <div className="mt-10">
                <h2 className="font-serif text-2xl mb-6">Удобства</h2>
                {services.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {services.map((service) => (
                      <div
                        key={service.serviceCode}
                        className="flex items-center gap-4 p-4 bg-ui/50 rounded-lg border border-ui"
                      >
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
            </div>

            {/* Manager Only: Cleaning Schedule */}
            {isManager && (
              <div className="bg-white p-8 rounded-xl shadow-lg border border-ui">
                <h2 className="text-2xl font-serif mb-6 flex items-center gap-3">
                  <Droplets className="text-primary" />
                  График уборки (Менеджер)
                </h2>
                {cleaningSchedules.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="border-b border-gray-200 text-text/60 uppercase">
                          <th className="py-2 px-3">Дата</th>
                          <th className="py-2 px-3">Ответственный</th>
                          <th className="py-2 px-3">Статус</th>
                          <th className="py-2 px-3">Примечания</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {cleaningSchedules.map((item, idx) => (
                          <tr key={idx} className="hover:bg-gray-50">
                            <td className="py-3 px-3 font-mono">
                              {new Date(item.scheduledDate).toLocaleString("ru-RU", {
                                year: "numeric",
                                month: "2-digit",
                                day: "2-digit",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </td>
                            <td className="py-3 px-3">{item.assignedTo || "—"}</td>
                            <td className="py-3 px-3">
                              <span
                                className={`px-2 py-1 rounded-full text-xs font-bold uppercase ${getCleaningStatusColor(
                                  item.status
                                )}`}
                              >
                                {translateCleaningStatus(item.status)}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-text/70">{item.notes || "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-text/50 italic">Запланированных уборок нет.</p>
                )}
              </div>
            )}
          </div>

          {/* Right Column - Actions */}
          <div className="lg:sticky top-24 h-fit">
            <div className="bg-white p-8 rounded-xl shadow-lg border border-ui">
              {isManager ? (
                <>
                  <h2 className="text-2xl font-serif mb-6 text-center">Управление</h2>
                  <div className="space-y-4">
                    <Button
                      text="Редактировать номер"
                      variant={ButtonVariant.Secondary}
                      className="w-full"
                      icon={<Edit size={20} />}
                      onClick={handleEditClick}
                    />
                    <Button
                      text="Удалить номер"
                      variant={ButtonVariant.Danger}
                      className="w-full"
                      icon={<Trash2 size={20} />}
                      onClick={handleDeleteClick}
                    />
                  </div>
                </>
              ) : (
                <>
                  <h2 className="text-2xl font-serif mb-6 text-center">Забронировать</h2>
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-bold text-text/70 mb-1 block">Заезд</label>
                      <input
                        type="date"
                        className="bg-ui px-3 py-2 rounded-md outline-none focus:ring-2 focus:ring-primary/50 text-text w-full"
                        value={dates.startDate}
                        onChange={(e) => setDates({ ...dates, startDate: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="text-sm font-bold text-text/70 mb-1 block">Выезд</label>
                      <input
                        type="date"
                        className="bg-ui px-3 py-2 rounded-md outline-none focus:ring-2 focus:ring-primary/50 text-text w-full"
                        value={dates.endDate}
                        onChange={(e) => setDates({ ...dates, endDate: e.target.value })}
                      />
                    </div>
                    <Button text="Перейти к оформлению" className="w-full !py-4 text-lg" onClick={handleBookClick} />
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <AlertModal
        isOpen={!!successMessage}
        onClose={() => setSuccessMessage(null)}
        title="Успешно"
        message={successMessage || ""}
      />

      <ConfirmModal
        isOpen={!!roomToDelete}
        onClose={() => setRoomToDelete(null)}
        onConfirm={confirmDelete}
        title="Удаление номера"
        message={`Вы уверены, что хотите удалить номер ${roomToDelete?.roomNo}? Это действие нельзя отменить.`}
        confirmText="Удалить"
        isLoading={isDeleting}
      />
    </div>
  );
}