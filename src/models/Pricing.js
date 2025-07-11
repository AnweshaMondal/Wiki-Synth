const mongoose = require('mongoose');

const pricingSchema = new mongoose.Schema({
  // Plan Information
  plan: { 
    type: String, 
    enum: ['free', 'basic', 'premium', 'enterprise'], 
    required: true,
    unique: true
  },
  name: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  
  // Pricing Structure
  pricePerCall: { 
    type: Number, 
    required: true,
    min: 0
  },
  monthlyPrice: {
    type: Number,
    default: 0,
    min: 0
  },
  annualPrice: {
    type: Number,
    default: 0,
    min: 0
  },
  setupFee: {
    type: Number,
    default: 0,
    min: 0
  },
  
  // Usage Limits
  limits: {
    monthlyCalls: {
      type: Number,
      required: true,
      min: 0
    },
    dailyCalls: {
      type: Number,
      required: true,
      min: 0
    },
    requestsPerMinute: {
      type: Number,
      default: 10,
      min: 1
    },
    maxInputLength: {
      type: Number,
      default: 10000, // characters
      min: 100
    },
    maxOutputLength: {
      type: Number,
      default: 1000, // characters
      min: 50
    },
    batchSize: {
      type: Number,
      default: 1,
      min: 1
    }
  },
  
  // Features
  features: {
    basicSummary: {
      type: Boolean,
      default: true
    },
    customStyles: {
      type: Boolean,
      default: false
    },
    batchProcessing: {
      type: Boolean,
      default: false
    },
    apiAccess: {
      type: Boolean,
      default: true
    },
    prioritySupport: {
      type: Boolean,
      default: false
    },
    analyticsAccess: {
      type: Boolean,
      default: false
    },
    customIntegrations: {
      type: Boolean,
      default: false
    },
    whiteLabel: {
      type: Boolean,
      default: false
    },
    sla: {
      uptime: {
        type: Number,
        default: 99.0,
        min: 90,
        max: 100
      },
      responseTime: {
        type: Number,
        default: 5000, // milliseconds
        min: 100
      }
    }
  },
  
  // AI Model Configuration
  allowedModels: [{
    name: {
      type: String,
      required: true
    },
    displayName: String,
    costMultiplier: {
      type: Number,
      default: 1.0,
      min: 0.1
    }
  }],
  
  // Billing Configuration
  billing: {
    cycle: {
      type: String,
      enum: ['monthly', 'annual', 'pay_per_use'],
      default: 'monthly'
    },
    trialDays: {
      type: Number,
      default: 0,
      min: 0
    },
    gracePeriodDays: {
      type: Number,
      default: 3,
      min: 0
    }
  },
  
  // Stripe Integration
  stripe: {
    priceId: String,
    productId: String
  },
  
  // Status
  isActive: {
    type: Boolean,
    default: true
  },
  isVisible: {
    type: Boolean,
    default: true
  },
  
  // Ordering
  sortOrder: {
    type: Number,
    default: 0
  },
  
  // Metadata
  metadata: {
    popular: {
      type: Boolean,
      default: false
    },
    recommended: {
      type: Boolean,
      default: false
    },
    tags: [String],
    targetAudience: [String]
  },
  
  // Timestamps
  createdAt: { 
    type: Date, 
    default: Date.now 
  },
  updatedAt: { 
    type: Date, 
    default: Date.now 
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
pricingSchema.index({ plan: 1 });
pricingSchema.index({ isActive: 1, isVisible: 1 });
pricingSchema.index({ sortOrder: 1 });

// Virtual for monthly savings (annual vs monthly)
pricingSchema.virtual('annualSavings').get(function() {
  if (this.annualPrice && this.monthlyPrice) {
    const monthlyTotal = this.monthlyPrice * 12;
    return monthlyTotal - this.annualPrice;
  }
  return 0;
});

// Virtual for savings percentage
pricingSchema.virtual('savingsPercentage').get(function() {
  if (this.annualSavings && this.monthlyPrice) {
    return Math.round((this.annualSavings / (this.monthlyPrice * 12)) * 100);
  }
  return 0;
});

// Virtual for cost per thousand calls
pricingSchema.virtual('costPer1000Calls').get(function() {
  return this.pricePerCall * 1000;
});

// Pre-save middleware
pricingSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Instance method to check if plan allows feature
pricingSchema.methods.hasFeature = function(featureName) {
  return this.features[featureName] === true;
};

// Instance method to get effective price based on volume
pricingSchema.methods.getEffectivePrice = function(callCount) {
  // Volume discounts could be implemented here
  let effectivePrice = this.pricePerCall;
  
  // Example volume discounts
  if (callCount > 10000) {
    effectivePrice *= 0.9; // 10% discount for >10k calls
  } else if (callCount > 1000) {
    effectivePrice *= 0.95; // 5% discount for >1k calls
  }
  
  return effectivePrice;
};

// Instance method to check if usage is within limits
pricingSchema.methods.isWithinLimits = function(usage) {
  return {
    monthly: usage.monthlyCalls <= this.limits.monthlyCalls,
    daily: usage.dailyCalls <= this.limits.dailyCalls,
    overall: usage.monthlyCalls <= this.limits.monthlyCalls && 
             usage.dailyCalls <= this.limits.dailyCalls
  };
};

// Static method to get public pricing info
pricingSchema.statics.getPublicPricing = function() {
  return this.find({ isActive: true, isVisible: true })
    .select('-stripe -__v')
    .sort({ sortOrder: 1 });
};

// Static method to get plan by name
pricingSchema.statics.getPlan = function(planName) {
  return this.findOne({ plan: planName, isActive: true });
};

// Static method to get default free plan
pricingSchema.statics.getFreePlan = function() {
  return this.findOne({ plan: 'free', isActive: true });
};

// Static method for plan comparison
pricingSchema.statics.comparePlans = function(planNames) {
  return this.find({ 
    plan: { $in: planNames }, 
    isActive: true 
  }).sort({ sortOrder: 1 });
};

module.exports = mongoose.model('Pricing', pricingSchema);
