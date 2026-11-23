import { Router } from "express";
import { handlePayment } from "../controllers/BillingController";

const router = Router();

router.post("/pay", handlePayment);

export default router;