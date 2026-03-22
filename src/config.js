const fs = require('fs');
const path = require('path');
const { createLogger } = require('./logger');

const logger = createLogger('Config');
const CONFIG_PATH = path.join(__dirname, '..', 'config.json');

let _config = null;
let _watcher = null;

function loadConfig() {
  try {
    const raw = fs.readFileSync(CONFIG_PATH, 'utf-8');
    const parsed = JSON.parse(raw);

    _config = {
      accessTokenLifetime: parsed.accessTokenLifetime || '15m',
      refreshTokenLifetime: parsed.refreshTokenLifetime || '7d',
      qrCodeLifetime: parseInt(parsed.qrCodeLifetime, 10) || 120, // seconds
      jwtSecret: parsed.jwtSecret || 'default-jwt-secret',
      refreshSecret: parsed.refreshSecret || 'default-refresh-secret',
      port: parseInt(parsed.port, 10) || 3001,
      stripeSecretKey: parsed.stripeSecretKey || '',
      stripeWebhookSecret: parsed.stripeWebhookSecret || '',
    };

    logger.info('Loaded', {
      accessTokenLifetime: _config.accessTokenLifetime,
      refreshTokenLifetime: _config.refreshTokenLifetime,
      qrCodeLifetime: `${_config.qrCodeLifetime}s`,
      port: _config.port,
      stripeConfigured: !!_config.stripeSecretKey && !_config.stripeSecretKey.includes('REPLACE'),
    });
  } catch (err) {
    logger.error('Failed to load config.json, using defaults', { error: err.message });
    _config = {
      accessTokenLifetime: '15m',
      refreshTokenLifetime: '7d',
      qrCodeLifetime: 120,
      jwtSecret: 'default-jwt-secret',
      refreshSecret: 'default-refresh-secret',
      port: 3001,
      stripeSecretKey: '',
      stripeWebhookSecret: '',
    };
  }
}

// Parse duration strings like "15m", "7d", "1h" into milliseconds
function parseDuration(str) {
  const match = String(str).match(/^(\d+)(s|m|h|d)$/);
  if (!match) return 15 * 60 * 1000; // default 15 min

  const value = parseInt(match[1], 10);
  const unit = match[2];

  switch (unit) {
    case 's': return value * 1000;
    case 'm': return value * 60 * 1000;
    case 'h': return value * 60 * 60 * 1000;
    case 'd': return value * 24 * 60 * 60 * 1000;
    default:  return 15 * 60 * 1000;
  }
}

function getConfig() {
  if (!_config) loadConfig();
  return _config;
}

function getRefreshTokenExpiresAt() {
  return new Date(Date.now() + parseDuration(getConfig().refreshTokenLifetime));
}

function getQRCodeExpiresAt() {
  return new Date(Date.now() + getConfig().qrCodeLifetime * 1000);
}

function startConfigWatcher() {
  if (_watcher) return;

  let debounceTimer = null;

  _watcher = fs.watch(CONFIG_PATH, (eventType) => {
    if (eventType === 'change') {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        logger.info('Detected change, reloading...');
        loadConfig();
      }, 300);
    }
  });

  _watcher.on('error', (err) => {
    logger.error('Watcher error', { error: err.message });
  });

  logger.info('Watching for changes...');
}

// Initial load
loadConfig();

module.exports = {
  getConfig,
  parseDuration,
  getRefreshTokenExpiresAt,
  getQRCodeExpiresAt,
  startConfigWatcher,
};
