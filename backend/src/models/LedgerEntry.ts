import mongoose, { Schema, Document } from "mongoose";

export interface ILedgerEntry extends Document {
  tenantId: string;
  amount: number;
  type: "CREDIT" | "DEBIT";
  description: string;
  transactionId: string;
}

const LedgerEntrySchema: Schema = new Schema(
  {
    tenantId: { type: String, required: true },
    amount: { type: Number, required: true },
    type: { type: String, enum: ["CREDIT", "DEBIT"], required: true },
    description: { type: String, required: true },
    transactionId: { type: String, required: true },
  },
  { timestamps: true }
);

export default mongoose.model<ILedgerEntry>("LedgerEntry", LedgerEntrySchema);