import React, { useState, useEffect } from "react";
import Modal from "./Modal";
import Button, { ButtonVariant } from "./Button";
import { Star } from "lucide-react";
import { Review } from "../types";

interface ReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (rating: number, title: string, content: string) => Promise<void>;
  initialData?: Review | null;
  isLoading?: boolean;
}

export default function ReviewModal({
  isOpen,
  onClose,
  onSubmit,
  initialData,
  isLoading = false,
}: ReviewModalProps) {
  const [rating, setRating] = useState(5);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setRating(initialData.rating);
        setTitle(initialData.title);
        setContent(initialData.content);
      } else {
        setRating(5);
        setTitle("");
        setContent("");
      }
    }
  }, [isOpen, initialData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit(rating, title, content);
  };

  const handleStarClick = (selectedRating: number) => {
    setRating(selectedRating);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={initialData ? "Редактировать отзыв" : "Оставить отзыв"}
      footer={
        <>
          <Button
            text="Отмена"
            variant={ButtonVariant.Tertiary}
            onClick={onClose}
            disabled={isLoading}
          />
          <Button
            text={initialData ? "Сохранить" : "Отправить"}
            variant={ButtonVariant.Primary}
            onClick={(e: any) => handleSubmit(e)}
            isLoading={isLoading}
          />
        </>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-1">Ваша оценка</label>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                className="focus:outline-none transition-transform hover:scale-110"
                onClick={() => handleStarClick(star)}
              >
                <Star
                  size={32}
                  className={`${
                    star <= rating ? "fill-yellow-400 text-yellow-400" : "text-gray-300"
                  } transition-colors`}
                />
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-bold text-gray-700 mb-1">Заголовок</label>
          <input
            type="text"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50"
            placeholder="Коротко о главном"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
           
          />
        </div>

        <div>
          <label className="block text-sm font-bold text-gray-700 mb-1">Ваш отзыв</label>
          <textarea
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50 min-h-[120px]"
            placeholder="Расскажите о своих впечатлениях..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
          />
        </div>
      </form>
    </Modal>
  );
}