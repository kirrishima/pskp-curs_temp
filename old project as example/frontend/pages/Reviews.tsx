import React, { useEffect, useState } from "react";
import { Review } from "../types";
import { getAllReviews } from "../services/oracleApiService";
import ErrorAlert from "../components/ErrorAlert";
import { MessageSquare, Star, User } from "lucide-react";

export default function Reviews() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<{ status: string; message: string } | null>(null);

  useEffect(() => {
    const fetchReviews = async () => {
      setLoading(true);
      setError(null);
      const res = await getAllReviews();
      if (res.status === "OK" && res.data) {
        setReviews(res.data);
      } else {
        setError({ status: res.status, message: res.message });
      }
      setLoading(false);
    };

    fetchReviews();
  }, []);

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }).map((_, i) => (
      <Star key={i} size={16} className={i < rating ? "fill-primary text-primary" : "text-gray-300"} />
    ));
  };

  return (
    <div className="max-w-[1440px] mx-auto px-4 py-12">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-serif text-text mb-4">Отзывы гостей</h1>
        <p className="text-text/60 max-w-2xl mx-auto">
          Прочитайте настоящие отзывы наших гостей. Мы ценим каждое мнение, чтобы сделать ваш отдых идеальным.
        </p>
      </div>

      <div className="max-w-2xl mx-auto mb-8">
        <ErrorAlert error={error} />
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      ) : reviews.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {reviews.map((review) => (
            <div
              key={review.reviewId}
              className="bg-white p-6 rounded-xl border border-ui shadow-sm hover:shadow-md transition-all"
            >
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-ui flex items-center justify-center">
                    <User size={20} className="text-text/50" />
                  </div>
                  <div>
                    <div className="font-bold text-sm">{review.username}</div>
                    <div className="text-xs text-text/50">Номер {review.roomNo}</div>
                  </div>
                </div>
                <div className="flex gap-1">{renderStars(review.rating)}</div>
              </div>

              <h3 className="font-bold text-lg mb-2 text-text font-serif">{review.title}</h3>
              <p className="text-text/70 text-sm leading-relaxed mb-4">{review.content}</p>

              <div className="text-xs text-text/40 pt-4 border-t border-ui">
                Опубликовано {new Date(review.createdAt).toISOString().slice(0, 10)}
              </div>
            </div>
          ))}
        </div>
      ) : !error ? (
        <div className="text-center py-20 bg-ui rounded-xl">
          <MessageSquare size={48} className="mx-auto text-text/30 mb-4" />
          <h3 className="text-xl font-bold text-text/70">Отзывов пока нет</h3>
          <p className="text-text/50">Станьте первым, кто оставит отзыв после проживания!</p>
        </div>
      ) : null}
    </div>
  );
}
