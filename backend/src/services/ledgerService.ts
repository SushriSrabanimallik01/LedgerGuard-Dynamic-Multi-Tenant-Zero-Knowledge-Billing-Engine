import LedgerEntry from "../models/LedgerEntry";
import { ILedgerEntry } from "../shared/types/billing.types";

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