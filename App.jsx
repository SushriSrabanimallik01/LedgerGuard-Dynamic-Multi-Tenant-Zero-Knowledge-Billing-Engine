
import { useState } from "react";
import { Menu, X } from "lucide-react";

import Sidebar from "./components/Sidebar";
import Topbar from "./components/Topbar";
import Dashboard from "./pages/Dashboard";

export default function App() {
  const [activePage, setActivePage] = useState("Overview");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);

  const handleNewInvoice = () => {
    setActivePage("Overview");
    setShowInvoiceModal(true);
  };

  return (
    <div className="app-shell">
      {sidebarOpen && (
        <div
          className="mobile-overlay"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div className={`sidebar-container ${sidebarOpen ? "mobile-open" : ""}`}>
        <Sidebar
          activePage={activePage}
          setActivePage={(page) => {
            setActivePage(page);
            setSidebarOpen(false);
          }}
        />
      </div>

      <div className="main-area">
        <div className="mobile-header">
          <button
            className="icon-button"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            aria-label="Toggle navigation"
          >
            {sidebarOpen ? <X /> : <Menu />}
          </button>

          <strong>LedgerGuard</strong>
        </div>

        <Topbar onNewInvoice={handleNewInvoice} />

        {activePage === "Overview" ? (
          <Dashboard
            showInvoiceModal={showInvoiceModal}
            setShowInvoiceModal={setShowInvoiceModal}
          />
        ) : (
          <main className="dashboard-content">
            <div className="page-heading">
              <div>
                <p className="eyebrow">WORKSPACE</p>
                <h1>{activePage}</h1>
                <p className="page-description">
                  This module will be implemented in the next phases.
                </p>
              </div>
            </div>

            <div className="panel coming-soon">
              <h3>{activePage} module</h3>
              <p>Development is coming soon.</p>
            </div>
          </main>
        )}
      </div>
    </div>
  );
}
