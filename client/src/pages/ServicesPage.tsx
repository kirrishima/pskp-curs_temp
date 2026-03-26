import React, { memo, useState, useEffect, useCallback } from 'react';
import { Edit2, Trash2, Upload } from 'lucide-react';
import useAppSelector from '@/hooks/useAppSelector';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Modal from '@/components/modals/Modal';
import ConfirmModal from '@/components/modals/ConfirmModal';
import AlertModal from '@/components/modals/AlertModal';
import { useModal } from '@/hooks/useModal';
import { API_BASE_URL } from '@/api/axiosInstance';
import * as hotelApi from '@/api/hotelApi';
import type { Service, ServicePriceType } from '@/types';

// ─── Create/Edit Form State ───────────────────────────────────────────────

interface ServiceFormData {
  serviceCode: string;
  title: string;
  description: string;
  basePrice: string;
  priceType: ServicePriceType;
  icon: string;
  isActive?: boolean;
}

// ─── Component ────────────────────────────────────────────────────────────

const ServicesPage = memo(function ServicesPage() {
  const user = useAppSelector((s) => s.auth.user);
  const [services, setServices] = useState<Service[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Modal states
  const createModal = useModal<ServiceFormData>('service-create');
  const editModal = useModal<ServiceFormData>('service-edit');
  const deleteModal = useModal<Service>('service-delete');
  const uploadModal = useModal<Service>('service-upload');
  const alertModal = useModal<{ title: string; message: string }>('service-alert');

  const [deleteLoading, setDeleteLoading] = useState(false);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [formData, setFormData] = useState<ServiceFormData>({
    serviceCode: '',
    title: '',
    description: '',
    basePrice: '',
    priceType: 'PER_NIGHT',
    icon: '',
  });

  // Load services
  const loadServices = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await hotelApi.getServices();
      setServices(result.services);
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Ошибка загрузки услуг';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadServices();
  }, [loadServices]);

  // Check if user is admin
  if (!user || user.role?.name !== 'admin') {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-text/50 text-lg">Доступ запрещен</p>
      </div>
    );
  }

  // Handle create service
  const handleCreate = async () => {
    try {
      setIsLoading(true);
      const payload: Partial<Service> = {
        serviceCode: formData.serviceCode,
        title: formData.title,
        description: formData.description || undefined,
        basePrice: parseFloat(formData.basePrice),
        priceType: formData.priceType,
        icon: formData.icon || undefined,
        isActive: true,
      };

      await hotelApi.createService(payload);
      createModal.close();
      setFormData({
        serviceCode: '',
        title: '',
        description: '',
        basePrice: '',
        priceType: 'PER_NIGHT',
        icon: '',
      });
      await loadServices();

      alertModal.open({
        title: 'Успех',
        message: 'Услуга создана успешно',
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Ошибка при создании услуги';
      alertModal.open({
        title: 'Ошибка',
        message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Handle edit service
  const handleEdit = async () => {
    if (!editModal.payload) return;

    try {
      setIsLoading(true);
      const payload: Partial<Service> = {
        title: formData.title,
        description: formData.description || undefined,
        basePrice: parseFloat(formData.basePrice),
        priceType: formData.priceType,
        icon: formData.icon || undefined,
        isActive: formData.isActive !== false,
      };

      await hotelApi.updateService(editModal.payload.serviceCode, payload);
      editModal.close();
      setFormData({
        serviceCode: '',
        title: '',
        description: '',
        basePrice: '',
        priceType: 'PER_NIGHT',
        icon: '',
      });
      await loadServices();

      alertModal.open({
        title: 'Успех',
        message: 'Услуга обновлена успешно',
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Ошибка при обновлении услуги';
      alertModal.open({
        title: 'Ошибка',
        message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Handle delete service
  const handleDeleteConfirm = async () => {
    if (!deleteModal.payload) return;

    try {
      setDeleteLoading(true);
      await hotelApi.deleteService(deleteModal.payload.serviceCode);
      deleteModal.close();
      await loadServices();

      alertModal.open({
        title: 'Успех',
        message: 'Услуга удалена успешно',
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Ошибка при удалении услуги';
      alertModal.open({
        title: 'Ошибка',
        message,
      });
    } finally {
      setDeleteLoading(false);
    }
  };

  // Handle upload icon
  const handleUploadIcon = async (file: File) => {
    if (!uploadModal.payload) return;

    try {
      setUploadLoading(true);
      await hotelApi.uploadServiceIcon(uploadModal.payload.serviceCode, file);
      uploadModal.close();
      await loadServices();

      alertModal.open({
        title: 'Успех',
        message: 'Иконка загружена успешно',
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Ошибка при загрузке иконки';
      alertModal.open({
        title: 'Ошибка',
        message,
      });
    } finally {
      setUploadLoading(false);
    }
  };

  const priceTypeOptions = [
    { value: 'PER_NIGHT', label: 'За ночь' },
    { value: 'ONE_TIME', label: 'Разовая' },
  ];

  const getIconUrl = (service: Service): string | null => {
    if (!service.iconUrl) return null;
    if (service.iconUrl.startsWith('/uploads/')) {
      return API_BASE_URL.replace('/api', '') + service.iconUrl;
    }
    return service.iconUrl;
  };

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-text">Управление услугами</h1>
          <Button
            variant="primary"
            onClick={() => {
              setFormData({
                serviceCode: '',
                title: '',
                description: '',
                basePrice: '',
                priceType: 'PER_NIGHT',
                icon: '',
              });
              createModal.open({
                serviceCode: '',
                title: '',
                description: '',
                basePrice: '',
                priceType: 'PER_NIGHT',
                icon: '',
              });
            }}
          >
            Создать услугу
          </Button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 text-red-700 text-sm">
            {error}
          </div>
        )}

        {/* Services Table */}
        <div className="bg-white rounded-xl shadow-sm border border-ui overflow-hidden">
          {isLoading && !services.length ? (
            <div className="p-8 text-center text-text/50">Загрузка...</div>
          ) : services.length === 0 ? (
            <div className="p-8 text-center text-text/50">Услуги не найдены</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-ui/30 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-bold text-text/50 uppercase tracking-wider">
                      Код услуги
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-text/50 uppercase tracking-wider">
                      Название
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-text/50 uppercase tracking-wider">
                      Описание
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-text/50 uppercase tracking-wider">
                      Цена
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-text/50 uppercase tracking-wider">
                      Тип цены
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-text/50 uppercase tracking-wider">
                      Иконка
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-text/50 uppercase tracking-wider">
                      Статус
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-text/50 uppercase tracking-wider">
                      Действия
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {services.map((service) => (
                    <tr key={service.serviceCode} className="hover:bg-ui/20 transition-colors">
                      <td className="px-6 py-4 text-sm font-medium text-text">
                        {service.serviceCode}
                      </td>
                      <td className="px-6 py-4 text-sm text-text/80">{service.title}</td>
                      <td className="px-6 py-4 text-sm text-text/60 max-w-xs truncate">
                        {service.description || '—'}
                      </td>
                      <td className="px-6 py-4 text-sm font-medium text-text">
                        {service.basePrice.toFixed(2)} ₽
                      </td>
                      <td className="px-6 py-4 text-sm text-text/80">
                        {service.priceType === 'PER_NIGHT' ? 'За ночь' : 'Разовая'}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        {getIconUrl(service) ? (
                          <img
                            src={getIconUrl(service)!}
                            alt={service.title}
                            className="h-8 w-8 rounded"
                          />
                        ) : service.icon ? (
                          <span className="text-xs bg-ui px-2 py-1 rounded">
                            [{service.icon}]
                          </span>
                        ) : (
                          <span className="text-text/30">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <span
                          className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                            service.isActive
                              ? 'bg-green-100 text-green-700'
                              : 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {service.isActive ? 'Активна' : 'Неактивна'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              setFormData({
                                serviceCode: service.serviceCode,
                                title: service.title,
                                description: service.description || '',
                                basePrice: service.basePrice.toString(),
                                priceType: service.priceType,
                                icon: service.icon || '',
                                isActive: service.isActive,
                              });
                              editModal.open({
                                serviceCode: service.serviceCode,
                                title: service.title,
                                description: service.description || '',
                                basePrice: service.basePrice.toString(),
                                priceType: service.priceType,
                                icon: service.icon || '',
                                isActive: service.isActive,
                              });
                            }}
                            className="p-2 rounded-md hover:bg-ui transition-colors"
                            title="Редактировать"
                          >
                            <Edit2 size={16} className="text-text/60" />
                          </button>

                          <button
                            onClick={() => uploadModal.open(service)}
                            className="p-2 rounded-md hover:bg-ui transition-colors"
                            title="Загрузить иконку"
                          >
                            <Upload size={16} className="text-text/60" />
                          </button>

                          <button
                            onClick={() => deleteModal.open(service)}
                            className="p-2 rounded-md hover:bg-red-50 transition-colors"
                            title="Удалить"
                          >
                            <Trash2 size={16} className="text-red-500" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Create Modal */}
      <Modal
        isOpen={createModal.isOpen}
        onClose={createModal.close}
        title="Создать услугу"
        maxWidthClass="max-w-lg"
        footer={
          <>
            <Button variant="tertiary" onClick={createModal.close} disabled={isLoading}>
              Отмена
            </Button>
            <Button variant="primary" isLoading={isLoading} onClick={handleCreate}>
              Создать
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Код услуги"
            value={formData.serviceCode}
            onChange={(e) => setFormData({ ...formData, serviceCode: e.target.value })}
            placeholder="например: SERVICE_001"
            disabled={isLoading}
          />
          <Input
            label="Название"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            placeholder="например: Завтрак"
            disabled={isLoading}
          />
          <div>
            <label className="block text-xs font-bold text-text/50 uppercase tracking-wider mb-1">
              Описание
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Описание услуги"
              disabled={isLoading}
              rows={3}
              className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-shadow text-sm text-text disabled:bg-gray-100 disabled:text-gray-400"
            />
          </div>
          <Input
            label="Базовая цена"
            type="number"
            step="0.01"
            value={formData.basePrice}
            onChange={(e) => setFormData({ ...formData, basePrice: e.target.value })}
            placeholder="0.00"
            disabled={isLoading}
          />
          <Select
            label="Тип цены"
            value={formData.priceType}
            onChange={(e) =>
              setFormData({ ...formData, priceType: e.target.value as ServicePriceType })
            }
            options={priceTypeOptions}
            disabled={isLoading}
          />
          <Input
            label="Иконка (имя Lucide React иконки)"
            value={formData.icon}
            onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
            placeholder="например: Coffee"
            disabled={isLoading}
          />
        </div>
      </Modal>

      {/* Edit Modal */}
      <Modal
        isOpen={editModal.isOpen}
        onClose={editModal.close}
        title="Редактировать услугу"
        maxWidthClass="max-w-lg"
        footer={
          <>
            <Button variant="tertiary" onClick={editModal.close} disabled={isLoading}>
              Отмена
            </Button>
            <Button variant="primary" isLoading={isLoading} onClick={handleEdit}>
              Сохранить
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-text/50 uppercase tracking-wider mb-1">
              Код услуги (не изменяется)
            </label>
            <div className="px-3 py-2 bg-gray-100 border border-gray-300 rounded-md text-sm text-text/60">
              {editModal.payload?.serviceCode}
            </div>
          </div>
          <Input
            label="Название"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            disabled={isLoading}
          />
          <div>
            <label className="block text-xs font-bold text-text/50 uppercase tracking-wider mb-1">
              Описание
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              disabled={isLoading}
              rows={3}
              className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-shadow text-sm text-text disabled:bg-gray-100 disabled:text-gray-400"
            />
          </div>
          <Input
            label="Базовая цена"
            type="number"
            step="0.01"
            value={formData.basePrice}
            onChange={(e) => setFormData({ ...formData, basePrice: e.target.value })}
            disabled={isLoading}
          />
          <Select
            label="Тип цены"
            value={formData.priceType}
            onChange={(e) =>
              setFormData({ ...formData, priceType: e.target.value as ServicePriceType })
            }
            options={priceTypeOptions}
            disabled={isLoading}
          />
          <Input
            label="Иконка (имя Lucide React иконки)"
            value={formData.icon}
            onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
            disabled={isLoading}
          />
          <div className="flex items-center gap-3 p-3 bg-ui/20 rounded-lg">
            <input
              type="checkbox"
              id="isActive"
              checked={formData.isActive !== false}
              onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
              disabled={isLoading}
            />
            <label htmlFor="isActive" className="text-sm font-medium text-text cursor-pointer">
              Активна
            </label>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={deleteModal.isOpen}
        onClose={deleteModal.close}
        onConfirm={handleDeleteConfirm}
        title="Удалить услугу"
        message={`Вы уверены, что хотите удалить услугу "${deleteModal.payload?.title}"? Это действие необратимо.`}
        confirmText="Удалить"
        cancelText="Отмена"
        isDangerous
        isLoading={deleteLoading}
      />

      {/* Upload Icon Modal */}
      <Modal
        isOpen={uploadModal.isOpen}
        onClose={uploadModal.close}
        title="Загрузить иконку"
        maxWidthClass="max-w-lg"
        footer={
          <Button
            variant="tertiary"
            onClick={uploadModal.close}
            disabled={uploadLoading}
          >
            Закрыть
          </Button>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-text/80">
            Для услуги "{uploadModal.payload?.title}"
          </p>
          <div
            className="border-2 border-dashed border-primary/30 rounded-lg p-6 text-center cursor-pointer hover:border-primary transition-colors"
            onClick={() => {
              const input = document.createElement('input');
              input.type = 'file';
              input.accept = 'image/*';
              input.onchange = (e) => {
                const file = (e.target as HTMLInputElement).files?.[0];
                if (file) {
                  handleUploadIcon(file);
                }
              };
              input.click();
            }}
          >
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.currentTarget.files?.[0];
                if (file) {
                  handleUploadIcon(file);
                }
              }}
              disabled={uploadLoading}
              className="hidden"
            />
            <p className="text-sm text-text/60">
              Нажмите или перетащите изображение сюда
            </p>
          </div>
        </div>
      </Modal>

      {/* Alert Modal */}
      <AlertModal
        isOpen={alertModal.isOpen}
        onClose={alertModal.close}
        title={alertModal.payload?.title || ''}
        message={alertModal.payload?.message || ''}
      />
    </div>
  );
});

export default ServicesPage;
