
import { Router } from "express";
import { getTenantLedger } from "../controllers/ledgerController";

const router = Router();

router.get("/:tenantId", getTenantLedger);

export default router;
