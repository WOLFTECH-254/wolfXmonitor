import { Router, type IRouter } from "express";
import healthRouter from "./health";
import monitorsRouter from "./monitors";
import authRouter from "./auth";
import oauthRouter from "./oauth";
import adminRouter from "./admin";
import paymentsRouter from "./payments";
import statusRouter from "./status";
import incidentsRouter from "./incidents";
import securityRouter from "./security";

const router: IRouter = Router();

router.use(authRouter);
router.use(oauthRouter);
router.use(healthRouter);
router.use(monitorsRouter);
router.use(adminRouter);
router.use(paymentsRouter);
router.use(statusRouter);
router.use(incidentsRouter);
router.use(securityRouter);

export default router;
