# Database Structure

Simple SQLite database setup for the Discord Gemini Bot.

## Files

- `index.js` - Main database initialization and model exports
- `models/` - Prompt, Message and Reminder models

## Models

### Prompt (`prompts`)
System prompts. The one with `is_active = true` is read on every message, so edits in the
admin panel apply immediately.

### Message (`messages`)
Chat history. `conversationKey` is `<platform>:<conversationId>`, `role` is `user` or `model`.

### Reminder (`reminders`)
Pending reminders: `platform`, `conversationId`, `userId`, `text`, `dueAt`. Deleted once sent.

## Usage

```javascript
import { Prompt, initializeDatabase } from './database/index.js';

// Initialize database
await initializeDatabase();

// Get active prompt
const activePrompt = await Prompt.getActive();

// Create new prompt
const newPrompt = await Prompt.create({
    title: "My Prompt",
    content: "Prompt content here"
});

// Activate a prompt
await newPrompt.activate();
```

## Default Data

The database automatically seeds with:
1. "小云雀来海 个性" - Custom personality prompt (active by default)
2. "专业助手" - Professional assistant prompt (inactive)
