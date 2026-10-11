require('dotenv').config();

const http = require('http');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');

const app = require('./app');
const config = require('./config');
const { PORT } = config;

const db = require('./db');
const { startAlertsListener } = require('./alertsListener');

/* =========================
   HTTP SERVER
========================= */

const server = http.createServer(app);

/* =========================
   SOCKET.IO
========================= */

const corsOrigins = config.CORS_ORIGINS.split(',').map((o) => o.trim());

const io = new Server(server, {
  cors: {
    origin: corsOrigins,
  },
});

const notificationNamespace = io.of('/notifications');
const eventsRouter = require('./routers/events');

/* =========================
   SOCKET AUTH
========================= */

notificationNamespace.use((socket, next) => {
  const token = socket.handshake.auth?.token;

  if (!token) {
    return next(
      new Error('Authentication error: Token missing')
    );
  }

  try {
    const decoded = jwt.verify(
      token,
      config.JWT_SECRET
    );

    socket.data.user = decoded;

    next();
  } catch (err) {
    next(
      new Error('Authentication error: Invalid token')
    );
  }
});

/* =========================
   CONNECTION HANDLER
========================= */

notificationNamespace.on('connection', (socket) => {
  const companyId =
    socket.data.user.companyId ||
    socket.data.user.company_id;

  if (companyId) {
    socket.join(`company_${companyId}`);

    console.log(
      `[Socket] User connected. Joined room: company_${companyId}`
    );
  }

  socket.on('disconnect', () => {
    console.log('[Socket] User disconnected');
  });
});

/* =========================
   REALTIME ALERTS
========================= */

const notifyNewAlert = (alertData) => {
  const companyId =
    alertData.companyId ||
    alertData.company_id;

  if (!companyId) {
    return;
  }

  notificationNamespace
    .to(`company_${companyId}`)
    .emit('new_alert', alertData);
};

/* =========================
   SERVER START
========================= */

server.listen(PORT, async () => {
  console.log(`
🚀 Server is running!
📡 API: http://localhost:${PORT}
🔌 WebSocket: ws://localhost:${PORT}/notifications
  `);

  eventsRouter.startCacheCleaner();

  try {
    await startAlertsListener(notifyNewAlert);
  } catch (error) {
    console.error(
      'Failed to start alerts listener:',
      error
    );
  }
});

/* =========================
   GRACEFUL SHUTDOWN
========================= */

const shutdown = async () => {
  console.log('\nStopping server gracefully...');

  server.close(async () => {
    console.log('HTTP/WebSocket server closed.');

    try {
      if (db?.end && typeof db.end === 'function') {
        await db.end();
      } else if (
        db?.pool &&
        typeof db.pool.end === 'function'
      ) {
        await db.pool.end();
      }

      console.log('Database pool closed.');
    } catch (err) {
      console.error(
        'Failed closing database pool:',
        err
      );
    }

    eventsRouter.stopCacheCleaner();

    process.exit(0);
  });
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

/* =========================
   EXPORTS
========================= */

module.exports = {
  server,
  notifyNewAlert,
};
