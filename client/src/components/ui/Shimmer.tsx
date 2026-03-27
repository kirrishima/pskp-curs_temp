import { memo } from 'react';

// ─── Base Shimmer ────────────────────────────────────────────────────────────

export interface ShimmerProps {
  className?: string;
}

const Shimmer = memo(function Shimmer({ className = '' }: ShimmerProps) {
  return (
    <div
      className={`relative overflow-hidden bg-gray-200 rounded-md ${className}`}
    >
      <div
        className="absolute inset-0 animate-shimmer"
        style={{
          background:
            'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.4) 50%, transparent 100%)',
        }}
      />
    </div>
  );
});

// ─── Predefined shimmer patterns ─────────────────────────────────────────────

/** Shimmer for a single text line */
export const ShimmerLine = memo(function ShimmerLine({
  width = '100%',
  height = '14px',
  className = '',
}: {
  width?: string;
  height?: string;
  className?: string;
}) {
  return <Shimmer className={className} style={{ width, height }} />;
});

/** Shimmer for a room card */
export const ShimmerRoomCard = memo(function ShimmerRoomCard() {
  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
      <Shimmer className="w-full h-48 !rounded-none" />
      <div className="p-4 space-y-3">
        <Shimmer className="h-5 w-3/4" />
        <Shimmer className="h-4 w-1/2" />
        <div className="grid grid-cols-2 gap-3">
          <Shimmer className="h-4" />
          <Shimmer className="h-4" />
          <Shimmer className="h-4" />
          <Shimmer className="h-4" />
        </div>
        <div className="flex gap-2 pt-2">
          <Shimmer className="h-6 w-16 rounded-full" />
          <Shimmer className="h-6 w-16 rounded-full" />
          <Shimmer className="h-6 w-16 rounded-full" />
        </div>
        <div className="border-t border-gray-100 pt-3">
          <Shimmer className="h-6 w-1/3" />
        </div>
        <Shimmer className="h-10 w-full rounded-lg" />
      </div>
    </div>
  );
});

/** Shimmer for the filter sidebar */
export const ShimmerFilterPanel = memo(function ShimmerFilterPanel() {
  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6 space-y-6">
      <Shimmer className="h-6 w-1/2" />
      <div className="space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Shimmer className="h-3 w-1/3" />
            <Shimmer className="h-10 w-full" />
          </div>
        ))}
      </div>
      <div className="space-y-2">
        <Shimmer className="h-3 w-1/4" />
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-2">
            <Shimmer className="h-4 w-4 rounded" />
            <Shimmer className="h-4 w-2/3" />
          </div>
        ))}
      </div>
      <Shimmer className="h-10 w-full rounded-lg" />
    </div>
  );
});

/** Shimmer for the hotel info section on homepage */
export const ShimmerHotelInfo = memo(function ShimmerHotelInfo() {
  return (
    <div className="space-y-8">
      <div className="text-center space-y-3">
        <Shimmer className="h-8 w-1/3 mx-auto" />
        <Shimmer className="h-4 w-2/3 mx-auto" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 space-y-3">
            <Shimmer className="h-12 w-12 rounded-full mx-auto" />
            <Shimmer className="h-5 w-1/2 mx-auto" />
            <Shimmer className="h-4 w-3/4 mx-auto" />
            <Shimmer className="h-4 w-2/3 mx-auto" />
          </div>
        ))}
      </div>
    </div>
  );
});

export default Shimmer;
