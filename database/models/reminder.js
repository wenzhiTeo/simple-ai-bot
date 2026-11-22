import { DataTypes } from "sequelize";

/** A pending reminder. See src/services/reminder.js. */
export default (sequelize) =>
    sequelize.define("Reminder", {
        id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
        platform: { type: DataTypes.STRING, allowNull: false },
        conversationId: { type: DataTypes.STRING, allowNull: false },
        userId: { type: DataTypes.STRING, allowNull: false },
        text: { type: DataTypes.TEXT, allowNull: false },
        dueAt: { type: DataTypes.DATE, allowNull: false },
    }, {
        tableName: "reminders",
        timestamps: true,
        updatedAt: false,
        indexes: [{ fields: ["dueAt"] }, { fields: ["platform", "userId"] }],
    });
