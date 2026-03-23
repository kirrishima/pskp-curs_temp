import React, { useEffect, useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Room, RoomService, RoomImage, CleaningScheduleItem } from "../types";
import {
  createRoom,
  updateRoom,
  getRooms,
  uploadRoomImage,
  deleteRoomImage,
  getManagerServices,
  addServiceToRoom,
  removeServiceFromRoom,
  createManagerService,
  updateManagerService,
  deleteManagerService,
  getManagerCleaningSchedules,
  createManagerCleaningSchedule,
  updateManagerCleaningSchedule,
  deleteManagerCleaningSchedule,
} from "../services/oracleApiService";
import Button, { ButtonVariant } from "../components/Button";
import ErrorAlert from "../components/ErrorAlert";
import Modal, { ConfirmModal } from "../components/Modal";
import { ArrowLeft, Save, Plus, Image as ImageIcon, Box, UploadCloud, Trash2, CheckCircle, X, Settings, Droplets, Calendar, Edit2, Pencil, Trash } from "lucide-react";
import { translateCleaningStatus, getCleaningStatusColor } from "../utils/BookingsUtils";

// Styles consistent with BookingsManager
const inputClass = "w-full px-3 py-2 bg-white border border-gray-300 rounded-md outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-shadow text-sm text-text disabled:bg-gray-100 disabled:text-gray-400";
const labelClass = "block text-xs font-bold text-text/50 uppercase tracking-wider mb-1";

export default function RoomManager() {
  const { roomNo } = useParams();
  const navigate = useNavigate();
  const isEditMode = !!roomNo;

  const [formData, setFormData] = useState<Partial<Room>>({
    roomNo: "",
    hotelCode: "MOONGLOW",
    title: "",
    capacity: 2,
    floor: 1,
    status: "AVAILABLE",
    basePrice: 100,
    description: "",
    imageUrl: "",
  });

  const [services, setServices] = useState<RoomService[]>([]);
  const [images, setImages] = useState<RoomImage[]>([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<{ status: string; message: string } | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Image management state
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [imageToDelete, setImageToDelete] = useState<RoomImage | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Service management state
  const [isAddServiceModalOpen, setIsAddServiceModalOpen] = useState(false);
  const [allServices, setAllServices] = useState<RoomService[]>([]);
  const [serviceToRemove, setServiceToRemove] = useState<RoomService | null>(null);
  const [isServiceActionLoading, setIsServiceActionLoading] = useState(false);
  const [newService, setNewService] = useState({ serviceCode: "", title: "", description: "" });
  const [existingServiceToAdd, setExistingServiceToAdd] = useState("");

  // Global service management state
  const [isManageServicesModalOpen, setIsManageServicesModalOpen] = useState(false);
  const [serviceToEdit, setServiceToEdit] = useState<RoomService | null>(null);
  const [serviceToDelete, setServiceToDelete] = useState<RoomService | null>(null);

  // Cleaning Schedule Management State
  const [schedules, setSchedules] = useState<CleaningScheduleItem[]>([]);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [currentSchedule, setCurrentSchedule] = useState<Partial<CleaningScheduleItem> & { isNew?: boolean }>({ isNew: true });
  const [scheduleToDelete, setScheduleToDelete] = useState<CleaningScheduleItem | null>(null);
  const [isScheduleActionLoading, setIsScheduleActionLoading] = useState(false);

  useEffect(() => {
    if (isEditMode && roomNo) {
      fetchRoomDetails(roomNo);
    }
  }, [roomNo, isEditMode]);

  const fetchRoomDetails = async (rNo: string) => {
    setLoading(true);
    setError(null);

    try {
      // Use unified endpoint
      const res = await getRooms({
        roomNo: rNo,
        includeImages: true,
        includeServices: true,
      });

      if (res.status === "OK" && res.data && res.data.length > 0) {
        const room = res.data[0];
        setFormData({
          roomNo: room.roomNo,
          hotelCode: room.hotelCode,
          title: room.title || "",
          capacity: room.capacity,
          floor: room.floor,
          status: room.status,
          basePrice: room.basePrice,
          description: room.description || "",
          imageUrl: room.imageUrl || "",
        });

        // Set services directly from the room object
        setServices(room.services || []);
        
        // Set images directly from the room object
        // Casting to any first to avoid strict TS issues with optional properties matching
        setImages((room.images as any[]) || []); 
      } else {
        setError({ status: res.status, message: res.message || "Номер не найден" });
      }

      // Fetch Schedules
      await fetchSchedules(rNo);

    } catch (err) {
      setError({ status: "ERROR", message: "Ошибка при загрузке данных" });
    } finally {
      setLoading(false);
    }
  };

  const fetchSchedules = async (rNo: string) => {
      const scheduleRes = await getManagerCleaningSchedules({ roomNo: rNo });
      if (scheduleRes.status === "OK" && scheduleRes.data) {
          setSchedules(scheduleRes.data);
      } else {
          setSchedules([]);
      }
  };

  const fetchAllServices = async () => {
    setIsServiceActionLoading(true);
    const res = await getManagerServices();
    if (res.status === "OK" && res.data) {
      setAllServices(res.data);
    } else {
      setError({ status: res.status, message: res.message });
      setAllServices([]);
    }
    setIsServiceActionLoading(false);
  };


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      let res;
      if (isEditMode && roomNo) {
        res = await updateRoom(roomNo, formData);
      } else {
        res = await createRoom(formData);
      }

      if (res.status === "OK") {
        setSuccess(isEditMode ? "Номер успешно обновлен" : "Номер успешно создан");
        if (!isEditMode && formData.roomNo) {
          navigate(`/manager/room/${formData.roomNo}`);
        }
      } else {
        setError({ status: res.status, message: res.message });
      }
    } catch (err) {
      setError({ status: "ERROR", message: "Ошибка сохранения" });
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === "capacity" || name === "floor" || name === "basePrice" ? Number(value) : value,
    }));
  };

  // --- Image Handlers ---
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setImageFile(e.target.files[0]);
    } else {
      setImageFile(null);
    }
  };

  const handleImageUpload = async () => {
    if (!roomNo || !imageFile) return;
    setIsUploading(true);
    setError(null);
    const res = await uploadRoomImage(roomNo, imageFile);
    if (res.status === "OK") {
      setSuccess("Фото успешно загружено");
      setImageFile(null);
      const fileInput = document.getElementById("image-upload-input") as HTMLInputElement;
      if (fileInput) fileInput.value = "";
      await fetchRoomDetails(roomNo);
    } else {
      setError({ status: res.status, message: res.message });
    }
    setIsUploading(false);
  };

  const confirmImageDelete = async () => {
    if (!imageToDelete || !roomNo) return;
    setIsDeleting(true);
    const res = await deleteRoomImage(imageToDelete.imageId);
    if (res.status === "OK") {
      setSuccess("Изображение удалено");
      await fetchRoomDetails(roomNo);
    } else {
      setError({ status: res.status, message: res.message });
    }
    setImageToDelete(null);
    setIsDeleting(false);
  };

  // --- Room-Service Handlers ---
  const openAddServiceModal = async () => {
    await fetchAllServices();
    setIsAddServiceModalOpen(true);
  };

  const handleAddExistingService = async () => {
    if (!roomNo || !existingServiceToAdd) return;
    setIsServiceActionLoading(true);
    setError(null);
    const res = await addServiceToRoom(roomNo, existingServiceToAdd);
    if (res.status === "OK") {
      setSuccess("Услуга добавлена");
      await fetchRoomDetails(roomNo);
    } else {
      setError({ status: res.status, message: res.message });
    }
    setExistingServiceToAdd("");
    setIsAddServiceModalOpen(false);
    setIsServiceActionLoading(false);
  };

  const handleCreateAndAddService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomNo || !newService.serviceCode || !newService.title) {
      setError({ status: "VALIDATION_ERROR", message: "Код и название услуги обязательны" });
      return;
    }
    setIsServiceActionLoading(true);
    setError(null);

    const createRes = await createManagerService(newService);
    if (createRes.status !== "OK") {
      setError({ status: createRes.status, message: createRes.message });
      setIsServiceActionLoading(false);
      return;
    }

    const addRes = await addServiceToRoom(roomNo, newService.serviceCode);
    if (addRes.status === "OK") {
      setSuccess(`Услуга "${newService.title}" создана и добавлена`);
      await fetchRoomDetails(roomNo);
      setNewService({ serviceCode: "", title: "", description: "" });
      setIsAddServiceModalOpen(false);
    } else {
      setError({ status: addRes.status, message: addRes.message });
    }
    setIsServiceActionLoading(false);
  };

  const confirmRemoveService = async () => {
    if (!serviceToRemove || !roomNo) return;
    setIsServiceActionLoading(true);
    setError(null);

    const res = await removeServiceFromRoom(roomNo, serviceToRemove.serviceCode);
    if (res.status === "OK") {
      setSuccess("Услуга удалена из номера");
      await fetchRoomDetails(roomNo);
    } else {
      setError({ status: res.status, message: res.message });
    }
    setServiceToRemove(null);
    setIsServiceActionLoading(false);
  };

  // --- Global Service Handlers ---
  const openManageServicesModal = async () => {
    await fetchAllServices();
    setIsManageServicesModalOpen(true);
  };

  const handleUpdateService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!serviceToEdit) return;
    setIsServiceActionLoading(true);
    const res = await updateManagerService(serviceToEdit.serviceCode, {
      title: serviceToEdit.title,
      description: serviceToEdit.description,
    });
    if (res.status === "OK") {
      setSuccess("Услуга обновлена");
      setServiceToEdit(null);
      await fetchAllServices();
      await fetchRoomDetails(roomNo);
    } else {
      setError({ status: res.status, message: res.message });
    }
    setIsServiceActionLoading(false);
  };

  const confirmDeleteService = async () => {
    if (!serviceToDelete) return;
    setIsServiceActionLoading(true);
    const res = await deleteManagerService(serviceToDelete.serviceCode);
    if (res.status === "OK") {
      setSuccess("Услуга удалена");
      setServiceToDelete(null);
      await fetchAllServices();
      await fetchRoomDetails(roomNo);
    } else {
      setError({ status: res.status, message: res.message });
    }
    setIsServiceActionLoading(false);
  };

  // --- Cleaning Schedule Handlers ---
  const handleAddSchedule = () => {
      setCurrentSchedule({
          roomNo: roomNo,
          scheduledDate: new Date().toISOString(),
          status: 'SCHEDULED',
          isNew: true
      });
      setIsScheduleModalOpen(true);
  };

  const handleEditSchedule = (item: CleaningScheduleItem) => {
      setCurrentSchedule({
          ...item,
          isNew: false
      });
      setIsScheduleModalOpen(true);
  };

  const handleSaveSchedule = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!roomNo || !currentSchedule.scheduledDate) return;
      setIsScheduleActionLoading(true);
      setError(null);

      try {
          let res;
          if (currentSchedule.isNew) {
              res = await createManagerCleaningSchedule({
                  roomNo: roomNo,
                  scheduledDate: currentSchedule.scheduledDate,
                  assignedTo: currentSchedule.assignedTo,
                  status: currentSchedule.status,
                  notes: currentSchedule.notes
              });
          } else {
              res = await updateManagerCleaningSchedule(roomNo, currentSchedule.scheduledDate, {
                  assignedTo: currentSchedule.assignedTo,
                  status: currentSchedule.status,
                  notes: currentSchedule.notes
              });
          }

          if (res.status === "OK") {
              setSuccess(currentSchedule.isNew ? "Запись создана" : "Запись обновлена");
              setIsScheduleModalOpen(false);
              await fetchSchedules(roomNo);
          } else {
              setError({ status: res.status, message: res.message });
          }
      } catch (err) {
          setError({ status: "ERROR", message: "Ошибка сохранения расписания" });
      } finally {
          setIsScheduleActionLoading(false);
      }
  };

  const confirmDeleteSchedule = async () => {
      if (!scheduleToDelete || !roomNo) return;
      setIsScheduleActionLoading(true);
      const res = await deleteManagerCleaningSchedule(roomNo, scheduleToDelete.scheduledDate);
      if (res.status === "OK") {
          setSuccess("Запись удалена");
          await fetchSchedules(roomNo);
      } else {
          setError({ status: res.status, message: res.message });
      }
      setScheduleToDelete(null);
      setIsScheduleActionLoading(false);
  };


  const availableServices = useMemo(() => {
    const currentServiceCodes = new Set(services.map(s => s.serviceCode));
    return allServices.filter(s => !currentServiceCodes.has(s.serviceCode));
  }, [allServices, services]);

  const toInputDateTime = (isoString: string | undefined) => {
      if (!isoString) return '';
      const date = new Date(isoString);
      const offset = date.getTimezoneOffset() * 60000;
      const localDate = new Date(date.getTime() - offset);
      return localDate.toISOString().slice(0, 16);
  };

  const fromInputDateTime = (value: string) => {
      return new Date(value).toISOString();
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate("/")} className="p-2 hover:bg-ui rounded-full transition-colors">
            <ArrowLeft size={24} />
          </button>
          <h1 className="text-3xl font-serif text-text">
            {isEditMode ? `Редактирование номера ${roomNo}` : "Создание номера"}
          </h1>
        </div>
      </div>

      <div className="pb-1"><ErrorAlert error={error} /></div>

      {success && (
        <div className="bg-green-50 text-green-800 p-4 rounded-md border border-green-200 mb-6 flex items-center gap-2">
          <CheckCircle size={20} /> {success}
        </div>
      )}

      {loading && !formData.roomNo && isEditMode ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-8">
          <div className="bg-white p-8 rounded-xl shadow-sm border border-ui space-y-6">
            <h2 className="text-xl font-bold flex items-center gap-2 border-b border-ui pb-4">
              <Box className="text-primary" size={20} /> Основная информация
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className={labelClass}>Номер комнаты *</label>
                <input
                  name="roomNo"
                  required
                  disabled={isEditMode}
                  value={formData.roomNo}
                  onChange={handleInputChange}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Код отеля *</label>
                <input
                  name="hotelCode"
                  required
                  value={formData.hotelCode}
                  onChange={handleInputChange}
                  className={inputClass}
                />
              </div>
              <div className="md:col-span-2">
                <label className={labelClass}>Название (Заголовок)</label>
                <input
                  name="title"
                  value={formData.title}
                  onChange={handleInputChange}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Этаж</label>
                <input
                  name="floor"
                  type="number"
                  value={formData.floor}
                  onChange={handleInputChange}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Вместимость (чел.)</label>
                <input
                  name="capacity"
                  type="number"
                  value={formData.capacity}
                  onChange={handleInputChange}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Базовая цена (рубли)</label>
                <input
                  name="basePrice"
                  type="number"
                  required
                  value={formData.basePrice}
                  onChange={handleInputChange}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Статус</label>
                <select
                  name="status"
                  value={formData.status}
                  onChange={handleInputChange}
                  className={inputClass}
                >
                  <option value="AVAILABLE">AVAILABLE</option>
                  <option value="BOOKED">BOOKED</option>
                  <option value="MAINTENANCE">MAINTENANCE</option>
                </select>
              </div>
              <div className="md:col-span-2">
                <label className={labelClass}>Описание</label>
                <textarea
                  name="description"
                  rows={4}
                  value={formData.description}
                  onChange={handleInputChange}
                  className={inputClass}
                />
              </div>
              <div className="md:col-span-2">
                <label className={labelClass}>Ссылка на главное фото</label>
                <input
                  name="imageUrl"
                  value={formData.imageUrl || ""}
                  onChange={handleInputChange}
                  className={inputClass}
                  placeholder="https://..."
                />
              </div>
            </div>
            <div className="flex justify-end pt-4">
              <Button
                text={isEditMode ? "Сохранить изменения" : "Создать номер"}
                variant={ButtonVariant.Primary}
                type="submit"
                isLoading={loading}
                icon={<Save size={18} />}
              />
            </div>
          </div>

          {isEditMode && (
            <>
               {/* Cleaning Schedule Section */}
              <div className="bg-white p-8 rounded-xl shadow-sm border border-ui space-y-6">
                <div className="border-b border-ui pb-4">
                  <h2 className="text-xl font-bold flex items-center gap-2">
                    <ImageIcon className="text-primary" size={20} /> Галерея
                  </h2>
                </div>
                <div className="flex items-center gap-4 p-4 bg-ui/50 rounded-lg border border-ui">
                  <input
                    id="image-upload-input"
                    type="file"
                    accept="image/png, image/jpeg, image/webp"
                    onChange={handleFileSelect}
                    className="block w-full text-sm text-text file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
                  />
                  <Button
                    text="Загрузить"
                    variant={ButtonVariant.Secondary}
                    type="button"
                    icon={<UploadCloud size={16} />}
                    onClick={handleImageUpload}
                    disabled={!imageFile || isUploading}
                    isLoading={isUploading}
                  />
                </div>
                {images.length > 0 ? (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {images.map((img) => (
                      <div key={img.imageId} className="relative group rounded-lg overflow-hidden border border-gray-200 aspect-square">
                        <img src={img.imageUrl} alt={`Room ${roomNo} image`} className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <button
                            type="button"
                            className="p-2 text-white bg-red-500/80 hover:bg-red-600 rounded-full transition-colors"
                            onClick={() => setImageToDelete(img)}
                            aria-label="Delete image"
                            disabled={isDeleting}
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-text/50 italic text-center py-4">Изображения галереи отсутствуют.</p>
                )}
              </div>

              <div className="bg-white p-8 rounded-xl shadow-sm border border-ui space-y-6">
                <div className="flex justify-between items-center border-b border-ui pb-4">
                  <h2 className="text-xl font-bold flex items-center gap-2">
                    <CheckCircle className="text-primary" size={20} /> Услуги номера
                  </h2>
                  <div className="flex gap-2">
                    <Button
                      text="Управлять всеми услугами"
                      variant={ButtonVariant.Tertiary}
                      type="button"
                      icon={<Settings size={18} />}
                      onClick={openManageServicesModal}
                    />
                     <Button
                      text="Добавить услугу"
                      variant={ButtonVariant.Secondary}
                      type="button"
                      icon={<Plus size={18} />}
                      onClick={openAddServiceModal}
                    />
                  </div>
                </div>
                {services.length > 0 ? (
                  <ul className="divide-y divide-gray-100">
                    {services.map((s, i) => (
                      <li key={i} className="py-3 flex justify-between items-center">
                        <div>
                          <span className="font-medium">{s.title}</span>
                          <span className="text-text/50 text-sm ml-2 font-mono">({s.serviceCode})</span>
                        </div>
                        <button
                          type="button"
                          className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-full"
                          onClick={() => setServiceToRemove(s)}
                          title={`Удалить услугу ${s.title}`}
                        >
                          <X size={16} />
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-text/50 italic text-center py-4">Услуги не добавлены.</p>
                )}
              </div>



              <div className="bg-white p-8 rounded-xl shadow-sm border border-ui space-y-6">
                <div className="flex justify-between items-center border-b border-ui pb-4">
                   <h2 className="text-xl font-bold flex items-center gap-2">
                        <Droplets className="text-primary" size={20} /> Расписание уборок
                    </h2>
                    <Button
                        text="Добавить уборку"
                        variant={ButtonVariant.Secondary}
                        type="button"
                        icon={<Plus size={16} />}
                        onClick={handleAddSchedule}
                    />
                </div>
                
                 {schedules.length > 0 ? (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead>
                                <tr className="border-b border-gray-200 text-text/60 uppercase">
                                    <th className="py-2 px-3">Дата</th>
                                    <th className="py-2 px-3">Статус</th>
                                    <th className="py-2 px-3">Ответственный</th>
                                    <th className="py-2 px-3">Заметки</th>
                                    <th className="py-2 px-3 text-right">Действия</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {schedules.map((item, idx) => (
                                    <tr key={`${item.roomNo}-${item.scheduledDate}`} className="hover:bg-gray-50">
                                        <td className="py-3 px-3 font-mono">
                                          {new Date(item.scheduledDate.replace(' ', 'T') + 'Z').toLocaleString('ru-RU', { 
                                              year: 'numeric', month: '2-digit', day: '2-digit', 
                                              hour: '2-digit', minute: '2-digit' 
                                            })}
                                        </td>
                                        <td className="py-3 px-3">
                                            <span className={`px-2 py-1 rounded-full text-xs font-bold uppercase ${getCleaningStatusColor(item.status)}`}>
                                                {translateCleaningStatus(item.status)}
                                            </span>
                                        </td>
                                        <td className="py-3 px-3">{item.assignedTo || "—"}</td>
                                        <td className="py-3 px-3 text-text/70">{item.notes || "—"}</td>
                                        <td className="py-3 px-3 text-right">
                                            <div className="flex justify-end gap-2">
                                                <button
                                                    type="button"
                                                    className="p-1 text-blue-500 hover:bg-blue-50 rounded"
                                                    onClick={() => handleEditSchedule(item)}
                                                >
                                                    <Edit2 size={16} />
                                                </button>
                                                <button
                                                    type="button"
                                                    className="p-1 text-red-500 hover:bg-red-50 rounded"
                                                    onClick={() => setScheduleToDelete(item)}
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
                    <p className="text-text/50 italic text-center py-4">Расписание уборок пусто.</p>
                )}
              </div>
            </>
          )}
        </form>
      )}

      {/* --- MODALS --- */}

      <Modal isOpen={isScheduleModalOpen} onClose={() => setIsScheduleModalOpen(false)} title={currentSchedule.isNew ? "Создать запись" : "Редактировать запись"} maxWidthClass="max-w-lg">
          <form onSubmit={handleSaveSchedule} className="space-y-4">
             <div>
                <label className={labelClass}>Дата и время *</label>
                <input
                    type="datetime-local"
                    required
                    disabled={!currentSchedule.isNew}
                    value={toInputDateTime(currentSchedule.scheduledDate)}
                    onChange={e => {setCurrentSchedule({...currentSchedule, scheduledDate: fromInputDateTime(e.target.value)});}}
                    className={`${inputClass} disabled:bg-gray-100`}
                />
                {!currentSchedule.isNew && <p className="text-xs text-text/50 mt-1">Дату нельзя изменить при редактировании.</p>}
             </div>
             <div>
                <label className={labelClass}>Ответственный</label>
                <input
                    value={currentSchedule.assignedTo || ''}
                    onChange={e => setCurrentSchedule({...currentSchedule, assignedTo: e.target.value})}
                    className={inputClass}
                    placeholder="Имя сотрудника"
                />
             </div>
             <div>
                <label className={labelClass}>Статус</label>
                <select
                    value={currentSchedule.status || 'SCHEDULED'}
                    onChange={e => setCurrentSchedule({...currentSchedule, status: e.target.value})}
                    className={inputClass}
                >
                    <option value="SCHEDULED">{translateCleaningStatus('SCHEDULED')}</option>
                    <option value="DONE">{translateCleaningStatus('DONE')}</option>
                    <option value="CANCELLED">{translateCleaningStatus('CANCELLED')}</option>
                </select>
             </div>
             <div>
                <label className={labelClass}>Заметки</label>
                <textarea
                    value={currentSchedule.notes || ''}
                    onChange={e => setCurrentSchedule({...currentSchedule, notes: e.target.value})}
                    className={inputClass}
                    rows={3}
                />
             </div>
             <div className="flex justify-end gap-2 pt-4 border-t border-ui mt-2">
                 <Button text="Отмена" type="button" variant={ButtonVariant.Tertiary} onClick={() => setIsScheduleModalOpen(false)} />
                 <Button text="Сохранить" type="submit" isLoading={isScheduleActionLoading} />
             </div>
          </form>
      </Modal>

      <ConfirmModal
        isOpen={!!scheduleToDelete}
        onClose={() => setScheduleToDelete(null)}
        onConfirm={confirmDeleteSchedule}
        title="Удалить запись?"
        message={`Вы уверены, что хотите удалить запись уборки на ${new Date(scheduleToDelete?.scheduledDate || '').toLocaleString()}?`}
        confirmText="Удалить"
        isLoading={isScheduleActionLoading}
      />

      <ConfirmModal
        isOpen={!!imageToDelete}
        onClose={() => setImageToDelete(null)}
        onConfirm={confirmImageDelete}
        title="Удалить изображение?"
        message="Вы уверены, что хотите удалить это изображение? Это действие нельзя отменить."
        confirmText="Удалить"
        isLoading={isDeleting}
      />

      <ConfirmModal
        isOpen={!!serviceToRemove}
        onClose={() => setServiceToRemove(null)}
        onConfirm={confirmRemoveService}
        title="Удалить услугу из номера?"
        message={`Вы уверены, что хотите удалить услугу "${serviceToRemove?.title}" из этого номера?`}
        confirmText="Удалить"
        isLoading={isServiceActionLoading}
      />
      
      <Modal
        isOpen={isAddServiceModalOpen}
        onClose={() => setIsAddServiceModalOpen(false)}
        title="Добавить услугу в номер"
      >
        <div className="space-y-6">
          {/* Add Existing Service */}
          <div>
            <h3 className="font-bold mb-2 text-sm text-text/70">Добавить существующую услугу</h3>
            {availableServices.length > 0 ? (
              <div className="flex items-center gap-2">
                <select
                  value={existingServiceToAdd}
                  onChange={(e) => setExistingServiceToAdd(e.target.value)}
                  className={inputClass}
                >
                  <option value="">-- Выберите услугу --</option>
                  {availableServices.map((s) => (
                    <option key={s.serviceCode} value={s.serviceCode}>
                      {s.title} ({s.serviceCode})
                    </option>
                  ))}
                </select>
                <Button
                  text="Добавить"
                  onClick={handleAddExistingService}
                  disabled={!existingServiceToAdd || isServiceActionLoading}
                  isLoading={isServiceActionLoading}
                />
              </div>
            ) : (
              <p className="text-sm text-text/60 italic p-2 bg-ui/50 rounded">Все доступные услуги уже добавлены.</p>
            )}
          </div>

          <div className="border-t border-gray-200"></div>

          {/* Create New Service */}
          <div>
            <h3 className="font-bold mb-2 text-sm text-text/70">Создать и добавить новую услугу</h3>
            <form onSubmit={handleCreateAndAddService} className="space-y-4">
              <div>
                <label className={labelClass}>Код услуги</label>
                <input
                  placeholder="Напр. PETS"
                  value={newService.serviceCode}
                  onChange={(e) => setNewService({ ...newService, serviceCode: e.target.value.toUpperCase() })}
                  className={inputClass}
                  required
                />
              </div>
              <div>
                <label className={labelClass}>Название услуги</label>
                <input
                  placeholder="Напр. Размещение с животными"
                  value={newService.title}
                  onChange={(e) => setNewService({ ...newService, title: e.target.value })}
                  className={inputClass}
                  required
                />
              </div>
              <div>
                <label className={labelClass}>Описание (необязательно)</label>
                <textarea
                  placeholder="Краткое описание"
                  value={newService.description}
                  onChange={(e) => setNewService({ ...newService, description: e.target.value })}
                  className={inputClass}
                  rows={2}
                />
              </div>
              <Button
                text="Создать и добавить"
                type="submit"
                variant={ButtonVariant.Secondary}
                className="w-full"
                isLoading={isServiceActionLoading}
                disabled={!newService.serviceCode || !newService.title || isServiceActionLoading}
              />
            </form>
          </div>
        </div>
      </Modal>

      <Modal isOpen={isManageServicesModalOpen} onClose={() => setIsManageServicesModalOpen(false)} title="Управление услугами" maxWidthClass="max-w-xl">
        <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
          {allServices.map(s => (
            <div key={s.serviceCode} className="p-3 bg-ui/50 rounded-md flex justify-between items-center border border-ui">
              <div>
                <p className="font-bold ">{s.title} <span className="font-mono text-xs text-text/50">({s.serviceCode})</span></p>
                <p className="text-xs text-text/60">{s.description}</p>
              </div>
              <div className="flex gap-2">
                 <Button text="" variant={ButtonVariant.Primary} icon={<Pencil></Pencil>} onClick={() => setServiceToEdit(s)} className="text-s px-4 py-1" />
                 <Button text="" variant={ButtonVariant.Danger} icon={<Trash></Trash>} onClick={() => setServiceToDelete(s)} className="text-s px-4 py-1"/>
              </div>
            </div>
          ))}
        </div>
      </Modal>

       <ConfirmModal
        isOpen={!!serviceToDelete}
        onClose={() => setServiceToDelete(null)}
        onConfirm={confirmDeleteService}
        title="Удалить услугу?"
        message={`Вы уверены, что хотите удалить услугу "${serviceToDelete?.title}" из системы? Это действие нельзя отменить.`}
        confirmText="Удалить"
        isLoading={isServiceActionLoading}
      />

       <Modal isOpen={!!serviceToEdit} onClose={() => setServiceToEdit(null)} title={`Редактирование: ${serviceToEdit?.title}`} maxWidthClass="max-w-lg">
         <form onSubmit={handleUpdateService} className="space-y-4">
           <div>
              <label className={labelClass}>Название услуги</label>
              <input
                value={serviceToEdit?.title || ''}
                onChange={e => setServiceToEdit(prev => prev ? {...prev, title: e.target.value} : null)}
                className={inputClass}
                required
              />
           </div>
           <div>
              <label className={labelClass}>Описание</label>
              <textarea
                value={serviceToEdit?.description || ''}
                onChange={e => setServiceToEdit(prev => prev ? {...prev, description: e.target.value} : null)}
                className={inputClass}
                rows={3}
              />
           </div>
           <div className="flex justify-end gap-2 pt-4">
             <Button text="Отмена" type="button" variant={ButtonVariant.Tertiary} onClick={() => setServiceToEdit(null)} />
             <Button text="Сохранить" type="submit" isLoading={isServiceActionLoading} />
           </div>
         </form>
       </Modal>
    </div>
  );
}