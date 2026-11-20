
import {
  LayoutDashboard,
  ReceiptText,
  ArrowLeftRight,
  ChartNoAxesCombined,
  Users,
  Settings,
  ShieldCheck,
  CircleHelp,
  LogOut,
  ChevronLeft,
  Building2,
} from "lucide-react";

const menuItems = [
  { label: "Overview", icon: LayoutDashboard },
  { label: "Invoices", icon: ReceiptText },
  { label: "Transactions", icon: ArrowLeftRight },
  { label: "Analytics", icon: ChartNoAxesCombined },
];

const managementItems = [
  { label: "Team Members", icon: Users },
  { label: "Audit Logs", icon: ShieldCheck },
  { label: "Settings", icon: Settings },
];

export default function Sidebar({
  activePage,
  setActivePage,
  onSignOut,
}) {
  const renderItems = (items) =>
    items.map(({ label, icon: Icon }) => (
      <button
        key={label}
        onClick={() => setActivePage(label)}
        className={`nav-item ${
          activePage === label ? "active" : ""
        }`}
      >
        <Icon size={19} strokeWidth={1.8} />
        <span>{label}</span>
      </button>
    ));

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-icon">
          <ShieldCheck size={23} />
        </div>

        <div>
          <h2>LedgerGuard</h2>
          <span>FINANCIAL PLATFORM</span>
        </div>
      </div>

      <div className="organization">
        <div className="organization-icon">
          <Building2 size={19} />
        </div>

        <div className="organization-info">
          <strong>Acme Corporation</strong>
          <span>Enterprise Plan</span>
        </div>
      </div>

      <div className="nav-section">
        <p className="nav-heading">WORKSPACE</p>
        {renderItems(menuItems)}
      </div>

      <div className="nav-section">
        <p className="nav-heading">MANAGEMENT</p>
        {renderItems(managementItems)}
      </div>

      <div className="sidebar-bottom">
        <button className="nav-item">
          <CircleHelp size={19} />
          <span>Help & Support</span>
        </button>

        {/* Sign Out Button */}
        <button
          className="nav-item"
          onClick={onSignOut}
          type="button"
        >
          <LogOut size={19} />
          <span>Sign Out</span>
        </button>

        <div className="sidebar-footer">
          <div className="avatar">AD</div>

          <div className="profile-info">
            <strong>Admin User</strong>
            <span>Administrator</span>
          </div>

          <ChevronLeft size={17} />
        </div>
      </div>
    </aside>
  );
}
