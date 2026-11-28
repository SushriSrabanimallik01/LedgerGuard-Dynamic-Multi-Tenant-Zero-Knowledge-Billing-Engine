
import mongoose from "mongoose";

export async function connectDatabase(): Promise<void> {
    const mongoUri = process.env.MONGODB_URI;

    if (!mongoUri) {
        throw new Error("MONGODB_URI is missing in environment variables.");
    }

    if (mongoose.connection.readyState === 1) {
        console.log("MongoDB is already connected!");
        return;
    }

    await mongoose.connect(mongoUri);

    console.log("MongoDB connected successfully!");
}

export async function disconnectDatabase(): Promise<void> {
    if (mongoose.connection.readyState !== 0) {
        await mongoose.disconnect();
        console.log("MongoDB disconnected!");
    }
}
