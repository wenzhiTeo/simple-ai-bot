# Discord AI Bot

A Discord bot powered by Google Gemini AI with intelligent conversation, scheduled reminders, and web-based admin panel.

## 🎯 Key Features

- **🤖 AI Chat**: Natural conversations using Google Gemini 2.0
- **📷 Image Analysis**: Upload images for AI-powered analysis
- **⏰ Scheduled Reminders**: Set timed messages that auto-send
- **🛠️ Web Management**: Browser-based bot configuration

## 🚀 Quick Start

### Prerequisites
- Node.js (version 18 or higher)
- Discord Bot Token: [Get one here](https://discord.com/developers/applications)
- Google Gemini API Key: [Get one here](https://makersuite.google.com/app/apikey)

### Installation

1. **Clone and Install**
   ```bash
   git clone <repository-url>
   cd discord-gemini-bot
   npm install
   ```

2. **Environment Setup**
   Create `.env` file:
   ```env
   DISCORD_TOKEN=your_discord_bot_token
   GEMINI_API_KEY=your_gemini_api_key
   INIT_CHANNEL_ID=startup_notification_channel_id_optional
   BLACKLISTED_CHANNEL_IDS=channel1,channel2,channel3_optional
   ```

3. **Discord Bot Permissions**
   
   In Discord Developer Portal, ensure your bot has:
   - Send Messages
   - Read Message History
   - Use Slash Commands
   - Mention Everyone
   - Attach Files
   
   Enable these intents:
   - Message Content Intent
   - Guild Members Intent

4. **Start the Bot**
   ```bash
   npm start
   ```
   
   **Available URLs:**
   - Admin panel: `http://localhost:3000/admin`
   - Health check: `http://localhost:3000/health`

## 📖 Usage

### Basic Discord UseCase

#### 💬 Chat with AI
```
@YourBot Hello! How are you today?
@YourBot [upload image] What do you see in this picture?
```

#### 🔧 Slash Commands
```
/help                    # Show all available commands
/ping                    # Check bot latency and status
/remind                  # Set a reminder for specific time
/reminders               # List all your active reminders
/clear-reminders         # Clear all your active reminders
```

#### ⏰ Set Reminders
Use the `/remind` command with time in HHMM format:
```
/remind time:1430 message:Team meeting reminder
/remind time:0900 message:Take medication
/remind time:2000 message:Call mom
```

### Admin Panel

Visit `http://localhost:3000/admin` to:

- **📝 Manage Prompts**: Create and edit AI personality styles
- **🔄 Live Updates**: Prompt changes reload AI service automatically
- **📊 Usage Statistics**: View prompt usage counts and activity
- **⚙️ Database Management**: Browse and manage all stored data


## ⚙️ Configuration

### Environment Variables

| Variable                  | Description                        | Required | Example              |
| ------------------------- | ---------------------------------- | -------- | -------------------- |
| `DISCORD_TOKEN`           | Discord bot token                  | ✅        | `MTIzNDU2Nzg5...`    |
| `GEMINI_API_KEY`          | Google Gemini API key              | ✅        | `AIzaSyC...`         |
| `INIT_CHANNEL_ID`         | Startup notification channel       | ❌        | `123456789012345678` |
| `BLACKLISTED_CHANNEL_IDS` | Ignored channels (comma-separated) | ❌        | `123,456,789`        |


## 🛠️ Tech Stack

| Category      | Technology         | Purpose                     |
| ------------- | ------------------ | --------------------------- |
| **Bot**       | Discord.js         | Discord API integration     |
| **AI**        | Google Gemini 2.0  | Natural language processing |
| **Database**  | SQLite + Sequelize | Data storage                |
| **Admin**     | AdminJS            | Web management interface    |
| **Scheduler** | node-cron          | Reminder system             |
| **Server**    | Express.js         | Web service                 |


## 🌐 Language Support

- **English**: README.md (this file)
- **中文**: [README-zh.md](README-zh.md)
