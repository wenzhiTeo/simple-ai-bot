import { Sequelize } from "sequelize";
import config from "../src/config/index.js";
import PromptModel from "./models/prompt.js";
import MessageModel from "./models/message.js";
import ReminderModel from "./models/reminder.js";

const sequelize = new Sequelize({
    dialect: "sqlite",
    storage: config.DATABASE_PATH,
    logging: config.ENABLE_DEBUG_LOGS ? console.log : false
});

const Prompt = PromptModel(sequelize);
const Message = MessageModel(sequelize);
const Reminder = ReminderModel(sequelize);

async function initializeDatabase() {
    await sequelize.authenticate();
    // Creates missing tables; never drops or alters existing ones
    await sequelize.sync();
    await Prompt.seedDefaults();
    console.log("✅ Database ready");
}

export { sequelize, Prompt, Message, Reminder, initializeDatabase };
