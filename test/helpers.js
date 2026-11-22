import { Sequelize } from "sequelize";
import MessageModel from "../database/models/message.js";
import ReminderModel from "../database/models/reminder.js";

/** Fresh in-memory database with the real models. */
export async function createTestDb() {
    const sequelize = new Sequelize({ dialect: "sqlite", storage: ":memory:", logging: false });
    const Message = MessageModel(sequelize);
    const Reminder = ReminderModel(sequelize);
    await sequelize.sync();
    return { sequelize, Message, Reminder };
}

export const silentLogger = { error() {}, warn() {}, log() {} };
