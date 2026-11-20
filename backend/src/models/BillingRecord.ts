import mongoose, { Schema, Document } from "mongoose";

export interface IBillingRecord extends Document {
  tenantId: string;
  amount: number;
  status: "pending" | "paid" | "failed";
  transactionId: string;
}

const BillingRecordSchema: Schema = new Schema(
  {
    tenantId: { type: String, required: true },
    amount: { type: Number, required: true },
    status: { type: String, enum: ["pending", "paid", "failed"], default: "pending" },
    transactionId: { type: String, required: true, unique: true },
  },
  { timestamps: true }
);

export default mongoose.model<IBillingRecord>("BillingRecord", BillingRecordSchema);
