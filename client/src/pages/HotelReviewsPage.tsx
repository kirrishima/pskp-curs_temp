import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Star,
  Loader2,
  AlertCircle,
  ChevronsLeft,
  ChevronsRight,
  ChevronLeft,
  ChevronRight,
  X,
  MessageSquare,
} from 'lucide-react';
import { getHotelReviews, getHotelPublic } from '@/api/hotelApi';
import { API_BASE_URL } from '@/api/axiosInstance';
import type { Review, ReviewsPagination, ReviewsStats } from '@/types';

// ─── URL resolver ────────────────────────────────────────────────────────────

function resolveImageUrl(imagesBase: string | undefined, imageId: string, ext: string): string {
  if (!imagesBase) return '';
  const serverBase = API_BASE_URL.replace(/\/api\/?$/, '');
  return `${serverBase}${imagesBase}/${imageId}.${ext}`;
}

// ─── Formatters ──────────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

// ─── Star component ──────────────────────────────────────────────────────────

function Stars({ rating, size = 16 }: { rating: number; size?: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          size={size}
          className={i <= rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}
        />
      ))}
    </div>
  );
}

// ─── Lightbox modal ──────────────────────────────────────────────────────────

function ImageLightbox({
  imagesBase,
  imageId,
  ext,
  onClose,
}: {
  imagesBase: string | undefined;
  imageId: string;
  ext: string;
  onClose: () => void;
}) {
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="relative max-w-2xl max-h-[80vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={resolveImageUrl(imagesBase, imageId, ext)}
          alt="Review image"
          className="w-full h-full object-contain rounded-lg"
        />
        <button
          type="button"
          onClick={onClose}
          className="absolute -top-10 -right-10 p-2 bg-white rounded-lg shadow-lg hover:bg-gray-100 transition-colors"
          title="Закрыть"
        >
          <X size={20} className="text-gray-700" />
        </button>
      </div>
    </div>
  );
}

// ─── Review card ─────────────────────────────────────────────────────────────

interface ExpandedImage {
  imagesBase: string | undefined;
  imageId: string;
  ext: string;
}

function ReviewCard({ review }: { review: Review }) {
  const [expandedImage, setExpandedImage] = useState<ExpandedImage | null>(null);
  const displayImages = review.images.slice(0, 3);

  return (
    <>
      <div className="bg-white border border-gray-100 rounded-2xl p-6 space-y-4">
        {/* Header: author + rating + date */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex-grow">
            <p className="font-semibold text-text">{review.authorName}</p>
            <p className="text-xs text-text/40 mt-1">{formatDate(review.createdAt)}</p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <Stars rating={review.rating} size={14} />
            <p className="text-sm font-medium text-text">{review.rating} / 5</p>
          </div>
        </div>

        {/* Review text */}
        {review.text && (
          <p className="text-sm text-text/70 leading-relaxed">{review.text}</p>
        )}

        {/* Images */}
        {displayImages.length > 0 && (
          <div className="flex gap-2 mt-4">
            {displayImages.map((img) => (
              <button
                key={img.imageId}
                type="button"
                onClick={() => setExpandedImage({ imagesBase: review.imagesBase, imageId: img.imageId, ext: img.ext })}
                className="w-20 h-20 rounded-lg overflow-hidden bg-gray-100 hover:opacity-80 transition-opacity flex-shrink-0"
              >
                <img
                  src={resolveImageUrl(review.imagesBase, img.imageId, img.ext)}
                  alt="Review"
                  className="w-full h-full object-cover"
                />
              </button>
            ))}
            {review.images.length > 3 && (
              <div className="w-20 h-20 rounded-lg bg-gray-100 flex items-center justify-center text-xs text-text/40 font-medium">
                +{review.images.length - 3}
              </div>
            )}
          </div>
        )}

        {/* Room info */}
        {review.room && (
          <div className="pt-3 border-t border-gray-100">
            <Link
              to={`/rooms/${review.room.roomNo}`}
              className="inline-flex items-center gap-2 text-sm text-primary hover:text-primary/80 font-medium transition-colors"
            >
              <MessageSquare size={14} />
              <span>{review.room.title}</span>
              {review.room.hotel && (
                <span className="text-text/40">·</span>
              )}
              {review.room.hotel && (
                <span className="text-text/40 font-normal">{review.room.hotel.name}</span>
              )}
            </Link>
          </div>
        )}
      </div>

      {/* Lightbox */}
      {expandedImage && (
        <ImageLightbox
          imagesBase={expandedImage.imagesBase}
          imageId={expandedImage.imageId}
          ext={expandedImage.ext}
          onClose={() => setExpandedImage(null)}
        />
      )}
    </>
  );
}

// ─── Pagination ──────────────────────────────────────────────────────────────

function Pagination({
  pagination,
  onPageChange,
}: {
  pagination: ReviewsPagination;
  onPageChange: (page: number) => void;
}) {
  const { page, totalPages, totalCount, limit } = pagination;
  const from = (page - 1) * limit + 1;
  const to = Math.min(page * limit, totalCount);

  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between mt-6 text-sm">
      <p className="text-text/40">
        {from}–{to} из {totalCount}
      </p>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onPageChange(1)}
          disabled={page === 1}
          className="p-1.5 rounded-lg hover:bg-ui disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronsLeft size={16} />
        </button>
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={page === 1}
          className="p-1.5 rounded-lg hover:bg-ui disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft size={16} />
        </button>
        <span className="px-3 py-1 text-text/60">
          {page} / {totalPages}
        </span>
        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={page === totalPages}
          className="p-1.5 rounded-lg hover:bg-ui disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronRight size={16} />
        </button>
        <button
          type="button"
          onClick={() => onPageChange(totalPages)}
          disabled={page === totalPages}
          className="p-1.5 rounded-lg hover:bg-ui disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronsRight size={16} />
        </button>
      </div>
    </div>
  );
}

// ─── Stats block ─────────────────────────────────────────────────────────────

function ReviewsStatsBlock({ stats }: { stats: ReviewsStats }) {
  const avgRating = stats.averageRating ?? 0;
  const ratingDisplay = avgRating > 0 ? avgRating.toFixed(1) : '—';

  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-6 flex items-center gap-6">
      <div className="flex flex-col items-center gap-2">
        <div className="flex items-center gap-2">
          <Stars rating={Math.round(avgRating)} size={20} />
        </div>
        <p className="text-2xl font-semibold text-text">
          {ratingDisplay} / 5
        </p>
      </div>
      <div className="h-12 border-l border-gray-200" />
      <div>
        <p className="text-sm text-text/50">Всего отзывов</p>
        <p className="text-2xl font-semibold text-text">
          {stats.totalReviews} {stats.totalReviews === 1 ? 'отзыв' : stats.totalReviews < 5 ? 'отзыва' : 'отзывов'}
        </p>
      </div>
    </div>
  );
}

// ─── Main page ───────────────────────────────────────────────────────────────

export default function HotelReviewsPage() {
  const { hotelCode } = useParams<{ hotelCode: string }>();
  const navigate = useNavigate();

  if (!hotelCode) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-10">
        <div className="flex flex-col items-center gap-3 py-20 text-center">
          <AlertCircle size={36} className="text-red-400" />
          <p className="text-text/60">Отель не найден</p>
        </div>
      </div>
    );
  }

  // ── State ────────────────────────────────────────────────────────────────

  const [hotelName, setHotelName] = useState<string>('');
  const [reviews, setReviews] = useState<Review[]>([]);
  const [pagination, setPagination] = useState<ReviewsPagination | null>(null);
  const [stats, setStats] = useState<ReviewsStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  // ── Load data ────────────────────────────────────────────────────────────

  const load = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      setError(null);
      try {
        // Fetch hotel info if not already set
        if (!hotelName) {
          const { hotel } = await getHotelPublic(hotelCode);
          setHotelName(hotel.name ?? 'Отель');
        }

        // Fetch reviews
        const result = await getHotelReviews(hotelCode, { page, limit: 10 }, signal);
        if (!signal?.aborted) {
          setReviews(result.reviews);
          setPagination(result.pagination);
          setStats(result.stats);
        }
      } catch (err) {
        if (signal?.aborted) return;
        setError('Не удалось загрузить отзывы. Пожалуйста, попробуйте позже.');
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [hotelCode, hotelName, page]
  );

  useEffect(() => {
    const ac = new AbortController();
    load(ac.signal);
    return () => ac.abort();
  }, [load]);

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      {/* Back link */}
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-primary hover:text-primary/80 font-medium mb-6 transition-colors"
      >
        <ArrowLeft size={18} />
        К отелю
      </button>

      {/* Title */}
      <h1 className="text-3xl font-semibold text-text mb-6">
        Отзывы · {hotelName || 'Отель'}
      </h1>

      {/* Content */}
      {loading ? (
        <div className="flex justify-center items-center py-24">
          <Loader2 className="animate-spin text-primary" size={32} />
        </div>
      ) : error ? (
        <div className="flex flex-col items-center gap-3 py-20 text-center">
          <AlertCircle size={36} className="text-red-400" />
          <p className="text-text/60">{error}</p>
          <button
            type="button"
            onClick={() => load()}
            className="mt-2 px-4 py-2 bg-primary text-white rounded-lg text-sm hover:bg-primary/90 transition-colors"
          >
            Попробовать снова
          </button>
        </div>
      ) : reviews.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-20 text-center">
          <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center">
            <MessageSquare size={28} className="text-gray-300" />
          </div>
          <div>
            <p className="font-medium text-text">Отзывов пока нет</p>
            <p className="text-sm text-text/50 mt-1">
              Будьте первым, кто оставит отзыв об этом отеле.
            </p>
          </div>
        </div>
      ) : (
        <>
          {/* Stats block */}
          {stats && <ReviewsStatsBlock stats={stats} />}

          {/* Reviews list */}
          <div className="flex flex-col gap-4 mt-6">
            {reviews.map((review) => (
              <ReviewCard key={review.reviewId} review={review} />
            ))}
          </div>

          {/* Pagination */}
          {pagination && <Pagination pagination={pagination} onPageChange={setPage} />}
        </>
      )}
    </div>
  );
}
