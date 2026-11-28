
import { processPayment, PaymentInProgressError } from "../../backend/src/services/BillingService";
import BillingRecord from "../../backend/src/models/BillingRecord";
import { recordTransaction } from "../../backend/src/services/ledgerService";
import { acquireLock, releaseLock } from "../../backend/src/redis/redisLock";

jest.mock("../../backend/src/models/BillingRecord", () => ({
  __esModule: true,
  default: {
    findOne: jest.fn(),
    create: jest.fn(),
  },
}));

jest.mock("../../backend/src/services/ledgerService", () => ({
  recordTransaction: jest.fn(),
}));

jest.mock("../../backend/src/redis/redisLock", () => ({
  acquireLock: jest.fn(),
  releaseLock: jest.fn(),
}));

describe("Billing Engine Tests", () => {
  const tenantId = "test_company";
  const amount = 500;
  const transactionId = "test_txn_123";

  const mockRecord = {
    tenantId,
    amount,
    transactionId,
    status: "paid",
  };

  beforeEach(() => {
    jest.clearAllMocks();

    (acquireLock as jest.Mock).mockResolvedValue(true);
    (releaseLock as jest.Mock).mockResolvedValue(true);
    (BillingRecord.findOne as jest.Mock).mockResolvedValue(null);
    (BillingRecord.create as jest.Mock).mockResolvedValue(mockRecord);
    (recordTransaction as jest.Mock).mockResolvedValue({});
  });

  it("should process a valid payment", async () => {
    const result = await processPayment(tenantId, amount, transactionId);

    expect(result).toEqual(mockRecord);
    expect(BillingRecord.create).toHaveBeenCalled();
    expect(recordTransaction).toHaveBeenCalled();
    expect(acquireLock).toHaveBeenCalled();
    expect(releaseLock).toHaveBeenCalled();
  });

  it("should return existing record for duplicate payment", async () => {
    (BillingRecord.findOne as jest.Mock).mockResolvedValue(mockRecord);

    const result = await processPayment(tenantId, amount, transactionId);

    expect(result).toEqual(mockRecord);
    expect(BillingRecord.create).not.toHaveBeenCalled();
    expect(recordTransaction).not.toHaveBeenCalled();
    expect(releaseLock).toHaveBeenCalled();
  });

  it("should reject payment when Redis lock is unavailable", async () => {
    (acquireLock as jest.Mock).mockResolvedValue(false);

    await expect(
      processPayment(tenantId, amount, transactionId)
    ).rejects.toThrow(PaymentInProgressError);

    expect(BillingRecord.create).not.toHaveBeenCalled();
    expect(releaseLock).not.toHaveBeenCalled();
  });

  it("should release Redis lock when payment processing fails", async () => {
    (BillingRecord.create as jest.Mock).mockRejectedValue(
      new Error("Database error")
    );

    await expect(
      processPayment(tenantId, amount, transactionId)
    ).rejects.toThrow("Database error");

    expect(releaseLock).toHaveBeenCalled();
  });
});
