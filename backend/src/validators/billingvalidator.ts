export function validatePaymentData(data: any): string | null {
  const { tenantId, amount, transactionId } = data;

  if (!tenantId || !amount || !transactionId) {
    return "Missing required fields: tenantId, amount, and transactionId are required.";
  }

  if (typeof tenantId !== "string" || typeof transactionId !== "string") {
    return "tenantId and transactionId must be text (strings).";
  }

  if (typeof amount !== "number" || isNaN(amount)) {
    return "Amount must be a valid number.";
  }

  if (amount <= 0) {
    return "Amount must be greater than zero.";
  }

  return null; // All checks passed!
}