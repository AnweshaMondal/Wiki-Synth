const mongoose = require('mongoose');

const apiCallSchema = new mongoose.Schema({
  // User Information
  user: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User',
    required: true,
    index: true
  },
  
  // Request Information
  endpoint: { 
    type: String, 
    required: true,
    index: true
  },
  method: {
    type: String,
    enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    default: 'POST'
  },
  
  // API Call Details
  requestData: {
    title: String,
    content: String,
    options: {
      style: String,
      length: String,
      language: String,
      includeKeyPoints: Boolean
    }
  },
  
  // Response Information
  responseStatus: {
    type: String,
    enum: ['success', 'error', 'timeout', 'rate_limited'],
    default: 'success'
  },
  responseTime: {
    type: Number, // in milliseconds
    min: 0
  },
  responseSize: {
    type: Number, // in bytes
    min: 0
  },
  
  // Usage & Billing
  cost: { 
    type: Number, 
    required: true,
    min: 0,
    default: 0
  },
  tokensUsed: {
    prompt: { type: Number, default: 0 },
    completion: { type: Number, default: 0 },
    total: { type: Number, default: 0 }
  },
  
  // AI Model Information
  aiModel: {
    type: String,
    default: 'openai/gpt-4o'
  },
  aiParameters: {
    temperature: Number,
    maxTokens: Number,
    topP: Number
  },
  
  // Request Metadata
  ipAddress: String,
  userAgent: String,
  referer: String,
  
  // Geographic Information
  country: String,
  city: String,
  
  // Error Information
  errorMessage: String,
  errorCode: String,
  
  // Performance Metrics
  processingSteps: [{
    step: String,
    startTime: Date,
    endTime: Date,
    duration: Number,
    status: String
  }],
  
  // Cache Information
  cached: {
    type: Boolean,
    default: false
  },
  cacheKey: String,
  
  // Rate Limiting
  rateLimitRemaining: Number,
  rateLimitReset: Date,
  
  // Quality Metrics
  contentQuality: {
    inputLength: Number,
    outputLength: Number,
    compressionRatio: Number,
    readabilityScore: Number
  },
  
  // Timestamps
  timestamp: { 
    type: Date, 
    default: Date.now,
    index: true
  },
  completedAt: Date
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Compound indexes for common queries
apiCallSchema.index({ user: 1, timestamp: -1 });
apiCallSchema.index({ endpoint: 1, timestamp: -1 });
apiCallSchema.index({ responseStatus: 1, timestamp: -1 });
apiCallSchema.index({ timestamp: -1 });
apiCallSchema.index({ user: 1, endpoint: 1, timestamp: -1 });

// Virtual for duration calculation
apiCallSchema.virtual('duration').get(function() {
  if (this.completedAt && this.timestamp) {
    return this.completedAt - this.timestamp;
  }
  return this.responseTime || 0;
});

// Virtual for success rate
apiCallSchema.virtual('isSuccessful').get(function() {
  return this.responseStatus === 'success';
});

// Virtual for cost per token
apiCallSchema.virtual('costPerToken').get(function() {
  if (this.tokensUsed.total > 0) {
    return this.cost / this.tokensUsed.total;
  }
  return 0;
});

// Pre-save middleware to calculate completion time
apiCallSchema.pre('save', function(next) {
  if (this.isModified('responseStatus') && this.responseStatus === 'success' && !this.completedAt) {
    this.completedAt = new Date();
  }
  next();
});

// Instance method to mark as completed
apiCallSchema.methods.markCompleted = function(responseData = {}) {
  this.completedAt = new Date();
  this.responseStatus = 'success';
  
  if (responseData.responseTime) {
    this.responseTime = responseData.responseTime;
  }
  
  if (responseData.tokensUsed) {
    this.tokensUsed = responseData.tokensUsed;
  }
  
  if (responseData.responseSize) {
    this.responseSize = responseData.responseSize;
  }
  
  return this.save();
};

// Instance method to mark as failed
apiCallSchema.methods.markFailed = function(error) {
  this.completedAt = new Date();
  this.responseStatus = 'error';
  this.errorMessage = error.message;
  this.errorCode = error.code;
  return this.save();
};

// Static method for usage analytics
apiCallSchema.statics.getUsageStats = async function(userId, startDate, endDate) {
  const match = { user: userId };
  
  if (startDate && endDate) {
    match.timestamp = {
      $gte: new Date(startDate),
      $lte: new Date(endDate)
    };
  }
  
  return this.aggregate([
    { $match: match },
    {
      $group: {
        _id: null,
        totalCalls: { $sum: 1 },
        successfulCalls: {
          $sum: { $cond: [{ $eq: ['$responseStatus', 'success'] }, 1, 0] }
        },
        totalCost: { $sum: '$cost' },
        avgResponseTime: { $avg: '$responseTime' },
        totalTokens: { $sum: '$tokensUsed.total' },
        endpoints: { $addToSet: '$endpoint' }
      }
    }
  ]);
};

// Static method for system analytics
apiCallSchema.statics.getSystemStats = async function(days = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  return this.aggregate([
    { $match: { timestamp: { $gte: startDate } } },
    {
      $group: {
        _id: {
          date: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } },
          endpoint: '$endpoint'
        },
        calls: { $sum: 1 },
        successRate: {
          $avg: { $cond: [{ $eq: ['$responseStatus', 'success'] }, 1, 0] }
        },
        avgResponseTime: { $avg: '$responseTime' },
        totalCost: { $sum: '$cost' }
      }
    },
    { $sort: { '_id.date': -1, '_id.endpoint': 1 } }
  ]);
};

// Static method for top users
apiCallSchema.statics.getTopUsers = async function(limit = 10, days = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  return this.aggregate([
    { $match: { timestamp: { $gte: startDate } } },
    {
      $group: {
        _id: '$user',
        totalCalls: { $sum: 1 },
        totalCost: { $sum: '$cost' },
        lastCall: { $max: '$timestamp' }
      }
    },
    { $sort: { totalCalls: -1 } },
    { $limit: limit },
    {
      $lookup: {
        from: 'users',
        localField: '_id',
        foreignField: '_id',
        as: 'user'
      }
    },
    { $unwind: '$user' }
  ]);
};

// Static method for endpoint performance
apiCallSchema.statics.getEndpointPerformance = async function(days = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  return this.aggregate([
    { $match: { timestamp: { $gte: startDate } } },
    {
      $group: {
        _id: '$endpoint',
        totalCalls: { $sum: 1 },
        successRate: {
          $avg: { $cond: [{ $eq: ['$responseStatus', 'success'] }, 1, 0] }
        },
        avgResponseTime: { $avg: '$responseTime' },
        p95ResponseTime: { $quantile: { input: '$responseTime', quantile: [0.95], method: 'approximate' } },
        totalCost: { $sum: '$cost' },
        avgCostPerCall: { $avg: '$cost' }
      }
    },
    { $sort: { totalCalls: -1 } }
  ]);
};

// Static method for hourly usage patterns
apiCallSchema.statics.getHourlyUsage = async function(days = 7) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  return this.aggregate([
    { $match: { timestamp: { $gte: startDate } } },
    {
      $group: {
        _id: { $hour: '$timestamp' },
        calls: { $sum: 1 },
        avgResponseTime: { $avg: '$responseTime' }
      }
    },
    { $sort: { '_id': 1 } }
  ]);
};

module.exports = mongoose.model('ApiCall', apiCallSchema);
