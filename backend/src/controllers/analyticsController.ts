import { Request, Response } from "express";
import { getTenantUsage } from "../services/analyticsService";

export async function getUsageAnalytics(req: Request, res: Response): Promise<void> {
  try {
    const tenantId = req.params.tenantId;

    if (!tenantId) {
      res.status(400).json({ error: "Tenant ID is required" });
      return;
    }

    const analytics = await getTenantUsage(tenantId as string);

    res.status(200).json({
      message: "Analytics retrieved successfully",
      data: analytics
    });
  } catch (error) {
    console.error("Analytics Error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}