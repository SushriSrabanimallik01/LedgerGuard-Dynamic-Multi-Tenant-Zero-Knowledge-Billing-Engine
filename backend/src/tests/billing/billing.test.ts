import { processPayment } from "../../services/BillingService";
import BillingRecord from "../../models/BillingRecord";
import { recordTransaction } from "../../services/ledgerService";

// Tell Jest to fake BOTH the database model and the ledger service
jest.mock("../../models/BillingRecord");
jest.mock("../../services/LedgerService");

// Give it 30 seconds just in case
jest.setTimeout(30000);

describe("Billing Engine Tests", () => {
  
  it("should process a valid payment and create a record", async () => {
    const testTenant = "test_company";
    const testAmount = 500;
    const testTxnId = "test_txn_123";

    // 1. Fake the idempotency check (no duplicate found)
    (BillingRecord.findOne as jest.Mock).mockResolvedValue(null);

    // 2. Fake the database save
    (BillingRecord.create as jest.Mock).mockResolvedValue({
      tenantId: testTenant,
      amount: testAmount,
      transactionId: testTxnId,
      status: "paid",
    });

    // 3. Fake the ledger write
    (recordTransaction as jest.Mock).mockResolvedValue({});

    // 4. Run your actual function
    const result = await processPayment(testTenant, testAmount, testTxnId);

    // 5. Check the results
    expect(result).toBeDefined();
    expect(result.tenantId).toBe(testTenant);
    expect(result.amount).toBe(testAmount);
    expect(result.transactionId).toBe(testTxnId);
    expect(result.status).toBe("paid");
  });
});