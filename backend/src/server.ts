import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { connectDB } from "./config/database";
import billingRoutes from "./routes/BillingRoutes"; // <-- The missing link!

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

app.use("/api", billingRoutes); // <-- The missing route!

app.get("/health", (req, res) => {
  res.json({ status: "ok", message: "LedgerGuard Backend is running!" });
});

const PORT = process.env.PORT || 5000;

async function startServer() {
  await connectDB();
  app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
  });
}

startServer();