import mongoose, { Schema, Document } from "mongoose";
import { ILedgerEntry } from "../shared/types/billing.types";

export interface ILedgerEntryDocument extends ILedgerEntry, Document {}

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

export default mongoose.model<ILedgerEntryDocument>("LedgerEntry", LedgerEntrySchema);