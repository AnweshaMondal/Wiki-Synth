const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const userSchema = new mongoose.Schema({
  // Basic Information
  email: { 
    type: String, 
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  password: { 
    type: String, 
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters']
  },
  
  // Profile Information
  firstName: {
    type: String,
    trim: true,
    maxlength: [50, 'First name cannot exceed 50 characters']
  },
  lastName: {
    type: String,
    trim: true,
    maxlength: [50, 'Last name cannot exceed 50 characters']
  },
  company: {
    type: String,
    trim: true,
    maxlength: [100, 'Company name cannot exceed 100 characters']
  },
  
  // Account Management
  role: { 
    type: String, 
    enum: ['user', 'premium', 'enterprise', 'admin'], 
    default: 'user' 
  },
  status: {
    type: String,
    enum: ['active', 'suspended', 'pending_verification', 'deleted'],
    default: 'pending_verification'
  },
  
  // API Management
  apiKey: { 
    type: String, 
    unique: true,
    sparse: true // Allow null values but unique when present
  },
  
  // Usage Tracking
  usage: {
    totalCalls: { type: Number, default: 0 },
    monthlyReset: { type: Date, default: Date.now },
    monthlyCalls: { type: Number, default: 0 },
    lastCallAt: { type: Date }
  },
  
  // Billing & Pricing
  subscription: {
    plan: { 
      type: String, 
      enum: ['free', 'basic', 'premium', 'enterprise'], 
      default: 'free' 
    },
    status: {
      type: String,
      enum: ['active', 'past_due', 'canceled', 'incomplete'],
      default: 'active'
    },
    currentPeriodStart: { type: Date, default: Date.now },
    currentPeriodEnd: { type: Date },
    stripeCustomerId: { type: String },
    stripeSubscriptionId: { type: String }
  },
  
  earnings: { type: Number, default: 0 },
  totalSpent: { type: Number, default: 0 },
  
  // Security
  emailVerified: { type: Boolean, default: false },
  emailVerificationToken: { type: String },
  emailVerificationExpires: { type: Date },
  
  passwordResetToken: { type: String },
  passwordResetExpires: { type: Date },
  
  twoFactorEnabled: { type: Boolean, default: false },
  twoFactorSecret: { type: String },
  
  // Login tracking
  lastLogin: { type: Date },
  loginAttempts: { type: Number, default: 0 },
  lockUntil: { type: Date },
  
  // Preferences
  preferences: {
    defaultSummaryStyle: {
      type: String,
      enum: ['wikipedia', 'academic', 'casual', 'technical'],
      default: 'wikipedia'
    },
    defaultSummaryLength: {
      type: String,
      enum: ['short', 'medium', 'long', 'detailed'],
      default: 'medium'
    },
    language: {
      type: String,
      default: 'english'
    },
    emailNotifications: {
      marketing: { type: Boolean, default: true },
      security: { type: Boolean, default: true },
      usage: { type: Boolean, default: true }
    }
  },
  
  // Metadata
  ipAddress: { type: String },
  userAgent: { type: String },
  
  // Timestamps
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  lastActiveAt: { type: Date, default: Date.now }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
userSchema.index({ email: 1 });
userSchema.index({ apiKey: 1 });
userSchema.index({ 'subscription.stripeCustomerId': 1 });
userSchema.index({ role: 1, status: 1 });
userSchema.index({ createdAt: 1 });

// Virtual for account lock status
userSchema.virtual('isLocked').get(function() {
  return !!(this.lockUntil && this.lockUntil > Date.now());
});

// Virtual for full name
userSchema.virtual('fullName').get(function() {
  if (this.firstName && this.lastName) {
    return `${this.firstName} ${this.lastName}`;
  }
  return this.firstName || this.lastName || this.email;
});

// Virtual for monthly usage reset check
userSchema.virtual('shouldResetMonthlyUsage').get(function() {
  const now = new Date();
  const resetDate = new Date(this.usage.monthlyReset);
  resetDate.setMonth(resetDate.getMonth() + 1);
  return now >= resetDate;
});

// Pre-save middleware
userSchema.pre('save', async function(next) {
  // Update the updatedAt field
  this.updatedAt = new Date();
  
  // Hash password if modified
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Generate API key
userSchema.methods.generateApiKey = function() {
  const apiKey = 'wsg_' + crypto.randomBytes(32).toString('hex');
  this.apiKey = apiKey;
  return apiKey;
};

// Generate JWT token
userSchema.methods.generateAuthToken = function() {
  const payload = {
    id: this._id,
    email: this.email,
    role: this.role
  };
  
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d'
  });
};

// Compare password
userSchema.methods.comparePassword = async function(candidatePassword) {
  if (!this.password) return false;
  return bcrypt.compare(candidatePassword, this.password);
};

// Generate email verification token
userSchema.methods.generateEmailVerificationToken = function() {
  const token = crypto.randomBytes(32).toString('hex');
  this.emailVerificationToken = crypto.createHash('sha256').update(token).digest('hex');
  this.emailVerificationExpires = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
  return token;
};

// Generate password reset token
userSchema.methods.generatePasswordResetToken = function() {
  const token = crypto.randomBytes(32).toString('hex');
  this.passwordResetToken = crypto.createHash('sha256').update(token).digest('hex');
  this.passwordResetExpires = Date.now() + 10 * 60 * 1000; // 10 minutes
  return token;
};

// Handle failed login attempts
userSchema.methods.incLoginAttempts = function() {
  // If we have a previous lock that has expired, restart at 1
  if (this.lockUntil && this.lockUntil < Date.now()) {
    return this.updateOne({
      $unset: { lockUntil: 1 },
      $set: { loginAttempts: 1 }
    });
  }
  
  const updates = { $inc: { loginAttempts: 1 } };
  
  // Lock account after 5 failed attempts for 2 hours
  if (this.loginAttempts + 1 >= 5 && !this.isLocked) {
    updates.$set = { lockUntil: Date.now() + 2 * 60 * 60 * 1000 };
  }
  
  return this.updateOne(updates);
};

// Reset login attempts
userSchema.methods.resetLoginAttempts = function() {
  return this.updateOne({
    $unset: { loginAttempts: 1, lockUntil: 1 }
  });
};

// Update last activity
userSchema.methods.updateLastActivity = function() {
  this.lastActiveAt = new Date();
  return this.save({ validateBeforeSave: false });
};

// Check and reset monthly usage if needed
userSchema.methods.checkMonthlyReset = function() {
  if (this.shouldResetMonthlyUsage) {
    this.usage.monthlyCalls = 0;
    this.usage.monthlyReset = new Date();
    return this.save({ validateBeforeSave: false });
  }
  return Promise.resolve(this);
};

// Get usage limits based on subscription plan
userSchema.methods.getUsageLimits = function() {
  const limits = {
    free: { monthly: 100, daily: 10 },
    basic: { monthly: 1000, daily: 100 },
    premium: { monthly: 10000, daily: 1000 },
    enterprise: { monthly: 100000, daily: 10000 }
  };
  
  return limits[this.subscription.plan] || limits.free;
};

// Check if user can make API call
userSchema.methods.canMakeApiCall = function() {
  const limits = this.getUsageLimits();
  return this.usage.monthlyCalls < limits.monthly;
};

// Increment usage
userSchema.methods.incrementUsage = function(cost = 0) {
  this.usage.totalCalls += 1;
  this.usage.monthlyCalls += 1;
  this.usage.lastCallAt = new Date();
  this.totalSpent += cost;
  return this.save({ validateBeforeSave: false });
};

// Static method to find by API key
userSchema.statics.findByApiKey = function(apiKey) {
  return this.findOne({ apiKey, status: 'active' });
};

// Static method to find by email verification token
userSchema.statics.findByEmailVerificationToken = function(token) {
  const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
  return this.findOne({
    emailVerificationToken: hashedToken,
    emailVerificationExpires: { $gt: Date.now() }
  });
};

// Static method to find by password reset token
userSchema.statics.findByPasswordResetToken = function(token) {
  const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
  return this.findOne({
    passwordResetToken: hashedToken,
    passwordResetExpires: { $gt: Date.now() }
  });
};

module.exports = mongoose.model('User', userSchema);
