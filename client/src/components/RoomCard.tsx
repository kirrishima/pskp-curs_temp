import { memo } from 'react';
import { Users, Square, Edit2, Trash2 } from 'lucide-react';
import Button from '@/components/ui/Button';
import { API_BASE_URL } from '@/api/axiosInstance';
import { getFeatureIcon } from '@/utils/featureIcons';
import { CURRENCY_SYMBOL } from '@/utils/currency';
import type { Room } from '@/types';

// ─── Service badge color assignment ──────────────────────────────────────────
// Colors are assigned cyclically per serviceCode on first encounter.
// The assignment is module-level so it stays consistent across all re-renders
// and across all card instances on the page.

const BADGE_PALETTE: string[] = [
  'bg-teal-100 text-teal-700',
  'bg-blue-100 text-blue-700',
  'bg-violet-100 text-violet-700',
  'bg-amber-100 text-amber-700',
  'bg-rose-100 text-rose-700',
  'bg-emerald-100 text-emerald-700',
  'bg-cyan-100 text-cyan-700',
  'bg-orange-100 text-orange-700',
];

/** serviceCode → Tailwind color class string */
const serviceBadgeColors = new Map<string, string>();

function getServiceBadgeColor(serviceCode: string): string {
  if (serviceBadgeColors.has(serviceCode)) {
    return serviceBadgeColors.get(serviceCode)!;
  }
  const color = BADGE_PALETTE[serviceBadgeColors.size % BADGE_PALETTE.length];
  serviceBadgeColors.set(serviceCode, color);
  return color;
}

// ─── Props ───────────────────────────────────────────────────────────────────

export interface RoomCardProps {
  room: Room;
  onView: (room: Room) => void;
  onEdit?: (room: Room) => void;
  onDelete?: (room: Room) => void;
  isAdmin?: boolean;
}

// ─── Status Badge ────────────────────────────────────────────────────────────

const StatusBadge = memo(function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; color: string }> = {
    ACTIVE: { label: 'Активен', color: 'bg-green-100 text-green-800' },
    MAINTENANCE: { label: 'На обслуживании', color: 'bg-amber-100 text-amber-800' },
    CLOSED: { label: 'Закрыт', color: 'bg-red-100 text-red-800' },
  };
  const { label, color } = config[status] || { label: status, color: 'bg-gray-100 text-gray-800' };
  return (
    <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold ${color}`}>
      {label}
    </span>
  );
});

// ─── Service Badge ───────────────────────────────────────────────────────────

const ServiceBadge = memo(function ServiceBadge({
  service,
}: {
  service: {
    serviceCode: string;
    title: string;
    icon?: string | null;
    iconUrl?: string | null;
  };
}) {
  const colorClass = getServiceBadgeColor(service.serviceCode);
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium whitespace-nowrap ${colorClass}`}
    >
      {getFeatureIcon({
        iconUrl: service.iconUrl,
        icon: service.icon,
        size: 12,
        className: '',
      })}
      {service.title}
    </span>
  );
});

// ─── Image Handler ───────────────────────────────────────────────────────────

function getImageUrl(imageUrl: string | undefined): string {
  if (!imageUrl) return '';
  if (imageUrl.startsWith('/uploads/')) {
    return `${API_BASE_URL.replace('/api', '')}${imageUrl}`;
  }
  return imageUrl;
}

// ─── Placeholder ─────────────────────────────────────────────────────────────

const PlaceholderImage = memo(function PlaceholderImage() {
  return (
    <div className="w-full h-48 bg-gradient-to-br from-primary/30 to-secondary/20 flex items-center justify-center">
      <div className="text-primary/50 text-center">
        <Square size={32} className="mx-auto mb-2" />
        <span className="text-sm">Нет фото</span>
      </div>
    </div>
  );
});

// ─── Main Component ──────────────────────────────────────────────────────────

const RoomCard = memo(function RoomCard({
  room,
  onView,
  onEdit,
  onDelete,
  isAdmin = false,
}: RoomCardProps) {
  const mainImage = room.images?.find((img) => img.isMain) || room.images?.[0];
  const imageUrl = mainImage ? getImageUrl(mainImage.imageUrl) : '';
  const displayServices = room.roomServices?.slice(0, 5) || [];

  return (
    // h-full ensures the card stretches to fill the grid cell so all cards in
    // a row are the same height; flex-col lets us push the footer to the bottom.
    <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden hover:shadow-xl transition-shadow duration-200 flex flex-col h-full">
      {/* Image */}
      <div className="relative w-full h-48 bg-gray-200 overflow-hidden flex-shrink-0">
        {imageUrl ? (
          <img src={imageUrl} alt={room.title} className="w-full h-full object-cover" />
        ) : (
          <PlaceholderImage />
        )}
        {isAdmin && (
          <div className="absolute top-3 right-3">
            <StatusBadge status={room.status} />
          </div>
        )}
      </div>

      {/* Body — grows to fill available space */}
      <div className="p-4 flex flex-col flex-1">
        {/* Title & Hotel */}
        <h3 className="text-lg font-bold text-text mb-1">{room.title}</h3>
        {room.hotel && (
          <p className="text-sm text-text/60 mb-3">
            {room.hotel.name}
            {room.hotel.city && ` • ${room.hotel.city}`}
          </p>
        )}

        {/* Room Details */}
        <div className="grid grid-cols-2 gap-3 mb-4 text-sm">
          {room.floor != null && (
            <div className="text-text/70">
              <span className="font-semibold">Этаж:</span> {room.floor}
            </div>
          )}
          <div className="flex items-center text-text/70">
            <Users size={14} className="mr-1.5" />
            <span>{room.capacity} гостей</span>
          </div>
          <div className="text-text/70">
            <span className="font-semibold">Кровати:</span> {room.bedsCount}
          </div>
          {room.area != null && (
            <div className="flex items-center text-text/70">
              <Square size={14} className="mr-1.5" />
              <span>{room.area} м²</span>
            </div>
          )}
        </div>

        {/* Services */}
        {displayServices.length > 0 && (
          <div className="mb-4">
            <p className="text-xs font-semibold text-text/60 uppercase tracking-wider mb-2">
              Услуги
            </p>
            <div className="flex flex-wrap gap-2">
              {displayServices.map((entry) => (
                <ServiceBadge
                  key={entry.serviceCode}
                  service={{
                    serviceCode: entry.serviceCode,
                    title: entry.service.title,
                    icon: entry.service.icon,
                    iconUrl: entry.service.iconUrl,
                  }}
                />
              ))}
            </div>
          </div>
        )}

        {/* ── Footer: price + button pushed to bottom ────────────────── */}
        <div className="mt-auto">
          <div className="border-t border-gray-100 pt-3 mb-4">
            <p className="text-lg font-bold text-primary">
              {room.basePrice.toLocaleString('ru-RU')} {CURRENCY_SYMBOL}
              <span className="text-sm font-normal text-text/60">/ночь</span>
            </p>
          </div>

          <div className="flex gap-2">
            <Button
              variant="primary"
              size="sm"
              onClick={() => onView(room)}
              className="flex-1"
            >
              Подробнее
            </Button>
            {isAdmin && (
              <>
                {onEdit && (
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={<Edit2 size={16} />}
                    onClick={() => onEdit(room)}
                    title="Редактировать"
                  >
                    {''}
                  </Button>
                )}
                {onDelete && (
                  <Button
                    variant="danger"
                    size="sm"
                    icon={<Trash2 size={16} />}
                    onClick={() => onDelete(room)}
                    title="Удалить"
                  >
                    {''}
                  </Button>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});

export default RoomCard;
