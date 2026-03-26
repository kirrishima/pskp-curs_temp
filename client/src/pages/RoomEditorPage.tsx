import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Upload, Trash2, Plus, X } from 'lucide-react';

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
  getRoomServices,
  addRoomService,
  updateRoomService,
  removeRoomService,
} from '@/api/hotelApi';
import { API_BASE_URL } from '@/api/axiosInstance';
import type { Room, Service, RoomServiceEntry, RoomServiceState } from '@/types';

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
                onClick={() => setManageServicesModal({ isOpen: true })}
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
                          ${service.basePrice} {service.priceType === 'PER_NIGHT' ? 'за ночь' : 'разово'}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <Select
                          options={[
                            { value: 'INCLUDED', label: 'Включено' },
                            { value: 'OPTIONAL_ON', label: 'По умолчанию' },
                            { value: 'OPTIONAL_OFF', label: 'Доступно' },
                          ]}
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
                        />
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
            label="По умолчанию"
            options={[
              { value: 'INCLUDED', label: 'Включено' },
              { value: 'OPTIONAL_ON', label: 'По умолчанию' },
              { value: 'OPTIONAL_OFF', label: 'Доступно' },
            ]}
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

      {/* Manage services modal */}
      <Modal
        isOpen={manageServicesModal.isOpen}
        onClose={() => setManageServicesModal({ isOpen: false })}
        title="Управление услугами"
        footer={
          <Button
            variant="primary"
            onClick={() => setManageServicesModal({ isOpen: false })}
          >
            Закрыть
          </Button>
        }
      >
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {allServices.length > 0 ? (
            allServices.map((service) => (
              <div
                key={service.serviceCode}
                className="p-3 border border-ui rounded-lg hover:bg-ui/30 transition"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="font-semibold text-text">{service.title}</p>
                    {service.description && (
                      <p className="text-xs text-text/50 mt-1">{service.description}</p>
                    )}
                    <p className="text-xs text-text/60 mt-1">
                      ${service.basePrice} {service.priceType === 'PER_NIGHT' ? 'за ночь' : 'разово'}
                    </p>
                  </div>
                  <Badge variant={service.isActive ? 'success' : 'danger'}>
                    {service.isActive ? 'Активна' : 'Неактивна'}
                  </Badge>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-8 text-text/50">Услуги не найдены</div>
          )}
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
