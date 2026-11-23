import { DataTypes } from "sequelize";

/**
 * Model settings that can be changed in the admin panel without a restart.
 * There is exactly one row (id 1). It is created on first start from the .env values;
 * after that the row wins and the matching .env values are no longer read.
 */
export default (sequelize) => {
    const Setting = sequelize.define("Setting", {
        id: { type: DataTypes.INTEGER, primaryKey: true },
        model_name: {
            type: DataTypes.STRING,
            allowNull: false,
            validate: { notEmpty: true },
            set(value) {
                this.setDataValue("model_name", typeof value === "string" ? value.trim() : value);
            },
        },
        temperature: {
            type: DataTypes.FLOAT,
            allowNull: false,
            defaultValue: 0.9,
            validate: { min: 0, max: 2 },
        },
        max_output_tokens: {
            type: DataTypes.INTEGER,
            allowNull: false,
            validate: { min: 1, max: 65536 },
        },
        history_limit: {
            type: DataTypes.INTEGER,
            allowNull: false,
            validate: { min: 0, max: 200 },
        },
    }, {
        tableName: "settings",
        timestamps: true,
        createdAt: false,
    });

    /** Create the settings row from `defaults` unless it already exists. */
    Setting.seedDefaults = async function ({ model, temperature = 0.9, maxOutputTokens, historyLimit }) {
        await this.findOrCreate({
            where: { id: 1 },
            defaults: {
                model_name: model,
                temperature,
                max_output_tokens: maxOutputTokens,
                history_limit: historyLimit,
            },
        });
    };

    /**
     * Current settings in the shape the services use.
     * @returns {Promise<{model: string, temperature: number, maxOutputTokens: number, historyLimit: number} | null>}
     */
    Setting.current = async function () {
        const row = await this.findByPk(1);
        if (!row) return null;
        return {
            model: row.model_name,
            temperature: row.temperature,
            maxOutputTokens: row.max_output_tokens,
            historyLimit: row.history_limit,
        };
    };

    return Setting;
};
