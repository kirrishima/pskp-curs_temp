'use strict';

const http = require('http');
const express = require('express');
const cors = require('cors');
const { createLogger } = require('./logger');
const { getConfig, startConfigWatcher } = require('./config');
const authRoutes = require('./routes/auth');
const qrRoutes = require('./routes/qr');
const paymentRoutes = require('./routes/payments');
const webhookRoutes = require('./routes/webhook');
const wsManager = require('./services/websocket');

const logger = createLogger('Server');
const app = express();

// ── Webhook route (must receive RAW body for Stripe signature verification) ──
// Register BEFORE express.json() so the body is not parsed yet.
app.use('/api/webhooks', express.raw({ type: 'application/json' }), webhookRoutes);

// ── Standard middleware ───────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// ── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/qr', qrRoutes);
// Payments + room management share one router.
// Room endpoints: GET/POST /api/payments/rooms
// Booking endpoints: POST /api/payments/create-intent
//                    GET  /api/payments/:bookingId
//                    POST /api/payments/cancel/:bookingId
app.use('/api/payments', paymentRoutes);

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    websocketClients: wsManager.connectedCount(),
  });
});

// ── Global error handler ──────────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  logger.error('Unhandled express error', { error: err.message, stack: err.stack });
  res.status(500).json({ error: 'Internal server error' });
});

// ── Start ─────────────────────────────────────────────────────────────────────
const config = getConfig();
startConfigWatcher();

// Use http.Server so we can share it with the WebSocket server
const server = http.createServer(app);

// Attach WebSocket (gracefully degrades if `ws` is not installed yet)
wsManager.init(server);

server.listen(config.port, () => {
  logger.info(`Running on http://localhost:${config.port}`);
  logger.info(`WebSocket available at ws://localhost:${config.port}/ws`);
});

module.exports = app;
