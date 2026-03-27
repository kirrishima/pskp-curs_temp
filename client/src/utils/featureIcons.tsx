import React from 'react';
import {
  Wifi,
  Coffee,
  Car,
  Droplets,
  Wine,
  Shirt,
  Plane,
  Dumbbell,
  Waves,
  Shield,
  Clock,
  Heart,
  ConciergeBell,
  Utensils,
  Tv,
  AirVent,
  Bath,
  Phone,
  Baby,
  Dog,
  Cigarette,
  Snowflake,
  Sun,
  Music,
  BookOpen,
  Gamepad2,
  Package,
} from 'lucide-react';
import { API_BASE_URL } from '@/api/axiosInstance';

// ─── Icon name → Lucide component mapping ────────────────────────────────────

const ICON_MAP: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  wifi: Wifi,
  coffee: Coffee,
  car: Car,
  droplet: Droplets,
  droplets: Droplets,
  wine: Wine,
  shirt: Shirt,
  plane: Plane,
  dumbbell: Dumbbell,
  pool: Waves,
  waves: Waves,
  security: Shield,
  shield: Shield,
  time: Clock,
  clock: Clock,
  heart: Heart,
  bell: ConciergeBell,
  concierge: ConciergeBell,
  utensils: Utensils,
  food: Utensils,
  tv: Tv,
  airvent: AirVent,
  ac: AirVent,
  bath: Bath,
  phone: Phone,
  baby: Baby,
  dog: Dog,
  pet: Dog,
  smoking: Cigarette,
  snowflake: Snowflake,
  sun: Sun,
  music: Music,
  book: BookOpen,
  gamepad: Gamepad2,
};

// ─── Default fallback icon ───────────────────────────────────────────────────

const DefaultIcon = Package;

// ─── Helper: resolve image URL ───────────────────────────────────────────────

function resolveImageUrl(imageUrl: string): string {
  if (imageUrl.startsWith('/uploads/')) {
    return `${API_BASE_URL.replace('/api', '')}${imageUrl}`;
  }
  return imageUrl;
}

// ─── Main utility function ───────────────────────────────────────────────────

/**
 * Returns a React element representing the icon for a service/feature.
 *
 * Priority:
 * 1. If `iconUrl` is a non-empty string → render an <img> tag
 * 2. If `icon` is a non-empty string matching a known Lucide icon → render that icon
 * 3. Otherwise → render a neutral default icon (Package)
 *
 * @param options.iconUrl  - URL path to a custom image icon (from service.iconUrl)
 * @param options.icon     - Lucide icon key string (from service.icon)
 * @param options.size     - Icon size in pixels (default: 20)
 * @param options.className - Additional CSS class for the Lucide icon
 */
export function getFeatureIcon(options: {
  iconUrl?: string | null;
  icon?: string | null;
  size?: number;
  className?: string;
}): React.ReactElement {
  const { iconUrl, icon, size = 20, className = 'text-primary' } = options;

  // 1. Custom image URL takes highest priority
  if (iconUrl && iconUrl.trim().length > 0) {
    return (
      <img
        src={resolveImageUrl(iconUrl)}
        alt="icon"
        className="object-contain"
        style={{ width: size, height: size }}
      />
    );
  }

  // 2. Named Lucide icon
  if (icon && icon.trim().length > 0) {
    const key = icon.trim().toLowerCase();
    const LucideIcon = ICON_MAP[key];
    if (LucideIcon) {
      return <LucideIcon size={size} className={className} />;
    }
  }

  // 3. Fallback
  return <DefaultIcon size={size} className={className} />;
}

/**
 * Returns the Lucide component for a given icon key string, or the default.
 */
export function getFeatureIconComponent(
  iconKey?: string | null,
): React.ComponentType<{ size?: number; className?: string }> {
  if (iconKey && iconKey.trim().length > 0) {
    const key = iconKey.trim().toLowerCase();
    return ICON_MAP[key] || DefaultIcon;
  }
  return DefaultIcon;
}
