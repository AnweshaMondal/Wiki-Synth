# 🌐 Wikipedia Summary Generator API

[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![MongoDB](https://img.shields.io/badge/MongoDB-5.0+-blue.svg)](https://www.mongodb.com/)
[![GitHub AI](https://img.shields.io/badge/GitHub_AI-GPT--4o-purple.svg)](https://github.com/marketplace/models)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Docker](https://img.shields.io/badge/Docker-Ready-blue.svg)](https://www.docker.com/)
[![Tests](https://img.shields.io/badge/Tests-Jest-red.svg)](https://jestjs.io/)

A sophisticated, enterprise-grade API service that generates intelligent Wikipedia article summaries using GitHub AI (GPT-4o). Built with modern architecture patterns, comprehensive security, and production-ready features for scalable deployment.

**Perfect for researchers, content creators, businesses, and developers who need high-quality automated summaries with advanced features like batch processing, multiple summary styles, and comprehensive analytics.**

---

## 🚀 Features

### 🤖 AI-Powered Core
- **GitHub AI Integration**: Leverages GitHub marketplace `gpt-4o` model for superior quality
- **Multiple Summary Styles**: Bullet points, paragraphs, academic, technical, and simplified formats
- **Wikipedia Integration**: Direct article fetching and processing from Wikipedia
- **Batch Processing**: Generate multiple summaries in a single request (Premium+)
- **Real-time Health Monitoring**: Comprehensive API and service health checks
- **Smart Caching**: Redis-based caching for improved performance and cost efficiency

### 🔐 Enterprise Security
- **Dual Authentication**: JWT tokens and API key authentication
- **Role-based Access Control**: Admin, premium, and standard user roles with granular permissions
- **Account Security**: Automatic account locking, login attempt tracking, password policies
- **Rate Limiting**: Intelligent throttling based on subscription tiers with burst handling
- **Input Validation**: Comprehensive request validation and sanitization using Joi
- **Security Headers**: Helmet.js integration for OWASP compliance

### 💰 Monetization Ready
- **Tiered Pricing Plans**: Free, Basic, Premium, Enterprise with feature differentiation
- **Usage Tracking**: Detailed API call analytics, token consumption, and cost tracking
- **Flexible Billing**: Ready for Stripe payment integration with webhook support
- **Admin Dashboard**: Complete user and revenue management interface
- **API Key Management**: Secure key generation, rotation, and permission scoping

### 📊 Advanced Analytics
- **Comprehensive Logging**: Winston-based logging with daily rotation and structured format
- **Performance Metrics**: Response times, success rates, error tracking with percentiles
- **Health Endpoints**: Service status, dependency monitoring, and diagnostic information
- **Usage Analytics**: Detailed consumption patterns, user behavior, and performance insights
- **Real-time Monitoring**: Live system metrics and alerting capabilities

### 🛠 Developer Experience
- **RESTful API Design**: Clean, intuitive endpoint structure following REST principles
- **Comprehensive Documentation**: Interactive API documentation with examples
- **Docker Ready**: Complete containerization setup for development and production
- **Testing Framework**: Jest-based test suite with 90%+ coverage and CI/CD ready
- **Development Tools**: Hot reload, debugging support, migration tools, and seed scripts

## 📋 Quick Start Guide

### Prerequisites
- **Node.js** 18+ 
- **MongoDB** 5.0+
- **GitHub AI Token** ([Get yours here](https://github.com/marketplace/models))
- **Redis** (optional, for caching)

### 🚀 Installation Methods

#### Method 1: Docker (Recommended)
```bash
# Clone repository
git clone https://github.com/yourusername/wikipedia-summary-generator.git
cd wikipedia-summary-generator

# Start with Docker Compose
docker-compose up -d

# View logs
docker-compose logs -f api
```

#### Method 2: Local Development
```bash
# Clone and install
git clone https://github.com/yourusername/wikipedia-summary-generator.git
cd wikipedia-summary-generator
npm install

# Configure environment
cp .env.example .env
# Edit .env with your configuration

# Initialize database
npm run db:migrate
npm run db:seed

# Start development server
npm run dev
```

### 🧪 Test the API
```bash
# Health check
curl http://localhost:3000/api/v1/health

# Generate your first summary
curl -X POST http://localhost:3000/api/v1/summary \
  -H "Content-Type: application/json" \
  -d '{"title": "Artificial Intelligence", "style": "bullet"}'
```

## 🏗 Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     API Gateway Layer                       │
├─────────────────────────────────────────────────────────────┤
│  Express.js Server │ Middleware Stack │ Rate Limiting      │
├─────────────────────────────────────────────────────────────┤
│                   Authentication Layer                      │
├─────────────────────────────────────────────────────────────┤
│   JWT Handler     │  API Key Auth    │  Role-Based Access │
├─────────────────────────────────────────────────────────────┤
│                    Business Logic Layer                     │
├─────────────────────────────────────────────────────────────┤
│  Summary Service  │  User Service    │  Admin Service     │
├─────────────────────────────────────────────────────────────┤
│                      Data Layer                            │
├─────────────────────────────────────────────────────────────┤
│    MongoDB       │    Redis Cache   │   File Storage     │
├─────────────────────────────────────────────────────────────┤
│                   External Services                        │
├─────────────────────────────────────────────────────────────┤
│   GitHub AI      │   Wikipedia API  │   Stripe (Optional)│
└─────────────────────────────────────────────────────────────┘
```

## 📚 API Documentation

### Base URL
```
https://your-domain.com/api/v1
```

### 🔐 Authentication

#### JWT Authentication
```http
Authorization: Bearer <your-jwt-token>
```

#### API Key Authentication
```http
X-API-Key: <your-api-key>
```

### 📝 Core Endpoints

#### Generate Summary
```http
POST /api/v1/summary
Content-Type: application/json
Authorization: Bearer <token>

{
  "title": "Artificial Intelligence",
  "style": "bullet|paragraph|academic|technical|simple",
  "maxLength": 500,
  "language": "en"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "title": "Artificial Intelligence",
    "summary": "• AI is the simulation of human intelligence processes...",
    "style": "bullet",
    "length": 425,
    "tokensUsed": 150,
    "sourceUrl": "https://en.wikipedia.org/wiki/Artificial_Intelligence",
    "generatedAt": "2024-01-15T10:30:00Z"
  },
  "usage": {
    "tokensUsed": 150,
    "remainingTokens": 850,
    "resetDate": "2024-01-16T00:00:00Z"
  }
}
```

#### Batch Processing (Premium+)
```http
POST /api/v1/summary/batch
Authorization: Bearer <token>

{
  "articles": [
    {"title": "Machine Learning", "style": "bullet"},
    {"title": "Neural Networks", "style": "paragraph"}
  ],
  "options": {
    "maxLength": 300,
    "parallel": true
  }
}
```

### 👤 User Management

#### Register User
```http
POST /api/v1/auth/register
Content-Type: application/json

{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "SecurePass123!",
  "plan": "basic"
}
```

#### Login User
```http
POST /api/v1/auth/login
Content-Type: application/json

{
  "email": "john@example.com",
  "password": "SecurePass123!"
}
```

#### Generate API Key
```http
POST /api/v1/auth/api-key
Authorization: Bearer <token>

{
  "name": "Production API Key",
  "permissions": ["summary:read", "summary:write"],
  "rateLimit": 1000
}
```

### 🛡 Admin Endpoints

#### User Management
```http
GET /api/v1/admin/users?page=1&limit=50
POST /api/v1/admin/users/:id/status
GET /api/v1/admin/analytics/overview
GET /api/v1/admin/analytics/revenue
```

#### System Health
```http
GET /api/v1/health
GET /api/v1/health/detailed
GET /api/v1/admin/system/metrics
```

## 💰 Pricing Plans

| Feature | Free | Basic | Premium | Enterprise |
|---------|------|-------|---------|------------|
| **Monthly Requests** | 1,000 | 10,000 | 100,000 | Unlimited |
| **Rate Limit** | 10/min | 100/min | 1,000/min | Custom |
| **Batch Processing** | ❌ | ✅ (5 max) | ✅ (25 max) | ✅ (Unlimited) |
| **Summary Styles** | Basic | All | All + Custom | All + Custom |
| **Priority Support** | ❌ | Email | Priority | Dedicated |
| **Analytics Dashboard** | Basic | Standard | Advanced | Enterprise |
| **API Keys** | 1 | 3 | 10 | Unlimited |
| **SLA** | None | 99% | 99.9% | 99.99% |
| **Price** | Free | $9/month | $49/month | Custom |

## ⚙️ Configuration

### Environment Variables

#### Core Configuration
| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `NODE_ENV` | Environment mode | development | ✅ |
| `PORT` | Server port | 3000 | ❌ |
| `API_VERSION` | API version | v1 | ❌ |

#### Database Configuration
| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `MONGODB_URI` | MongoDB connection string | - | ✅ |
| `MONGODB_TEST_URI` | Test database connection | - | ❌ |
| `REDIS_URL` | Redis connection string | - | ❌ |

#### GitHub AI Configuration
| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `GITHUB_AI_TOKEN` | GitHub AI API token | - | ✅ |
| `GITHUB_AI_MODEL` | AI model to use | gpt-4o | ❌ |
| `GITHUB_AI_ENDPOINT` | AI service endpoint | - | ❌ |

#### Security Configuration
| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `JWT_SECRET` | JWT signing secret | - | ✅ |
| `JWT_EXPIRE` | JWT expiration time | 24h | ❌ |
| `BCRYPT_ROUNDS` | Password hashing rounds | 12 | ❌ |

### Database Setup

#### MongoDB Indexes
The application automatically creates optimized indexes for:
- User authentication (email, apiKey)
- API call tracking (user, timestamp, endpoint)
- Pricing plans (plan, status)
- Performance optimization

#### Migration System
```bash
# Run all pending migrations
npm run db:migrate

# Create new migration
npm run db:migrate:create add-new-feature

# Rollback last migration
npm run db:migrate:rollback
```

#### Seed Data
```bash
# Seed all data
npm run db:seed

# Seed specific collections
npm run db:seed -- --users --pricing
```

## 🚀 Deployment Options

### 🐳 Docker Deployment

#### Development Environment
```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

Services included:
- **API Server**: Node.js application
- **MongoDB**: Database with initialization scripts
- **Redis**: Caching and session storage
- **Mongo Express**: Database admin interface

#### Production Environment
```bash
# Production deployment
docker-compose -f docker-compose.prod.yml up -d
```

Production features:
- Optimized Docker images
- Health checks and restart policies
- Resource limits and security constraints
- Logging and monitoring integration

### ☁️ Cloud Deployment

#### Heroku
```bash
# Setup
heroku create your-app-name
heroku addons:create mongolab:sandbox
heroku addons:create heroku-redis:hobby-dev

# Configure environment
heroku config:set GITHUB_AI_TOKEN=your-token
heroku config:set JWT_SECRET=your-secret
heroku config:set NODE_ENV=production

# Deploy
git push heroku main
```

#### Railway
```bash
railway login
railway init
railway add
railway deploy
```

#### Vercel (Serverless)
```bash
npm install -g vercel
vercel
```

#### AWS ECS/Fargate
Use the provided `Dockerfile` with AWS ECS for scalable container deployment:

```yaml
# AWS Task Definition
{
  "family": "wikipedia-summary-api",
  "networkMode": "awsvpc",
  "cpu": "256",
  "memory": "512",
  "containerDefinitions": [{
    "name": "api",
    "image": "your-registry/wikipedia-summary:latest",
    "portMappings": [{
      "containerPort": 3000,
      "protocol": "tcp"
    }]
  }]
}
```

#### Azure Container Instances
```bash
az container create \
  --resource-group myResourceGroup \
  --name wikipedia-summary-api \
  --image your-registry/wikipedia-summary:latest \
  --environment-variables GITHUB_AI_TOKEN=xxx
```

#### Google Cloud Run
```bash
# Build and deploy
gcloud builds submit --tag gcr.io/PROJECT-ID/wikipedia-summary
gcloud run deploy --image gcr.io/PROJECT-ID/wikipedia-summary
```

## 🧪 Development & Testing

### Development Setup

#### Local Development
```bash
# Install dependencies
npm install

# Start development server with hot reload
npm run dev

# Run in watch mode
npm run dev:watch
```

#### Available Scripts
| Script | Description |
|--------|-------------|
| `npm start` | Production server |
| `npm run dev` | Development with hot reload |
| `npm run dev:watch` | Development with file watching |
| `npm test` | Run test suite |
| `npm run test:watch` | Tests in watch mode |
| `npm run test:coverage` | Coverage report |
| `npm run lint` | ESLint checking |
| `npm run lint:fix` | Fix ESLint issues |
| `npm run db:migrate` | Database migrations |
| `npm run db:seed` | Seed sample data |
| `npm run docker:build` | Build Docker image |
| `npm run docker:run` | Run Docker container |

### Testing Framework

#### Test Suite Coverage
```bash
# Run all tests
npm test

# Run with coverage report
npm run test:coverage

# Run specific test files
npm test -- auth.test.js

# Run tests matching pattern
npm test -- --grep "authentication"
```

#### Test Structure
```
tests/
├── unit/
│   ├── models/           # Model unit tests
│   ├── services/         # Service unit tests
│   ├── middleware/       # Middleware tests
│   └── utils/           # Utility function tests
├── integration/
│   ├── auth.test.js     # Authentication flow tests
│   ├── summary.test.js  # Summary generation tests
│   ├── admin.test.js    # Admin functionality tests
│   └── health.test.js   # Health check tests
├── fixtures/
│   ├── users.json       # Test user data
│   ├── articles.json    # Sample articles
│   └── responses.json   # Expected responses
└── helpers/
    ├── testSetup.js     # Test environment setup
    ├── mockData.js      # Mock data generators
    └── apiHelpers.js    # API testing utilities
```

#### Performance Testing
```bash
# Load testing
npm run test:load

# Memory leak detection
npm run test:memory

# Stress testing
npm run test:stress
```

### Code Quality

#### ESLint Configuration
```json
{
  "extends": ["eslint:recommended", "node"],
  "rules": {
    "no-console": "warn",
    "no-unused-vars": "error",
    "semi": ["error", "always"],
    "quotes": ["error", "single"]
  }
}
```

#### Prettier Integration
```json
{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": true,
  "printWidth": 80,
  "tabWidth": 2
}
```

## 📊 Monitoring & Analytics

### Health Monitoring

#### Health Check Endpoints
```http
GET /api/v1/health
GET /api/v1/health/detailed
GET /api/v1/admin/system/status
```

#### Health Check Response
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00Z",
  "uptime": 86400,
  "services": {
    "database": {
      "status": "healthy",
      "responseTime": 12,
      "lastCheck": "2024-01-15T10:30:00Z"
    },
    "github_ai": {
      "status": "healthy",
      "responseTime": 245,
      "lastCheck": "2024-01-15T10:30:00Z"
    },
    "redis": {
      "status": "healthy",
      "responseTime": 3,
      "lastCheck": "2024-01-15T10:30:00Z"
    }
  },
  "metrics": {
    "requests_per_minute": 125,
    "error_rate": 0.02,
    "average_response_time": 180
  }
}
```

### Logging System

#### Winston Configuration
- **Structured Logging**: JSON format for easy parsing
- **Log Levels**: error, warn, info, http, verbose, debug, silly
- **File Rotation**: Daily rotation with compression
- **Multiple Transports**: Console, file, and external services

#### Log Format
```json
{
  "timestamp": "2024-01-15T10:30:00Z",
  "level": "info",
  "message": "Summary generated successfully",
  "requestId": "req_123456",
  "userId": "user_789",
  "endpoint": "/api/v1/summary",
  "responseTime": 245,
  "tokensUsed": 150
}
```

### Performance Metrics

#### Key Metrics Tracked
- **Response Times**: P50, P95, P99 percentiles
- **Throughput**: Requests per second/minute
- **Error Rates**: 4xx, 5xx error percentages
- **Token Usage**: GitHub AI consumption tracking
- **Database Performance**: Query execution times
- **Cache Hit Rates**: Redis cache effectiveness

#### Analytics Dashboard
Access comprehensive analytics at `/admin/analytics`:
- Real-time system metrics
- User activity patterns
- Revenue and usage trends
- Performance bottlenecks
- Error frequency analysis

## 🔒 Security

### Security Features

#### Authentication Security
- **Password Policies**: Minimum length, complexity requirements
- **Account Locking**: Automatic lockout after failed attempts
- **JWT Security**: Secure token generation and validation
- **API Key Security**: Encrypted storage and rotation capabilities

#### Input Security
- **Request Validation**: Joi schema validation for all inputs
- **SQL Injection Prevention**: Parameterized queries with Mongoose
- **XSS Protection**: Input sanitization and output encoding
- **Rate Limiting**: DDoS protection and abuse prevention

#### Infrastructure Security
- **HTTPS Only**: TLS encryption for all communications
- **Security Headers**: Helmet.js for OWASP compliance
- **CORS Configuration**: Restricted cross-origin requests
- **Environment Separation**: Isolated configurations per environment

### Security Best Practices

#### Production Checklist
- [ ] Use HTTPS in production
- [ ] Rotate secrets regularly
- [ ] Monitor access logs
- [ ] Update dependencies
- [ ] Use environment separation
- [ ] Enable audit logging
- [ ] Configure firewalls
- [ ] Set up monitoring alerts

#### Vulnerability Management
- **Regular Updates**: Automated dependency updates
- **Security Scanning**: Continuous vulnerability assessment
- **Penetration Testing**: Regular security audits
- **Incident Response**: Defined security incident procedures

### Compliance

#### Data Protection
- **GDPR Compliance**: User data protection and privacy
- **Data Encryption**: At-rest and in-transit encryption
- **Data Retention**: Configurable retention policies
- **Right to Deletion**: User data removal capabilities

## 🤝 Contributing

We welcome contributions from the community! Here's how to get started:

### Development Process

#### Getting Started
1. **Fork** the repository on GitHub
2. **Clone** your fork locally
3. **Create** a feature branch (`git checkout -b feature/amazing-feature`)
4. **Setup** your development environment
5. **Make** your changes
6. **Test** your changes thoroughly
7. **Commit** with conventional commit format
8. **Push** to your fork
9. **Submit** a pull request

#### Code Standards

##### Style Guidelines
- **ESLint**: Follow the provided configuration
- **Prettier**: Use for consistent formatting
- **Naming**: Use camelCase for variables, PascalCase for classes
- **Comments**: Document complex logic and public APIs

##### Commit Convention
```
type(scope): description

feat(auth): add API key rotation functionality
fix(summary): resolve timeout issue with long articles
docs(api): update authentication examples
test(integration): add batch processing tests
```

##### Testing Requirements
- **Unit Tests**: Test individual functions and modules
- **Integration Tests**: Test API endpoints and workflows
- **Coverage**: Maintain >90% test coverage
- **Performance**: Include performance regression tests

#### Pull Request Process

##### Before Submitting
- [ ] All tests pass (`npm test`)
- [ ] Code coverage maintained
- [ ] ESLint and Prettier checks pass
- [ ] Documentation updated
- [ ] CHANGELOG.md updated

##### Review Process
1. **Automated Checks**: CI/CD pipeline validation
2. **Code Review**: Maintainer review for quality and standards
3. **Testing**: Manual testing of new features
4. **Documentation**: Verify documentation completeness
5. **Merge**: Approved PRs merged to main branch

### Issue Guidelines

#### Bug Reports
Include:
- **Environment**: OS, Node.js version, dependencies
- **Steps to Reproduce**: Clear reproduction steps
- **Expected vs Actual**: What should happen vs what happens
- **Logs**: Relevant error messages and stack traces

#### Feature Requests
Include:
- **Use Case**: Why is this feature needed?
- **Proposed Solution**: How should it work?
- **Alternatives**: Other approaches considered
- **Impact**: Who benefits from this feature?

## 📞 Support & Community

### Community Support

#### GitHub
- **Issues**: [Report bugs and request features](https://github.com/yourusername/wikipedia-summary-generator/issues)
- **Discussions**: [Community Q&A and ideas](https://github.com/yourusername/wikipedia-summary-generator/discussions)
- **Wiki**: [Additional documentation and guides](https://github.com/yourusername/wikipedia-summary-generator/wiki)

#### Stack Overflow
Tag your questions with `wikipedia-summary-api` for community support.

#### Discord/Slack
Join our community server for real-time discussions and support.

### Professional Support

#### Support Tiers
- **Community**: GitHub issues and community forums
- **Basic**: Email support with 48-hour response time
- **Premium**: Priority email support with 24-hour response
- **Enterprise**: Dedicated support with SLA guarantees

#### Enterprise Services
- **Custom Integration**: Tailored API integration assistance
- **Performance Optimization**: System tuning and scaling guidance
- **Training**: Team training and best practices workshops
- **Consulting**: Architecture and implementation consulting

### Contact Information
- **General Support**: support@wikisummaryapi.com
- **Enterprise Sales**: enterprise@wikisummaryapi.com  
- **Security Issues**: security@wikisummaryapi.com
- **Partnership**: partnerships@wikisummaryapi.com

## 📜 License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.

### Commercial Use
This project is free for commercial use under the MIT license. For enterprise support and additional features, contact our sales team.

## 🙏 Acknowledgments

### Technology Partners
- **GitHub AI**: For providing state-of-the-art AI models
- **Wikipedia**: For the incredible knowledge database
- **MongoDB**: For reliable and scalable data storage
- **Redis**: For high-performance caching solutions

### Open Source Community
- All contributors who have made this project possible
- The Node.js and JavaScript communities
- Testing and development tool maintainers
- Documentation and tutorial creators

### Special Thanks
- Beta testers who provided valuable feedback
- Security researchers who responsibly disclosed vulnerabilities  
- Community members who contributed feature ideas and improvements

---

<div align="center">

**[⬆ Back to Top](#-wikipedia-summary-generator-api)**

---

**Made with ❤️ by the Wikipedia Summary API Team**

[![GitHub Stars](https://img.shields.io/github/stars/yourusername/wikipedia-summary-generator?style=social)](https://github.com/yourusername/wikipedia-summary-generator)
[![Twitter Follow](https://img.shields.io/twitter/follow/wikisummaryapi?style=social)](https://twitter.com/wikisummaryapi)
[![Discord](https://img.shields.io/discord/123456789?style=social&logo=discord)](https://discord.gg/wikisummaryapi)

**[Website](https://wikisummaryapi.com) • [Documentation](https://docs.wikisummaryapi.com) • [API Status](https://status.wikisummaryapi.com) • [Blog](https://blog.wikisummaryapi.com)**

</div>
