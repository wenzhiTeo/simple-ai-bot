import { timingSafeEqual } from "node:crypto";
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

/**
 * @param {import("sequelize").Sequelize} dbInstance
 * @param {{path: string, router: express.Router}[]} [routes] extra routers, e.g. platform webhooks
 */
export default function startServer(dbInstance, routes = []) {
    AdminJS.registerAdapter(AdminJSSequelize);

    const admin = new AdminJS({
        databases: [dbInstance],
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

    app.use(
        admin.options.rootPath,
        adminGuard({ user: config.ADMIN_USER, password: config.ADMIN_PASSWORD }),
        AdminJSExpress.buildRouter(admin)
    );

    app.listen(config.ADMIN_PORT, () => {
        console.log(`✅ Express server running on port ${config.ADMIN_PORT}`);
        console.log(`📊 Admin: http://localhost:${config.ADMIN_PORT}/admin` +
            (config.ADMIN_PASSWORD ? "" : " (local-only, set ADMIN_PASSWORD for remote access)"));
    });
}
