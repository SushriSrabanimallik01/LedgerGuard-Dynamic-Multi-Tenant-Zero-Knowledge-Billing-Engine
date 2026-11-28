
import { Request, Response } from "express";
import { getTenantUsage } from "../services/analyticsService";

export async function getUsageAnalytics(
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

        const analytics = await getTenantUsage(tenantId);

        res.status(200).json({
            success: true,
            message: "Analytics retrieved successfully",
            data: analytics
        });
    } catch (error) {
        console.error("Analytics Error:", error);

        res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
}
