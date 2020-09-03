'use strict';

const https = require('https');
const http = require('http');
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const { createLogger } = require('./logger');
const { getConfig, startConfigWatcher } = require('./config');

const authRoutes = require('./routes/auth');
const qrRoutes = require('./routes/qr');
const paymentRoutes = require('./routes/payments');
const bookingRoutes = require('./routes/bookings');
const webhookRoutes = require('./routes/webhook');
const hotelRoutes = require('./routes/hotels');
const roomRoutes = require('./routes/rooms');
const serviceRoutes = require('./routes/services');
const roomServiceRoutes = require('./routes/room-services');
const uploadRoutes = require('./routes/uploads');

const wsManager = require('./services/websocket');
const { runMigrations } = require('./services/migrate');
const { scheduleNoShowProcessing } = require('./services/noshow');

const logger = createLogger('Server');
const app = express();

// ── Webhook route (must receive RAW body for Stripe signature verification) ──
// Register BEFORE express.json() so the body is not parsed yet.
app.use('/api/webhooks', express.raw({ type: 'application/json' }), webhookRoutes);

// ── Standard middleware ───────────────────────────────────────────────────────
const corsOptions = {
  origin: true,
  credentials: true,
};

app.use(cors(corsOptions));
app.options('/api/*', cors(corsOptions));
app.use(express.json());

// ── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/qr', qrRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/hotels', hotelRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/room-services', roomServiceRoutes);
app.use('/api/uploads', uploadRoutes);

// ── Static file serving for uploaded images ──────────────────────────────────
const path = require('path');
app.use('/uploads', express.static(path.resolve(process.cwd(), 'uploads')));

// ── Health check ────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    websocketClients: wsManager.connectedCount(),
  });
});

// ── Global error handler ────────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  logger.error('Unhandled express error', { error: err.message, stack: err.stack });
  res.status(500).json({ error: 'Internal server error' });
});

// ── Start ───────────────────────────────────────────────────────────────────
const config = getConfig();
startConfigWatcher();

// ── Startup tasks (non-blocking) ─────────────────────────────────────────────
runMigrations().catch((err) => logger.error('Startup migration failed', { error: err.message }));
scheduleNoShowProcessing();

// Try HTTPS first, fall back to HTTP if certs are missing
let server;

const certKeyPath = './client/cer/moonglow.key';
const certCrtPath = './client/cer/moonglow.crt';

if (fs.existsSync(certKeyPath) && fs.existsSync(certCrtPath)) {
  const httpsOptions = {
    key: fs.readFileSync(certKeyPath),
    cert: fs.readFileSync(certCrtPath),
  };
  server = https.createServer(httpsOptions, app);
  wsManager.init(server);

  server.listen(config.port, '0.0.0.0', () => {
    logger.info(`Running on https://localhost:${config.port}`);
    logger.info(`WebSocket available at wss://localhost:${config.port}/ws`);
  });
} else {
  logger.warn('SSL certificates not found, starting HTTP server');
  server = http.createServer(app);
  wsManager.init(server);

  server.listen(config.port, '0.0.0.0', () => {
    logger.info(`Running on http://localhost:${config.port}`);
    logger.info(`WebSocket available at ws://localhost:${config.port}/ws`);
  });
}

module.exports = app;
