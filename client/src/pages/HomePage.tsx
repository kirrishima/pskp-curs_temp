import { memo, useEffect, useState, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Calendar,
  Users,
  Search,
  MapPin,
  Star,
} from 'lucide-react';
import { getHotelsPublic, getServices } from '@/api/hotelApi';
import { API_BASE_URL } from '@/api/axiosInstance';
import { getFeatureIcon } from '@/utils/featureIcons';
import type { Hotel, Service } from '@/types';
import Button from '@/components/ui/Button';
import Shimmer from '@/components/ui/Shimmer';

// ─── Constants ───────────────────────────────────────────────────────────────

const inputClass =
  'w-full px-3 py-2 bg-white border border-gray-300 rounded-md outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-shadow text-sm text-text disabled:bg-gray-100 disabled:text-gray-400';

const labelClass =
  'block text-xs font-bold text-text/50 uppercase tracking-wider mb-1';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getTodayDate(): string {
  return new Date().toISOString().split('T')[0];
}

function getTomorrowDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().split('T')[0];
}

function getImageUrl(imageUrl: string | undefined | null): string {
  if (!imageUrl) return '';
  if (imageUrl.startsWith('/uploads/')) {
    return `${API_BASE_URL.replace('/api', '')}${imageUrl}`;
  }
  return imageUrl;
}

// ─── Star Rating ─────────────────────────────────────────────────────────────

const StarRating = memo(function StarRating({ count }: { count: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          size={16}
          className={i < count ? 'text-amber-400 fill-amber-400' : 'text-gray-300'}
        />
      ))}
    </div>
  );
});

// ─── Search Form ─────────────────────────────────────────────────────────────

const SearchForm = memo(function SearchForm() {
  const navigate = useNavigate();

  const [checkIn, setCheckIn] = useState(getTodayDate());
  const [checkOut, setCheckOut] = useState(getTomorrowDate());
  const [guests, setGuests] = useState(1);

  const handleSearch = useCallback(() => {
    const params = new URLSearchParams({
      checkIn,
      checkOut,
      minCapacity: String(guests),
    });
    navigate(`/rooms?${params.toString()}`);
  }, [navigate, checkIn, checkOut, guests]);

  return (
    <div className="bg-white border-b border-gray-100 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className="flex flex-col md:flex-row gap-3 md:items-end">
          {/* Dates — side-by-side on mobile */}
          <div className="flex gap-2 md:contents">
            {/* Check-in */}
            <div className="flex-1 min-w-0">
              <label className={labelClass}>
                <Calendar size={12} className="inline mr-1" />
                Заезд
              </label>
              <input
                type="date"
                value={checkIn}
                min={getTodayDate()}
                onChange={(e) => {
                  setCheckIn(e.target.value);
                  if (e.target.value >= checkOut) {
                    const next = new Date(e.target.value);
                    next.setDate(next.getDate() + 1);
                    setCheckOut(next.toISOString().split('T')[0]);
                  }
                }}
                className={inputClass}
              />
            </div>

            {/* Check-out */}
            <div className="flex-1 min-w-0">
              <label className={labelClass}>
                <Calendar size={12} className="inline mr-1" />
                Выезд
              </label>
              <input
                type="date"
                value={checkOut}
                min={checkIn}
                onChange={(e) => setCheckOut(e.target.value)}
                className={inputClass}
              />
            </div>
          </div>

          {/* Guests */}
          <div className="w-full md:w-36">
            <label className={labelClass}>
              <Users size={12} className="inline mr-1" />
              Гостей
            </label>
            <select
              value={guests}
              onChange={(e) => setGuests(Number(e.target.value))}
              className={inputClass}
            >
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <option key={n} value={n}>
                  {n} {n === 1 ? 'гость' : n < 5 ? 'гостя' : 'гостей'}
                </option>
              ))}
            </select>
          </div>

          {/* Search Button */}
          <Button
            variant="primary"
            size="md"
            icon={<Search size={18} />}
            onClick={handleSearch}
            className="w-full md:w-auto whitespace-nowrap"
          >
            Найти номера
          </Button>
        </div>
      </div>
    </div>
  );
});

// ─── Hotel Card ──────────────────────────────────────────────────────────────

const HotelCard = memo(function HotelCard({ hotel }: { hotel: Hotel }) {
  const mainImage = hotel.images?.find((img) => img.isMain) || hotel.images?.[0];
  const imageUrl = mainImage ? getImageUrl(mainImage.imageUrl) : '';

  const starCount = hotel.stars ? Math.round(hotel.stars) : 0;

  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden hover:shadow-xl transition-shadow duration-200 flex flex-col h-full">
      {/* Image */}
      <div className="relative w-full h-48 bg-gray-200 overflow-hidden flex-shrink-0">
        {imageUrl ? (
          <img src={imageUrl} alt={hotel.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-primary/30 to-secondary/20 flex items-center justify-center">
            <MapPin size={32} className="text-primary/50" />
          </div>
        )}
      </div>

      {/* Body */}
      <div className="p-4 flex flex-col flex-1">
        {/* Name & City */}
        <h3 className="text-lg font-bold text-text mb-1">{hotel.name}</h3>
        {hotel.city && (
          <p className="text-sm text-text/60 mb-3">
            <MapPin size={14} className="inline mr-1" />
            {hotel.city}
          </p>
        )}

        {/* Stars & Rating */}
        <div className="flex items-center gap-2 mb-4">
          {starCount > 0 && <StarRating count={starCount} />}
          {hotel.averageRating != null && (
            <span className="text-sm text-text/60">
              {hotel.averageRating.toFixed(1)} ({hotel.totalReviews || 0})
            </span>
          )}
        </div>

        {/* Room count */}
        <p className="text-sm text-text/70 mb-4 flex-1">
          {hotel.rooms && hotel.rooms.length > 0
            ? `${hotel.rooms.length} номеров`
            : 'Доступны номера'}
        </p>

        {/* Button */}
        <div className="mt-auto">
          <Link
            to={`/hotels/${hotel.hotelCode}`}
            className="w-full"
          >
            <Button
              variant="primary"
              size="sm"
              className="w-full"
            >
              Подробнее
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
});

// ─── Hotel Card Skeleton ─────────────────────────────────────────────────────

const HotelCardSkeleton = memo(function HotelCardSkeleton() {
  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden flex flex-col h-full">
      <Shimmer className="w-full h-48" />
      <div className="p-4 flex flex-col flex-1 space-y-3">
        <Shimmer className="h-6 w-2/3" />
        <Shimmer className="h-4 w-1/2" />
        <Shimmer className="h-4 w-full" />
        <div className="mt-auto pt-2">
          <Shimmer className="h-10 w-full" />
        </div>
      </div>
    </div>
  );
});

// ─── Main HomePage Component ─────────────────────────────────────────────────

const HomePage = memo(function HomePage() {
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [loadingHotels, setLoadingHotels] = useState(true);
  const [loadingServices, setLoadingServices] = useState(true);

  useEffect(() => {
    const controller = new AbortController();

    const loadHotels = async () => {
      try {
        const { hotels: h } = await getHotelsPublic();
        setHotels(h);
      } catch (err) {
        if (!controller.signal.aborted) {
          console.error('Failed to load hotels:', err);
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoadingHotels(false);
        }
      }
    };

    const loadServices = async () => {
      try {
        const { services: s } = await getServices();
        setServices(s.filter((svc) => svc.isActive));
      } catch (err) {
        if (!controller.signal.aborted) {
          console.error('Failed to load services:', err);
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoadingServices(false);
        }
      }
    };

    loadHotels();
    loadServices();

    return () => {
      controller.abort();
    };
  }, []);

  return (
    <div className="flex flex-col">
      {/* ── Hero Section ─────────────────────────────────────────────────── */}
      <section className="relative h-[420px] md:h-[500px] w-full bg-gray-900 text-white overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/30 to-black/60 z-10" />
        <div className="absolute inset-0 bg-gradient-to-br from-primary/30 to-secondary/20 z-0" />

        <div className="relative z-20 h-full flex flex-col items-center justify-center text-center px-4 max-w-5xl mx-auto gap-6">
          <h1 className="text-4xl md:text-6xl font-light tracking-tight">
            Добро пожаловать
          </h1>
          <p className="text-lg md:text-xl text-white/80 font-light max-w-2xl">
            Найдите идеальный номер среди лучших отелей
          </p>
        </div>
      </section>

      {/* ── Search Form ──────────────────────────────────────────────────── */}
      <SearchForm />

      {/* ── Hotels Section ───────────────────────────────────────────────── */}
      <section className="max-w-7xl mx-auto px-4 py-16 w-full">
        <h2 className="text-3xl font-light text-text text-center mb-12">
          Наши отели
        </h2>

        {loadingHotels ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <HotelCardSkeleton key={i} />
            ))}
          </div>
        ) : hotels.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {hotels.map((hotel) => (
              <HotelCard key={hotel.hotelCode} hotel={hotel} />
            ))}
          </div>
        ) : (
          <div className="text-center py-12 text-text/60">
            <MapPin size={48} className="mx-auto mb-3 text-text/30" />
            <p className="text-lg">Отели не найдены</p>
          </div>
        )}
      </section>

      {/* ── Services Section ─────────────────────────────────────────────── */}
      <section className="bg-ui/50 py-16">
        <div className="max-w-7xl mx-auto px-4">
          <h2 className="text-3xl font-light text-text text-center mb-12">
            Наши услуги
          </h2>

          {loadingServices ? (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {Array.from({ length: 12 }).map((_, i) => (
                <div
                  key={i}
                  className="bg-white rounded-xl p-5 shadow-sm border border-gray-100"
                >
                  <Shimmer className="h-10 w-10 rounded-full mx-auto mb-3" />
                  <Shimmer className="h-4 w-2/3 mx-auto" />
                </div>
              ))}
            </div>
          ) : services.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {services.map((service) => (
                <div
                  key={service.serviceCode}
                  className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 text-center hover:shadow-md transition-shadow"
                >
                  <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-2">
                    {getFeatureIcon({
                      iconUrl: service.iconUrl,
                      icon: service.icon,
                      size: 18,
                      className: 'text-primary',
                    })}
                  </div>
                  <h3 className="font-medium text-text text-xs mb-1">
                    {service.title}
                  </h3>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-text/50">
              Услуги будут доступны позже
            </p>
          )}
        </div>
      </section>

    </div>
  );
});

export default HomePage;
