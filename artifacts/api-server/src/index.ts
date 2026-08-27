import "./env";
import app from "./app";
import { logger } from "./lib/logger";
import { startBackgroundJobs } from "./lib/scheduler";
import { seedPlans, migrateExistingUsers } from "./lib/plans";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, async (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");

  try {
    await seedPlans();
    await migrateExistingUsers();
  } catch (err) {
    logger.error({ err }, "Plan seed/migration failed");
  }

  try {
    await startBackgroundJobs();
  } catch (err) {
    logger.error({ err }, "Failed to start background jobs");
  }
});
