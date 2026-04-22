#!/bin/bash

# API Testing Demo Script
# This script demonstrates how to run the API tests

echo "======================================================================"
echo "COS417 API Testing Guide"
echo "======================================================================"
echo ""

# Check if MongoDB is accessible
echo "1. Checking MongoDB connection..."
if [ -z "$MONGO_URI" ]; then
  echo "   ⚠️  MONGO_URI not set in environment"
  echo "   Please ensure .env file exists and contains MONGO_URI"
fi

# Check if .env exists
if [ ! -f ".env" ]; then
  echo ""
  echo "2. ❌ .env file not found!"
  echo "   Create a .env file in the project root with:"
  echo "   MONGO_URI=mongodb://user:password@host:port/dbname"
  exit 1
fi

echo "   ✓ .env file found"

# Option 1: Run with dev server
echo ""
echo "======================================================================"
echo "Option 1: Run tests with automatic server startup (RECOMMENDED)"
echo "======================================================================"
echo "Command: npm run test:api"
echo ""
echo "This will:"
echo "  1. Start the Nuxt dev server"
echo "  2. Wait 5 seconds for server to start"
echo "  3. Run the full test suite"
echo "  4. Stop the server"
echo ""

# Option 2: Run against existing server
echo "======================================================================"
echo "Option 2: Run tests against running server"
echo "======================================================================"
echo "Terminal 1: npm run dev"
echo "Terminal 2: npm run test:api:only"
echo ""
echo "This allows you to see server logs while tests run"
echo ""

# Option 3: Direct node command
echo "======================================================================"
echo "Option 3: Run tests directly with Node"
echo "======================================================================"
echo "Command: node scripts/test-api-endpoints.mjs"
echo ""
echo "Make sure dev server is running first!"
echo ""

# Show test configuration
echo "======================================================================"
echo "Test Configuration"
echo "======================================================================"
grep "^const TEST" scripts/test-api-endpoints.mjs | sed 's/^/  /'
echo ""

echo "======================================================================"
echo "To run tests now:"
echo "======================================================================"
echo ""
echo "If dev server is NOT running:"
echo "  $ npm run test:api"
echo ""
echo "If dev server IS already running:"
echo "  $ npm run test:api:only"
echo ""