const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const env = require('./config/env');
const routes = require('./routes');
const { notFound, errorHandler } = require('./middleware/errorHandler');

const app = express();
app.set('trust proxy', 1); // Render / Heroku sit behind a proxy

const limiter = (limit, windowMs = 15 * 60 * 1000) =>
  rateLimit({
    windowMs,
    limit,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: 'Too many requests. Please slow down.', code: 'RATE_LIMITED' },
  });

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10kb' }));
app.use(morgan(env.nodeEnv === 'production' ? 'combined' : 'dev')); // method/url/status only, no bodies

app.get('/', (req, res) => res.json({ name: 'CreditSea API', docs: '/api/health' }));
app.use('/api', limiter(600));
app.use('/api/auth', limiter(80));
app.use('/api', routes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
