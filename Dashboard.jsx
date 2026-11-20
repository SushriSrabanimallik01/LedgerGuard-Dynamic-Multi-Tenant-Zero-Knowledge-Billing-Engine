import {
  ArrowUpRight,
  ArrowDownRight,
  Plus,
  FileText,
  CreditCard,
  X,
} from "lucide-react";

import { dashboardStats, invoiceSummary } from "../data/dashboardData";
import StatCard from "../components/StatCard";
import RevenueChart from "../components/RevenueChart";
import TransactionsTable from "../components/TransactionsTable";

export default function Dashboard({
  showInvoiceModal,
  setShowInvoiceModal,
}) {

  return (
    <main className="dashboard-content">
      <div className="page-heading">
        <div>
          <p className="eyebrow">
  {new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).toUpperCase()}
</p>
          <h1>Good morning, Admin <span>✦</span></h1>
          <p className="page-description">
            Here's what's happening with your business today.
          </p>
        </div>

        <button
          className="primary-button mobile-create"
          onClick={() => setShowInvoiceModal(true)}
        >
          <Plus size={18} />
          Create Invoice
        </button>
      </div>

      <section className="stats-grid">
        {dashboardStats.map((stat) => (
          <StatCard key={stat.title} stat={stat} />
        ))}
      </section>

      <section className="main-grid">
        <RevenueChart />

        <div className="panel invoice-panel">
          <div className="panel-header">
            <div>
              <h3>Invoice Status</h3>
              <p>Payment distribution</p>
            </div>

            <button className="more-button">•••</button>
          </div>

          <div className="invoice-total">
            <h2>1,284</h2>
            <span>Total Invoices</span>
          </div>

          <div className="invoice-bars">
            {invoiceSummary.map((item) => {
              const percentage =
                (item.value / 1284) * 100;

              return (
                <div className="invoice-bar-group" key={item.label}>
                  <div
                    className="invoice-bar"
                    style={{
                      width: `${percentage}%`,
                      background: item.color,
                    }}
                  />
                </div>
              );
            })}
          </div>

          <div className="invoice-legend">
            {invoiceSummary.map((item) => (
              <div className="invoice-legend-item" key={item.label}>
                <div>
                  <i style={{ background: item.color }} />
                  {item.label}
                </div>
                <strong>{item.value}</strong>
              </div>
            ))}
          </div>

          <button
            className="view-all-button"
            onClick={() => setShowInvoiceModal(true)}
          >
            <Plus size={16} />
            Create New Invoice
          </button>
        </div>
      </section>

      <section className="bottom-grid">
        <TransactionsTable />

        <div className="panel activity-panel">
          <div className="panel-header">
            <div>
              <h3>Financial Activity</h3>
              <p>Latest account movements</p>
            </div>
          </div>

          <div className="activity-list">
            <div className="activity-item">
              <div className="activity-icon green">
                <ArrowDownRight size={19} />
              </div>

              <div className="activity-details">
                <strong>Payment received</strong>
                <span>Acme Technologies</span>
                <small>Today, 10:42 AM</small>
              </div>

              <strong className="activity-amount positive">
                +$12,450
              </strong>
            </div>

            <div className="activity-item">
              <div className="activity-icon blue">
                <FileText size={18} />
              </div>

              <div className="activity-details">
                <strong>Invoice generated</strong>
                <span>INV-2026-084</span>
                <small>Today, 09:18 AM</small>
              </div>

              <strong className="activity-amount">
                $8,200
              </strong>
            </div>

            <div className="activity-item">
              <div className="activity-icon red">
                <ArrowUpRight size={18} />
              </div>

              <div className="activity-details">
                <strong>Payment failed</strong>
                <span>Quantum Systems</span>
                <small>Yesterday, 04:32 PM</small>
              </div>

              <strong className="activity-amount negative">
                -$3,100
              </strong>
            </div>

            <div className="activity-item">
              <div className="activity-icon purple">
                <CreditCard size={18} />
              </div>

              <div className="activity-details">
                <strong>Subscription renewed</strong>
                <span>Vertex Solutions</span>
                <small>Yesterday, 11:05 AM</small>
              </div>

              <strong className="activity-amount">
                $2,400
              </strong>
            </div>
          </div>

          <button className="view-all-button">
            View Activity History
          </button>
        </div>
      </section>

      {showInvoiceModal && (
        <div
          className="modal-overlay"
          onClick={() => setShowInvoiceModal(false)}
        >
          <div
            className="invoice-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-header">
              <div>
                <h3>Create Invoice</h3>
                <p>Invoice creation will be connected to the API in our next integration phase.</p>
              </div>

              <button
                className="icon-button"
                onClick={() => setShowInvoiceModal(false)}
              >
                <X size={19} />
              </button>
            </div>

            <div className="modal-placeholder">
              <FileText size={32} />
              <strong>Invoice module coming next</strong>
              <span>
                We'll implement customer selection, line items,
                tax calculation and invoice persistence.
              </span>
            </div>

            <button
              className="primary-button modal-close"
              onClick={() => setShowInvoiceModal(false)}
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
