import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Hotel } from "../types";
import { getHotelInfo, updateHotel, STATIC_IMAGES_URL } from "../services/oracleApiService";
import Button, { ButtonVariant } from "../components/Button";
import ErrorAlert from "../components/ErrorAlert";
import { AlertModal } from "../components/Modal";
import { ArrowLeft, Save, MapPin, Phone, Mail, Globe, Building, Edit2 } from "lucide-react";

// Reuse styles
const inputClass = "w-full px-3 py-2 bg-white border border-gray-300 rounded-md outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-shadow text-lg text-text";
const labelClass = "block text-xs font-bold text-text/50 uppercase tracking-wider mb-1";

export default function AdminHotelDetails() {
  const { hotelCode } = useParams<{ hotelCode: string }>();
  const navigate = useNavigate();

  const [hotel, setHotel] = useState<Hotel | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<{ status: string; message: string } | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Edit Mode
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState<Partial<Hotel>>({});
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!hotelCode) {
        navigate('/admin/hotels');
        return;
    }
    fetchHotelData(hotelCode);
  }, [hotelCode, navigate]);

  const fetchHotelData = async (code: string) => {
    setLoading(true);
    setError(null);
    const res = await getHotelInfo(code);
    if (res.status === "OK" && res.data) {
      setHotel(res.data);
      setEditData(res.data);
    } else {
      setError({ status: res.status, message: res.message });
    }
    setLoading(false);
  };

  const handleSave = async () => {
    if (!hotelCode || !editData.name) return;
    setIsSaving(true);
    
    // Ensure hotelCode is part of update data
    const res = await updateHotel({ ...editData, hotelCode });
    
    if (res.status === "OK") {
        setSuccess("Информация об отеле обновлена");
        setIsEditing(false);
        fetchHotelData(hotelCode);
    } else {
        setError({ status: res.status, message: res.message });
    }
    setIsSaving(false);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error && !hotel) {
     return (
        <div className="max-w-4xl mx-auto p-8">
            <ErrorAlert error={error} />
            <Button text="Вернуться к списку" onClick={() => navigate('/admin/hotels')} className="mt-4" />
        </div>
     );
  }

  if (!hotel) return null;

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Header Image */}
      <div className="relative h-[300px] w-full bg-gray-900 overflow-hidden group">
        <img
          src={`${STATIC_IMAGES_URL}/hero_about.jpg`}
          alt="Hotel Exterior"
          className="absolute inset-0 w-full h-full object-cover opacity-60"
          onError={(e) => {
             (e.target as HTMLImageElement).src = "https://picsum.photos/1920/600?grayscale&blur=2";
          }}
        />
        <div className="absolute top-8 left-8 z-10">
             <Button 
                text="Назад к списку" 
                variant={ButtonVariant.Tertiary} 
                icon={<ArrowLeft size={16} />}
                onClick={() => navigate('/admin/hotels')}
             />
        </div>
        
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-8">
           <div className="max-w-[1200px] mx-auto flex justify-between items-end">
             <div>
                <h1 className="text-4xl md:text-5xl font-serif text-white tracking-wide mb-2">
                  {hotel.name}
                </h1>
                <p className="text-white/80 font-mono text-sm bg-white/10 inline-block px-3 py-1 rounded">
                   CODE: {hotel.hotelCode}
                </p>
             </div>
             {!isEditing && (
                 <Button 
                    text="Редактировать" 
                    icon={<Edit2 size={18} />} 
                    variant={ButtonVariant.Primary}
                    onClick={() => setIsEditing(true)}
                 />
             )}
           </div>
        </div>
      </div>

      <div className="max-w-[1200px] mx-auto px-4 py-12 w-full">
         <ErrorAlert error={error} />
         <AlertModal isOpen={!!success} onClose={() => setSuccess(null)} title="Успешно" message={success || ""} />

         {isEditing ? (
            <div className="bg-white p-8 rounded-xl shadow-lg border border-primary/20 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="flex justify-between items-center mb-8 pb-4 border-b border-ui">
                   <h2 className="text-2xl font-bold text-text">Редактирование данных</h2>
                   <div className="flex gap-3">
                       <Button text="Отмена" variant={ButtonVariant.Tertiary} onClick={() => {setIsEditing(false); setEditData(hotel);}} />
                       <Button text="Сохранить" variant={ButtonVariant.Primary} icon={<Save size={18} />} onClick={handleSave} isLoading={isSaving} />
                   </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="md:col-span-2">
                        <label className={labelClass}>Название отеля</label>
                        <input 
                            value={editData.name || ""}
                            onChange={e => setEditData({...editData, name: e.target.value})}
                            className={inputClass}
                        />
                    </div>
                    
                    <div className="md:col-span-2">
                        <label className={labelClass}>Описание</label>
                        <textarea 
                            value={editData.description || ""}
                            onChange={e => setEditData({...editData, description: e.target.value})}
                            className={`${inputClass} min-h-[150px] leading-relaxed`}
                        />
                    </div>

                    <div>
                        <label className={labelClass}>Город</label>
                        <input 
                            value={editData.city || ""}
                            onChange={e => setEditData({...editData, city: e.target.value})}
                            className={inputClass}
                        />
                    </div>
                    
                    <div>
                        <label className={labelClass}>Адрес</label>
                        <input 
                            value={editData.address || ""}
                            onChange={e => setEditData({...editData, address: e.target.value})}
                            className={inputClass}
                        />
                    </div>

                    <div>
                        <label className={labelClass}>Телефон</label>
                        <input 
                            value={editData.phone || ""}
                            onChange={e => setEditData({...editData, phone: e.target.value})}
                            className={inputClass}
                        />
                    </div>

                     <div>
                        <label className={labelClass}>Email</label>
                        <input 
                            value={editData.email || ""}
                            onChange={e => setEditData({...editData, email: e.target.value})}
                            className={inputClass}
                        />
                    </div>

                    <div className="md:col-span-2">
                        <label className={labelClass}>Веб-сайт</label>
                        <input 
                            value={editData.website || ""}
                            onChange={e => setEditData({...editData, website: e.target.value})}
                            className={inputClass}
                        />
                    </div>
                </div>
            </div>
         ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
               {/* Main Description */}
               <div className="md:col-span-2 space-y-8">
                 <div>
                    <h2 className="text-2xl font-serif text-text mb-6">О {hotel.name}</h2>
                    <div className="prose prose-lg text-text/80 whitespace-pre-wrap leading-relaxed">
                      {hotel.description || "Описание отсутствует."}
                    </div>
                 </div>

                 <div className="bg-ui p-8 rounded-xl border border-gray-200">
                    <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                      <Building size={20} /> Детали объекта
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-sm">
                      <div>
                        <span className="block text-text/50 uppercase text-xs font-bold tracking-wider mb-1">Город</span>
                        <span className="font-medium text-lg">{hotel.city || "—"}</span>
                      </div>
                      <div>
                        <span className="block text-text/50 uppercase text-xs font-bold tracking-wider mb-1">
                          Дата регистрации в системе
                        </span>
                        <span className="font-medium text-lg">{hotel.createdAt ? new Date(hotel.createdAt).toLocaleDateString() : "—"}</span>
                      </div>
                    </div>
                  </div>
               </div>

               {/* Sidebar Info */}
               <div className="space-y-8">
                  <div className="bg-white shadow-lg shadow-gray-100 rounded-xl p-6 border border-ui sticky top-24">
                    <h3 className="font-serif text-xl mb-6 pb-4 border-b border-ui">Контактная информация</h3>
                    <ul className="space-y-6">
                      <li className="flex items-start gap-4">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 text-primary">
                          <MapPin size={20} />
                        </div>
                        <div>
                          <span className="block text-xs font-bold text-text/40 uppercase mb-1">Адрес</span>
                          <p className="text-text/80 leading-snug">{hotel.address || "—"}</p>
                        </div>
                      </li>

                      <li className="flex items-start gap-4">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 text-primary">
                          <Phone size={20} />
                        </div>
                        <div>
                          <span className="block text-xs font-bold text-text/40 uppercase mb-1">Телефон</span>
                          <p className="text-text/80">{hotel.phone || "—"}</p>
                        </div>
                      </li>

                      <li className="flex items-start gap-4">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 text-primary">
                          <Mail size={20} />
                        </div>
                        <div>
                          <span className="block text-xs font-bold text-text/40 uppercase mb-1">Email</span>
                          <p className="text-text/80">{hotel.email || "—"}</p>
                        </div>
                      </li>

                      <li className="flex items-start gap-4">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 text-primary">
                          <Globe size={20} />
                        </div>
                        <div>
                          <span className="block text-xs font-bold text-text/40 uppercase mb-1">Веб-сайт</span>
                          <a
                            href={hotel.website ? `https://${hotel.website.replace('https://', '').replace('http://', '')}` : '#'}
                            target="_blank"
                            rel="noreferrer"
                            className="text-primary hover:underline truncate block"
                          >
                            {hotel.website || "—"}
                          </a>
                        </div>
                      </li>
                    </ul>
                  </div>
                </div>
            </div>
         )}
      </div>
    </div>
  );
}