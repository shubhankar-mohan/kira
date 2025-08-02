#!/bin/bash

# Kira Task Manager - Slack Integration Setup Script
# Created by Shubhankar Mohan for KiranaClub

echo "🤖 Kira Task Manager - Slack Integration Setup"
echo "=============================================="
echo

# Check if .env file exists
if [ ! -f "backend/.env" ]; then
    echo "📝 Creating .env file from template..."
    cp backend/.env.example backend/.env
    echo "✅ .env file created. Please edit it with your credentials."
    echo
fi

# Install dependencies
echo "📦 Installing Slack integration dependencies..."
cd backend
npm install @slack/bolt @slack/web-api express-rate-limit node-cron crypto axios
echo "✅ Dependencies installed successfully"
echo

# Check environment variables
echo "🔍 Checking Slack configuration..."
source .env

missing_vars=()

if [ -z "$SLACK_BOT_TOKEN" ] || [ "$SLACK_BOT_TOKEN" = "xoxb-your-slack-bot-token-here" ]; then
    missing_vars+=("SLACK_BOT_TOKEN")
fi

if [ -z "$SLACK_SIGNING_SECRET" ] || [ "$SLACK_SIGNING_SECRET" = "your_slack_signing_secret_here" ]; then
    missing_vars+=("SLACK_SIGNING_SECRET")
fi

if [ ${#missing_vars[@]} -eq 0 ]; then
    echo "✅ All required Slack environment variables are configured"
else
    echo "❌ Missing or placeholder Slack environment variables:"
    for var in "${missing_vars[@]}"; do
        echo "   - $var"
    done
    echo
    echo "Please update these variables in backend/.env before proceeding."
fi

echo
echo "🔧 Slack App Setup Instructions:"
echo "1. Visit https://api.slack.com/apps"
echo "2. Click 'Create New App' > 'From an app manifest'"
echo "3. Select your workspace"
echo "4. Copy and paste the content from slack-app-manifest.yaml"
echo "5. Update the URLs in the manifest to your actual domain"
echo "6. Install the app to your workspace"
echo "7. Copy the Bot User OAuth Token to SLACK_BOT_TOKEN in .env"
echo "8. Copy the Signing Secret to SLACK_SIGNING_SECRET in .env"
echo

echo "📋 Required Slack Channels:"
echo "Create these channels in your Slack workspace (or update channel names in .env):"
echo "  - #general (notifications)"
echo "  - #alerts (blocked tasks, urgent issues)"
echo "  - #standup (daily standup reports)"
echo "  - #development (code review reminders)"
echo "  - #releases (release planning)"
echo "  - #sprint-reports (weekly summaries)"
echo

echo "🚀 Testing the Integration:"
echo "1. Start the backend server: npm run dev"
echo "2. In Slack, try: @kira help"
echo "3. Test slash commands: /kira help"
echo "4. Create a test task: @kira Test task @yourusername P2"
echo

echo "⚙️  Advanced Features:"
echo "- Automatic daily standup reports at 9 AM"
echo "- Sprint health monitoring twice daily"
echo "- Code review reminders on Tue/Thu"
echo "- Weekly sprint summaries on Fridays"
echo "- Set SLACK_ENABLE_SCHEDULED_REPORTS=true to enable"
echo

if [ ${#missing_vars[@]} -eq 0 ]; then
    echo "🎉 Setup appears complete! Your Slack integration should be ready to use."
else
    echo "⚠️  Please complete the missing configuration before testing."
fi

echo
echo "📚 For detailed documentation, see the implementation guide."
echo "🐛 For troubleshooting, check the server logs and /api/slack/health endpoint."
echo
echo "Happy task managing! 🏪✨"