
import { ArrowUpRight, Download, Search } from "lucide-react";
import { transactions } from "../data/dashboardData";
import { useMemo, useState } from "react";

export default function TransactionsTable() {
  const [search, setSearch] = useState("");

  const filteredTransactions = useMemo(() => {
    const query = search.toLowerCase();

    return transactions.filter((transaction) =>
      [
        transaction.id,
        transaction.customer,
        transaction.email,
        transaction.status,
      ]
        .join(" ")
        .toLowerCase()
        .includes(query)
    );
  }, [search]);

  const exportCSV = () => {
    const headers = [
      "Transaction ID",
      "Customer",
      "Email",
      "Amount",
      "Date",
      "Status",
      "Payment Method",
    ];

    const rows = filteredTransactions.map((t) => [
      t.id,
      t.customer,
      t.email,
      t.amount,
      t.date,
      t.status,
      t.method,
    ]);

    const csv = [headers, ...rows]
      .map((row) =>
        row.map((value) =>
          `"${String(value).replace(/"/g, '""')}"`
        ).join(",")
      )
      .join("\n");

    const blob = new Blob([csv], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = "ledgerguard-transactions.csv";
    link.click();

    URL.revokeObjectURL(url);
  };

  return (
    <div className="panel transactions-panel">
      <div className="panel-header">
        <div>
          <h3>Recent Transactions</h3>
          <p>Track your latest payment activity</p>
        </div>

        <button className="secondary-button" onClick={exportCSV}>
          <Download size={15} />
          Export
        </button>
      </div>

      <div className="table-search">
        <Search size={16} />
        <input
          placeholder="Search transactions..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>TRANSACTION</th>
              <th>CUSTOMER</th>
              <th>PAYMENT METHOD</th>
              <th>AMOUNT</th>
              <th>STATUS</th>
              <th></th>
            </tr>
          </thead>

          <tbody>
            {filteredTransactions.map((transaction) => (
              <tr key={transaction.id}>
                <td>
                  <strong className="transaction-id">
                    {transaction.id}
                  </strong>
                  <span className="table-subtext">
                    {transaction.date}
                  </span>
                </td>

                <td>
                  <strong>{transaction.customer}</strong>
                  <span className="table-subtext">
                    {transaction.email}
                  </span>
                </td>

                <td>{transaction.method}</td>

                <td>
                  <strong>
                    ${transaction.amount.toLocaleString("en-US")}
                  </strong>
                </td>

                <td>
                  <span
                    className={`status-badge ${
                      transaction.status.toLowerCase()
                    }`}
                  >
                    <span className="status-dot" />
                    {transaction.status}
                  </span>
                </td>

                <td>
                  <button
                    className="row-action"
                    aria-label={`View ${transaction.id}`}
                    title="Transaction details coming soon"
                  >
                    <ArrowUpRight size={17} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filteredTransactions.length === 0 && (
          <div className="empty-state">
            No matching transactions found.
          </div>
        )}
      </div>

      <div className="table-footer">
        Showing {filteredTransactions.length} of {transactions.length} transactions
      </div>
    </div>
  );
}
