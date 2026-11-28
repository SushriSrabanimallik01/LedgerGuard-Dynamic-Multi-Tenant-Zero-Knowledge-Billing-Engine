import LedgerEntry, { ILedgerEntry } from "../models/LedgerEntry";

export async function recordTransaction(
  tenantId: string,
  amount: number,
  type: "CREDIT" | "DEBIT",
  description: string,
  transactionId: string
): Promise<ILedgerEntry> {
  
  const entry = await LedgerEntry.create({
    tenantId,
    amount,
    type,
    description,
    transactionId
  });

  return entry;
}