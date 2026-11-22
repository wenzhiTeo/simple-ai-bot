// src/commands/index.js
import { pingCommand } from './ping.js';
import { remindCommand } from './remind.js';
import { helpCommand } from './help.js';
import { remindersCommand } from './reminders.js';
import { clearRemindersCommand } from './clear-reminders.js';
import { resetCommand } from './reset.js';

export const commands = [
    pingCommand,
    remindCommand,
    helpCommand,
    remindersCommand,
    clearRemindersCommand,
    resetCommand
];

export const commandMap = new Map(
    commands.map(cmd => [cmd.data.name, cmd])
);