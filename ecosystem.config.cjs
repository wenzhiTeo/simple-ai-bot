// pm2 process definition. Usage: see docs/deploy-pm2-zh.md
//   pm2 start ecosystem.config.cjs
// (.cjs because package.json sets "type": "module" and pm2 loads this file with require)
module.exports = {
    apps: [
        {
            name: "ai-bot",
            script: "index.js",
            cwd: __dirname,

            // Must stay a single process: SQLite allows one writer, and a second
            // Discord connection would answer every message twice.
            instances: 1,
            exec_mode: "fork",

            env: {
                NODE_ENV: "production",
            },

            // Restart on crash, waiting longer after each failure (100ms, 150ms, … up to 15s)
            autorestart: true,
            exp_backoff_restart_delay: 100,
            // Restart if memory grows past this (the app idles around 200-250 MB)
            max_memory_restart: "600M",
            // Give in-flight replies a moment before a restart kills the process
            kill_timeout: 5000,

            // Prefix every log line with a timestamp
            time: true,
        },
    ],
};
