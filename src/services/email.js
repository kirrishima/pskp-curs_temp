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

// ── Booking Confirmation ─────────────────────────────────────────────────────

/**
 * Formats a Decimal (or number/string) as a localised BYN price string.
 * @param {number|string|object} amount  Prisma Decimal or plain number
 * @returns {string}
 */
function _fmtPrice(amount) {
  const n = typeof amount === 'object' && amount !== null ? Number(amount) : Number(amount);
  return `${n.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} BYN`;
}

/**
 * Formats a JS Date as a nice Russian date string.
 * @param {Date} date
 * @returns {string}
 */
function _fmtDate(date) {
  return new Date(date).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/**
 * Builds an absolute URL for a server-relative upload path.
 * Uses SERVER_URL env var if set, otherwise falls back to localhost.
 * @param {string|null|undefined} path
 * @returns {string|null}
 */
function _absoluteUrl(path) {
  if (!path) return null;
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  const base = process.env.SERVER_URL || `http://localhost:${getConfig().port}`;
  return `${base}${path}`;
}

/**
 * Returns a simple emoji for a service's sourceState.
 * @param {string} sourceState
 * @returns {string}
 */
function _stateEmoji(sourceState) {
  if (sourceState === 'INCLUDED') return '✅';
  if (sourceState === 'OPTIONAL_ON') return '✅';
  return '➕';
}

/**
 * Sends a full booking confirmation email to the guest.
 *
 * @param {object} booking  Full Prisma Booking record with includes:
 *   booking.user              – User { firstName, lastName, email, phone }
 *   booking.room              – Room { title, floor, capacity, bedsCount, area, basePrice,
 *                                       hotel: Hotel, images: RoomImage[] }
 *   booking.bookingServices   – BookingService[] with { sourceState, priceSnapshot, service: Service }
 *   booking.payment           – Payment { amount, currency }
 */
async function sendBookingConfirmation(booking) {
  const config = getConfig();
  const transporter = getTransporter();

  const { user, room, bookingServices, payment } = booking;
  const hotel = room?.hotel || {};

  // ── Dates & nights ──────────────────────────────────────────────────────────
  const startDate = new Date(booking.startDate);
  const endDate = new Date(booking.endDate);
  const nights = Math.round((endDate - startDate) / (1000 * 60 * 60 * 24));

  // ── Hotel logo URL ───────────────────────────────────────────────────────────
  const hotelLogoUrl = _absoluteUrl(hotel.heroImageUrl);

  // ── Services table rows ─────────────────────────────────────────────────────
  const serviceRows = (bookingServices || []).map((bs) => {
    const price = Number(bs.priceSnapshot);
    const priceStr = price > 0
      ? `${_fmtPrice(price)}${bs.service?.priceType === 'PER_NIGHT' ? '/ночь' : ', разово'}`
      : 'Включено';
    return `
      <tr>
        <td style="padding: 8px 12px; border-bottom: 1px solid #EFF6F7; font-size: 14px; color: #444;">
          ${_stateEmoji(bs.sourceState)}&nbsp;&nbsp;${bs.service?.title || bs.serviceCode}
        </td>
        <td style="padding: 8px 12px; border-bottom: 1px solid #EFF6F7; font-size: 14px; color: #444; text-align: right; white-space: nowrap;">
          ${priceStr}
        </td>
      </tr>`;
  }).join('');

  // ── Room details rows ────────────────────────────────────────────────────────
  const roomDetails = [
    room.floor != null ? `<span>Этаж: <strong>${room.floor}</strong></span>` : null,
    `<span>Вместимость: <strong>${room.capacity} гост.</strong></span>`,
    `<span>Кроватей: <strong>${room.bedsCount}</strong></span>`,
    room.area != null ? `<span>Площадь: <strong>${Number(room.area)} м²</strong></span>` : null,
  ].filter(Boolean).join('&nbsp;&nbsp;·&nbsp;&nbsp;');

  // ── Hotel address line ───────────────────────────────────────────────────────
  const hotelAddress = [hotel.city, hotel.address].filter(Boolean).join(', ');

  // ── Stars ────────────────────────────────────────────────────────────────────
  const stars = hotel.stars ? '★'.repeat(hotel.stars) : '';

  const html = `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Подтверждение бронирования</title>
</head>
<body style="margin:0;padding:0;background:#F0F6F8;font-family:'Segoe UI',Arial,sans-serif;">

  <!-- Wrapper -->
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F0F6F8;padding:32px 0;">
    <tr><td align="center">

      <!-- Card -->
      <table width="600" cellpadding="0" cellspacing="0"
             style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 16px rgba(0,0,0,0.08);max-width:600px;width:100%;">

        <!-- ── Header ── -->
        <tr>
          <td style="background:linear-gradient(135deg,#42ACC1 0%,#2E8FA3 100%);padding:0;">
            ${hotelLogoUrl ? `
            <div style="padding:28px 32px 0;text-align:center;">
              <img src="${hotelLogoUrl}" alt="${hotel.name || 'Отель'}"
                   style="max-height:90px;max-width:280px;object-fit:contain;border-radius:8px;" />
            </div>` : ''}
            <div style="padding:${hotelLogoUrl ? '16px' : '32px'} 32px 28px;text-align:center;">
              <p style="margin:0 0 4px;font-size:13px;color:rgba(255,255,255,0.8);letter-spacing:1px;text-transform:uppercase;">
                ${hotel.name || 'Отель'}${stars ? '&nbsp;&nbsp;' + stars : ''}
              </p>
              <h1 style="margin:0;font-size:26px;font-weight:700;color:#fff;">
                Бронирование подтверждено!
              </h1>
              <p style="margin:8px 0 0;font-size:14px;color:rgba(255,255,255,0.85);">
                Ждём вас с распростёртыми объятиями
              </p>
            </div>
          </td>
        </tr>

        <!-- ── Booking ID banner ── -->
        <tr>
          <td style="background:#E8F6F9;padding:14px 32px;text-align:center;border-bottom:1px solid #D4EEF3;">
            <span style="font-size:12px;color:#42ACC1;letter-spacing:1px;text-transform:uppercase;font-weight:600;">
              Номер бронирования
            </span><br/>
            <span style="font-size:15px;font-weight:700;color:#040909;letter-spacing:0.5px;font-family:monospace;">
              ${booking.bookingId}
            </span>
          </td>
        </tr>

        <!-- ── Body ── -->
        <tr>
          <td style="padding:32px;">

            <!-- Greeting -->
            <p style="margin:0 0 24px;font-size:16px;color:#333;line-height:1.6;">
              Здравствуйте, <strong>${user.firstName} ${user.lastName}</strong>!<br/>
              Ваше бронирование успешно оформлено. Ниже приведены все детали.
            </p>

            <!-- ── Check-in / Check-out ── -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
              <tr>
                <td width="48%" style="background:#F4FAFB;border:1px solid #D4EEF3;border-radius:10px;padding:16px 20px;text-align:center;">
                  <div style="font-size:11px;color:#42ACC1;font-weight:600;letter-spacing:1px;text-transform:uppercase;margin-bottom:6px;">
                    Заезд
                  </div>
                  <div style="font-size:18px;font-weight:700;color:#040909;">${_fmtDate(startDate)}</div>
                  <div style="font-size:12px;color:#888;margin-top:4px;">с 14:00</div>
                </td>
                <td width="4%" style="text-align:center;color:#42ACC1;font-size:18px;">→</td>
                <td width="48%" style="background:#F4FAFB;border:1px solid #D4EEF3;border-radius:10px;padding:16px 20px;text-align:center;">
                  <div style="font-size:11px;color:#42ACC1;font-weight:600;letter-spacing:1px;text-transform:uppercase;margin-bottom:6px;">
                    Выезд
                  </div>
                  <div style="font-size:18px;font-weight:700;color:#040909;">${_fmtDate(endDate)}</div>
                  <div style="font-size:12px;color:#888;margin-top:4px;">до 12:00</div>
                </td>
              </tr>
            </table>
            <p style="margin:-16px 0 24px;text-align:center;font-size:13px;color:#666;">
              Продолжительность: <strong>${nights} ${nights === 1 ? 'ночь' : nights < 5 ? 'ночи' : 'ночей'}</strong>
            </p>

            <!-- ── Room info ── -->
            <table width="100%" cellpadding="0" cellspacing="0"
                   style="background:#F4FAFB;border:1px solid #D4EEF3;border-radius:10px;margin-bottom:24px;overflow:hidden;">
              <tr>
                <td style="padding:14px 20px;background:#42ACC1;">
                  <span style="font-size:13px;font-weight:700;color:#fff;letter-spacing:0.5px;text-transform:uppercase;">
                    🏨 Номер
                  </span>
                </td>
              </tr>
              <tr>
                <td style="padding:16px 20px;">
                  <div style="font-size:18px;font-weight:700;color:#040909;margin-bottom:6px;">
                    ${room.title}
                  </div>
                  <div style="font-size:13px;color:#666;margin-bottom:8px;">${roomDetails}</div>
                  <div style="font-size:14px;color:#444;">
                    Базовая цена: <strong style="color:#42ACC1;">${_fmtPrice(room.basePrice)}/ночь</strong>
                  </div>
                </td>
              </tr>
            </table>

            <!-- ── Services ── -->
            ${serviceRows ? `
            <table width="100%" cellpadding="0" cellspacing="0"
                   style="border:1px solid #D4EEF3;border-radius:10px;margin-bottom:24px;overflow:hidden;">
              <tr>
                <td colspan="2" style="padding:14px 20px;background:#42ACC1;">
                  <span style="font-size:13px;font-weight:700;color:#fff;letter-spacing:0.5px;text-transform:uppercase;">
                    🛎 Услуги
                  </span>
                </td>
              </tr>
              ${serviceRows}
            </table>` : ''}

            <!-- ── Total ── -->
            <table width="100%" cellpadding="0" cellspacing="0"
                   style="background:#E8F6F9;border:2px solid #42ACC1;border-radius:10px;margin-bottom:24px;">
              <tr>
                <td style="padding:16px 20px;font-size:15px;color:#444;font-weight:600;">
                  Итого к оплате
                </td>
                <td style="padding:16px 20px;text-align:right;font-size:22px;font-weight:700;color:#42ACC1;white-space:nowrap;">
                  ${_fmtPrice(payment?.amount ?? booking.totalAmount)}
                </td>
              </tr>
            </table>

            <!-- ── Guest info ── -->
            <table width="100%" cellpadding="0" cellspacing="0"
                   style="background:#F4FAFB;border:1px solid #D4EEF3;border-radius:10px;margin-bottom:24px;overflow:hidden;">
              <tr>
                <td colspan="2" style="padding:14px 20px;background:#42ACC1;">
                  <span style="font-size:13px;font-weight:700;color:#fff;letter-spacing:0.5px;text-transform:uppercase;">
                    👤 Данные гостя
                  </span>
                </td>
              </tr>
              <tr>
                <td style="padding:8px 20px 4px;font-size:13px;color:#666;width:40%;">Имя и фамилия</td>
                <td style="padding:8px 20px 4px;font-size:14px;color:#040909;font-weight:600;">
                  ${user.firstName} ${user.lastName}
                </td>
              </tr>
              <tr>
                <td style="padding:4px 20px;font-size:13px;color:#666;">Email</td>
                <td style="padding:4px 20px;font-size:14px;color:#040909;">${user.email}</td>
              </tr>
              ${user.phone ? `
              <tr>
                <td style="padding:4px 20px 8px;font-size:13px;color:#666;">Телефон</td>
                <td style="padding:4px 20px 8px;font-size:14px;color:#040909;">${user.phone}</td>
              </tr>` : '<tr><td style="padding-bottom:8px;"></td></tr>'}
              ${booking.notes ? `
              <tr>
                <td colspan="2" style="padding:0 20px 16px;">
                  <div style="background:#fff;border-left:3px solid #42ACC1;padding:10px 14px;border-radius:0 6px 6px 0;font-size:13px;color:#555;font-style:italic;">
                    📝 ${booking.notes}
                  </div>
                </td>
              </tr>` : ''}
            </table>

            <!-- ── Hotel info ── -->
            <table width="100%" cellpadding="0" cellspacing="0"
                   style="background:#F4FAFB;border:1px solid #D4EEF3;border-radius:10px;margin-bottom:28px;overflow:hidden;">
              <tr>
                <td colspan="2" style="padding:14px 20px;background:#42ACC1;">
                  <span style="font-size:13px;font-weight:700;color:#fff;letter-spacing:0.5px;text-transform:uppercase;">
                    📍 Контакты отеля
                  </span>
                </td>
              </tr>
              <tr>
                <td style="padding:8px 20px 4px;font-size:13px;color:#666;width:40%;">Отель</td>
                <td style="padding:8px 20px 4px;font-size:14px;color:#040909;font-weight:600;">
                  ${hotel.name || '—'}${stars ? '&nbsp;&nbsp;<span style="color:#F59E0B;">' + stars + '</span>' : ''}
                </td>
              </tr>
              ${hotelAddress ? `
              <tr>
                <td style="padding:4px 20px;font-size:13px;color:#666;">Адрес</td>
                <td style="padding:4px 20px;font-size:14px;color:#040909;">${hotelAddress}</td>
              </tr>` : ''}
              ${hotel.phone ? `
              <tr>
                <td style="padding:4px 20px 8px;font-size:13px;color:#666;">Телефон</td>
                <td style="padding:4px 20px 8px;font-size:14px;color:#040909;">${hotel.phone}</td>
              </tr>` : '<tr><td style="padding-bottom:8px;"></td></tr>'}
            </table>

            <!-- CTA note -->
            <p style="margin:0 0 8px;font-size:14px;color:#555;text-align:center;line-height:1.6;">
              Если у вас возникнут вопросы, свяжитесь с нами по телефону${hotel.phone ? ' <strong>' + hotel.phone + '</strong>' : ''} или reply на это письмо.
            </p>
            <p style="margin:0;font-size:14px;color:#555;text-align:center;">
              До встречи! 🏨
            </p>

          </td>
        </tr>

        <!-- ── Footer ── -->
        <tr>
          <td style="background:#F0F6F8;padding:20px 32px;text-align:center;border-top:1px solid #D4EEF3;">
            <p style="margin:0;font-size:12px;color:#999;line-height:1.6;">
              Это письмо сформировано автоматически — пожалуйста, не отвечайте на него напрямую.<br/>
              © ${new Date().getFullYear()} ${hotel.name || 'Hotel App'}. Все права защищены.
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const mailOptions = {
    from: `"${hotel.name || 'Hotel App'}" <${config.smtpUser}>`,
    to: user.email,
    subject: `✅ Бронирование подтверждено — ${room.title} · ${_fmtDate(startDate)}`,
    html,
  };

  try {
    await transporter.sendMail(mailOptions);
    logger.info('Booking confirmation email sent', { to: user.email, bookingId: booking.bookingId });
  } catch (err) {
    logger.error('Failed to send booking confirmation email', {
      to: user.email,
      bookingId: booking.bookingId,
      error: err.message,
    });
    // Do NOT rethrow – email failure must not break the payment success flow
  }
}

// ── Cancellation email ───────────────────────────────────────────────────────

/**
 * Sends a cancellation notification to the guest.
 *
 * @param {object} booking   Prisma Booking with user, room (with hotel), bookingServices
 * @param {object} opts
 *   opts.source        – 'GUEST' | 'ADMIN' | 'HOTEL' | 'SYSTEM'
 *   opts.reason        – free-text reason (admin cancellations)
 *   opts.penaltyAmount – number, amount withheld
 *   opts.refundAmount  – number, amount actually refunded
 *   opts.refundStatus  – 'FULL' | 'PARTIAL' | 'NONE' | 'PENDING' | 'FAILED' | 'ACTION_REQUIRED'
 */
async function sendCancellationEmail(booking, opts = {}) {
  const config = getConfig();
  const transporter = getTransporter();

  const { user, room } = booking;
  const hotel = room?.hotel || {};
  const { source = 'GUEST', reason, penaltyAmount = 0, refundAmount = 0, refundStatus = 'NONE' } = opts;

  const startDate = new Date(booking.startDate);
  const endDate = new Date(booking.endDate);
  const nights = Math.round((endDate - startDate) / (1000 * 60 * 60 * 24));

  const totalPaid = Number(booking.payment?.amount ?? booking.totalAmount ?? 0);

  const isHotelInitiated = source === 'HOTEL';
  const isNoShow = source === 'SYSTEM';

  const subjectPrefix = isHotelInitiated
    ? '⚠️ Бронирование отменено отелем'
    : isNoShow
    ? '⚠️ Бронирование отменено (незаезд)'
    : '❌ Бронирование отменено';

  const headerColor = isHotelInitiated ? '#DC2626' : '#6B7280';

  // ── Refund message block ────────────────────────────────────────────────────
  let refundHtml = '';
  if (refundStatus === 'NONE' || refundAmount === 0) {
    if (penaltyAmount >= totalPaid && totalPaid > 0) {
      refundHtml = `
        <tr>
          <td style="padding:12px 20px;background:#FEF2F2;border-radius:8px;font-size:14px;color:#991B1B;text-align:center;">
            Возврат не предусмотрен. Удержан штраф в размере <strong>${_fmtPrice(penaltyAmount)}</strong>.
          </td>
        </tr>`;
    }
  } else {
    const refundBlock = refundStatus === 'FULL'
      ? `Возврат средств: <strong style="color:#16A34A;">${_fmtPrice(refundAmount)}</strong> (полный)`
      : refundStatus === 'PARTIAL'
      ? `Возврат средств: <strong style="color:#D97706;">${_fmtPrice(refundAmount)}</strong> (за вычетом штрафа ${_fmtPrice(penaltyAmount)})`
      : refundStatus === 'PENDING'
      ? `Возврат в обработке: <strong>${_fmtPrice(refundAmount)}</strong>`
      : `Возврат: <strong style="color:#DC2626;">ожидает ручной обработки</strong>`;

    const disclaimer = refundAmount > 0
      ? `<p style="margin:8px 0 0;font-size:12px;color:#6B7280;">
           Средства поступят на вашу карту в течение 5–10 рабочих дней, в зависимости от вашего банка.
         </p>`
      : '';

    refundHtml = `
      <tr>
        <td style="padding:16px 20px;background:#F0FDF4;border:1px solid #BBF7D0;border-radius:8px;font-size:14px;color:#166534;">
          ${refundBlock}
          ${disclaimer}
        </td>
      </tr>`;
  }

  // ── Hotel-initiated apology block ───────────────────────────────────────────
  const apologyHtml = isHotelInitiated
    ? `<tr>
         <td style="padding:16px 24px;background:#FEF2F2;border-left:4px solid #DC2626;margin-bottom:16px;font-size:14px;color:#991B1B;line-height:1.6;">
           <strong>Сожалеем об этой ситуации.</strong> Ваше бронирование было отменено по инициативе отеля.
           Полная стоимость будет возвращена на вашу карту в течение 5–10 рабочих дней.
         </td>
       </tr>
       <tr><td style="height:16px;"></td></tr>`
    : '';

  // ── Reason block ────────────────────────────────────────────────────────────
  const reasonHtml = reason
    ? `<p style="font-size:13px;color:#555;margin:4px 0 0;">
         Причина: <em>${reason}</em>
       </p>`
    : '';

  const html = `<!DOCTYPE html>
<html lang="ru">
<head><meta charset="UTF-8" /><title>Отмена бронирования</title></head>
<body style="margin:0;padding:0;background:#F3F4F6;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F3F4F6;padding:32px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0"
             style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 16px rgba(0,0,0,0.08);max-width:600px;width:100%;">

        <!-- Header -->
        <tr>
          <td style="background:${headerColor};padding:28px 32px;text-align:center;">
            <h1 style="margin:0;font-size:24px;font-weight:700;color:#fff;">
              ${isHotelInitiated ? 'Отмена бронирования отелем' : isNoShow ? 'Бронирование: незаезд' : 'Бронирование отменено'}
            </h1>
          </td>
        </tr>

        <!-- Booking ID -->
        <tr>
          <td style="background:#F9FAFB;padding:12px 32px;text-align:center;border-bottom:1px solid #E5E7EB;">
            <span style="font-size:12px;color:#6B7280;letter-spacing:1px;text-transform:uppercase;">Номер бронирования</span><br/>
            <span style="font-size:14px;font-weight:700;color:#111827;font-family:monospace;">${booking.bookingId}</span>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:28px 32px;">
            <p style="margin:0 0 20px;font-size:15px;color:#374151;line-height:1.6;">
              Здравствуйте, <strong>${user.firstName} ${user.lastName}</strong>!
            </p>

            ${apologyHtml}

            <!-- Details table -->
            <table width="100%" cellpadding="0" cellspacing="0"
                   style="background:#F9FAFB;border:1px solid #E5E7EB;border-radius:8px;margin-bottom:20px;">
              <tr>
                <td style="padding:10px 16px;font-size:13px;color:#6B7280;width:45%;">Номер</td>
                <td style="padding:10px 16px;font-size:14px;color:#111827;font-weight:600;">${room.title}</td>
              </tr>
              <tr style="background:#fff;">
                <td style="padding:10px 16px;font-size:13px;color:#6B7280;">Даты</td>
                <td style="padding:10px 16px;font-size:14px;color:#111827;">
                  ${_fmtDate(startDate)} — ${_fmtDate(endDate)}
                  <span style="color:#9CA3AF;font-size:12px;"> (${nights} ${nights === 1 ? 'ночь' : nights < 5 ? 'ночи' : 'ночей'})</span>
                </td>
              </tr>
              <tr>
                <td style="padding:10px 16px;font-size:13px;color:#6B7280;">Оплачено</td>
                <td style="padding:10px 16px;font-size:14px;color:#111827;font-weight:600;">${_fmtPrice(totalPaid)}</td>
              </tr>
              ${penaltyAmount > 0 ? `
              <tr style="background:#FEF9C3;">
                <td style="padding:10px 16px;font-size:13px;color:#92400E;">Штраф (1 ночь)</td>
                <td style="padding:10px 16px;font-size:14px;color:#92400E;font-weight:600;">−${_fmtPrice(penaltyAmount)}</td>
              </tr>` : ''}
              ${reasonHtml ? `<tr><td colspan="2" style="padding:0 16px 12px;">${reasonHtml}</td></tr>` : ''}
            </table>

            <!-- Refund block -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
              ${refundHtml}
            </table>

            <p style="margin:16px 0 0;font-size:13px;color:#6B7280;text-align:center;">
              Если у вас есть вопросы, обратитесь в ${hotel.name || 'наш отель'}.
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#F9FAFB;padding:16px 32px;text-align:center;border-top:1px solid #E5E7EB;">
            <p style="margin:0;font-size:12px;color:#9CA3AF;">
              © ${new Date().getFullYear()} ${hotel.name || 'Hotel App'}. Все права защищены.
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const mailOptions = {
    from: `"${hotel.name || 'Hotel App'}" <${config.smtpUser}>`,
    to: user.email,
    subject: `${subjectPrefix} — ${room.title} · ${_fmtDate(startDate)}`,
    html,
  };

  try {
    await transporter.sendMail(mailOptions);
    logger.info('Cancellation email sent', { to: user.email, bookingId: booking.bookingId });
  } catch (err) {
    logger.error('Failed to send cancellation email', {
      to: user.email,
      bookingId: booking.bookingId,
      error: err.message,
    });
    throw err; // Callers decide whether to swallow
  }
}

module.exports = { sendVerificationCode, sendBookingConfirmation, sendCancellationEmail };
