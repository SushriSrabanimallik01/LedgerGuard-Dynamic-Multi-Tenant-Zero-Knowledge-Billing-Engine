
import {
  Wallet,
  ReceiptText,
  Clock3,
  CreditCard,
  TrendingUp,
  TrendingDown,
} from "lucide-react";

const icons = {
  revenue: Wallet,
  invoices: ReceiptText,
  outstanding: Clock3,
  payments: CreditCard,
};

export default function StatCard({ stat }) {
  const Icon = icons[stat.icon];
  const TrendIcon =
    stat.trend === "up" ? TrendingUp : TrendingDown;

  return (
    <div className="stat-card">
      <div className="stat-top">
        <span>{stat.title}</span>

        <div className="stat-icon">
          <Icon size={19} />
        </div>
      </div>

      <h2>{stat.value}</h2>

      <div className="stat-bottom">
        <span
          className={`trend ${
            stat.trend === "up" ? "positive" : "negative"
          }`}
        >
          <TrendIcon size={14} />
          {stat.change}
        </span>

        <span className="stat-description">
          {stat.description}
        </span>
      </div>
    </div>
  );
}
