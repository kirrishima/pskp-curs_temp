import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Upload, Trash2, Plus, X, ToggleLeft, ToggleRight } from 'lucide-react';

import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Textarea from '@/components/ui/Textarea';
import Select from '@/components/ui/Select';
import Badge from '@/components/ui/Badge';
import ConfirmModal from '@/components/modals/ConfirmModal';
import AlertModal from '@/components/modals/AlertModal';
import Modal from '@/components/modals/Modal';

import {
  getRoom,
  createRoom,
  updateRoom,
  uploadRoomImages,
  deleteRoomImage,
  getServices,
  getAllServicesAdmin,
  createService,
  updateService,
  uploadServiceIcon,
  invalidateCache,
  getRoomServices,
  addRoomService,
  updateRoomService,
  removeRoomService,
} from '@/api/hotelApi';
import { API_BASE_URL } from '@/api/axiosInstance';
import { ROOM_SERVICE_STATE_OPTIONS } from '@/utils/roomServiceStates';
import { CURRENCY_SYMBOL } from '@/utils/currency';
import type { Room, Service, RoomServiceEntry, RoomServiceState, ServicePriceType } from '@/types';

// ─── Image URL Helper ───────────────────────────────────────────────────────

function resolveImageUrl(url: string): string {
  if (url.startsWith('/uploads/')) {
    const base = API_BASE_URL.replace(/\/api\/?$/, '');
    return base + url;
  }
  return url;
}

// ─── Types ──────────────────────────────────────────────────────────────────

interface FormData {
  roomNo: string;
  hotelCode: string;
  title: string;
  description: string;
  capacity: number;
  bedsCount: number;
  floor: number | null;
  area: number | null;
  basePrice: number;
  status: 'ACTIVE' | 'MAINTENANCE' | 'CLOSED';
}

interface AddServiceModalState {
  isOpen: boolean;
  selectedService: string;
  defaultState: RoomServiceState;
}

interface ManageServicesModalState {
  isOpen: boolean;
}

interface CreateServiceForm {
  serviceCode: string;
  title: string;
  description: string;
  basePrice: string;
  priceType: ServicePriceType;
  icon: string;
  iconFile: File | null;
}

const BLANK_CREATE_FORM: CreateServiceForm = {
  serviceCode: '',
  title: '',
  description: '',
  basePrice: '0',
  priceType: 'PER_NIGHT',
  icon: '',
  iconFile: null,
};

// ─── Component ───────────────────────────────────────────────────────────────

export default function RoomEditorPage() {
  const { roomNo } = useParams<{ roomNo: string }>();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isCreateMode = roomNo === 'new';

  // Form state
  const [formData, setFormData] = useState<FormData>({
    roomNo: '',
    hotelCode: 'HOTEL001',
    title: '',
    description: '',
    capacity: 1,
    bedsCount: 1,
    floor: null,
    area: null,
    basePrice: 0,
    status: 'ACTIVE',
  });

  // Room data
  const [room, setRoom] = useState<Room | null>(null);
  const [images, setImages] = useState<any[]>([]);
  const [roomServices, setRoomServices] = useState<RoomServiceEntry[]>([]);
  const [allServices, setAllServices] = useState<Service[]>([]);

  // UI state
  const [loading, setLoading] = useState(!isCreateMode);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Modals
  const [deleteImageModal, setDeleteImageModal] = useState<{ isOpen: boolean; imageId: number | null }>({
    isOpen: false,
    imageId: null,
  });
  const [deleteImageLoading, setDeleteImageLoading] = useState(false);
  const [addServiceModal, setAddServiceModal] = useState<AddServiceModalState>({
    isOpen: false,
    selectedService: '',
    defaultState: 'OPTIONAL_OFF',
  });
  const [manageServicesModal, setManageServicesModal] = useState<ManageServicesModalState>({
    isOpen: false,
  });
  const [successAlert, setSuccessAlert] = useState<{ isOpen: boolean; message: string }>({
    isOpen: false,
    message: '',
  });
  const [errorAlert, setErrorAlert] = useState<{ isOpen: boolean; message: string }>({
    isOpen: false,
    message: '',
  });

  // Manage-services modal — shows ALL services (active + inactive) for admin
  const [manageServicesAll, setManageServicesAll] = useState<Service[]>([]);
  const [manageServicesLoading, setManageServicesLoading] = useState(false);

  // Create-service modal (stacks on top of manage-services)
  const [createSvcModalOpen, setCreateSvcModalOpen] = useState(false);
  const [createSvcForm, setCreateSvcForm] = useState<CreateServiceForm>(BLANK_CREATE_FORM);
  const [createSvcSaving, setCreateSvcSaving] = useState(false);
  const [createSvcError, setCreateSvcError] = useState<string | null>(null);
  const iconFileRef = useRef<HTMLInputElement>(null);

  // Load data
  useEffect(() => {
    const loadData = async () => {
      try {
        // Always load services
        const servicesRes = await getServices();
        setAllServices(servicesRes.services);

        // Load room if in edit mode
        if (!isCreateMode && roomNo) {
          const roomRes = await getRoom(roomNo);
          setRoom(roomRes.room);
          setImages(roomRes.room.images || []);
          setRoomServices(roomRes.room.roomServices || []);

          // Populate form
          setFormData({
            roomNo: roomRes.room.roomNo,
            hotelCode: roomRes.room.hotelCode,
            title: roomRes.room.title,
            description: roomRes.room.description || '',
            capacity: roomRes.room.capacity,
            bedsCount: roomRes.room.bedsCount,
            floor: roomRes.room.floor ?? null,
            area: roomRes.room.area ?? null,
            basePrice: roomRes.room.basePrice,
            status: roomRes.room.status,
          });
        }

        setError(null);
      } catch (err) {
        console.error('Failed to load data:', err);
        setError('Ошибка при загрузке данных');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [roomNo, isCreateMode]);

  // Handle form input change
  const handleInputChange = useCallback(
    (field: keyof FormData, value: any) => {
      setFormData((prev) => ({
        ...prev,
        [field]: value,
      }));
    },
    [],
  );

  // Handle save room
  const handleSaveRoom = useCallback(async () => {
    try {
      setSaving(true);
      const payload = {
        ...formData,
        capacity: Number(formData.capacity),
        bedsCount: Number(formData.bedsCount),
        floor: formData.floor ? Number(formData.floor) : null,
        area: formData.area ? Number(formData.area) : null,
        basePrice: Number(formData.basePrice),
      };

      if (isCreateMode) {
        const res = await createRoom(payload);
        setRoom(res.room);
        setSuccessAlert({ isOpen: true, message: 'Номер успешно создан' });
        setTimeout(() => navigate(`/admin/rooms/${res.room.roomNo}`), 1500);
      } else {
        const res = await updateRoom(formData.roomNo, payload);
        setRoom(res.room);
        setSuccessAlert({ isOpen: true, message: 'Номер успешно обновлен' });
      }
    } catch (err) {
      console.error('Failed to save room:', err);
      setErrorAlert({ isOpen: true, message: 'Ошибка при сохранении номера' });
    } finally {
      setSaving(false);
    }
  }, [formData, isCreateMode, navigate]);

  // Handle file upload
  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !formData.roomNo) return;

    try {
      setUploading(true);
      const fileArray = Array.from(files);
      const res = await uploadRoomImages(formData.roomNo, fileArray);
      setImages((prev) => [...prev, ...res.images]);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      setSuccessAlert({ isOpen: true, message: 'Изображения загружены' });
    } catch (err) {
      console.error('Failed to upload images:', err);
      setErrorAlert({ isOpen: true, message: 'Ошибка при загрузке изображений' });
    } finally {
      setUploading(false);
    }
  }, [formData.roomNo]);

  // Handle delete image
  const handleDeleteImage = useCallback(async () => {
    if (!formData.roomNo || deleteImageModal.imageId === null) return;

    try {
      setDeleteImageLoading(true);
      await deleteRoomImage(formData.roomNo, deleteImageModal.imageId);
      setImages((prev) => prev.filter((img) => img.imageId !== deleteImageModal.imageId));
      setSuccessAlert({ isOpen: true, message: 'Изображение удалено' });
      setDeleteImageModal({ isOpen: false, imageId: null });
    } catch (err) {
      console.error('Failed to delete image:', err);
      setErrorAlert({ isOpen: true, message: 'Ошибка при удалении изображения' });
    } finally {
      setDeleteImageLoading(false);
    }
  }, [formData.roomNo, deleteImageModal.imageId]);

  // Handle add service
  const handleAddService = useCallback(async () => {
    if (!formData.roomNo || !addServiceModal.selectedService) return;

    try {
      setSaving(true);
      const res = await addRoomService(
        formData.roomNo,
        addServiceModal.selectedService,
        addServiceModal.defaultState,
      );
      setRoomServices((prev) => [...prev, res.roomService]);
      setSuccessAlert({ isOpen: true, message: 'Услуга добавлена' });
      setAddServiceModal({ isOpen: false, selectedService: '', defaultState: 'OPTIONAL_OFF' });
    } catch (err) {
      console.error('Failed to add service:', err);
      setErrorAlert({ isOpen: true, message: 'Ошибка при добавлении услуги' });
    } finally {
      setSaving(false);
    }
  }, [formData.roomNo, addServiceModal]);

  // Handle update service state
  const handleUpdateServiceState = useCallback(
    async (serviceCode: string, newState: RoomServiceState) => {
      if (!formData.roomNo) return;

      try {
        const res = await updateRoomService(formData.roomNo, serviceCode, newState);
        setRoomServices((prev) =>
          prev.map((rs) => (rs.serviceCode === serviceCode ? res.roomService : rs)),
        );
      } catch (err) {
        console.error('Failed to update service state:', err);
        setErrorAlert({ isOpen: true, message: 'Ошибка при обновлении услуги' });
      }
    },
    [formData.roomNo],
  );

  // Handle remove service
  const handleRemoveService = useCallback(
    async (serviceCode: string) => {
      if (!formData.roomNo) return;

      try {
        await removeRoomService(formData.roomNo, serviceCode);
        setRoomServices((prev) => prev.filter((rs) => rs.serviceCode !== serviceCode));
        setSuccessAlert({ isOpen: true, message: 'Услуга удалена' });
      } catch (err) {
        console.error('Failed to remove service:', err);
        setErrorAlert({ isOpen: true, message: 'Ошибка при удалении услуги' });
      }
    },
    [formData.roomNo],
  );

  // Open manage-services modal and load all services (incl. inactive)
  const handleOpenManageServices = useCallback(async () => {
    setManageServicesModal({ isOpen: true });
    setManageServicesLoading(true);
    try {
      const res = await getAllServicesAdmin();
      setManageServicesAll(res.services);
    } catch (err) {
      console.error('Failed to load all services:', err);
    } finally {
      setManageServicesLoading(false);
    }
  }, []);

  // Toggle isActive on a service from inside the manage modal
  const handleToggleServiceActive = useCallback(
    async (serviceCode: string, currentActive: boolean) => {
      try {
        await updateService(serviceCode, { isActive: !currentActive });
        setManageServicesAll((prev) =>
          prev.map((s) =>
            s.serviceCode === serviceCode ? { ...s, isActive: !currentActive } : s,
          ),
        );
        // Keep allServices (used by the "add service" dropdown) in sync
        if (!currentActive) {
          // Reactivated — add back to the available list
          setManageServicesAll((prev) => {
            const reactivated = prev.find((s) => s.serviceCode === serviceCode);
            if (reactivated) {
              setAllServices((as) => [...as, { ...reactivated, isActive: true }]);
            }
            return prev;
          });
        } else {
          // Deactivated — remove from available list
          setAllServices((as) => as.filter((s) => s.serviceCode !== serviceCode));
        }
        invalidateCache('services:all');
      } catch (err) {
        console.error('Failed to toggle service active:', err);
        setErrorAlert({ isOpen: true, message: 'Ошибка при изменении статуса услуги' });
      }
    },
    [],
  );

  // Create a new service (and optionally upload its icon)
  const handleCreateService = useCallback(async () => {
    const { serviceCode, title, description, basePrice, priceType, icon, iconFile } = createSvcForm;

    if (!serviceCode.trim()) {
      setCreateSvcError('Код услуги обязателен');
      return;
    }
    if (!title.trim()) {
      setCreateSvcError('Название обязательно');
      return;
    }

    setCreateSvcSaving(true);
    setCreateSvcError(null);

    try {
      const created = await createService({
        serviceCode: serviceCode.trim().toUpperCase(),
        title: title.trim(),
        description: description.trim() || undefined,
        basePrice: parseFloat(basePrice) || 0,
        priceType,
        icon: icon.trim() || undefined,
      });

      // Upload icon file if one was selected
      if (iconFile) {
        await uploadServiceIcon(created.service.serviceCode, iconFile);
      }

      // Invalidate public cache and refresh both lists
      invalidateCache('services:all');
      const refreshed = await getAllServicesAdmin();
      setManageServicesAll(refreshed.services);
      setAllServices(refreshed.services.filter((s) => s.isActive));

      // Close create modal and reset form
      setCreateSvcModalOpen(false);
      setCreateSvcForm(BLANK_CREATE_FORM);
      if (iconFileRef.current) iconFileRef.current.value = '';

      setSuccessAlert({ isOpen: true, message: 'Услуга успешно создана' });
    } catch (err: any) {
      const msg =
        err?.response?.data?.error ||
        (err instanceof Error ? err.message : 'Ошибка при создании услуги');
      setCreateSvcError(msg);
    } finally {
      setCreateSvcSaving(false);
    }
  }, [createSvcForm]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background py-12">
        <div className="max-w-3xl mx-auto px-4">
          <div className="flex items-center justify-center h-96">
            <div className="animate-pulse text-text/50">Загрузка...</div>
          </div>
        </div>
      </div>
    );
  }

  const assignedServiceCodes = new Set(roomServices.map((rs) => rs.serviceCode));
  const availableServices = allServices.filter((s) => !assignedServiceCodes.has(s.serviceCode));

  return (
    <div className="min-h-screen bg-background py-12">
      <div className="max-w-3xl mx-auto px-4">
        {/* Back button */}
        <Button
          variant="ghost"
          size="sm"
          icon={<ArrowLeft size={16} />}
          onClick={() => navigate('/')}
        >
          Вернуться
        </Button>

        {/* Title */}
        <h1 className="text-3xl font-bold text-text mt-8 mb-8">
          {isCreateMode
            ? 'Создание номера'
            : `Редактирование номера ${formData.roomNo}`}
        </h1>

        {/* Main Info Section */}
        <div className="bg-white p-8 rounded-xl shadow-lg border border-ui mb-8">
          <h2 className="text-lg font-bold text-text mb-6">Основная информация</h2>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Номер комнаты"
                type="text"
                value={formData.roomNo}
                onChange={(e) => handleInputChange('roomNo', e.target.value)}
                disabled={!isCreateMode}
                placeholder="Е.г. 101"
              />

              <Input
                label="Код отеля"
                type="text"
                value={formData.hotelCode}
                onChange={(e) => handleInputChange('hotelCode', e.target.value)}
                placeholder="Е.г. HOTEL001"
              />
            </div>

            <Input
              label="Название номера"
              type="text"
              value={formData.title}
              onChange={(e) => handleInputChange('title', e.target.value)}
              placeholder="Е.г. Люкс с видом на море"
            />

            <Textarea
              label="Описание"
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              placeholder="Описание номера и его удобств..."
            />

            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Вместимость (гостей)"
                type="number"
                value={formData.capacity}
                onChange={(e) => handleInputChange('capacity', parseInt(e.target.value) || 1)}
                min="1"
              />

              <Input
                label="Количество кроватей"
                type="number"
                value={formData.bedsCount}
                onChange={(e) => handleInputChange('bedsCount', parseInt(e.target.value) || 1)}
                min="1"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Этаж"
                type="number"
                value={formData.floor ?? ''}
                onChange={(e) => handleInputChange('floor', e.target.value ? parseInt(e.target.value) : null)}
                placeholder="Опционально"
              />

              <Input
                label="Площадь (м²)"
                type="number"
                value={formData.area ?? ''}
                onChange={(e) => handleInputChange('area', e.target.value ? parseInt(e.target.value) : null)}
                placeholder="Опционально"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Базовая цена ($)"
                type="number"
                value={formData.basePrice}
                onChange={(e) => handleInputChange('basePrice', parseFloat(e.target.value) || 0)}
                min="0"
                step="0.01"
              />

              <Select
                label="Статус"
                value={formData.status}
                onChange={(e) => handleInputChange('status', e.target.value as any)}
                options={[
                  { value: 'ACTIVE', label: 'Активен' },
                  { value: 'MAINTENANCE', label: 'На обслуживании' },
                  { value: 'CLOSED', label: 'Закрыт' },
                ]}
              />
            </div>

            <Button
              variant="primary"
              size="md"
              className="w-full"
              onClick={handleSaveRoom}
              isLoading={saving}
            >
              {isCreateMode ? 'Создать номер' : 'Сохранить изменения'}
            </Button>
          </div>
        </div>

        {/* Gallery Section (edit mode only) */}
        {!isCreateMode && (
          <div className="bg-white p-8 rounded-xl shadow-lg border border-ui mb-8">
            <h2 className="text-lg font-bold text-text mb-6">Галерея</h2>

            <div className="mb-6">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
              />
              <Button
                variant="secondary"
                size="md"
                icon={<Upload size={16} />}
                onClick={() => fileInputRef.current?.click()}
                isLoading={uploading}
                className="w-full"
              >
                Загрузить изображения
              </Button>
            </div>

            {images.length > 0 ? (
              <div className="grid grid-cols-3 gap-4">
                {images.map((img) => (
                  <div key={img.imageId} className="relative group">
                    <img
                      src={resolveImageUrl(img.imageUrl)}
                      alt="Room"
                      className="w-full h-32 object-cover rounded-lg"
                    />

                    {/* Main badge */}
                    {img.isMain && (
                      <Badge variant="primary" className="absolute top-2 left-2">
                        Основное
                      </Badge>
                    )}

                    {/* Delete overlay on hover */}
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 rounded-lg transition flex items-center justify-center cursor-pointer"
                      onClick={() => setDeleteImageModal({ isOpen: true, imageId: img.imageId })}
                    >
                      <Trash2 size={20} className="text-white" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-text/50">Нет загруженных изображений</div>
            )}
          </div>
        )}

        {/* Services Section (edit mode only) */}
        {!isCreateMode && (
          <div className="bg-white p-8 rounded-xl shadow-lg border border-ui mb-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-text">Услуги</h2>
              <Button
                variant="tertiary"
                size="sm"
                icon={<Plus size={16} />}
                onClick={handleOpenManageServices}
              >
                Управлять услугами
              </Button>
            </div>

            {roomServices.length > 0 ? (
              <div className="space-y-2 mb-6">
                {roomServices.map((entry) => {
                  const service = entry.service;
                  return (
                    <div
                      key={entry.serviceCode}
                      className="flex items-center justify-between p-3 border border-ui rounded-lg hover:bg-ui/30 transition"
                    >
                      <div className="flex-1">
                        <p className="font-semibold text-text">{service.title}</p>
                        <p className="text-xs text-text/50">
                          ${Number(service.basePrice).toFixed(2)}{' '}
                          {service.priceType === 'PER_NIGHT' ? '/ ночь' : 'разово'}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <Select
                          options={ROOM_SERVICE_STATE_OPTIONS}
                          value={entry.defaultState}
                          onChange={(e) =>
                            handleUpdateServiceState(entry.serviceCode, e.target.value as RoomServiceState)
                          }
                          className="w-40"
                        />

                        <Button
                          variant="danger"
                          size="sm"
                          icon={<X size={16} />}
                          onClick={() => handleRemoveService(entry.serviceCode)}
                        >{''}</Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8 text-text/50 mb-6">Услуги не добавлены</div>
            )}

            {availableServices.length > 0 && (
              <Button
                variant="secondary"
                size="md"
                icon={<Plus size={16} />}
                className="w-full"
                onClick={() => setAddServiceModal({ ...addServiceModal, isOpen: true })}
              >
                Добавить услугу
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Modals */}

      {/* Delete image confirmation */}
      <ConfirmModal
        isOpen={deleteImageModal.isOpen}
        onClose={() => setDeleteImageModal({ isOpen: false, imageId: null })}
        onConfirm={handleDeleteImage}
        title="Удалить изображение"
        message="Вы уверены, что хотите удалить это изображение?"
        confirmText="Удалить"
        cancelText="Отмена"
        isDangerous={true}
        isLoading={deleteImageLoading}
      />

      {/* Add service modal */}
      <Modal
        isOpen={addServiceModal.isOpen}
        onClose={() => setAddServiceModal({ isOpen: false, selectedService: '', defaultState: 'OPTIONAL_OFF' })}
        title="Добавить услугу"
        footer={
          <>
            <Button
              variant="tertiary"
              onClick={() => setAddServiceModal({ isOpen: false, selectedService: '', defaultState: 'OPTIONAL_OFF' })}
            >
              Отмена
            </Button>
            <Button
              variant="primary"
              onClick={handleAddService}
              disabled={!addServiceModal.selectedService}
              isLoading={saving}
            >
              Добавить
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Select
            label="Выберите услугу"
            options={availableServices.map((s) => ({
              value: s.serviceCode,
              label: s.title,
            }))}
            value={addServiceModal.selectedService}
            onChange={(e) => setAddServiceModal({ ...addServiceModal, selectedService: e.target.value })}
            placeholder="Выберите услугу..."
          />

          <Select
            label="Включение по умолчанию"
            hint={
              ROOM_SERVICE_STATE_OPTIONS.find((o) => o.value === addServiceModal.defaultState)
                ?.description
            }
            options={ROOM_SERVICE_STATE_OPTIONS}
            value={addServiceModal.defaultState}
            onChange={(e) =>
              setAddServiceModal({
                ...addServiceModal,
                defaultState: e.target.value as RoomServiceState,
              })
            }
          />
        </div>
      </Modal>

      {/* Manage services modal — shows ALL services including inactive */}
      <Modal
        isOpen={manageServicesModal.isOpen}
        onClose={() => setManageServicesModal({ isOpen: false })}
        title="Управление услугами"
        maxWidthClass="max-w-2xl"
        footer={
          <Button
            variant="primary"
            onClick={() => setManageServicesModal({ isOpen: false })}
          >
            Закрыть
          </Button>
        }
      >
        <div>
          {/* Create new service button */}
          <div className="mb-4">
            <Button
              variant="secondary"
              size="sm"
              icon={<Plus size={16} />}
              onClick={() => {
                setCreateSvcForm(BLANK_CREATE_FORM);
                setCreateSvcError(null);
                setCreateSvcModalOpen(true);
              }}
            >
              Создать новую услугу
            </Button>
          </div>

          {/* Services list */}
          {manageServicesLoading ? (
            <div className="text-center py-8 text-text/50">Загрузка...</div>
          ) : manageServicesAll.length === 0 ? (
            <div className="text-center py-8 text-text/50">Услуги не найдены</div>
          ) : (
            <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
              {manageServicesAll.map((service) => (
                <div
                  key={service.serviceCode}
                  className={`p-3 border rounded-lg transition ${
                    service.isActive
                      ? 'border-ui hover:bg-ui/30'
                      : 'border-gray-200 bg-gray-50 opacity-70'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-text truncate">{service.title}</p>
                        <span className="text-xs font-mono text-text/40 shrink-0">
                          {service.serviceCode}
                        </span>
                      </div>
                      {service.description && (
                        <p className="text-xs text-text/50 mt-0.5 truncate">{service.description}</p>
                      )}
                      <p className="text-xs text-text/60 mt-0.5">
                        {Number(service.basePrice).toFixed(2)} {CURRENCY_SYMBOL}{' '}
                        {service.priceType === 'PER_NIGHT' ? '/ ночь' : 'разово'}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant={service.isActive ? 'success' : 'warning'}>
                        {service.isActive ? 'Активна' : 'Неактивна'}
                      </Badge>
                      <button
                        title={service.isActive ? 'Деактивировать' : 'Активировать'}
                        onClick={() =>
                          handleToggleServiceActive(service.serviceCode, service.isActive)
                        }
                        className="p-1 rounded text-text/40 hover:text-primary transition"
                      >
                        {service.isActive ? (
                          <ToggleRight size={22} className="text-green-500" />
                        ) : (
                          <ToggleLeft size={22} />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>

      {/* Create service modal — stacks on top of manage-services modal */}
      <Modal
        isOpen={createSvcModalOpen}
        onClose={() => {
          setCreateSvcModalOpen(false);
          setCreateSvcError(null);
          if (iconFileRef.current) iconFileRef.current.value = '';
        }}
        title="Создать услугу"
        maxWidthClass="max-w-lg"
        footer={
          <>
            <Button
              variant="tertiary"
              onClick={() => {
                setCreateSvcModalOpen(false);
                setCreateSvcError(null);
                if (iconFileRef.current) iconFileRef.current.value = '';
              }}
              disabled={createSvcSaving}
            >
              Отмена
            </Button>
            <Button
              variant="primary"
              onClick={handleCreateService}
              isLoading={createSvcSaving}
            >
              Создать
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {createSvcError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {createSvcError}
            </div>
          )}

          <Input
            label="Код услуги"
            value={createSvcForm.serviceCode}
            onChange={(e) =>
              setCreateSvcForm({ ...createSvcForm, serviceCode: e.target.value })
            }
            placeholder="Например: BREAKFAST"
            hint="Уникальный идентификатор. Будет преобразован в верхний регистр."
            disabled={createSvcSaving}
          />

          <Input
            label="Название"
            value={createSvcForm.title}
            onChange={(e) =>
              setCreateSvcForm({ ...createSvcForm, title: e.target.value })
            }
            placeholder="Например: Завтрак включён"
            disabled={createSvcSaving}
          />

          <Textarea
            label="Описание"
            value={createSvcForm.description}
            onChange={(e) =>
              setCreateSvcForm({ ...createSvcForm, description: e.target.value })
            }
            placeholder="Краткое описание услуги (необязательно)"
            disabled={createSvcSaving}
          />

          <div className="grid grid-cols-2 gap-4">
            <Input
              label={`Базовая цена (${CURRENCY_SYMBOL})`}
              type="number"
              min="0"
              step="0.01"
              value={createSvcForm.basePrice}
              onChange={(e) =>
                setCreateSvcForm({ ...createSvcForm, basePrice: e.target.value })
              }
              disabled={createSvcSaving}
            />

            <Select
              label="Тип цены"
              value={createSvcForm.priceType}
              onChange={(e) =>
                setCreateSvcForm({
                  ...createSvcForm,
                  priceType: e.target.value as ServicePriceType,
                })
              }
              options={[
                { value: 'PER_NIGHT', label: 'За ночь' },
                { value: 'ONE_TIME', label: 'Разовая' },
              ]}
              disabled={createSvcSaving}
            />
          </div>

          <Input
            label="Иконка (имя Lucide React)"
            value={createSvcForm.icon}
            onChange={(e) =>
              setCreateSvcForm({ ...createSvcForm, icon: e.target.value })
            }
            placeholder="Например: Coffee, Wifi, Car"
            hint="Используется если не загружено изображение иконки."
            disabled={createSvcSaving}
          />

          {/* Icon file upload */}
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-text/80">
              Иконка (изображение)
            </label>
            <input
              ref={iconFileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0] ?? null;
                setCreateSvcForm({ ...createSvcForm, iconFile: file });
              }}
              disabled={createSvcSaving}
            />
            <button
              type="button"
              onClick={() => iconFileRef.current?.click()}
              disabled={createSvcSaving}
              className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-md text-sm text-text/70 hover:border-primary/50 hover:text-primary transition text-left"
            >
              <Upload size={15} />
              {createSvcForm.iconFile
                ? createSvcForm.iconFile.name
                : 'Выбрать файл…'}
            </button>
            <p className="text-xs text-text/50">
              Файл будет сохранён как{' '}
              <code className="bg-ui px-1 rounded">
                services/
                {createSvcForm.serviceCode
                  ? createSvcForm.serviceCode.toUpperCase()
                  : '<КОД>'}
                .ext
              </code>
            </p>
          </div>
        </div>
      </Modal>

      {/* Success alert */}
      <AlertModal
        isOpen={successAlert.isOpen}
        onClose={() => setSuccessAlert({ isOpen: false, message: '' })}
        title="Успех"
        message={successAlert.message}
        type="success"
        closeText="OK"
      />

      {/* Error alert */}
      <AlertModal
        isOpen={errorAlert.isOpen}
        onClose={() => setErrorAlert({ isOpen: false, message: '' })}
        title="Ошибка"
        message={errorAlert.message}
        type="error"
        closeText="OK"
      />
    </div>
  );
}
