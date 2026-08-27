import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import router from "./routes";
import { logger } from "./lib/logger";
import { globalLimiter, authLimiter, apiLimiter } from "./middlewares/rate-limit";
import { ipBlockMiddleware } from "./middlewares/ip-block";

declare module "express-session" {
  interface SessionData {
    userId?: number;
  }
}

const PgSession = connectPgSimple(session);

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return { id: req.id, method: req.method, url: req.url?.split("?")[0] };
      },
      res(res) {
        return { statusCode: res.statusCode };
      },
    },
  }),
);

app.set("trust proxy", 1);
// Reject blocked IPs / scanners before they consume rate-limit budget.
app.use(ipBlockMiddleware);
app.use(globalLimiter);
app.use("/api/auth", authLimiter);
app.use("/api", apiLimiter);
app.use(cors({ credentials: true, origin: true }));
app.use(
  express.json({
    // Keep the raw bytes so webhook handlers can verify HMAC signatures.
    verify: (req, _res, buf) => {
      (req as unknown as { rawBody?: Buffer }).rawBody = buf;
    },
  }),
);
app.use(express.urlencoded({ extended: true }));

app.use(
  session({
    store: new PgSession({
      conString: process.env.DATABASE_URL,
      tableName: "user_sessions",
      // The user_sessions table is provisioned by `db:push` (see
      // lib/db/src/schema/sessions.ts). createTableIfMissing is unreliable
      // against the bundled build, so keep it off.
      createTableIfMissing: false,
    }),
    secret: process.env.SESSION_SECRET ?? "guardix-dev-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    },
  }),
);

app.use("/api", router);

export default app;
