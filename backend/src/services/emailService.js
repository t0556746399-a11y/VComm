const nodemailer = require('nodemailer');

const {
  MAILTRAP_HOST,
  MAILTRAP_PORT,
  MAILTRAP_USER,
  MAILTRAP_PASS,
  EMAIL_FROM,
} = process.env;

// Build transport options dynamically so we only include auth when credentials are provided.
const transportOptions = {
  host: MAILTRAP_HOST || 'smtp.mailtrap.io',
  port: MAILTRAP_PORT ? Number(MAILTRAP_PORT) : 2525,
  secure: false,
};

if (MAILTRAP_USER && MAILTRAP_PASS) {
  transportOptions.auth = { user: MAILTRAP_USER, pass: MAILTRAP_PASS };
}

// Allow replacing transporter when falling back to a test account.
let transporter = nodemailer.createTransport(transportOptions);
let usingEthereal = false;

async function testConnection() {
  try {
    await transporter.verify();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err?.message || String(err) };
  }
}

async function sendEmailWithAttachment({ to, subject, text = '', pdfBuffer, filename = 'report.pdf' }) {
  if (!pdfBuffer) {
    throw new Error('pdfBuffer is required');
  }

  const from = EMAIL_FROM || 'no-reply@vcomm.local';

  // If auth is required but missing, and we're in development, create an Ethereal test account
  // so developers can preview emails without Mailtrap configuration.
  const missingAuth = !(transporter && transporter.options && transporter.options.auth && transporter.options.auth.user && transporter.options.auth.pass);
  if (missingAuth) {
    if ((process.env.NODE_ENV || 'development') !== 'production') {
      try {
        console.warn('MAILTRAP credentials missing — creating Ethereal test account for development');
        const testAccount = await nodemailer.createTestAccount();
        transporter = nodemailer.createTransport({
          host: 'smtp.ethereal.email',
          port: 587,
          secure: false,
          auth: {
            user: testAccount.user,
            pass: testAccount.pass,
          },
        });
        usingEthereal = true;
      } catch (err) {
        console.error('Failed to create Ethereal test account:', err);
        throw new Error('Email service not configured and failed to create test account');
      }
    } else {
      const msg = 'Email service not configured: missing SMTP credentials (MAILTRAP_USER / MAILTRAP_PASS)';
      console.error(msg);
      throw new Error(msg);
    }
  }

  const mailOptions = {
    from,
    to,
    subject,
    text,
    attachments: [
      {
        filename,
        content: pdfBuffer,
      },
    ],
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    if (usingEthereal) {
      const preview = nodemailer.getTestMessageUrl(info);
      console.info('Ethereal preview URL:', preview);
    }
    return info;
  } catch (err) {
    console.error('sendEmailWithAttachment failed:', err && err.message ? err.message : err);
    throw err;
  }
}

module.exports = {
  sendEmailWithAttachment,
  testConnection,
  transporter,
};
