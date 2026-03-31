import { memo, useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Calendar,
  Users,
  Search,
  MapPin,
  Phone,
  Mail,
  Star,
  Heart,
} from 'lucide-react';
import { getHotelPublic, getServices } from '@/api/hotelApi';
import { API_BASE_URL } from '@/api/axiosInstance';
import { getFeatureIcon } from '@/utils/featureIcons';
import type { Hotel, Service } from '@/types';
import Button from '@/components/ui/Button';
import Shimmer, { ShimmerHotelInfo } from '@/components/ui/Shimmer';

// ─── Constants ───────────────────────────────────────────────────────────────

const HOTEL_CODE = 'MOONGLOW'; // default hotel code

const inputClass =
  'w-full px-3 py-2 bg-white border border-gray-300 rounded-md outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-shadow text-sm text-text disabled:bg-gray-100 disabled:text-gray-400';

const labelClass =
  'block text-xs font-bold text-text/50 uppercase tracking-wider mb-1';

// ─── Helper ──────────────────────────────────────────────────────────────────

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
          size={18}
          className={i < count ? 'text-amber-400 fill-amber-400' : 'text-gray-300'}
        />
      ))}
    </div>
  );
});

// ─── Search Form (matching /rooms top bar style) ─────────────────────────────

const SearchForm = memo(function SearchForm() {
  const navigate = useNavigate();

  const [checkIn, setCheckIn] = useState(getTodayDate());
  const [checkOut, setCheckOut] = useState(getTomorrowDate());
  const [guests, setGuests] = useState(1);

  const handleSearch = useCallback(() => {
    const params = new URLSearchParams({
      checkIn,
      checkOut,
      guests: String(guests),
    });
    navigate(`/rooms?${params.toString()}`);
  }, [navigate, checkIn, checkOut, guests]);

  return (
    <div className="bg-white border-b border-gray-100 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className="flex flex-col md:flex-row gap-3 md:items-end">
          {/* Dates — side-by-side on mobile, flat flex items on desktop */}
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
            Найти
          </Button>
        </div>
      </div>
    </div>
  );
});

// ─── Main HomePage Component ─────────────────────────────────────────────────

const HomePage = memo(function HomePage() {
  const [hotel, setHotel] = useState<(Hotel & { _count?: { rooms: number } }) | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [loadingHotel, setLoadingHotel] = useState(true);
  const [loadingServices, setLoadingServices] = useState(true);

  useEffect(() => {
    const loadHotel = async () => {
      try {
        const { hotel: h } = await getHotelPublic(HOTEL_CODE);
        setHotel(h);
      } catch (err) {
        console.error('Failed to load hotel info:', err);
      } finally {
        setLoadingHotel(false);
      }
    };

    const loadServices = async () => {
      try {
        const { services: s } = await getServices();
        setServices(s.filter((svc) => svc.isActive));
      } catch (err) {
        console.error('Failed to load services:', err);
      } finally {
        setLoadingServices(false);
      }
    };

    loadHotel();
    loadServices();
  }, []);

  const heroImage = hotel?.heroImageUrl
    ? getImageUrl(hotel.heroImageUrl)
    : 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=1920&q=80';

  return (
    <div className="flex flex-col">
      {/* ── Hero Section ─────────────────────────────────────────────────── */}
      <section className="relative h-[420px] md:h-[500px] w-full bg-gray-900 text-white overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/30 to-black/60 z-10" />
        <img
          src={heroImage}
          alt="Hotel Hero"
          className="absolute inset-0 w-full h-full object-cover"
          onError={(e) => {
            (e.target as HTMLImageElement).src =
              'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=1920&q=80';
          }}
        />

        <div className="relative z-20 h-full flex flex-col items-center justify-center text-center px-4 max-w-5xl mx-auto gap-6">
          {/* Hotel name & tagline */}
          {loadingHotel ? (
            <div className="space-y-4 w-full max-w-md">
              <Shimmer className="h-12 w-2/3 mx-auto !bg-white/20" />
              <Shimmer className="h-6 w-full mx-auto !bg-white/15" />
            </div>
          ) : (
            <>
              <h1 className="text-4xl md:text-6xl font-light tracking-tight">
                {hotel?.name || 'Moonglow'}
              </h1>
              {hotel?.tagline && (
                <p className="text-lg md:text-xl text-white/80 font-light max-w-2xl">
                  {hotel.tagline}
                </p>
              )}
              {hotel?.stars && <StarRating count={hotel.stars} />}
            </>
          )}
        </div>
      </section>

      {/* ── Search Form (same style as /rooms top bar) ─────────────────── */}
      <SearchForm />

      {/* ── About Section ────────────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-4 py-16 w-full">
        {loadingHotel ? (
          <ShimmerHotelInfo />
        ) : hotel ? (
          <div className="space-y-12">
            {/* About text */}
            {(hotel.aboutText || hotel.description) && (
              <div className="text-center max-w-3xl mx-auto">
                <h2 className="text-3xl font-light text-text mb-6">
                  Добро пожаловать
                </h2>
                <p className="text-text/70 leading-relaxed text-lg">
                  {hotel.aboutText || hotel.description}
                </p>
              </div>
            )}

            {/* Info cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Location */}
              {(hotel.city || hotel.address) && (
                <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 text-center hover:shadow-md transition-shadow">
                  <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <MapPin size={24} className="text-primary" />
                  </div>
                  <h3 className="font-semibold text-text mb-2">Расположение</h3>
                  {hotel.city && <p className="text-text/60 text-sm">{hotel.city}</p>}
                  {hotel.address && (
                    <p className="text-text/60 text-sm">{hotel.address}</p>
                  )}
                </div>
              )}

              {/* Contact */}
              {(hotel.phone || hotel.email) && (
                <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 text-center hover:shadow-md transition-shadow">
                  <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Phone size={24} className="text-primary" />
                  </div>
                  <h3 className="font-semibold text-text mb-2">Контакты</h3>
                  {hotel.phone && <p className="text-text/60 text-sm">{hotel.phone}</p>}
                  {hotel.email && (
                    <p className="text-text/60 text-sm flex items-center justify-center gap-1">
                      <Mail size={14} />
                      {hotel.email}
                    </p>
                  )}
                </div>
              )}

              {/* Rooms count */}
              <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 text-center hover:shadow-md transition-shadow">
                <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Heart size={24} className="text-primary" />
                </div>
                <h3 className="font-semibold text-text mb-2">Номера</h3>
                <p className="text-text/60 text-sm">
                  {hotel._count?.rooms
                    ? `${hotel._count.rooms} номеров к вашим услугам`
                    : 'Широкий выбор номеров'}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-12 text-text/60">
            Информация об отеле недоступна
          </div>
        )}
      </section>

      {/* ── Services Section ──────────────────────────────────────────────── */}
      <section className="bg-ui/50 py-16">
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="text-3xl font-light text-text text-center mb-10">
            Наши услуги
          </h2>

          {loadingServices ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div
                  key={i}
                  className="bg-white rounded-xl p-5 shadow-sm border border-gray-100"
                >
                  <Shimmer className="h-10 w-10 rounded-full mx-auto mb-3" />
                  <Shimmer className="h-4 w-2/3 mx-auto mb-2" />
                  <Shimmer className="h-3 w-full mx-auto" />
                </div>
              ))}
            </div>
          ) : services.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {services.map((service) => (
                <div
                  key={service.serviceCode}
                  className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 text-center hover:shadow-md transition-shadow"
                >
                  <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-3">
                    {getFeatureIcon({
                      iconUrl: service.iconUrl,
                      icon: service.icon,
                      size: 20,
                      className: 'text-primary',
                    })}
                  </div>
                  <h3 className="font-medium text-text text-sm mb-1">
                    {service.title}
                  </h3>
                  {service.description && (
                    <p className="text-text/50 text-xs line-clamp-2">
                      {service.description}
                    </p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-text/50">
              Информация об услугах появится позже
            </p>
          )}
        </div>
      </section>

      {/* ── Map Section (Placeholder) ─────────────────────────────────────── */}
      <section className="py-16">
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="text-3xl font-light text-text text-center mb-10">
            Как нас найти
          </h2>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            {hotel?.latitude && hotel?.longitude ? (
              <iframe
                title="Hotel Location"
                width="100%"
                height="400"
                style={{ border: 0 }}
                loading="lazy"
                src={`https://www.openstreetmap.org/export/embed.html?bbox=${Number(hotel.longitude) - 0.01}%2C${Number(hotel.latitude) - 0.01}%2C${Number(hotel.longitude) + 0.01}%2C${Number(hotel.latitude) + 0.01}&layer=mapnik&marker=${hotel.latitude}%2C${hotel.longitude}`}
              />
            ) : (
              <div className="h-[400px] bg-gradient-to-br from-primary/5 to-secondary/10 flex items-center justify-center">
                <div className="text-center text-text/40">
                  <MapPin size={48} className="mx-auto mb-3" />
                  <p className="text-lg">Карта будет доступна позже</p>
                  {hotel?.address && (
                    <p className="text-sm mt-2">{hotel.city}, {hotel.address}</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
});

export default HomePage;
