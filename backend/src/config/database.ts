import mongoose from "mongoose";

export async function connectDB(): Promise<void> {
  try {
    const uri = process.env.MONGO_URI;
    if (!uri) throw new Error("MONGO_URI is missing in .env file");
    
    await mongoose.connect(uri);
    console.log("✅ MongoDB Connected Successfully");
  } catch (error) {
    console.error("❌ MongoDB Connection Error:", error);
    process.exit(1);
  }
}