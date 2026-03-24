const nodemailer = require('nodemailer');
const { createLogger } = require('../logger');
const { getConfig } = require('../config');

const logger = createLogger('Email');

let _transporter = null;

function getTransporter() {
  if (_transporter) return _transporter;

  const config = getConfig();

  _transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: config.smtpUser,
      pass: config.smtpPass,
    },
  });

  return _transporter;
}

/**
 * Send a 6-digit verification code to the given email address.
 */
async function sendVerificationCode(email, code) {
  const config = getConfig();
  const transporter = getTransporter();

  const mailOptions = {
    from: `"Hotel App" <${config.smtpUser}>`,
    to: email,
    subject: 'Код подтверждения регистрации',
    html: `
      <div style="font-family: 'Roboto', Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
        <h2 style="color: #42ACC1; margin-bottom: 24px;">Подтверждение email</h2>
        <p style="color: #333; font-size: 16px; line-height: 1.5;">
          Ваш код подтверждения:
        </p>
        <div style="background: #F4FAFB; border: 2px solid #42ACC1; border-radius: 12px; padding: 20px; text-align: center; margin: 24px 0;">
          <span style="font-size: 32px; font-weight: 700; letter-spacing: 8px; color: #040909;">${code}</span>
        </div>
        <p style="color: #666; font-size: 14px;">
          Код действителен в течение 10 минут. Если вы не запрашивали регистрацию, проигнорируйте это письмо.
        </p>
      </div>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    logger.info('Verification code sent', { email });
  } catch (err) {
    logger.error('Failed to send verification email', { email, error: err.message });
    throw new Error('Failed to send verification email');
  }
}

module.exports = { sendVerificationCode };
