
export function validatePaymentData(data: any): string | null {
    if (!data || typeof data !== "object") {
        return "Invalid payment data.";
    }

    const { tenantId, amount, transactionId } = data;

    if (!tenantId || !amount || !transactionId) {
        return "Missing required fields: tenantId, amount, and transactionId are required.";
    }

    if (
        typeof tenantId !== "string" ||
        typeof transactionId !== "string" ||
        !tenantId.trim() ||
        !transactionId.trim()
    ) {
        return "tenantId and transactionId must be non-empty strings.";
    }

    if (typeof amount !== "number" || !Number.isFinite(amount)) {
        return "Amount must be a valid number.";
    }

    if (amount <= 0) {
        return "Amount must be greater than zero.";
    }

    return null;
}
