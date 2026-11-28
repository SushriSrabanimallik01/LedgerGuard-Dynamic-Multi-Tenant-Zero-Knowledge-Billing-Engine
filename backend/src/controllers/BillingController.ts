
import { Request, Response } from "express";
import {
    processPayment,
    PaymentInProgressError,
} from "../services/BillingService";
import { validatePaymentData } from "../validators/billingvalidator";

export async function handlePayment(
    req: Request,
    res: Response
): Promise<void> {
    try {
        // Step 1: Validate payment input
        const validationError = validatePaymentData(req.body);

        if (validationError) {
            res.status(400).json({
                success: false,
                message: validationError,
            });
            return;
        }

        // Step 2: Extract payment details
        const { tenantId, amount, transactionId } = req.body;

        // Step 3: Process payment
        const record = await processPayment(
            tenantId,
            amount,
            transactionId
        );

        // Step 4: Send successful response
        res.status(200).json({
            success: true,
            message: "Payment processed successfully",
            data: record,
        });

    } catch (error) {
        // Redis lock already acquired by another request
        if (error instanceof PaymentInProgressError) {
            res.status(409).json({
                success: false,
                message: error.message,
            });
            return;
        }

        console.error("Payment Error:", error);

        res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
}
