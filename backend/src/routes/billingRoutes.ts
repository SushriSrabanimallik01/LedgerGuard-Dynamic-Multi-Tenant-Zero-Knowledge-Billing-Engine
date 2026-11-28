
import { Router } from "express";
import { handlePayment } from "../controllers/BillingController";

const router = Router();

// Process a new payment
router.post("/payment", handlePayment);

export default router;
