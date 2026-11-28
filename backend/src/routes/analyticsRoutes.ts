
import { Router } from "express";
import { getUsageAnalytics } from "../controllers/analyticsController";

const router = Router();

router.get("/:tenantId", getUsageAnalytics);

export default router;
