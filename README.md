# Discord AI Bot

A Discord bot powered by Google Gemini AI with intelligent conversation, scheduled reminders, and web-based admin panel.

## 🎯 Key Features

- **🤖 AI Chat**: Natural conversations using Google Gemini
- **📷 Image Analysis**: Upload images for AI-powered analysis
- **⏰ Scheduled Reminders**: Set timed messages that auto-send
- **🛠️ Web Management**: Browser-based bot configuration

## 🚀 Quick Start

### Prerequisites
- Node.js (version 20 or higher)
- Discord Bot Token: [Get one here](https://discord.com/developers/applications)
- Google Gemini API Key: [Get one here](https://aistudio.google.com/apikey)

### Installation

1. **Clone and Install**
   ```bash
   git clone <repository-url>
   cd simple-ai-bot
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
   - Admin panel: `http://localhost:3000/admin` (local-only until `ADMIN_PASSWORD` is set)
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
/reset                   # Clear the bot's memory of this channel
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
- **🔄 Live Updates**: Prompt changes apply to the next message
- **💬 History & Reminders**: Browse stored conversations and pending reminders
- **⚙️ Database Management**: Browse and manage all stored data


## ⚙️ Configuration

### Environment Variables

| Variable                  | Description                                             | Required | Example              |
| ------------------------- | ------------------------------------------------------- | -------- | -------------------- |
| `GEMINI_API_KEY`          | Google Gemini API key                                   | ✅        | `AIzaSyC...`         |
| `DISCORD_TOKEN`           | Discord bot token (Discord starts only when set)        | ❌        | `MTIzNDU2Nzg5...`    |
| `MODEL_NAME`              | Gemini model                                            | ❌        | `gemini-2.5-flash`   |
| `HISTORY_LIMIT`           | Past messages sent to the model per conversation        | ❌        | `20`                 |
| `HISTORY_RETENTION_DAYS`  | Days to keep stored history (`0` = forever, default 30) | ❌        | `30`                 |
| `INIT_CHANNEL_ID`         | Startup notification channel                            | ❌        | `123456789012345678` |
| `BLACKLISTED_CHANNEL_IDS` | Ignored channels (comma-separated)                      | ❌        | `123,456,789`        |
| `ADMIN_PASSWORD`          | Password for `/admin`. Unset = local access only        | ❌        |                      |
| `TZ`                      | Timezone for `/remind` times                            | ❌        | `Asia/Singapore`     |

See `.env.example` for the full list.


## 🧱 Architecture

```
index.js                     wiring: database, AI, router, adapters, scheduler, web server
src/adapters/<platform>/     everything platform-specific (Discord today)
src/core/router.js           platform-independent message handling
src/core/conversationStore.js  chat history per conversation, stored in SQLite
src/services/                gemini.js (stateless AI client), reminder.js (DB-backed reminders)
src/server.js                Express: /health, /admin, platform webhooks
database/models/             Prompt, Message, Reminder
test/                        `npm test`
```

An adapter turns a platform event into a plain `IncomingMessage`
(`platform`, `conversationId`, `userId`, `text`, `images`, `reply()`) and passes it to
`router.handle()`. To add a platform, add a folder under `src/adapters/` that implements
`name`, `start(onMessage)`, `send(conversationId, text)` and `mention(userId)`, then register
it in `index.js`. Nothing in `core/` or `services/` needs to change.

Each conversation (one Discord channel, one WhatsApp chat) has its own history; the last
`HISTORY_LIMIT` messages are sent to the model. Reminders are stored in the database and
survive restarts.

## 🚢 Deployment

Step-by-step pm2 guide (Chinese): [docs/deploy-pm2-zh.md](docs/deploy-pm2-zh.md)

## 🛠️ Tech Stack

| Category      | Technology         | Purpose                     |
| ------------- | ------------------ | --------------------------- |
| **Bot**       | Discord.js         | Discord API integration     |
| **AI**        | Google Gemini  | Natural language processing |
| **Database**  | SQLite + Sequelize | Data storage                |
| **Admin**     | AdminJS            | Web management interface    |
| **Scheduler** | node-cron          | Reminder system             |
| **Server**    | Express.js         | Web service                 |


## 🌐 Language Support

- **English**: README.md (this file)
- **中文**: [README-zh.md](README-zh.md)
