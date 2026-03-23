import React, { useState } from 'react';
import Button, { ButtonVariant } from '../components/Button';
import { getHotelStats, getMonthlyStats, getTopRoomsStats } from '../services/oracleApiService';
import { BarChart3, TrendingUp, Award, DollarSign, Calendar, RefreshCcw, CheckCircle, Clock, XCircle, LayoutGrid } from 'lucide-react';
import ErrorAlert from '../components/ErrorAlert';

// Helper to safely get value regardless of case
const getVal = (obj: any, keys: string[]) => {
  if (!obj) return 0;
  for (const k of keys) {
    if (obj[k] !== undefined) return obj[k];
    if (obj[k.toUpperCase()] !== undefined) return obj[k.toUpperCase()];
    if (obj[k.toLowerCase()] !== undefined) return obj[k.toLowerCase()];
  }
  return 0;
};

const SimpleBarChart = ({ data, labelKey, valueKey, formatValue, colorClass = "bg-primary" }: any) => {
  if (!data || data.length === 0) return <div className="text-center py-8 text-text/40 italic">Нет данных для отображения</div>;
  
  const max = Math.max(...data.map((d: any) => Number(getVal(d, [valueKey]))));
  
  // Center bars if there are few items (less than 8), otherwise align start to allow scrolling
  const justifyClass = data.length < 8 ? 'justify-center' : 'justify-start';

  return (
    <div className={`flex items-end gap-8 h-64 mt-6 border-b border-gray-100 pb-2 overflow-x-auto custom-scrollbar ${justifyClass}`}>
      {data.map((item: any, i: number) => {
        const val = Number(getVal(item, [valueKey]));
        // Calculate height percentage, ensure at least 4% height so 0 isn't invisible if we want to show it
        const height = max > 0 ? (val / max) * 100 : 0;
        const label = item.month ? item.month : getVal(item, [labelKey]);
        
        return (
          <div key={i} className="flex flex-col items-center gap-2 w-16 flex-shrink-0">
            {/* Value Label (Always visible, no hover effect) */}
            <span className="text-xs font-bold text-gray-600 bg-gray-100 px-2 py-1 rounded-md mb-1">
                {formatValue ? formatValue(val) : val}
            </span>

            {/* Bar Track & Bar */}
            <div className="w-full h-40 flex items-end justify-center relative rounded-t-lg bg-gray-50/50">
                <div 
                    className={`w-6 ${colorClass} rounded-t-md opacity-90`} 
                    style={{ height: `${Math.max(height, 2)}%` }}
                ></div>
            </div>

            {/* X Label */}
            <div className="text-[11px] font-mono font-medium text-gray-500 mt-1 truncate w-full text-center" title={label}>
                {label}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default function AdminStats() {
  // 1. Hotel Stats State
  const [hotelCode, setHotelCode] = useState("MOONGLOW");
  const [hotelStats, setHotelStats] = useState<any[]>([]); // Array of { status, bookingsCount, totalAmount }
  const [loadingHotel, setLoadingHotel] = useState(false);
  
  // 2. Monthly Stats State
  const [monthlyStats, setMonthlyStats] = useState<any[]>([]);
  const [loadingMonthly, setLoadingMonthly] = useState(false);

  // 3. Top Rooms State
  const [topRooms, setTopRooms] = useState<any[]>([]);
  const [loadingRooms, setLoadingRooms] = useState(false);

  const [error, setError] = useState<{status: string, message: string} | null>(null);

  const loadHotelStats = async () => {
    setLoadingHotel(true);
    setError(null);
    const res = await getHotelStats(hotelCode);
    if (res.status === 'OK' && res.data) {
        setHotelStats(res.data);
    } else {
        setError({ status: res.status, message: res.message });
    }
    setLoadingHotel(false);
  };

  const loadMonthlyStats = async () => {
    setLoadingMonthly(true);
    setError(null);
    const res = await getMonthlyStats();
    if (res.status === 'OK' && res.data) {
        setMonthlyStats(res.data);
    } else {
        setError({ status: res.status, message: res.message });
    }
    setLoadingMonthly(false);
  };

  const loadTopRooms = async () => {
    setLoadingRooms(true);
    setError(null);
    const res = await getTopRoomsStats(10);
    if (res.status === 'OK' && res.data) {
        setTopRooms(res.data);
    } else {
        setError({ status: res.status, message: res.message });
    }
    setLoadingRooms(false);
  };

  // Aggregation for Hotel Stats
  const totalBookings = hotelStats.reduce((acc, curr) => acc + (curr.bookingsCount || 0), 0);
  const totalRevenue = hotelStats.reduce((acc, curr) => acc + (curr.totalAmount || 0), 0);
  
  // Find specific statuses
  const confirmed = hotelStats.find(s => s.status === 'CONFIRMED')?.bookingsCount || 0;
  const pending = hotelStats.find(s => s.status === 'PENDING')?.bookingsCount || 0;
  const cancelled = hotelStats.find(s => s.status === 'CANCELLED')?.bookingsCount || 0;

  return (
    <div className="max-w-[1440px] mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-8 pb-4 border-b border-ui">
         <div className="p-3 bg-primary/10 rounded-full text-primary">
            <BarChart3 size={28} />
         </div>
         <div>
            <h1 className="text-3xl font-serif text-text">Аналитика и Статистика</h1>
            <p className="text-text/60 text-sm">Отчеты по эффективности отеля и бронированиям</p>
         </div>
      </div>

      <ErrorAlert error={error} />

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        
        {/* SECTION 1: Hotel Stats */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-ui space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold flex items-center gap-2">
                    <DollarSign size={20} className="text-primary" /> Общая статистика отеля
                </h2>
            </div>
            
            <div className="flex gap-2 items-end bg-gray-50 p-4 rounded-lg border border-gray-100">
                <div className="flex-grow">
                    <label className="block text-xs font-bold text-text/50 uppercase tracking-wider mb-1">Код отеля</label>
                    <input 
                        value={hotelCode}
                        onChange={(e) => setHotelCode(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md outline-none focus:border-primary text-sm"
                    />
                </div>
                <Button 
                    text={loadingHotel ? "Загрузка..." : "Загрузить отчет"} 
                    onClick={loadHotelStats}
                    disabled={loadingHotel}
                    icon={<RefreshCcw size={16} />}
                />
            </div>

            {hotelStats.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
                    
                    {/* Status Breakdown Row */}
                    <div className="md:col-span-2 grid grid-cols-3 gap-4 mb-2">
                        <div className="p-4 bg-green-50 rounded-lg border border-green-100 flex flex-col items-center">
                           <div className="text-green-600 mb-1"><CheckCircle size={20}/></div>
                           <span className="text-xs font-bold uppercase text-green-800/60 mb-1">Подтверждено</span>
                           <span className="text-2xl font-bold text-green-700">{confirmed}</span>
                        </div>
                        <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-100 flex flex-col items-center">
                           <div className="text-yellow-600 mb-1"><Clock size={20}/></div>
                           <span className="text-xs font-bold uppercase text-yellow-800/60 mb-1">Ожидает</span>
                           <span className="text-2xl font-bold text-yellow-700">{pending}</span>
                        </div>
                        <div className="p-4 bg-red-50 rounded-lg border border-red-100 flex flex-col items-center">
                           <div className="text-red-600 mb-1"><XCircle size={20}/></div>
                           <span className="text-xs font-bold uppercase text-red-800/60 mb-1">Отменено</span>
                           <span className="text-2xl font-bold text-red-700">{cancelled}</span>
                        </div>
                    </div>

                    {/* Totals Row */}
                    <div className="p-5 bg-ui/30 rounded-lg border border-ui flex flex-col items-center justify-center text-center">
                        <span className="text-xs font-bold text-text/50 uppercase tracking-wider mb-2">Всего бронирований</span>
                        <span className="text-3xl font-serif text-text font-bold">
                            {totalBookings}
                        </span>
                    </div>

                    <div className="p-5 bg-primary/10 rounded-lg border border-primary/20 flex flex-col items-center justify-center text-center">
                        <span className="text-xs font-bold text-primary/70 uppercase tracking-wider mb-2">Общая выручка</span>
                        <span className="text-3xl font-serif text-primary font-bold">
                            {totalRevenue.toLocaleString()} ₽
                        </span>
                    </div>
                </div>
            ) : !loadingHotel && (
                <div className="text-center py-12 text-text/40 text-sm italic">
                    Нажмите "Загрузить отчет" для просмотра данных
                </div>
            )}
        </div>

        {/* SECTION 2: Top Rooms */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-ui space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold flex items-center gap-2">
                    <Award size={20} className="text-amber-500" /> Топ популярных номеров
                </h2>
                <Button 
                    text="Загрузить топ" 
                    variant={ButtonVariant.Secondary}
                    onClick={loadTopRooms}
                    disabled={loadingRooms}
                    isLoading={loadingRooms}
                />
            </div>

            {topRooms.length > 0 ? (
                <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-500 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                    {topRooms.map((room, i) => {
                        const count = Number(getVal(room, ['bookingsCount', 'BOOKINGS_COUNT']));
                        const roomNo = getVal(room, ['roomNo', 'room_no', 'ROOM_NO']);
                        
                        // Find max for scale
                        const maxCount = Math.max(...topRooms.map(r => Number(getVal(r, ['bookingsCount', 'BOOKINGS_COUNT']))));
                        const percent = maxCount > 0 ? (count / maxCount) * 100 : 0;

                        return (
                            <div key={i} className="relative">
                                <div className="flex justify-between text-sm mb-1">
                                    <span className="font-bold font-mono">#{i+1} Номер {roomNo}</span>
                                    <span className="text-text/70">{count} бронирований</span>
                                </div>
                                <div className="w-full bg-gray-100 rounded-full h-2.5 mb-1 overflow-hidden">
                                    <div className="bg-amber-400 h-2.5 rounded-full" style={{ width: `${percent}%` }}></div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            ) : (
                <div className="text-center py-12 text-text/40 text-sm italic">
                    Данные не загружены
                </div>
            )}
        </div>

        {/* SECTION 3: Monthly Trends (Full Width usually looks better for charts) */}
        <div className="xl:col-span-2 bg-white p-6 rounded-xl shadow-sm border border-ui space-y-6">
             <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold flex items-center gap-2">
                    <TrendingUp size={20} className="text-green-600" /> Динамика бронирований
                </h2>
                <Button 
                    text="Показать тренды" 
                    variant={ButtonVariant.Secondary}
                    onClick={loadMonthlyStats}
                    disabled={loadingMonthly}
                    isLoading={loadingMonthly}
                />
            </div>
            
            <div className="min-h-[300px] flex flex-col justify-end">
                 {loadingMonthly ? (
                     <div className="flex justify-center items-center h-full text-text/40">Загрузка...</div>
                 ) : monthlyStats.length > 0 ? (
                     <SimpleBarChart 
                        data={monthlyStats} 
                        labelKey="month" 
                        valueKey="bookingsCount" 
                        formatValue={(v: number) => v}
                        colorClass="bg-secondary"
                     />
                 ) : (
                     <div className="text-center py-20 text-text/40 text-sm italic border border-dashed border-gray-200 rounded-xl">
                        График появится здесь после загрузки
                     </div>
                 )}
            </div>
            {monthlyStats.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 text-center">
                     <div className="p-3 bg-gray-50 rounded border border-gray-100">
                        <span className="block text-xs font-bold text-text/40 uppercase">Всего месяцев</span>
                        <span className="text-xl font-bold text-text">{monthlyStats.length}</span>
                     </div>
                     <div className="p-3 bg-gray-50 rounded border border-gray-100">
                        <span className="block text-xs font-bold text-text/40 uppercase">Максимум</span>
                        <span className="text-xl font-bold text-text">
                           {Math.max(...monthlyStats.map(m => Number(getVal(m, ['bookingsCount', 'BOOKINGS_COUNT']))))}
                        </span>
                     </div>
                </div>
            )}
        </div>

      </div>
    </div>
  );
}