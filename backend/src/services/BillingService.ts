import BillingRecord, { IBillingRecord } from "../models/BillingRecord";
import { recordTransaction } from "./ledgerService";
import { checkIdempotency } from "./idempotencyService";

export async function processPayment(
  tenantId: string,
  amount: number,
  transactionId: string
): Promise<IBillingRecord> {
  
  // 1. Idempotency Check: Prevent double charging
  const existingRecord = await checkIdempotency(transactionId);
  
  if (existingRecord) {
    return existingRecord; 
  }

  // 2. Process new payment
  const newRecord = await BillingRecord.create({
    tenantId,
    amount,
    transactionId,
    status: "paid", 
  });

  // 3. Write to the permanent ledger
  await recordTransaction(
    tenantId, 
    amount, 
    "CREDIT", 
    "Payment for services", 
    transactionId
  );

  return newRecord;
}