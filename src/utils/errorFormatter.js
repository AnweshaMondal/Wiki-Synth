const logger = require('./logger');

/**
 * Format error response for API
 * @param {Error} err - Error object
 * @param {string} context - Additional context
 * @returns {Object} Formatted error response
 */
exports.formatError = (err, context = null) => {
  const errorResponse = {
    error: err.message || 'Unknown error',
    timestamp: new Date().toISOString(),
    code: err.code || 'UNKNOWN_ERROR'
  };

  if (context) {
    errorResponse.context = context;
  }

  // Add stack trace in development
  if (process.env.NODE_ENV === 'development') {
    errorResponse.stack = err.stack;
  }

  return errorResponse;
};

/**
 * Format validation errors from express-validator
 * @param {Array} errors - Array of validation errors
 * @returns {Object} Formatted validation error response
 */
exports.formatValidationErrors = (errors) => {
  const formattedErrors = errors.map(error => ({
    field: error.path || error.param,
    message: error.msg,
    value: error.value,
    location: error.location
  }));

  return {
    error: 'Validation failed',
    details: formattedErrors,
    timestamp: new Date().toISOString(),
    code: 'VALIDATION_ERROR'
  };
};

/**
 * Create standardized API error classes
 */
class APIError extends Error {
  constructor(message, statusCode = 500, code = 'API_ERROR') {
    super(message);
    this.name = 'APIError';
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;
  }
}

class ValidationError extends APIError {
  constructor(message, details = []) {
    super(message, 400, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
    this.details = details;
  }
}

class AuthenticationError extends APIError {
  constructor(message = 'Authentication failed') {
    super(message, 401, 'AUTHENTICATION_ERROR');
    this.name = 'AuthenticationError';
  }
}

class AuthorizationError extends APIError {
  constructor(message = 'Access denied') {
    super(message, 403, 'AUTHORIZATION_ERROR');
    this.name = 'AuthorizationError';
  }
}

class NotFoundError extends APIError {
  constructor(message = 'Resource not found') {
    super(message, 404, 'NOT_FOUND_ERROR');
    this.name = 'NotFoundError';
  }
}

class RateLimitError extends APIError {
  constructor(message = 'Rate limit exceeded') {
    super(message, 429, 'RATE_LIMIT_ERROR');
    this.name = 'RateLimitError';
  }
}

class ExternalServiceError extends APIError {
  constructor(message = 'External service error', service = 'unknown') {
    super(message, 502, 'EXTERNAL_SERVICE_ERROR');
    this.name = 'ExternalServiceError';
    this.service = service;
  }
}

/**
 * Enhanced error handler middleware
 */
exports.errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  // Log error
  logger.error('Error occurred:', {
    error: error.message,
    stack: error.stack,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    userId: req.user?.id
  });

  // Mongoose bad ObjectId
  if (err.name === 'CastError') {
    const message = 'Invalid resource ID';
    error = new NotFoundError(message);
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern)[0];
    const message = `${field} already exists`;
    error = new ValidationError(message);
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const message = Object.values(err.errors).map(val => val.message).join(', ');
    error = new ValidationError(message);
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    error = new AuthenticationError('Invalid token');
  }

  if (err.name === 'TokenExpiredError') {
    error = new AuthenticationError('Token expired');
  }

  // Send error response
  res.status(error.statusCode || 500).json(exports.formatError(error));
};

// Export error classes
exports.APIError = APIError;
exports.ValidationError = ValidationError;
exports.AuthenticationError = AuthenticationError;
exports.AuthorizationError = AuthorizationError;
exports.NotFoundError = NotFoundError;
exports.RateLimitError = RateLimitError;
exports.ExternalServiceError = ExternalServiceError;
