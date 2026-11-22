import { Request, Response } from "express";
import LedgerEntry from "../models/LedgerEntry";

export async function getTenantLedger(req: Request, res: Response): Promise<void> {
  try {
    const tenantId = req.params.tenantId;

    if (!tenantId) {
      res.status(400).json({ error: "Tenant ID is required" });
      return;
    }

    const entries = await LedgerEntry.find({ tenantId }).sort({ createdAt: -1 });

    res.status(200).json({
      message: "Ledger retrieved successfully",
      data: entries
    });
  } catch (error) {
    console.error("Ledger Error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}