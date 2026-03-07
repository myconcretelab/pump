#!/bin/bash

# Pump Setup Script
# Initializes the monorepo and creates necessary directories

echo "🚀 Setting up Pump..."

# Create data directories
mkdir -p data/configs
mkdir -p data/sessions
mkdir -p data/logs

echo "✓ Created data directories"

# Install dependencies
echo ""
echo "📦 Installing dependencies..."
npm run install-all

echo ""
echo "✅ Setup complete!"
echo ""
echo "🎯 Next steps:"
echo "   1. Open two terminals"
echo "   2. Terminal 1: npm run dev:backend"
echo "   3. Terminal 2: npm run dev:frontend"
echo "   4. Visit: http://localhost:3000"
echo ""
echo "📚 For more info, see QUICKSTART.md or README.md"
