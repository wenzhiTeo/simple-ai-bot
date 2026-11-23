import { Sequelize } from "sequelize";
import config from "../src/config/index.js";
import PromptModel from "./models/prompt.js";
import MessageModel from "./models/message.js";
import ReminderModel from "./models/reminder.js";
import BillModel from "./models/bill.js";
import SettingModel from "./models/setting.js";

const sequelize = new Sequelize({
    dialect: "sqlite",
    storage: config.DATABASE_PATH,
    logging: config.ENABLE_DEBUG_LOGS ? console.log : false
});

const Prompt = PromptModel(sequelize);
const Message = MessageModel(sequelize);
const Reminder = ReminderModel(sequelize);
const Bill = BillModel(sequelize);
const Setting = SettingModel(sequelize);

async function initializeDatabase() {
    await sequelize.authenticate();
    // Creates missing tables; never drops or alters existing ones
    await sequelize.sync();
    await Prompt.seedDefaults();
    // First start only: copy the .env model settings into the database, editable in /admin from then on
    await Setting.seedDefaults({
        model: config.MODEL_NAME,
        maxOutputTokens: config.MAX_OUTPUT_TOKENS,
        historyLimit: config.HISTORY_LIMIT,
    });
    console.log("✅ Database ready");
}

export { sequelize, Prompt, Message, Reminder, Bill, Setting, initializeDatabase };
