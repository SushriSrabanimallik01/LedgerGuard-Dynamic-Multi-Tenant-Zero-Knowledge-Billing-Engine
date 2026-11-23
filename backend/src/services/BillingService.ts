 import BillingRecord, { IBillingRecord } from "../models/BillingRecord";
 import { recordTransaction } from "./ledgerService";

export async function processPayment(
  tenantId: string,
  amount: number,
  transactionId: string
): Promise<IBillingRecord> {
  
  const existingRecord = await BillingRecord.findOne({ transactionId });
  
  if (existingRecord) {
    console.log("⚠️ Duplicate transaction detected. Preventing double charge.");
    return existingRecord; 
  }

  const newRecord = await BillingRecord.create({
    tenantId,
    amount,
    transactionId,
    status: "paid", 
  });
  // Write to the permanent ledger
await recordTransaction(
  tenantId, 
  amount, 
  "CREDIT", 
  "Payment for services", 
  transactionId
);

  return newRecord;
}