import React, { memo, useState, useEffect, useCallback } from 'react';
import { Edit2, Trash2, Info } from 'lucide-react';
import { Link } from 'react-router-dom';
import useAppSelector from '@/hooks/useAppSelector';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Modal from '@/components/modals/Modal';
import ConfirmModal from '@/components/modals/ConfirmModal';
import AlertModal from '@/components/modals/AlertModal';
import { useModal } from '@/hooks/useModal';
import * as hotelApi from '@/api/hotelApi';
import type { Hotel } from '@/types';

// ─── Create/Edit Form State ───────────────────────────────────────────────

interface HotelFormData {
  hotelCode: string;
  name: string;
  description: string;
  city: string;
  address: string;
  phone: string;
  email: string;
}

// ─── Component ────────────────────────────────────────────────────────────

const HotelsPage = memo(function HotelsPage() {
  const user = useAppSelector((s) => s.auth.user);
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Modal states
  const createModal = useModal<HotelFormData>('hotel-create');
  const editModal = useModal<HotelFormData>('hotel-edit');
  const deleteModal = useModal<Hotel>('hotel-delete');
  const alertModal = useModal<{ title: string; message: string }>('hotel-alert');

  const [deleteLoading, setDeleteLoading] = useState(false);
  const [formData, setFormData] = useState<HotelFormData>({
    hotelCode: '',
    name: '',
    description: '',
    city: '',
    address: '',
    phone: '',
    email: '',
  });

  // Load hotels
  const loadHotels = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await hotelApi.getHotels();
      setHotels(result.hotels);
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Ошибка загрузки отелей';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadHotels();
  }, [loadHotels]);

  // Check if user is admin
  if (!user || user.role?.name !== 'admin') {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-text/50 text-lg">Доступ запрещен</p>
      </div>
    );
  }

  // Handle create hotel
  const handleCreate = async () => {
    try {
      setIsLoading(true);
      const payload: Partial<Hotel> = {
        hotelCode: formData.hotelCode,
        name: formData.name,
        description: formData.description || undefined,
        city: formData.city || undefined,
        address: formData.address || undefined,
        phone: formData.phone || undefined,
        email: formData.email || undefined,
      };

      await hotelApi.createHotel(payload);
      createModal.close();
      setFormData({
        hotelCode: '',
        name: '',
        description: '',
        city: '',
        address: '',
        phone: '',
        email: '',
      });
      await loadHotels();

      alertModal.open({
        title: 'Успех',
        message: 'Отель создан успешно',
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Ошибка при создании отеля';
      alertModal.open({
        title: 'Ошибка',
        message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Handle edit hotel
  const handleEdit = async () => {
    if (!editModal.payload) return;

    try {
      setIsLoading(true);
      const payload: Partial<Hotel> = {
        name: formData.name,
        description: formData.description || undefined,
        city: formData.city || undefined,
        address: formData.address || undefined,
        phone: formData.phone || undefined,
        email: formData.email || undefined,
      };

      await hotelApi.updateHotel(editModal.payload.hotelCode, payload);
      editModal.close();
      setFormData({
        hotelCode: '',
        name: '',
        description: '',
        city: '',
        address: '',
        phone: '',
        email: '',
      });
      await loadHotels();

      alertModal.open({
        title: 'Успех',
        message: 'Отель обновлен успешно',
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Ошибка при обновлении отеля';
      alertModal.open({
        title: 'Ошибка',
        message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Handle delete hotel
  const handleDeleteConfirm = async () => {
    if (!deleteModal.payload) return;

    try {
      setDeleteLoading(true);
      await hotelApi.deleteHotel(deleteModal.payload.hotelCode);
      deleteModal.close();
      await loadHotels();

      alertModal.open({
        title: 'Успех',
        message: 'Отель удален успешно',
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Ошибка при удалении отеля';
      alertModal.open({
        title: 'Ошибка',
        message,
      });
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-text">Управление отелями</h1>
          <Button
            variant="primary"
            onClick={() => {
              setFormData({
                hotelCode: '',
                name: '',
                description: '',
                city: '',
                address: '',
                phone: '',
                email: '',
              });
              createModal.open({
                hotelCode: '',
                name: '',
                description: '',
                city: '',
                address: '',
                phone: '',
                email: '',
              });
            }}
          >
            Создать отель
          </Button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 text-red-700 text-sm">
            {error}
          </div>
        )}

        {/* Hotels Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {isLoading && !hotels.length ? (
            <div className="col-span-full p-8 text-center text-text/50">Загрузка...</div>
          ) : hotels.length === 0 ? (
            <div className="col-span-full p-8 text-center text-text/50">Отели не найдены</div>
          ) : (
            hotels.map((hotel) => (
              <div
                key={hotel.hotelCode}
                className="bg-white p-8 rounded-xl shadow-sm border border-ui hover:shadow-md transition-shadow"
              >
                {/* Hotel Info */}
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-text mb-1">{hotel.name}</h3>
                  <p className="text-xs font-bold text-text/50 uppercase tracking-wider mb-4">
                    {hotel.hotelCode}
                  </p>

                  <div className="space-y-2 text-sm text-text/70">
                    {hotel.city && (
                      <div>
                        <span className="text-text/50">Город: </span>
                        {hotel.city}
                      </div>
                    )}
                    {hotel.address && (
                      <div>
                        <span className="text-text/50">Адрес: </span>
                        {hotel.address}
                      </div>
                    )}
                    {hotel.phone && (
                      <div>
                        <span className="text-text/50">Телефон: </span>
                        {hotel.phone}
                      </div>
                    )}
                    {hotel.email && (
                      <div>
                        <span className="text-text/50">Email: </span>
                        {hotel.email}
                      </div>
                    )}
                  </div>

                  {hotel.description && (
                    <div className="mt-4 p-3 bg-ui/10 rounded text-sm text-text/70 italic">
                      {hotel.description}
                    </div>
                  )}

                  {hotel.rooms && hotel.rooms.length > 0 && (
                    <div className="mt-4 p-2 bg-primary/10 rounded text-sm text-primary font-medium">
                      Номеров: {hotel.rooms.length}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex flex-col gap-2">
                  <Link
                    to={`/hotels/${hotel.hotelCode}`}
                    className="px-4 py-2.5 rounded-md bg-secondary text-text hover:opacity-80 transition-opacity text-center text-sm font-medium inline-flex items-center justify-center gap-2"
                  >
                    <Info size={16} />
                    Подробнее
                  </Link>

                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setFormData({
                          hotelCode: hotel.hotelCode,
                          name: hotel.name,
                          description: hotel.description || '',
                          city: hotel.city || '',
                          address: hotel.address || '',
                          phone: hotel.phone || '',
                          email: hotel.email || '',
                        });
                        editModal.open({
                          hotelCode: hotel.hotelCode,
                          name: hotel.name,
                          description: hotel.description || '',
                          city: hotel.city || '',
                          address: hotel.address || '',
                          phone: hotel.phone || '',
                          email: hotel.email || '',
                        });
                      }}
                      className="flex-1 px-4 py-2.5 rounded-md bg-ui text-text hover:bg-gray-200 transition-colors text-sm font-medium inline-flex items-center justify-center gap-2"
                    >
                      <Edit2 size={16} />
                      Редактировать
                    </button>

                    <button
                      onClick={() => deleteModal.open(hotel)}
                      className="flex-1 px-4 py-2.5 rounded-md bg-red-50 text-red-600 hover:bg-red-100 transition-colors text-sm font-medium inline-flex items-center justify-center gap-2"
                    >
                      <Trash2 size={16} />
                      Удалить
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Create Modal */}
      <Modal
        isOpen={createModal.isOpen}
        onClose={createModal.close}
        title="Создать отель"
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
            label="Код отеля"
            value={formData.hotelCode}
            onChange={(e) => setFormData({ ...formData, hotelCode: e.target.value })}
            placeholder="например: HOTEL_001"
            disabled={isLoading}
          />
          <Input
            label="Название"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="например: Гранд Отель"
            disabled={isLoading}
          />
          <div>
            <label className="block text-xs font-bold text-text/50 uppercase tracking-wider mb-1">
              Описание
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Описание отеля"
              disabled={isLoading}
              rows={3}
              className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-shadow text-sm text-text disabled:bg-gray-100 disabled:text-gray-400"
            />
          </div>
          <Input
            label="Город"
            value={formData.city}
            onChange={(e) => setFormData({ ...formData, city: e.target.value })}
            placeholder="например: Москва"
            disabled={isLoading}
          />
          <Input
            label="Адрес"
            value={formData.address}
            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
            placeholder="например: ул. Пушкина, 10"
            disabled={isLoading}
          />
          <Input
            label="Телефон"
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            placeholder="например: +7 (495) 123-45-67"
            disabled={isLoading}
          />
          <Input
            label="Email"
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            placeholder="например: info@hotel.com"
            disabled={isLoading}
          />
        </div>
      </Modal>

      {/* Edit Modal */}
      <Modal
        isOpen={editModal.isOpen}
        onClose={editModal.close}
        title="Редактировать отель"
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
              Код отеля (не изменяется)
            </label>
            <div className="px-3 py-2 bg-gray-100 border border-gray-300 rounded-md text-sm text-text/60">
              {editModal.payload?.hotelCode}
            </div>
          </div>
          <Input
            label="Название"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
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
            label="Город"
            value={formData.city}
            onChange={(e) => setFormData({ ...formData, city: e.target.value })}
            disabled={isLoading}
          />
          <Input
            label="Адрес"
            value={formData.address}
            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
            disabled={isLoading}
          />
          <Input
            label="Телефон"
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            disabled={isLoading}
          />
          <Input
            label="Email"
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            disabled={isLoading}
          />
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={deleteModal.isOpen}
        onClose={deleteModal.close}
        onConfirm={handleDeleteConfirm}
        title="Удалить отель"
        message={
          <>
            <p>
              Вы уверены, что хотите удалить отель "{deleteModal.payload?.name}"? Это действие
              необратимо.
            </p>
            {deleteModal.payload?.rooms && deleteModal.payload.rooms.length > 0 && (
              <p className="mt-3 text-amber-600">
                Внимание: в этом отеле есть {deleteModal.payload.rooms.length} номер(ов).
              </p>
            )}
          </>
        }
        confirmText="Удалить"
        cancelText="Отмена"
        isDangerous
        isLoading={deleteLoading}
      />

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

export default HotelsPage;
