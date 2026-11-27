export interface IBillingRecord {
  tenantId: string;
  amount: number;
  status: "pending" | "paid" | "failed";
  transactionId: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ILedgerEntry {
  tenantId: string;
  amount: number;
  type: "CREDIT" | "DEBIT";
  description: string;
  transactionId: string;
  createdAt?: Date;
  updatedAt?: Date;
}