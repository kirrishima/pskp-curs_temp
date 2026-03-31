const { Router } = require("express");
const { createLogger } = require("../logger");
const { generateQRSession, approveQRCode, checkQRStatus } = require("../services/qr");
const { authenticate } = require("../middleware/auth");

const logger = createLogger("QR");
const router = Router();

// ── Generate QR session (NO auth — called by PC that wants to log in) ────
router.post("/generate", async (req, res) => {
  try {
    const result = await generateQRSession();

    logger.info("QR session created", { code: result.code, expiresAt: result.expiresAt });

    res.json({
      code: result.code,
      expiresAt: result.expiresAt,
    });
  } catch (err) {
    logger.error("QR session creation failed", { error: err.message, stack: err.stack });
    res.status(500).json({ error: "Не удалось создать QR-сессию" });
  }
});

// ── Approve QR code (requires auth — called by phone) ────────────────────
router.post("/approve", authenticate, async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) {
      return res.status(400).json({ error: "QR-код обязателен" });
    }

    await approveQRCode(code, req.user.id);

    logger.info("QR code approved", { userId: req.user.id, code });

    res.json({ success: true });
  } catch (err) {
    logger.warn("QR approval failed", { error: err.message });
    res.status(400).json({ error: err.message || "Не удалось одобрить QR-код" });
  }
});

// ── Check QR status (NO auth — polled by PC) ─────────────────────────────
router.get("/status/:code", async (req, res) => {
  try {
    const result = await checkQRStatus(req.params.code);

    if (result.status === "approved") {
      const { password, tokenVersion, ...safeUser } = result.user;
      return res.json({
        status: "approved",
        user: safeUser,
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
      });
    }

    res.json({ status: result.status });
  } catch (err) {
    logger.warn("QR status check failed", { error: err.message });
    res.status(400).json({ error: err.message || "Ошибка проверки QR-кода" });
  }
});

module.exports = router;
