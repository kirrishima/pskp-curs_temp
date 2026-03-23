
import React, { useEffect, useState } from "react";
import { Hotel } from "../types";
import { getHotelInfo, STATIC_IMAGES_URL } from "../services/oracleApiService";
import ErrorAlert from "../components/ErrorAlert";
import { MapPin, Phone, Mail, Globe, Clock, Building } from "lucide-react";

export default function About() {
  const [hotel, setHotel] = useState<Hotel | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<{ status: string; message: string } | null>(null);

  // We hardcode 'MOON_TOKYO' as the primary hotel code for this application instance.
  // In a multi-hotel app, this would come from a URL param.
  const HOTEL_CODE = "MOONGLOW";

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      const res = await getHotelInfo(HOTEL_CODE);
      if (res.status === "OK" && res.data) {
        setHotel(res.data);
      } else {
        setError({ status: res.status, message: res.message });
      }
      setLoading(false);
    };

    fetchData();
  }, []);

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header Image */}
      <div className="relative h-[400px] w-full bg-gray-900 overflow-hidden">
        <img
          src={`${STATIC_IMAGES_URL}/hero_about.jpg`}
          alt="Hotel Exterior"
          className="absolute inset-0 w-full h-full object-cover opacity-60"
          onError={(e) => {
             (e.target as HTMLImageElement).src = "https://picsum.photos/1920/600?grayscale&blur=2";
          }}
        />
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-4">
          <h1 className="text-4xl md:text-5xl font-serif text-white tracking-wide mb-4">
            {loading ? "Загрузка..." : hotel?.name || "Наш Отель"}
          </h1>
          <p className="text-white/80 max-w-2xl text-lg font-light">
            Убежище искусства и комфорта в самом сердце города.
          </p>
        </div>
      </div>

      <div className="max-w-[1200px] mx-auto px-4 py-16 w-full">
        <ErrorAlert error={error} />

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
        ) : hotel ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            {/* Main Content */}
            <div className="md:col-span-2 space-y-8">
              <div>
                <h2 className="text-2xl font-serif text-text mb-6">О {hotel.name}</h2>
                <div className="prose prose-lg text-text/80 whitespace-pre-wrap leading-relaxed">
                  {hotel.description}
                </div>
              </div>

              <div className="bg-ui p-8 rounded-xl border border-gray-200">
                <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                  <Building size={20} /> Детали объекта
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-sm">
                  <div>
                    <span className="block text-text/50 uppercase text-xs font-bold tracking-wider mb-1">Город</span>
                    <span className="font-medium text-lg">{hotel.city}</span>
                  </div>
                  <div>
                    <span className="block text-text/50 uppercase text-xs font-bold tracking-wider mb-1">
                      Основан
                    </span>
                    <span className="font-medium text-lg">{new Date(hotel.createdAt).getFullYear()}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Sidebar Contact Info */}
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
                      <p className="text-text/80 leading-snug">{hotel.address}</p>
                    </div>
                  </li>

                  <li className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 text-primary">
                      <Phone size={20} />
                    </div>
                    <div>
                      <span className="block text-xs font-bold text-text/40 uppercase mb-1">Телефон</span>
                      <p className="text-text/80">{hotel.phone}</p>
                    </div>
                  </li>

                  <li className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 text-primary">
                      <Mail size={20} />
                    </div>
                    <div>
                      <span className="block text-xs font-bold text-text/40 uppercase mb-1">Email</span>
                      <p className="text-text/80">{hotel.email}</p>
                    </div>
                  </li>

                  <li className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 text-primary">
                      <Globe size={20} />
                    </div>
                    <div>
                      <span className="block text-xs font-bold text-text/40 uppercase mb-1">Веб-сайт</span>
                      <a
                        href={`https://${hotel.website}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary hover:underline"
                      >
                        {hotel.website}
                      </a>
                    </div>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
