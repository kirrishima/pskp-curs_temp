/**
 * Shared constants for the RoomServiceState enum.
 *
 * INCLUDED      — the service is bundled into the room rate and cannot be
 *                 declined by the guest.
 * OPTIONAL_ON   — the service is included by default but the guest may opt
 *                 out of it during booking.
 * OPTIONAL_OFF  — the service is not included by default but the guest may
 *                 add it during booking.
 */

import type { RoomServiceState } from '@/types';

export interface RoomServiceStateOption {
  value: RoomServiceState;
  /** Short label used in dropdowns and select inputs */
  label: string;
  /** Longer one-sentence explanation displayed in hints / tooltips */
  description: string;
}

export const ROOM_SERVICE_STATE_OPTIONS: RoomServiceStateOption[] = [
  {
    value: 'INCLUDED',
    label: 'Включено в номер',
    description: 'Услуга входит в стоимость номера. Гость не может от неё отказаться.',
  },
  {
    value: 'OPTIONAL_ON',
    label: 'Включено по умолчанию',
    description: 'Услуга включена автоматически, но гость может убрать её при бронировании.',
  },
  {
    value: 'OPTIONAL_OFF',
    label: 'Доступно по запросу',
    description: 'Услуга не включена, но гость может добавить её при бронировании.',
  },
];

/** Returns the human-readable label for a given defaultState value. */
export function getRoomServiceStateLabel(state: string): string {
  return ROOM_SERVICE_STATE_OPTIONS.find((o) => o.value === state)?.label ?? state;
}

/** Returns the full option object for a given defaultState value. */
export function getRoomServiceStateOption(
  state: string,
): RoomServiceStateOption | undefined {
  return ROOM_SERVICE_STATE_OPTIONS.find((o) => o.value === state);
}
