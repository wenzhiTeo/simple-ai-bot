import { timingSafeEqual } from "node:crypto";
import { fileURLToPath } from "node:url";
import express from "express";
import AdminJS from "adminjs";
import AdminJSExpress from "@adminjs/express";
import * as AdminJSSequelize from "@adminjs/sequelize";
import config from "./config/index.js";

const safeEqual = (a, b) => {
    const left = Buffer.from(a);
    const right = Buffer.from(b);
    return left.length === right.length && timingSafeEqual(left, right);
};

/**
 * Protects the admin panel.
 * - ADMIN_PASSWORD set: HTTP Basic auth.
 * - not set: only direct requests from this machine (anything that came through
 *   a tunnel or reverse proxy carries a forwarding header and is rejected).
 */
export function adminGuard({ user, password }) {
    return (req, res, next) => {
        if (password) {
            const header = req.headers.authorization ?? "";
            const [scheme, encoded] = header.split(" ");
            const [name, ...rest] = Buffer.from(encoded ?? "", "base64").toString().split(":");
            if (scheme === "Basic" && safeEqual(name, user) && safeEqual(rest.join(":"), password)) {
                return next();
            }
            res.set("WWW-Authenticate", 'Basic realm="admin"');
            return res.status(401).send("Authentication required");
        }

        const address = req.socket.remoteAddress ?? "";
        const isLocal = ["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(address);
        const isForwarded = req.headers["x-forwarded-for"] || req.headers.forwarded;
        if (isLocal && !isForwarded) return next();
        return res.status(403).send("Admin panel is local-only. Set ADMIN_PASSWORD to enable remote access.");
    };
}

const STATUS_PAGE = fileURLToPath(new URL("./web/status.html", import.meta.url));

/**
 * GET /status (the page) and GET /status.json (what it polls), both behind `guard`.
 * @param {{ getStatus: () => Promise<object>, guard: express.RequestHandler }} options
 */
export function statusRoutes({ getStatus, guard }) {
    const router = express.Router();
    router.get("/status", guard, (req, res) => res.sendFile(STATUS_PAGE));
    router.get("/status.json", guard, async (req, res, next) => {
        try {
            res.set("Cache-Control", "no-store").json(await getStatus());
        } catch (error) {
            next(error);
        }
    });
    return router;
}

const noAccess = { isAccessible: false };

/**
 * Admin page for the single settings row: edit only, no create/delete, Chinese field help.
 * @param {import("sequelize").ModelStatic<any>} Setting
 */
export function settingResource(Setting) {
    return {
        resource: Setting,
        options: {
            navigation: { name: "配置", icon: "Settings" },
            actions: { new: noAccess, delete: noAccess, bulkDelete: noAccess },
            listProperties: ["model_name", "temperature", "max_output_tokens", "history_limit", "updatedAt"],
            editProperties: ["model_name", "temperature", "max_output_tokens", "history_limit"],
            properties: {
                model_name: {
                    description: "Gemini 模型名，例如 gemini-2.5-flash、gemini-2.5-pro。填错了机器人会回复出错消息，看日志里的报错。",
                },
                temperature: {
                    description: "0 到 2。越高回答越随机、越有个性；越低越稳定。默认 0.9。",
                },
                max_output_tokens: {
                    description: "单条回复最多的 token 数（1 到 65536）。回复经常被截断就调大。",
                },
                history_limit: {
                    description: "每次带给模型的历史消息条数（0 到 200，一问一答算 2 条）。0 = 不带记忆。越大越费 token。",
                },
                updatedAt: { isVisible: { list: true, show: true, edit: false, filter: false } },
            },
        },
    };
}

/**
 * @param {import("sequelize").Sequelize} dbInstance
 * @param {object} [options]
 * @param {{path: string, router: express.Router}[]} [options.routes] extra routers, e.g. platform webhooks
 * @param {import("sequelize").ModelStatic<any>} [options.Setting] gets a customised admin page
 * @param {() => Promise<object>} [options.getStatus] enables the /status page
 */
export default function startServer(dbInstance, { routes = [], Setting, getStatus } = {}) {
    AdminJS.registerAdapter(AdminJSSequelize);

    const admin = new AdminJS({
        databases: [dbInstance],
        // Resources listed here replace the plain version AdminJS builds from the database
        resources: Setting ? [settingResource(Setting)] : [],
        rootPath: "/admin",
        branding: {
            companyName: "AI Bot",
            logo: false,
            withMadeWithLove: false,
        }
    });

    const app = express();

    app.get("/health", (req, res) => {
        res.json({ status: "healthy", uptime: process.uptime() });
    });

    // Webhook routers are mounted before any body parser so they can verify raw-body signatures
    for (const { path, router } of routes) app.use(path, router);

    const guard = adminGuard({ user: config.ADMIN_USER, password: config.ADMIN_PASSWORD });
    if (getStatus) app.use(statusRoutes({ getStatus, guard }));
    app.use(admin.options.rootPath, guard, AdminJSExpress.buildRouter(admin));

    app.listen(config.ADMIN_PORT, () => {
        console.log(`✅ Express server running on port ${config.ADMIN_PORT}`);
        const access = config.ADMIN_PASSWORD ? "" : " (local-only, set ADMIN_PASSWORD for remote access)";
        console.log(`📊 Admin: http://localhost:${config.ADMIN_PORT}/admin${access}`);
        if (getStatus) console.log(`🩺 Status: http://localhost:${config.ADMIN_PORT}/status${access}`);
    });
}
