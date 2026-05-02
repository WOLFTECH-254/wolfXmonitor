import { Router, type IRouter } from "express";
import healthRouter from "./health";
import monitorsRouter from "./monitors";
import authRouter from "./auth";
import adminRouter from "./admin";
import paymentsRouter from "./payments";
import statusRouter from "./status";

const router: IRouter = Router();

router.use(authRouter);
router.use(healthRouter);
router.use(monitorsRouter);
router.use(adminRouter);
router.use(paymentsRouter);
router.use(statusRouter);

export default router;
