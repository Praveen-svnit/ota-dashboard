module.exports = {
  apps: [
    {
      name: "ota-dashboard",
      script: "node_modules/next/dist/bin/next",
      args: "start",
      cwd: "./",
      exec_mode: "fork",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "512M",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
      },
    },
    {
      name: "ota-auto-sync",
      script: "scripts/auto-sync.js",
      cwd: "./",
      exec_mode: "fork",
      instances: 1,
      autorestart: true,
      watch: false,
      // Waits 30s after startup, then syncs inventory + OTA listings every hour.
      // APP_URL must match the port the Next.js server is running on.
      env: {
        NODE_ENV: "production",
        APP_URL: "http://localhost:3000",
      },
    },
  ],
};
