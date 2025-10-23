import express from "express";
import AdminJS from "adminjs";
import AdminJSExpress from "@adminjs/express";
import * as AdminJSSequelize from "@adminjs/sequelize";
import createGeminiServicesRoute from "./routes/geminiServices.js";
import config from "./config/index.js";


const ADMIN_PORT = config.ADMIN_PORT

export default function expressStart(dbInstance, geminiService) {
    // Register AdminJS adapter
    AdminJS.registerAdapter(AdminJSSequelize);

    // Configure AdminJS
    const admin = new AdminJS({
        databases: [dbInstance],
        rootPath: "/admin",
        branding: {
            companyName: "Discord Gemini Bot",
            logo: false,
            softwareBrothers: false,
        }
    });

    const app = express();

    // Basic middleware
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));

    // Health check
    app.get('/health', (req, res) => {
        res.json({ status: 'healthy', uptime: process.uptime() });
    });

    // API routes
    app.use("/ai-api", createGeminiServicesRoute(geminiService));

    // Admin panel
    const adminRouter = AdminJSExpress.buildRouter(admin);
    app.use(admin.options.rootPath, adminRouter);

    // Start server
    app.listen(ADMIN_PORT, () => {
        console.log(`✅ Express server running on port ${ADMIN_PORT}`);
        console.log(`📊 Admin: http://localhost:${ADMIN_PORT}/admin`);
    });
}
