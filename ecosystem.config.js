module.exports = {
  apps: [
    {
      name: "ota-dashboard",
      script: "node_modules/.bin/next",
      args: "start",
      cwd: "./",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "512M",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
        // OTA_DB_PATH: "/absolute/path/to/ota.db"  ← set this on the server
      },
    },
  ],
};
