module.exports = {
  apps: [
    {
      name: "wolfxmonitor-api",
      script: "node",
      args: "--enable-source-maps artifacts/api-server/dist/index.mjs",
      cwd: "/var/www/wolfxmonitor",
      env: {
        NODE_ENV: "production",
        PORT: "8080",
      },
      env_file: "/var/www/wolfxmonitor/.env",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "512M",
      error_file: "/var/log/wolfxmonitor/error.log",
      out_file: "/var/log/wolfxmonitor/out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss",
    },
  ],
};
