import { DataTypes } from "sequelize";

/** One turn of chat history. See src/core/conversationStore.js. */
export default (sequelize) =>
    sequelize.define("Message", {
        id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
        // "<platform>:<conversationId>", e.g. "discord:1234567890"
        conversationKey: { type: DataTypes.STRING, allowNull: false },
        role: { type: DataTypes.ENUM("user", "model"), allowNull: false },
        text: { type: DataTypes.TEXT, allowNull: false },
    }, {
        tableName: "messages",
        timestamps: true,
        updatedAt: false,
        indexes: [{ fields: ["conversationKey", "id"] }],
    });
