
import BillingRecord from "../models/BillingRecord";

export async function getTenantUsage(tenantId: string) {
    const result = await BillingRecord.aggregate([
        {
            $match: {
                tenantId,
                status: "paid"
            }
        },
        {
            $group: {
                _id: "$tenantId",
                totalSpent: { $sum: "$amount" },
                totalTransactions: { $sum: 1 }
            }
        }
    ]);

    if (result.length === 0) {
        return {
            tenantId,
            totalSpent: 0,
            totalTransactions: 0
        };
    }

    return {
        tenantId: result[0]._id,
        totalSpent: result[0].totalSpent,
        totalTransactions: result[0].totalTransactions
    };
}
