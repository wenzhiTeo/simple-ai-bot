# Discord AI Bot

A Discord bot powered by Google Gemini AI with intelligent conversation, scheduled reminders, and web-based admin panel.

## 🎯 Key Features

- **🤖 AI Chat**: Natural conversations using Google Gemini
- **📷 Image Analysis**: Upload images for AI-powered analysis
- **💸 Utility Bills (WhatsApp)**: Split monthly bills from text or bill photos and send the result to a contact
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
   - Status page: `http://localhost:3000/status` (same access rule as the admin panel)
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
/status                  # Bot & server status, only you see it (server managers only)
```

#### ⏰ Set Reminders
Use the `/remind` command with time in HHMM format:
```
/remind time:1430 message:Team meeting reminder
/remind time:0900 message:Take medication
/remind time:2000 message:Call mom
```

### WhatsApp: utility bills

The bot links to your own WhatsApp number as a device (like WhatsApp Web) and only
listens to your **"Message yourself"** chat. It never reacts to anyone else's messages.
Its replies there start with 🤖.

```
水电费 9月 wifi 100 水 6.50 电 25.6
```

You can also send photos or PDFs of the bills with the caption `水电费`; Gemini reads the
amounts and the code does the maths. You get a draft first:

```
水电费
2026 年 9 月
Wi-Fi = 100.00 / 2 = 50.00
水费 = 6.50 / 2 = 3.25
电费 = 25.60 / 2 = 12.80
总计 RM66.05
```

While the draft is open: `电 25.60` changes a line, `删 电` removes one, more photos add
lines, `确认` sends it to `BILL_RECIPIENT`, `取消` drops it. Drafts expire after 6 hours.
Anything else is normal AI chat. Sent bills are stored in the `bills` table.

> Uses [Baileys](https://github.com/WhiskeySockets/Baileys), an unofficial WhatsApp Web
> client. This is against WhatsApp's terms and the number could be banned; keep usage
> personal and low-volume. Bill photos are sent to Gemini.

### Admin Panel

Visit `http://localhost:3000/admin` to:

- **📝 Manage Prompts**: Create and edit AI personality styles
- **🎛️ Model Settings**: Change the Gemini model, temperature, reply length and memory size under *Settings*
- **🔄 Live Updates**: Prompt and settings changes apply to the next message, no restart
- **💬 History & Reminders**: Browse stored conversations and pending reminders
- **⚙️ Database Management**: Browse and manage all stored data

### Status Page

`http://localhost:3000/status` shows at a glance whether everything is fine: platform
connections, current model and personality, failed replies since start (with the last
error message), server memory / swap / disk / load, the bot's own memory, and stored data.
Problems are listed at the top. It refreshes every 30 seconds and is protected like `/admin`.

On your phone, use the Discord `/status` command instead: the same checks in a compact
embed, visible only to you. By default only members who can manage the server see the
command (change it under Server Settings → Integrations).


## ⚙️ Configuration

### Environment Variables

| Variable                  | Description                                             | Required | Example              |
| ------------------------- | ------------------------------------------------------- | -------- | -------------------- |
| `GEMINI_API_KEY`          | Google Gemini API key                                   | ✅        | `AIzaSyC...`         |
| `DISCORD_TOKEN`           | Discord bot token (Discord starts only when set)        | ❌        | `MTIzNDU2Nzg5...`    |
| `MODEL_NAME`              | Gemini model ¹                                          | ❌        | `gemini-2.5-flash`   |
| `MAX_OUTPUT_TOKENS`       | Longest reply, in tokens ¹                              | ❌        | `4096`               |
| `HISTORY_LIMIT`           | Past messages sent to the model per conversation ¹      | ❌        | `20`                 |
| `HISTORY_RETENTION_DAYS`  | Days to keep stored history (`0` = forever, default 30) | ❌        | `30`                 |
| `INIT_CHANNEL_ID`         | Startup notification channel                            | ❌        | `123456789012345678` |
| `BLACKLISTED_CHANNEL_IDS` | Ignored channels (comma-separated)                      | ❌        | `123,456,789`        |
| `WHATSAPP_PHONE`          | Your WhatsApp number (digits, with country code). WhatsApp starts only when set | ❌ | `60123456789` |
| `BILL_RECIPIENT`          | Who receives confirmed bills (digits, with country code) | ❌        | `60198765432`        |
| `BILL_SPLIT`              | How many people share the bills (default 2)             | ❌        | `2`                  |
| `ADMIN_PASSWORD`          | Password for `/admin`. Unset = local access only        | ❌        |                      |
| `TZ`                      | Timezone for `/remind` times                            | ❌        | `Asia/Singapore`     |

¹ Only read on the first start, to fill the *Settings* table. After that, change them in the admin panel (*Settings*); editing `.env` has no effect.

See `.env.example` for the full list.


## 🧱 Architecture

```
index.js                     wiring: database, AI, router, adapters, scheduler, web server
src/adapters/<platform>/     everything platform-specific (discord, whatsapp)
src/skills/                  features that run before AI chat (bills)
src/core/router.js           platform-independent message handling
src/core/conversationStore.js  chat history per conversation, stored in SQLite
src/services/                gemini.js (stateless AI client), reminder.js (DB-backed reminders)
src/server.js                Express: /health, /status, /admin, platform webhooks
src/web/status.html          the status page (no build step)
database/models/             Prompt, Message, Reminder, Bill, Setting
test/                        `npm test`
```

An adapter turns a platform event into a plain `IncomingMessage`
(`platform`, `conversationId`, `userId`, `text`, `images`, `reply()`) and passes it to
`router.handle()`. To add a platform, add a folder under `src/adapters/` that implements
`name`, `start(onMessage)`, `send(conversationId, text)` and `mention(userId)`, then register
it in `index.js`. Nothing in `core/` or `services/` needs to change.

Each conversation (one Discord channel, one WhatsApp chat) has its own history; the last
`history_limit` messages (admin panel → *Settings*) are sent to the model. Reminders are stored in the database and
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
