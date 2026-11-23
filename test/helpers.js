import { Sequelize } from "sequelize";
import MessageModel from "../database/models/message.js";
import ReminderModel from "../database/models/reminder.js";
import BillModel from "../database/models/bill.js";
import SettingModel from "../database/models/setting.js";
import PromptModel from "../database/models/prompt.js";

/** Fresh in-memory database with the real models. */
export async function createTestDb() {
    const sequelize = new Sequelize({ dialect: "sqlite", storage: ":memory:", logging: false });
    const Message = MessageModel(sequelize);
    const Reminder = ReminderModel(sequelize);
    const Bill = BillModel(sequelize);
    const Setting = SettingModel(sequelize);
    const Prompt = PromptModel(sequelize);
    await sequelize.sync();
    return { sequelize, Message, Reminder, Bill, Setting, Prompt };
}

export const silentLogger = { error() {}, warn() {}, log() {} };
