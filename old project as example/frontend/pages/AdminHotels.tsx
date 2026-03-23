import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Hotel } from "../types";
import { listHotels, createHotel, deleteHotel, STATIC_IMAGES_URL } from "../services/oracleApiService";
import Button, { ButtonVariant } from "../components/Button";
import ErrorAlert from "../components/ErrorAlert";
import Modal, { ConfirmModal } from "../components/Modal";
import { Plus, MapPin, Building, Trash2, Edit } from "lucide-react";

const inputClass = "w-full px-3 py-2 bg-white border border-gray-300 rounded-md outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-shadow text-sm text-text";
const labelClass = "block text-xs font-bold text-text/50 uppercase tracking-wider mb-1";

export default function AdminHotels() {
  const navigate = useNavigate();
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<{ status: string; message: string } | null>(null);
  
  // Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newHotel, setNewHotel] = useState<Partial<Hotel>>({});
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [hotelToDelete, setHotelToDelete] = useState<Hotel | null>(null);

  useEffect(() => {
    fetchHotels();
  }, []);

  const fetchHotels = async () => {
    setLoading(true);
    setError(null);
    const res = await listHotels();
    if (res.status === "OK" && res.data) {
      setHotels(res.data);
    } else {
      setError({ status: res.status, message: res.message });
    }
    setLoading(false);
  };

  const handleCreateHotel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newHotel.name) return;
    
    setIsActionLoading(true);
    const res = await createHotel(newHotel);
    if (res.status === "OK") {
      setIsCreateModalOpen(false);
      setNewHotel({});
      fetchHotels();
    } else {
      setError({ status: res.status, message: res.message });
    }
    setIsActionLoading(false);
  };

  const confirmDelete = async () => {
    if (!hotelToDelete) return;
    setIsActionLoading(true);
    const res = await deleteHotel(hotelToDelete.hotelCode);
    if (res.status === "OK") {
      setHotelToDelete(null);
      fetchHotels();
    } else {
       setError({ status: res.status, message: res.message });
       setHotelToDelete(null);
    }
    setIsActionLoading(false);
  };

  return (
    <div className="max-w-[1440px] mx-auto px-4 py-12">
      <div className="flex justify-between items-center mb-8 border-b border-ui pb-6">
        <div>
          <h1 className="text-3xl font-serif text-text mb-2">Управление отелями</h1>
          <p className="text-text/60">Список всех отелей в системе</p>
        </div>
        <Button 
          text="Добавить отель" 
          variant={ButtonVariant.Primary} 
          icon={<Plus size={20} />} 
          onClick={() => setIsCreateModalOpen(true)}
        />
      </div>

      <div className="mb-1"><ErrorAlert error={error} /></div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {hotels.map(hotel => (
             <div key={hotel.hotelCode} className="group bg-white rounded-xl shadow-sm hover:shadow-lg transition-all border border-ui overflow-hidden flex flex-col h-full">
               <div className="relative h-48 bg-gray-200 overflow-hidden">
                 <img 
                    src={`${STATIC_IMAGES_URL}/hero_about.jpg`} // Placeholder as we don't have per-hotel images yet
                    alt={hotel.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    onError={(e) => {
                        (e.target as HTMLImageElement).src = "https://picsum.photos/800/400?grayscale";
                    }}
                 />
                 <div className="absolute top-4 left-4 bg-white/90 backdrop-blur-sm px-3 py-1 rounded-full text-xs font-bold font-mono shadow-sm">
                   {hotel.hotelCode}
                 </div>
               </div>
               
               <div className="p-6 flex flex-col flex-grow">
                 <div className="flex justify-between items-start mb-2">
                    <h2 className="text-xl font-bold font-serif text-text group-hover:text-primary transition-colors">
                        {hotel.name}
                    </h2>
                 </div>
                 
                 <div className="flex items-center gap-2 text-sm text-text/60 mb-4">
                    <MapPin size={16} className="text-primary"/>
                    <span>{hotel.city || "Город не указан"}</span>
                 </div>

                 <p className="text-text/70 text-sm line-clamp-3 mb-6 flex-grow">
                    {hotel.description || "Описание отсутствует."}
                 </p>

                 <div className="flex gap-3 pt-4 border-t border-ui">
                    <Link to={`/admin/hotels/${hotel.hotelCode}`} className="flex-1">
                        <Button text="Управление" variant={ButtonVariant.Secondary} className="w-full" />
                    </Link>
                    <button 
                        onClick={() => setHotelToDelete(hotel)}
                        className="p-3 text-red-500 hover:bg-red-50 rounded-md transition-colors border border-transparent hover:border-red-100"
                        title="Удалить отель"
                    >
                        <Trash2 size={20} />
                    </button>
                 </div>
               </div>
             </div>
          ))}
          {hotels.length === 0 && (
            <div className="col-span-full py-20 text-center bg-gray-50 rounded-xl border border-dashed border-gray-300">
               <Building size={48} className="mx-auto text-text/20 mb-4" />
               <p className="text-text/50">Список отелей пуст</p>
            </div>
          )}
        </div>
      )}

      {/* Create Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Добавить новый отель"
        maxWidthClass="max-w-xl"
      >
        <form onSubmit={handleCreateHotel} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className={labelClass}>Код отеля (уникальный)</label>
                    <input 
                        value={newHotel.hotelCode || ""}
                        onChange={e => setNewHotel({...newHotel, hotelCode: e.target.value.toUpperCase()})}
                        className={inputClass}
                        placeholder="CODE"
                    />
                    <p className="text-xs text-text/40 mt-1">Если пусто, сгенерируется автоматически</p>
                </div>
                <div>
                    <label className={labelClass}>Название *</label>
                    <input 
                        value={newHotel.name || ""}
                        onChange={e => setNewHotel({...newHotel, name: e.target.value})}
                        className={inputClass}
                        required
                        placeholder="Название отеля"
                    />
                </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className={labelClass}>Город</label>
                    <input 
                        value={newHotel.city || ""}
                        onChange={e => setNewHotel({...newHotel, city: e.target.value})}
                        className={inputClass}
                    />
                </div>
                 <div>
                    <label className={labelClass}>Телефон</label>
                    <input 
                        value={newHotel.phone || ""}
                        onChange={e => setNewHotel({...newHotel, phone: e.target.value})}
                        className={inputClass}
                    />
                </div>
            </div>
            
            <div>
                 <label className={labelClass}>Email</label>
                 <input 
                    type="email"
                    value={newHotel.email || ""}
                    onChange={e => setNewHotel({...newHotel, email: e.target.value})}
                    className={inputClass}
                 />
            </div>
            
            <div>
                <label className={labelClass}>Адрес</label>
                <input 
                    value={newHotel.address || ""}
                    onChange={e => setNewHotel({...newHotel, address: e.target.value})}
                    className={inputClass}
                />
            </div>

            <div>
                <label className={labelClass}>Веб-сайт</label>
                <input 
                    value={newHotel.website || ""}
                    onChange={e => setNewHotel({...newHotel, website: e.target.value})}
                    className={inputClass}
                />
            </div>

            <div>
                <label className={labelClass}>Описание</label>
                <textarea 
                    value={newHotel.description || ""}
                    onChange={e => setNewHotel({...newHotel, description: e.target.value})}
                    className={inputClass}
                    rows={3}
                />
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t border-ui mt-4">
                <Button text="Отмена" type="button" variant={ButtonVariant.Tertiary} onClick={() => setIsCreateModalOpen(false)} />
                <Button text="Создать" type="submit" isLoading={isActionLoading} />
            </div>
        </form>
      </Modal>

      <ConfirmModal 
        isOpen={!!hotelToDelete}
        onClose={() => setHotelToDelete(null)}
        onConfirm={confirmDelete}
        title="Удалить отель?"
        message={`Вы уверены, что хотите удалить отель "${hotelToDelete?.name}"? Все связанные данные (номера, бронирования) могут быть утеряны.`}
        confirmText="Удалить"
        isLoading={isActionLoading}
      />
    </div>
  );
}