
import {
  Search,
  Bell,
  ChevronDown,
  CalendarDays,
  Plus,
} from "lucide-react";

export default function Topbar({ onNewInvoice }) {
  return (
    <header className="topbar">
      <div className="breadcrumb">
        <span>Workspace</span>
        <span className="breadcrumb-divider">/</span>
        <strong>Overview</strong>
      </div>

      <div className="topbar-actions">
        <div className="search-box">
          <Search size={17} />
          <input placeholder="Search anything..." />
          <kbd>⌘ K</kbd>
        </div>

        <button className="icon-button notification-button">
          <Bell size={19} />
          <span className="notification-dot" />
        </button>

        <div className="topbar-divider" />

        <button className="date-button">
          <CalendarDays size={17} />
          <span>Nov 2026</span>
          <ChevronDown size={15} />
        </button>

        <button className="primary-button" onClick={onNewInvoice}>
          <Plus size={18} />
          <span>New Invoice</span>
        </button>
      </div>
    </header>
  );
}
