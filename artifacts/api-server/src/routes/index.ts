import { Router, type IRouter } from "express";
import healthRouter from "./health";
import monitorsRouter from "./monitors";

const router: IRouter = Router();

router.use(healthRouter);
router.use(monitorsRouter);

export default router;
