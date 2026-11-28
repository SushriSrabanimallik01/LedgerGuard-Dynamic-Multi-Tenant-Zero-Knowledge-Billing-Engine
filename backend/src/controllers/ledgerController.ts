
import { Request, Response } from "express";
import LedgerEntry from "../models/LedgerEntry";

export async function getTenantLedger(
    req: Request,
    res: Response
): Promise<void> {
    try {
        const tenantId = req.params.tenantId;

        if (!tenantId || !tenantId.trim()) {
            res.status(400).json({
                success: false,
                message: "Tenant ID is required"
            });
            return;
        }

        const entries = await LedgerEntry.find({ tenantId })
            .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            message: "Ledger retrieved successfully",
            data: entries
        });

    } catch (error) {
        console.error("Ledger Error:", error);

        res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
}
