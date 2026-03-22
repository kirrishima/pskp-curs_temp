'use strict';

/**
 * WebSocket manager
 *
 * Wraps the `ws` library and provides a simple pub/sub interface so the
 * rest of the app never has to deal with raw WebSocket internals.
 *
 * Usage
 * -----
 *   const wsManager = require('./services/websocket');
 *
 *   // During server startup:
 *   wsManager.init(httpServer);
 *
 *   // From anywhere (e.g. webhook handler):
 *   wsManager.broadcast({ type: 'PAYMENT_SUCCEEDED', bookingId: '...' });
 *   wsManager.notifyUser(userId, { type: 'PAYMENT_FAILED', bookingId: '...' });
 */

const { createLogger } = require('../logger');

const logger = createLogger('WebSocket');

let _wss = null;

// Map<userId, Set<WebSocket>> – for user-targeted messages
const _userSockets = new Map();

/**
 * Attach the WebSocket server to an existing HTTP server.
 * Call once, right after app.listen().
 */
function init(httpServer) {
  if (_wss) {
    logger.warn('WebSocket server already initialised');
    return _wss;
  }

  let WebSocketServer;
  try {
    ({ WebSocketServer } = require('ws'));
  } catch (err) {
    if (err.code === 'MODULE_NOT_FOUND') {
      logger.error('The "ws" package is not installed. Run: npm install ws');
      return null;
    }
    throw err;
  }

  _wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  _wss.on('connection', (socket, req) => {
    const userId = _extractUserId(req);

    if (userId) {
      _registerSocket(userId, socket);
      logger.info('Client connected', { userId });
    } else {
      logger.info('Anonymous client connected');
    }

    // Send a welcome/ping so the client knows the connection is live
    _send(socket, { type: 'CONNECTED', timestamp: new Date().toISOString() });

    // Handle client heartbeat
    socket.isAlive = true;
    socket.on('pong', () => { socket.isAlive = true; });

    socket.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.type === 'PING') _send(socket, { type: 'PONG' });
      } catch {
        // ignore malformed messages
      }
    });

    socket.on('close', () => {
      if (userId) _unregisterSocket(userId, socket);
      logger.info('Client disconnected', { userId: userId || 'anonymous' });
    });

    socket.on('error', (err) => {
      logger.error('Socket error', { userId, error: err.message });
    });
  });

  // Heartbeat interval – removes dead connections every 30 s
  const heartbeat = setInterval(() => {
    if (!_wss) return clearInterval(heartbeat);
    _wss.clients.forEach((socket) => {
      if (!socket.isAlive) {
        socket.terminate();
        return;
      }
      socket.isAlive = false;
      socket.ping();
    });
  }, 30_000);

  _wss.on('close', () => clearInterval(heartbeat));

  logger.info('WebSocket server ready on /ws');
  return _wss;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Extract userId from the query string: ws://host/ws?userId=<id>
 * In production you'd verify a JWT token here instead.
 */
function _extractUserId(req) {
  try {
    const url = new URL(req.url, 'http://localhost');
    return url.searchParams.get('userId') || null;
  } catch {
    return null;
  }
}

function _registerSocket(userId, socket) {
  if (!_userSockets.has(userId)) _userSockets.set(userId, new Set());
  _userSockets.get(userId).add(socket);
}

function _unregisterSocket(userId, socket) {
  const sockets = _userSockets.get(userId);
  if (!sockets) return;
  sockets.delete(socket);
  if (sockets.size === 0) _userSockets.delete(userId);
}

function _send(socket, payload) {
  const { WebSocket } = require('ws');
  if (socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(payload));
  }
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Broadcast a message to every connected client.
 */
function broadcast(payload) {
  if (!_wss) return;
  const json = JSON.stringify(payload);
  _wss.clients.forEach((socket) => {
    const { WebSocket } = require('ws');
    if (socket.readyState === WebSocket.OPEN) socket.send(json);
  });
}

/**
 * Send a message only to sockets associated with a given userId.
 */
function notifyUser(userId, payload) {
  if (!_wss || !userId) return;
  const sockets = _userSockets.get(userId);
  if (!sockets) return;
  sockets.forEach((socket) => _send(socket, payload));
}

/**
 * Returns the number of currently connected clients (useful for health checks).
 */
function connectedCount() {
  return _wss ? _wss.clients.size : 0;
}

module.exports = { init, broadcast, notifyUser, connectedCount };
