import mongoose, { Schema, Document } from "mongoose";
import { IBillingRecord } from "../shared/types/billing.types";

export interface IBillingRecordDocument extends IBillingRecord, Document {}

const BillingRecordSchema: Schema = new Schema(
  {
    tenantId: { type: String, required: true },
    amount: { type: Number, required: true },
    status: { type: String, enum: ["pending", "paid", "failed"], default: "pending" },
    transactionId: { type: String, required: true, unique: true },
  },
  { timestamps: true }
);

export default mongoose.model<IBillingRecordDocument>("BillingRecord", BillingRecordSchema);