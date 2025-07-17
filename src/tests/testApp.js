// Test-specific app configuration
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

const authRoutes = require('../routes/auth');
const summaryRoutes = require('../routes/summary');
const adminRoutes = require('../routes/admin');
const { errorHandler } = require('../utils/errorFormatter');

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '50mb' }));

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

app.get('/api/health/detailed', (req, res) => {
  res.json({
    status: 'ok',
    services: { database: { status: 'healthy' } },
    performance: { memory: { used: 50 } }
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/summary', summaryRoutes);
app.use('/admin', adminRoutes);
app.use(errorHandler);

module.exports = { app };
