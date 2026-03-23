import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { Room } from "../types";
import Button, { ButtonVariant } from "./Button";
import { Layers, Users, Wifi, Tv, Wind, Coffee, CheckCircle, Edit, Trash2 } from "lucide-react";
import Slider from "./Slider";

interface RoomCardProps {
  room: Room;
  onBook: (room: Room) => void;
  onEdit?: (room: Room) => void;
  onDelete?: (room: Room) => void;
  userRole?: number; // 1 = Manager, 2 = User
}

const RoomCard: React.FC<RoomCardProps> = ({ room, onBook, onEdit, onDelete, userRole }) => {
  const navigate = useNavigate();
  const allImages: string[] = [];

  if (room.mainImage) {
    allImages.push(room.mainImage);
  }

  if (room.images && room.images.length > 0) {
    room.images.forEach((img) => {
      if (img.imageUrl && img.imageUrl !== room.imageUrl) {
        allImages.push(img.imageUrl);
      }
    });
  }
  
  // Add the base imageUrl if it's not already in the list from mainImage
  if (room.imageUrl && !allImages.includes(room.imageUrl)) {
    allImages.unshift(room.imageUrl); // Put it at the beginning
  }


  if (allImages.length === 0) {
    const fallback = "/no-image-placeholder.png";
    allImages.push(fallback);
  }

  // Helper for service icons
  const getServiceIcon = (code: string) => {
    switch (code.toUpperCase()) {
      case "WIFI":
        return <Wifi size={14} />;
      case "TV":
        return <Tv size={14} />;
      case "AC":
        return <Wind size={14} />;
      case "MINIBAR":
        return <Coffee size={14} />;
      default:
        return null;
    }
  };

  // Update: Check for Manager (1) OR Admin (0)
  const isManager = userRole === 1 || userRole === 0;
  const canBook = userRole === undefined || userRole === 2;

  return (
    <div className="bg-ui rounded-xl overflow-hidden flex flex-col h-full shadow-sm hover:shadow-md transition-shadow border border-gray-200">
      <div 
        className="relative h-64 overflow-hidden group cursor-pointer" 
        onClick={() => navigate(`/room/${room.roomNo}`)}
      >
        <Slider images={allImages} height="100%" />
        {isManager && (
          <div className="absolute top-4 right-4 z-20 bg-background/90 backdrop-blur-sm px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider shadow-sm">
            {room.status === "AVAILABLE" ? "Свободен" : room.status}
          </div>
        )}
        {isManager && (
          <div className="absolute top-4 left-4 z-20 bg-background/90 backdrop-blur-sm px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider shadow-sm">
            room_no: {room.roomNo}
          </div>
        )}
      </div>

      <div className="p-6 flex flex-col flex-grow gap-4">
        <Link to={`/room/${room.roomNo}`}>
          <div className="flex justify-between items-start">
            <h3 className="text-xl font-bold text-text font-serif hover:text-primary transition-colors">{room.title || `Номер ${room.roomNo}`}</h3>
          </div>
        </Link>

        <div className="flex gap-4 text-sm text-text/70 border-b border-gray-200/50 pb-4">
          <div className="flex items-center gap-2" title="Этаж">
            <Layers size={18} className="text-primary" />
            <span className="font-medium">Этаж {room.floor}</span>
          </div>
          <div className="flex items-center gap-2" title="Вместимость">
            <Users size={18} className="text-primary" />
            <span className="font-medium">До {room.capacity}</span>
          </div>
        </div>

        {/* Services Preview */}
        {room.services && room.services.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2">
            {room.services.slice(0, 4).map((s, i) => (
              <span key={i} className="text-xs bg-gray-100 text-text/70 px-2 py-1 rounded flex items-center gap-1">
                {getServiceIcon(s.serviceCode)} {s.title}
              </span>
            ))}
            {room.services.length > 4 && (
              <span className="text-xs text-text/50 py-1">+ еще {room.services.length - 4}</span>
            )}
          </div>
        )}

        <p className="text-sm text-text/80 line-clamp-3 leading-relaxed">
          {room.description || "Описание номера отсутствует."}
        </p>

        <div className="mt-auto pt-4 flex flex-col gap-4">
          <div className="flex flex-col items-end">
            <span className="text-2xl font-bold text-primary">{room.basePrice}р.</span>
            <span className="text-xs text-text/60">за ночь</span>
          </div>

          {isManager ? (
            <div className="flex flex-col gap-2 w-full">
              <Button
                text="Изменить"
                variant={ButtonVariant.Secondary}
                className="w-full"
                icon={<Edit size={16} />}
                onClick={() => onEdit && onEdit(room)}
              />
              <Button
                text="Удалить"
                variant={ButtonVariant.Danger}
                className="w-full"
                icon={<Trash2 size={16} />}
                onClick={() => onDelete && onDelete(room)}
              />
            </div>
          ) : canBook ? (
            <Button
              text="Забронировать"
              variant={ButtonVariant.Primary}
              className="w-full"
              onClick={() => onBook(room)}
            />
          ) : (
            <div className="w-full text-center py-2 text-sm text-text/40 bg-gray-100 rounded border border-gray-200 cursor-not-allowed">
              Бронирование недоступно
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RoomCard;