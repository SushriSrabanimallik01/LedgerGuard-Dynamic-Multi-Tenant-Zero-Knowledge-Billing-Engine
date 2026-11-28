
import { randomUUID } from "crypto";
import BillingRecord, { IBillingRecord } from "../models/BillingRecord";
import { recordTransaction } from "./ledgerService";
import { checkIdempotency } from "./idempotencyService";
import { acquireLock, releaseLock } from "../redis/redisLock";

// Error when another request is already processing this payment
export class PaymentInProgressError extends Error {
  constructor() {
    super("This payment is already being processed. Please try again.");
    this.name = "PaymentInProgressError";
  }
}

export async function processPayment(
  tenantId: string,
  amount: number,
  transactionId: string
): Promise<IBillingRecord> {

  // 1. Create a unique lock for this transaction
  const lockKey = `billing:lock:${transactionId}`;
  const lockValue = randomUUID();

  // 2. Acquire Redis lock (maximum 30 seconds)
  const lockAcquired = await acquireLock(lockKey, lockValue, 30);

  if (!lockAcquired) {
    throw new PaymentInProgressError();
  }

  try {
    // 3. Check whether this transaction was already processed
    const existingRecord = await checkIdempotency(transactionId);

    if (existingRecord) {
      return existingRecord;
    }

    // 4. Create a new billing record
    const newRecord = await BillingRecord.create({
      tenantId,
      amount,
      transactionId,
      status: "paid",
    });

    // 5. Add transaction to the permanent ledger
    await recordTransaction(
      tenantId,
      amount,
      "CREDIT",
      "Payment for services",
      transactionId
    );

    return newRecord;

  } finally {
    // 6. Release the lock, even if payment processing fails
    try {
      await releaseLock(lockKey, lockValue);
    } catch (error) {
      console.error("Redis lock release failed:", error);
    }
  }
}
