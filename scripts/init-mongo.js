// MongoDB initialization script for Docker
// This script runs when the MongoDB container starts for the first time

db = db.getSiblingDB('wikipedia-summary');

// Create indexes for better performance
db.users.createIndex({ "email": 1 }, { unique: true });
db.users.createIndex({ "apiKey": 1 }, { unique: true, sparse: true });
db.users.createIndex({ "subscription.stripeCustomerId": 1 }, { sparse: true });
db.users.createIndex({ "role": 1, "status": 1 });
db.users.createIndex({ "createdAt": 1 });

db.apicalls.createIndex({ "user": 1, "timestamp": -1 });
db.apicalls.createIndex({ "endpoint": 1, "timestamp": -1 });
db.apicalls.createIndex({ "responseStatus": 1, "timestamp": -1 });
db.apicalls.createIndex({ "timestamp": -1 });

db.pricings.createIndex({ "plan": 1 }, { unique: true });
db.pricings.createIndex({ "isActive": 1, "isVisible": 1 });
db.pricings.createIndex({ "sortOrder": 1 });

// Create a collection for migrations tracking
db.createCollection("migrations");
db.migrations.createIndex({ "version": 1 }, { unique: true });

print('Database initialization completed');
