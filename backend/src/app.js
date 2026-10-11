const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const rateLimit = require('express-rate-limit');

const config = require('./config');

// Routers
const authRouter = require('./routers/auth');
const aggregationsRouter = require('./routers/aggregations');
const drivesRouter = require('./routers/drives');
const eventsRouter = require('./routers/events');
const heatmapRouter = require('./routers/heatmap');
const notificationsRouter = require('./routers/notifications');

let lookupsRouter = null;
let reportsRouter = null;
let adminRouter = null;

// Optional feature routers
try {
  lookupsRouter = require('./routers/lookups');
} catch (e) {
  console.warn('lookups router not found');
}

try {
  reportsRouter = require('./routers/reports');
} catch (e) {
  console.warn('reports router not found');
}

try {
  adminRouter = require('./routers/admin');
} catch (e) {
  console.warn('admin router not found');
}


// Middleware
const { auth } = require('./middleware/auth');

let errorHandler = null;

try {
  const eh = require('./middleware/errorHandler');

  errorHandler =
    typeof eh === 'function'
      ? eh
      : eh.errorHandler || null;

} catch (e) {
  errorHandler = null;
}


const app = express();

app.set('trust proxy', 1);


// Basic middleware
app.use(helmet());

app.use(
  cors({
    origin:
      config?.CORS_ORIGINS ||
      (process.env.CORS_ORIGINS
        ? process.env.CORS_ORIGINS.split(',')
        : '*'),
  })
);

app.use(compression());

app.use(express.json());

app.use(
  rateLimit({
    windowMs: 60 * 1000,
    max: 200,
  })
);


// Health check
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
  });
});


// Public routes (Allowed before auth middleware)
app.use('/auth', authRouter);
app.use('/api/auth', authRouter); // <--- שורה זו תתפוס את הבקשה של ה-Frontend ותעקוף את החסימה

// Protected API
app.use('/api', auth);


// System routes
app.use('/api', aggregationsRouter);

app.use('/api/drives', drivesRouter);

app.use('/api/events', eventsRouter);

app.use('/api/heatmap', heatmapRouter);

app.use('/api/notifications', notificationsRouter);


// Optional routes
if (lookupsRouter) {
  app.use('/api', lookupsRouter);
}

if (reportsRouter) {
  app.use('/api/reports', reportsRouter);
}

if (adminRouter) {
  app.use('/api/admin', adminRouter);
}


// Error handler
if (typeof errorHandler === 'function') {

  app.use(errorHandler);

} else {

  app.use((err, req, res, next) => {

    console.error(err?.stack || err);

    res.status(500).json({
      error: 'Something went wrong on the server',
    });

  });

}


module.exports = app;