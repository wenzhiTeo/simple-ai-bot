import { DataTypes } from "sequelize";

/** A bill that was confirmed and sent. See src/skills/bills. */
export default (sequelize) =>
    sequelize.define("Bill", {
        id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
        platform: { type: DataTypes.STRING, allowNull: false },
        year: { type: DataTypes.INTEGER, allowNull: false },
        month: { type: DataTypes.INTEGER, allowNull: false },
        // [{ name: "电费", cents: 2560 }, …] (full amounts, before splitting)
        items: { type: DataTypes.JSON, allowNull: false },
        people: { type: DataTypes.INTEGER, allowNull: false },
        // Each person's total, in cents
        totalCents: { type: DataTypes.INTEGER, allowNull: false },
        recipient: { type: DataTypes.STRING, allowNull: false },
        // The exact message that was sent
        text: { type: DataTypes.TEXT, allowNull: false },
    }, {
        tableName: "bills",
        timestamps: true,
        updatedAt: false,
    });
