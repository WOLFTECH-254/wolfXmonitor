import { Router, type IRouter } from "express";
import healthRouter from "./health";
import monitorsRouter from "./monitors";
import authRouter from "./auth";
import adminRouter from "./admin";

const router: IRouter = Router();

router.use(authRouter);
router.use(healthRouter);
router.use(monitorsRouter);
router.use(adminRouter);

export default router;
