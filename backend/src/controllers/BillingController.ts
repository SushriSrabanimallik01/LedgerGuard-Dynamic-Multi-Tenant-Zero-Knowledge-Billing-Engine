import { Request, Response } from "express";
import { processPayment } from "../services/BillingService";

export async function handlePayment(req: Request, res: Response): Promise<void> {
  try {
    const { tenantId, amount, transactionId } = req.body;

    if (!tenantId || !amount || !transactionId) {
      res.status(400).json({ error: "Missing required fields" });
      return;
    }

    const record = await processPayment(tenantId, amount, transactionId);

    res.status(200).json({
      message: "Payment processed successfully",
      data: record,
    });
  } catch (error) {
    console.error("Payment Error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}