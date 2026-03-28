/**
 * useWebSocket
 *
 * Connects to the backend WebSocket server at /ws, passing the current
 * user's ID as a query parameter so the server can route user-targeted
 * messages (PAYMENT_SUCCEEDED, PAYMENT_FAILED, PAYMENT_CANCELLED, …).
 *
 * The connection is opened when `enabled` is true and `userId` is provided,
 * and automatically reconnects every 3 seconds on unexpected close.
 */

import { useEffect, useRef, useCallback } from 'react';
import { API_BASE_URL } from '@/api/axiosInstance';

// Derive ws(s):// URL from the http(s):// API base URL
function getWsBaseUrl(): string {
  return API_BASE_URL
    .replace(/^https/, 'wss')
    .replace(/^http/, 'ws')
    .replace(/\/api\/?$/, '/ws');
}

export interface WsMessage {
  type: string;
  bookingId?: string;
  timestamp?: string;
  [key: string]: unknown;
}

interface UseWebSocketOptions {
  /** The user ID to register with the server. Pass null/undefined to disable. */
  userId?: string | null;
  /** Whether the connection should be active at all. Defaults to true. */
  enabled?: boolean;
  /** Called every time a message is received from the server. */
  onMessage: (msg: WsMessage) => void;
}

export function useWebSocket({ userId, enabled = true, onMessage }: UseWebSocketOptions): void {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Keep latest callback in a ref so we never need to close/re-open the socket
  // just because the callback reference changed.
  const onMessageRef = useRef(onMessage);
  useEffect(() => { onMessageRef.current = onMessage; }, [onMessage]);

  const connect = useCallback(() => {
    if (!enabled || !userId) return;

    try {
      const url = `${getWsBaseUrl()}?userId=${encodeURIComponent(userId)}`;
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data as string) as WsMessage;
          onMessageRef.current(msg);
        } catch {
          // ignore malformed frames
        }
      };

      ws.onclose = () => {
        // Schedule reconnect
        reconnectTimer.current = setTimeout(connect, 3000);
      };

      ws.onerror = () => {
        // onclose will fire after onerror, so just close explicitly
        ws.close();
      };
    } catch {
      // WebSocket constructor can throw if the URL is invalid
      reconnectTimer.current = setTimeout(connect, 5000);
    }
  }, [enabled, userId]);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimer.current !== null) clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, [connect]);
}
