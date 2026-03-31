const { Router } = require("express");
const { createLogger } = require("../logger");
const { generateQRCode, consumeQRCode } = require("../services/qr");
const { authenticate } = require("../middleware/auth");

const logger = createLogger("QR");
const router = Router();

// ── Generate QR code (requires authentication) ─────────────────────
router.post("/generate", authenticate, async (req, res) => {
  try {
    const result = await generateQRCode(req.user.id);

    logger.info("QR code generated", { userId: req.user.id, expiresAt: result.expiresAt });

    res.json({
      code: result.code,
      expiresAt: result.expiresAt,
    });
  } catch (err) {
    logger.error("QR code generation failed", { error: err.message, stack: err.stack });
    res.status(500).json({ error: "QR code generation failed" });
  }
});

// ── Consume QR code (login from another device — no auth needed) ───
router.post("/consume", async (req, res) => {
  try {
    console.log("hello???");
    const { code } = req.body;
    logger.info(code);
    console.log(code);
    if (!code) {
      return res.status(400).json({ error: "QR code is required" });
    }

    const result = await consumeQRCode(code);

    logger.info("QR code consumed", { userId: result.user.id });

    const { password, tokenVersion, ...safeUser } = result.user;
    res.json({
      user: safeUser,
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
    });
  } catch (err) {
    logger.warn("QR login failed", { error: err.message });
    res.status(401).json({ error: err.message || "QR login failed" });
  }
});

module.exports = router;
