const fs = require('fs');
const path = require('path');
const { createLogger: winstonCreateLogger, format, transports } = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');

const CONFIG_PATH = path.join(__dirname, '..', 'config.json');

// ── Read logging config directly from config.json ────────────────────
// We intentionally bypass src/config.js to avoid circular dependencies
// (config.js imports logger, logger would import config).
function readLoggingConfig() {
  try {
    const raw = fs.readFileSync(CONFIG_PATH, 'utf-8');
    return JSON.parse(raw).logging ?? {};
  } catch {
    return {};
  }
}

// ── Formats ──────────────────────────────────────────────────────────
const consoleFormat = format.combine(
  format.colorize({ all: true }),
  format.timestamp({ format: 'HH:mm:ss' }),
  format.printf(({ timestamp, level, label, message, ...meta }) => {
    const tag = label ? `[${label}]` : '';
    const extra = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
    return `${timestamp} ${level} ${tag} ${message}${extra}`;
  })
);

const fileFormat = format.combine(
  format.timestamp(),
  format.errors({ stack: true }),
  format.json()
);

// ── Build transports from config ──────────────────────────────────────
function buildTransports(cfg) {
  const list = [];

  if (cfg.console !== false) {
    list.push(new transports.Console({ format: consoleFormat }));
  }

  if (cfg.file !== false) {
    const logDir = path.dirname(path.join(__dirname, '..', cfg.filename ?? 'logs/app.log'));
    if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });

    list.push(
      new DailyRotateFile({
        filename: path.join(__dirname, '..', cfg.filename ?? 'logs/app-%DATE%.log'),
        datePattern: 'YYYY-MM-DD',
        maxSize: cfg.maxSize ?? '10m',
        maxFiles: cfg.maxFiles ?? 5,
        format: fileFormat,
      })
    );
  }

  return list;
}

// ── Root logger instance ──────────────────────────────────────────────
let _cfg = readLoggingConfig();

const rootLogger = winstonCreateLogger({
  level: _cfg.level ?? 'info',
  transports: buildTransports(_cfg),
});

// ── Hot-reload: swap transports when config.json changes ─────────────
let _debounce = null;
fs.watch(CONFIG_PATH, (event) => {
  if (event !== 'change') return;
  clearTimeout(_debounce);
  _debounce = setTimeout(() => {
    const newCfg = readLoggingConfig();
    rootLogger.level = newCfg.level ?? 'info';
    rootLogger.clear();
    buildTransports(newCfg).forEach((t) => rootLogger.add(t));
    rootLogger.info('Logger config reloaded', { label: 'Logger' });
  }, 300);
});

// ── Factory ───────────────────────────────────────────────────────────
// Each module calls createLogger('MyLabel') to get a child logger that
// automatically tags every line with its label.
function createLogger(label) {
  return rootLogger.child({ label });
}

module.exports = { createLogger, rootLogger };
