const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { checkAIServiceHealth } = require('../services/wikipediaService');
const logger = require('../utils/logger');

/**
 * Basic health check endpoint
 * GET /api/health
 */
router.get('/', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version || '2.0.0',
    environment: process.env.NODE_ENV || 'development'
  });
});

/**
 * Detailed health check endpoint
 * GET /api/health/detailed
 */
router.get('/detailed', async (req, res) => {
  const healthCheck = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version || '2.0.0',
    environment: process.env.NODE_ENV || 'development',
    services: {}
  };

  try {
    // Check database connection
    const dbState = mongoose.connection.readyState;
    healthCheck.services.database = {
      status: dbState === 1 ? 'healthy' : 'unhealthy',
      state: ['disconnected', 'connected', 'connecting', 'disconnecting'][dbState],
      host: mongoose.connection.host,
      name: mongoose.connection.name
    };

    // Check AI service
    try {
      const aiHealth = await checkAIServiceHealth();
      healthCheck.services.ai = aiHealth;
    } catch (error) {
      healthCheck.services.ai = {
        status: 'unhealthy',
        error: error.message
      };
    }

    // Check memory usage
    const memUsage = process.memoryUsage();
    healthCheck.system = {
      memory: {
        used: Math.round(memUsage.rss / 1024 / 1024), // MB
        heap: Math.round(memUsage.heapUsed / 1024 / 1024), // MB
        external: Math.round(memUsage.external / 1024 / 1024) // MB
      },
      cpu: process.cpuUsage(),
      nodeVersion: process.version,
      platform: process.platform
    };

    // Overall health status
    const servicesHealthy = Object.values(healthCheck.services)
      .every(service => service.status === 'healthy');
    
    if (!servicesHealthy) {
      healthCheck.status = 'degraded';
    }

    res.status(healthCheck.status === 'ok' ? 200 : 503).json(healthCheck);

  } catch (error) {
    logger.error('Health check failed:', error);
    res.status(503).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

/**
 * Readiness probe - checks if app is ready to serve traffic
 * GET /api/health/ready
 */
router.get('/ready', async (req, res) => {
  try {
    // Check critical dependencies
    const checks = [];

    // Database check
    checks.push(mongoose.connection.readyState === 1);

    // Environment variables check
    checks.push(!!process.env.GITHUB_TOKEN);
    checks.push(!!process.env.JWT_SECRET);

    const ready = checks.every(check => check === true);

    if (ready) {
      res.status(200).json({
        status: 'ready',
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(503).json({
        status: 'not_ready',
        timestamp: new Date().toISOString(),
        reason: 'Critical dependencies not available'
      });
    }
  } catch (error) {
    res.status(503).json({
      status: 'not_ready',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

/**
 * Liveness probe - checks if app is alive
 * GET /api/health/live
 */
router.get('/live', (req, res) => {
  res.status(200).json({
    status: 'alive',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

module.exports = router;
