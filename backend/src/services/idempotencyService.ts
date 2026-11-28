import BillingRecord, { IBillingRecord } from "../models/BillingRecord";

export async function checkIdempotency(transactionId: string): Promise<IBillingRecord | null> {
  const existingRecord = await BillingRecord.findOne({ transactionId });
  
  if (existingRecord) {
    console.log("⚠️ Duplicate transaction detected. Preventing double charge.");
    return existingRecord;
  }

  return null; // Safe to proceed
}