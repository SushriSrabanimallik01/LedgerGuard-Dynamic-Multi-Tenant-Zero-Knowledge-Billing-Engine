
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

import { revenueData } from "../data/dashboardData";

const formatCurrency = (value) =>
  `$${(value / 1000).toFixed(0)}k`;

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;

  return (
    <div className="chart-tooltip">
      <strong>{label} 2026</strong>

      {payload.map((item) => (
        <div key={item.dataKey} className="tooltip-row">
          <span style={{ color: item.color }}>
            ● {item.name}
          </span>

          <strong>
            ${item.value.toLocaleString("en-US")}
          </strong>
        </div>
      ))}
    </div>
  );
}

export default function RevenueChart() {
  return (
    <div className="panel revenue-panel">
      <div className="panel-header">
        <div>
          <h3>Revenue Overview</h3>
          <p>Monitor your financial performance</p>
        </div>

        <div className="chart-legend">
          <span>
            <i className="legend-dot revenue-dot" />
            Revenue
          </span>

          <span>
            <i className="legend-dot expense-dot" />
            Expenses
          </span>
        </div>
      </div>

      <div className="chart-container">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={revenueData}
            margin={{
              top: 15,
              right: 8,
              left: -15,
              bottom: 0,
            }}
          >
            <defs>
              <linearGradient
                id="revenueGradient"
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop
                  offset="0%"
                  stopColor="#10B981"
                  stopOpacity={0.24}
                />
                <stop
                  offset="100%"
                  stopColor="#10B981"
                  stopOpacity={0}
                />
              </linearGradient>

              <linearGradient
                id="expenseGradient"
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop
                  offset="0%"
                  stopColor="#64748B"
                  stopOpacity={0.15}
                />
                <stop
                  offset="100%"
                  stopColor="#64748B"
                  stopOpacity={0}
                />
              </linearGradient>
            </defs>

            <CartesianGrid
              stroke="#26364B"
              strokeDasharray="4 5"
              vertical={false}
            />

            <XAxis
              dataKey="month"
              axisLine={false}
              tickLine={false}
              tick={{ fill: "#8190A5", fontSize: 12 }}
              dy={12}
            />

            <YAxis
              tickFormatter={formatCurrency}
              axisLine={false}
              tickLine={false}
              tick={{ fill: "#8190A5", fontSize: 12 }}
            />

            <Tooltip content={<CustomTooltip />} />

            <Area
              type="monotone"
              dataKey="revenue"
              name="Revenue"
              stroke="#10B981"
              strokeWidth={2.5}
              fill="url(#revenueGradient)"
              activeDot={{ r: 5 }}
            />

            <Area
              type="monotone"
              dataKey="expenses"
              name="Expenses"
              stroke="#64748B"
              strokeWidth={2}
              fill="url(#expenseGradient)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
