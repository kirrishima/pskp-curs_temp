import { memo, useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  MapPin,
  Phone,
  Mail,
  Star,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  X,
  Loader2,
  MessageSquare,
} from 'lucide-react';
import { getHotelPublic, getHotelReviews } from '@/api/hotelApi';
import { API_BASE_URL } from '@/api/axiosInstance';
import type { Hotel, Review, ReviewsPagination, HotelImage } from '@/types';
import Button from '@/components/ui/Button';
import Shimmer from '@/components/ui/Shimmer';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function resolveImageUrl(imagesBase: string | undefined, imageId: string, ext: string): string {
  if (!imagesBase) return '';
  const serverBase = API_BASE_URL.replace(/\/api\/?$/, '');
  return `${serverBase}${imagesBase}/${imageId}.${ext}`;
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('ru-RU', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

// ─── Star Rating ─────────────────────────────────────────────────────────────

const StarRating = memo(function StarRating({ count, size = 16 }: { count: number; size?: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          size={size}
          className={i < count ? 'text-amber-400 fill-amber-400' : 'text-gray-300'}
        />
      ))}
    </div>
  );
});

// ─── Image Lightbox ──────────────────────────────────────────────────────────

interface ImageLightboxProps {
  images: HotelImage[];
  imagesBase: string | undefined;
  initialIndex: number;
  onClose: () => void;
}

const ImageLightbox = memo(function ImageLightbox({
  images,
  imagesBase,
  initialIndex,
  onClose,
}: ImageLightboxProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);

  const handlePrev = useCallback(() => {
    setCurrentIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
  }, [images.length]);

  const handleNext = useCallback(() => {
    setCurrentIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));
  }, [images.length]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') handlePrev();
      if (e.key === 'ArrowRight') handleNext();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, handlePrev, handleNext]);

  const image = images[currentIndex];

  return (
    <div
      className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
      onClick={onClose}
    >
      <div className="relative w-full h-full flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 bg-white/10 hover:bg-white/20 p-2 rounded-full transition-colors"
        >
          <X size={24} className="text-white" />
        </button>

        {/* Image */}
        <img
          src={resolveImageUrl(imagesBase, image.imageId, image.ext)}
          alt={`Hotel ${currentIndex + 1}`}
          className="max-w-full max-h-full object-contain"
        />

        {/* Prev button */}
        <button
          onClick={handlePrev}
          className="absolute left-4 bg-white/10 hover:bg-white/20 p-2 rounded-full transition-colors"
        >
          <ChevronLeft size={24} className="text-white" />
        </button>

        {/* Next button */}
        <button
          onClick={handleNext}
          className="absolute right-4 bg-white/10 hover:bg-white/20 p-2 rounded-full transition-colors"
        >
          <ChevronRight size={24} className="text-white" />
        </button>

        {/* Counter */}
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-black/70 px-3 py-1 rounded-full text-white text-sm">
          {currentIndex + 1} / {images.length}
        </div>
      </div>
    </div>
  );
});

// ─── Review Card ─────────────────────────────────────────────────────────────

const ReviewCard = memo(function ReviewCard({ review }: { review: Review }) {
  return (
    <div className="bg-white rounded-xl p-6 border border-gray-100 shadow-sm">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <h4 className="font-semibold text-text mb-1">{review.authorName}</h4>
          <p className="text-sm text-text/50">{formatDate(review.createdAt)}</p>
        </div>
        <StarRating count={review.rating} size={14} />
      </div>

      {/* Text */}
      {review.text && (
        <p className="text-text/70 text-sm mb-4 leading-relaxed">
          {review.text}
        </p>
      )}

      {/* Images */}
      {review.images && review.images.length > 0 && (
        <div className="flex gap-2 overflow-x-auto">
          {review.images.slice(0, 3).map((img) => (
            <div key={img.imageId} className="flex-shrink-0">
              <img
                src={resolveImageUrl(review.imagesBase, img.imageId, img.ext)}
                alt="Review"
                className="h-16 w-16 object-cover rounded"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
});

// ─── Review Section Skeleton ─────────────────────────────────────────────────

const ReviewCardSkeleton = memo(function ReviewCardSkeleton() {
  return (
    <div className="bg-white rounded-xl p-6 border border-gray-100 shadow-sm space-y-3">
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <Shimmer className="h-5 w-40 mb-2" />
          <Shimmer className="h-4 w-32" />
        </div>
        <Shimmer className="h-4 w-20" />
      </div>
      <Shimmer className="h-12 w-full" />
    </div>
  );
});

// ─── Main HotelDetailPage Component ───────────────────────────────────────────

const HotelDetailPage = memo(function HotelDetailPage() {
  const { hotelCode } = useParams<{ hotelCode: string }>();
  const navigate = useNavigate();

  const [hotel, setHotel] = useState<Hotel | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [reviewPagination, setReviewPagination] = useState<ReviewsPagination | null>(null);
  const [loadingHotel, setLoadingHotel] = useState(true);
  const [loadingReviews, setLoadingReviews] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  if (!hotelCode) {
    return null;
  }

  // Load initial data
  useEffect(() => {
    const controller = new AbortController();

    const loadHotel = async () => {
      try {
        const { hotel: h } = await getHotelPublic(hotelCode);
        if (!controller.signal.aborted) {
          setHotel(h);
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          console.error('Failed to load hotel:', err);
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoadingHotel(false);
        }
      }
    };

    const loadReviews = async () => {
      try {
        const { reviews: r, pagination: p } = await getHotelReviews(hotelCode, { page: 1, limit: 10 });
        if (!controller.signal.aborted) {
          setReviews(r);
          setReviewPagination(p);
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          console.error('Failed to load reviews:', err);
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoadingReviews(false);
        }
      }
    };

    loadHotel();
    loadReviews();

    return () => {
      controller.abort();
    };
  }, [hotelCode]);

  const handleLoadMoreReviews = useCallback(async () => {
    if (!reviewPagination || reviewPagination.page >= reviewPagination.totalPages) {
      return;
    }

    setLoadingMore(true);
    try {
      const nextPage = reviewPagination.page + 1;
      const { reviews: r, pagination: p } = await getHotelReviews(hotelCode, {
        page: nextPage,
        limit: 10,
      });
      setReviews((prev) => [...prev, ...r]);
      setReviewPagination(p);
    } catch (err) {
      console.error('Failed to load more reviews:', err);
    } finally {
      setLoadingMore(false);
    }
  }, [hotelCode, reviewPagination]);

  const starCount = hotel?.stars ? Math.round(hotel.stars) : 0;
  const hasImages = hotel?.images && hotel.images.length > 0;
  const mainImage = hasImages ? hotel?.images?.find((img) => img.isMain) || hotel?.images?.[0] : null;

  return (
    <div className="flex flex-col bg-gray-50 min-h-screen">
      {/* ── Header with Back Button ──────────────────────────────────────── */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-primary hover:text-primary/80 transition-colors"
          >
            <ArrowLeft size={20} />
            <span className="text-sm font-medium">Назад</span>
          </button>
        </div>
      </div>

      {/* ── Gallery / Hero Section ───────────────────────────────────────── */}
      <section className="bg-white border-b border-gray-100">
        {loadingHotel ? (
          <div className="max-w-7xl mx-auto px-4 py-8">
            <Shimmer className="w-full h-96 rounded-xl" />
          </div>
        ) : hasImages ? (
          <div className="max-w-7xl mx-auto px-4 py-8">
            {/* Main image */}
            <div
              className="relative w-full h-96 rounded-xl overflow-hidden cursor-pointer group"
              onClick={() => {
                const index = hotel!.images!.findIndex(
                  (img) => img.imageId === mainImage?.imageId,
                );
                setLightboxIndex(Math.max(index, 0));
                setLightboxOpen(true);
              }}
            >
              <img
                src={resolveImageUrl(hotel?.imagesBase, mainImage?.imageId || '', mainImage?.ext || '')}
                alt={hotel?.name}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              />
              <div className="absolute inset-0 bg-black/20 group-hover:bg-black/30 transition-colors" />
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <span className="text-white text-sm font-medium">Просмотреть все фото</span>
              </div>
            </div>

            {/* Thumbnails — only when gallery images are uploaded */}
            {hotel!.images!.length > 1 && (
              <div className="flex gap-3 mt-4 overflow-x-auto pb-2">
                {hotel!.images!.map((img, idx) => (
                  <button
                    key={img.imageId}
                    onClick={() => {
                      setLightboxIndex(idx);
                      setLightboxOpen(true);
                    }}
                    className={`flex-shrink-0 h-20 w-20 rounded-lg overflow-hidden border-2 transition-colors ${
                      mainImage?.imageId === img.imageId
                        ? 'border-primary'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <img
                      src={resolveImageUrl(hotel?.imagesBase, img.imageId, img.ext)}
                      alt="Thumbnail"
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          // No images at all — subtle gradient banner, no distracting icon
          <div className="max-w-7xl mx-auto px-4 py-8">
            <div className="w-full h-64 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5" />
          </div>
        )}
      </section>

      {/* ── Hotel Header with Title & Rating ─────────────────────────────── */}
      <section className="bg-white border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 py-8">
          {loadingHotel ? (
            <div className="space-y-3">
              <Shimmer className="h-8 w-2/3" />
              <Shimmer className="h-4 w-1/2" />
            </div>
          ) : hotel ? (
            <div>
              <h1 className="text-4xl font-light text-text mb-3">{hotel.name}</h1>
              <div className="flex flex-wrap items-center gap-6">
                {starCount > 0 && <StarRating count={starCount} size={20} />}
                {hotel.averageRating != null && (
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-semibold text-text">
                      {hotel.averageRating.toFixed(1)}
                    </span>
                    <span className="text-text/60">
                      ({hotel.totalReviews || 0} отзывов)
                    </span>
                  </div>
                )}
                {hotel.city && (
                  <div className="flex items-center gap-2 text-text/70">
                    <MapPin size={18} />
                    {hotel.city}
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </div>
      </section>

      {/* ── Info Grid (Address, Phone, Email) ───────────────────────────── */}
      <section className="bg-white border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 py-8">
          {loadingHotel ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {Array.from({ length: 3 }).map((_, i) => (
                <Shimmer key={i} className="h-20 w-full rounded-lg" />
              ))}
            </div>
          ) : hotel ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {hotel.address && (
                <div className="flex gap-3">
                  <MapPin size={20} className="text-primary flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-semibold text-text/60 uppercase mb-1">Адрес</p>
                    <p className="text-text">{hotel.address}</p>
                  </div>
                </div>
              )}
              {hotel.phone && (
                <div className="flex gap-3">
                  <Phone size={20} className="text-primary flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-semibold text-text/60 uppercase mb-1">Телефон</p>
                    <a href={`tel:${hotel.phone}`} className="text-primary hover:underline">
                      {hotel.phone}
                    </a>
                  </div>
                </div>
              )}
              {hotel.email && (
                <div className="flex gap-3">
                  <Mail size={20} className="text-primary flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-semibold text-text/60 uppercase mb-1">Email</p>
                    <a href={`mailto:${hotel.email}`} className="text-primary hover:underline">
                      {hotel.email}
                    </a>
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </div>
      </section>

      {/* ── About Section ────────────────────────────────────────────────── */}
      {hotel?.aboutText || hotel?.description ? (
        <section className="bg-white border-b border-gray-100">
          <div className="max-w-7xl mx-auto px-4 py-8">
            <h2 className="text-2xl font-light text-text mb-4">Об отеле</h2>
            <p className="text-text/70 leading-relaxed whitespace-pre-wrap">
              {hotel?.aboutText || hotel?.description}
            </p>
          </div>
        </section>
      ) : null}


      {/* ── CTA: View Rooms ──────────────────────────────────────────────── */}
      <section className="bg-primary/5 border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 py-8 text-center">
          <h2 className="text-2xl font-light text-text mb-4">
            Готовы забронировать номер?
          </h2>
          <Link to={`/rooms?hotelCode=${hotelCode}`}>
            <Button variant="primary" size="lg">
              Посмотреть номера
            </Button>
          </Link>
        </div>
      </section>

      {/* ── Reviews Section ──────────────────────────────────────────────── */}
      <section className="max-w-7xl mx-auto px-4 py-8 w-full">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-light text-text">Отзывы гостей</h2>
          <Link to={`/hotels/${hotelCode}/reviews`}>
            <Button variant="secondary" size="sm">
              Все отзывы
            </Button>
          </Link>
        </div>

        {loadingReviews ? (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <ReviewCardSkeleton key={i} />
            ))}
          </div>
        ) : reviews.length > 0 ? (
          <div className="space-y-4">
            {reviews.map((review) => (
              <ReviewCard key={review.reviewId} review={review} />
            ))}

            {/* Load More Button */}
            {reviewPagination && reviewPagination.page < reviewPagination.totalPages && (
              <div className="text-center pt-4">
                <Button
                  variant="secondary"
                  onClick={handleLoadMoreReviews}
                  disabled={loadingMore}
                  className="inline-flex items-center gap-2"
                >
                  {loadingMore ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Загрузка...
                    </>
                  ) : (
                    'Загрузить ещё'
                  )}
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-12 text-text/60">
            <MessageSquare size={48} className="mx-auto mb-3 text-text/30" />
            <p className="text-lg">Отзывов пока нет</p>
          </div>
        )}
      </section>

      {/* ── Map Section ──────────────────────────────────────────────────── */}
      {hotel?.latitude && hotel?.longitude && (
        <section className="bg-white border-t border-gray-100 py-8">
          <div className="max-w-7xl mx-auto px-4">
            <h2 className="text-2xl font-light text-text mb-6">Как нас найти</h2>
            <div className="rounded-xl overflow-hidden border border-gray-100 shadow-sm">
              <iframe
                title="Hotel Location"
                width="100%"
                height="400"
                style={{ border: 0 }}
                loading="lazy"
                src={`https://www.openstreetmap.org/export/embed.html?bbox=${Number(hotel.longitude) - 0.01}%2C${Number(hotel.latitude) - 0.01}%2C${Number(hotel.longitude) + 0.01}%2C${Number(hotel.latitude) + 0.01}&layer=mapnik&marker=${hotel.latitude}%2C${hotel.longitude}`}
              />
            </div>
          </div>
        </section>
      )}

      {/* ── Lightbox ──────────────────────────────────────────────────────── */}
      {lightboxOpen && hotel?.images && hotel.images.length > 0 && (
        <ImageLightbox
          images={hotel.images}
          imagesBase={hotel.imagesBase}
          initialIndex={lightboxIndex}
          onClose={() => setLightboxOpen(false)}
        />
      )}
    </div>
  );
});

export default HotelDetailPage;
