const path = require('path');

/**
 * Application configuration
 */
const config = {
  // Server Configuration
  server: {
    port: parseInt(process.env.PORT) || 3000,
    host: process.env.HOST || 'localhost',
    environment: process.env.NODE_ENV || 'development',
    trustProxy: process.env.TRUST_PROXY === 'true'
  },

  // Database Configuration
  database: {
    uri: process.env.MONGO_URI || 'mongodb://localhost:27017/wikipedia-summary',
    options: {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      maxPoolSize: parseInt(process.env.DB_MAX_POOL_SIZE) || 10,
      serverSelectionTimeoutMS: parseInt(process.env.DB_TIMEOUT) || 5000,
      socketTimeoutMS: parseInt(process.env.DB_SOCKET_TIMEOUT) || 45000,
    }
  },

  // Authentication Configuration
  auth: {
    jwtSecret: process.env.JWT_SECRET,
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
    saltRounds: parseInt(process.env.SALT_ROUNDS) || 12,
    maxLoginAttempts: parseInt(process.env.MAX_LOGIN_ATTEMPTS) || 5,
    lockoutTime: parseInt(process.env.LOCKOUT_TIME) || 2 * 60 * 60 * 1000, // 2 hours
    passwordResetExpiry: parseInt(process.env.PASSWORD_RESET_EXPIRY) || 10 * 60 * 1000, // 10 minutes
    emailVerificationExpiry: parseInt(process.env.EMAIL_VERIFICATION_EXPIRY) || 24 * 60 * 60 * 1000 // 24 hours
  },

  // AI Service Configuration
  ai: {
    githubToken: process.env.GITHUB_TOKEN,
    endpoint: process.env.AI_ENDPOINT || 'https://models.github.ai/inference',
    model: process.env.AI_MODEL || 'openai/gpt-4o',
    timeout: parseInt(process.env.AI_TIMEOUT) || 30000,
    maxRetries: parseInt(process.env.AI_MAX_RETRIES) || 3,
    retryDelay: parseInt(process.env.AI_RETRY_DELAY) || 1000
  },

  // Rate Limiting Configuration
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
    authWindowMs: parseInt(process.env.AUTH_RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
    authMaxRequests: parseInt(process.env.AUTH_RATE_LIMIT_MAX_REQUESTS) || 10,
    strictWindowMs: parseInt(process.env.STRICT_RATE_LIMIT_WINDOW_MS) || 60 * 60 * 1000,
    strictMaxRequests: parseInt(process.env.STRICT_RATE_LIMIT_MAX_REQUESTS) || 5
  },

  // Pricing Configuration
  pricing: {
    freeCalls: parseInt(process.env.PRICING_FREE_CALLS) || 100,
    basicCost: parseFloat(process.env.PRICING_BASIC_COST) || 0.01,
    premiumCost: parseFloat(process.env.PRICING_PREMIUM_COST) || 0.005,
    enterpriseCost: parseFloat(process.env.PRICING_ENTERPRISE_COST) || 0.003,
    currency: process.env.PRICING_CURRENCY || 'USD'
  },

  // Logging Configuration
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    filePath: process.env.LOG_FILE_PATH || 'logs',
    maxFiles: process.env.LOG_MAX_FILES || '14d',
    maxSize: process.env.LOG_MAX_SIZE || '20m',
    enableConsole: process.env.LOG_ENABLE_CONSOLE !== 'false',
    enableFile: process.env.LOG_ENABLE_FILE !== 'false'
  },

  // Redis Configuration (Optional)
  redis: {
    url: process.env.REDIS_URL,
    password: process.env.REDIS_PASSWORD,
    db: parseInt(process.env.REDIS_DB) || 0,
    keyPrefix: process.env.REDIS_KEY_PREFIX || 'wsg:',
    ttl: parseInt(process.env.REDIS_TTL) || 3600 // 1 hour
  },

  // Email Configuration
  email: {
    host: process.env.EMAIL_HOST,
    port: parseInt(process.env.EMAIL_PORT) || 587,
    secure: process.env.EMAIL_SECURE === 'true',
    user: process.env.EMAIL_USER,
    password: process.env.EMAIL_PASSWORD,
    from: process.env.EMAIL_FROM || 'noreply@wikipediasummary.com',
    templates: {
      welcome: path.join(__dirname, '../templates/email/welcome.html'),
      passwordReset: path.join(__dirname, '../templates/email/password-reset.html'),
      verification: path.join(__dirname, '../templates/email/verification.html')
    }
  },

  // Stripe Configuration
  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY,
    publishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
    currency: process.env.STRIPE_CURRENCY || 'usd'
  },

  // CORS Configuration
  cors: {
    origins: process.env.CORS_ORIGINS 
      ? process.env.CORS_ORIGINS.split(',')
      : ['http://localhost:3000', 'http://localhost:3001'],
    credentials: true,
    optionsSuccessStatus: 200
  },

  // Security Configuration
  security: {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'", "https://models.github.ai"],
        fontSrc: ["'self'", "https:", "data:"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"]
      }
    },
    helmetOptions: {
      contentSecurityPolicy: true,
      crossOriginEmbedderPolicy: false,
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
      }
    }
  },

  // API Configuration
  api: {
    version: process.env.API_VERSION || 'v1',
    baseUrl: process.env.API_BASE_URL || 'http://localhost:3000/api',
    maxRequestSize: process.env.API_MAX_REQUEST_SIZE || '10mb',
    timeout: parseInt(process.env.API_TIMEOUT) || 30000,
    compression: {
      threshold: parseInt(process.env.COMPRESSION_THRESHOLD) || 1024,
      level: parseInt(process.env.COMPRESSION_LEVEL) || 6
    }
  },

  // Wikipedia API Configuration
  wikipedia: {
    baseUrl: 'https://en.wikipedia.org/api/rest_v1',
    userAgent: 'WikipediaSummaryGenerator/2.0 (https://github.com/AnweshaMondal/Wikipedia-Summary-Generator)',
    timeout: parseInt(process.env.WIKIPEDIA_TIMEOUT) || 10000,
    maxRetries: parseInt(process.env.WIKIPEDIA_MAX_RETRIES) || 2
  },

  // Admin Configuration
  admin: {
    email: process.env.ADMIN_EMAIL || 'admin@example.com',
    password: process.env.ADMIN_PASSWORD || 'admin123',
    dashboardUrl: process.env.ADMIN_DASHBOARD_URL || 'http://localhost:3000/admin'
  },

  // Monitoring Configuration
  monitoring: {
    sentryDsn: process.env.SENTRY_DSN,
    enableMetrics: process.env.ENABLE_METRICS === 'true',
    healthCheckInterval: parseInt(process.env.HEALTH_CHECK_INTERVAL) || 30000,
    alertThresholds: {
      errorRate: parseFloat(process.env.ALERT_ERROR_RATE) || 5.0,
      responseTime: parseInt(process.env.ALERT_RESPONSE_TIME) || 5000,
      memoryUsage: parseFloat(process.env.ALERT_MEMORY_USAGE) || 80.0
    }
  },

  // Development Configuration
  development: {
    enableDebug: process.env.ENABLE_DEBUG === 'true',
    enableMockData: process.env.ENABLE_MOCK_DATA === 'true',
    enableSwagger: process.env.ENABLE_SWAGGER === 'true',
    seedOnStart: process.env.SEED_ON_START === 'true'
  }
};

// Validation
function validateConfig() {
  const required = [
    'auth.jwtSecret',
    'ai.githubToken',
    'database.uri'
  ];

  const missing = required.filter(key => {
    const value = key.split('.').reduce((obj, k) => obj?.[k], config);
    return !value;
  });

  if (missing.length > 0) {
    throw new Error(`Missing required configuration: ${missing.join(', ')}`);
  }
}

// Environment-specific overrides
if (config.server.environment === 'production') {
  config.logging.level = 'warn';
  config.security.helmetOptions.contentSecurityPolicy = true;
  config.development.enableDebug = false;
} else if (config.server.environment === 'test') {
  config.logging.level = 'error';
  config.database.uri = process.env.MONGO_URI_TEST || 'mongodb://localhost:27017/wikipedia-summary-test';
}

// Validate configuration on load
try {
  validateConfig();
} catch (error) {
  console.error('Configuration validation failed:', error.message);
  process.exit(1);
}

module.exports = config;
