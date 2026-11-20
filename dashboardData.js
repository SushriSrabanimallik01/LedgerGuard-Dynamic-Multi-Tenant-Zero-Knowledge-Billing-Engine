
export const dashboardStats = [
  {
    title: "Total Revenue",
    value: "$284,592.00",
    change: "+12.8%",
    description: "vs. previous month",
    trend: "up",
    icon: "revenue",
  },
  {
    title: "Total Invoices",
    value: "1,284",
    change: "+8.2%",
    description: "vs. previous month",
    trend: "up",
    icon: "invoices",
  },
  {
    title: "Outstanding",
    value: "$42,850.00",
    change: "-4.3%",
    description: "vs. previous month",
    trend: "down",
    icon: "outstanding",
  },
  {
    title: "Successful Payments",
    value: "96.8%",
    change: "+2.4%",
    description: "vs. previous month",
    trend: "up",
    icon: "payments",
  },
];

export const revenueData = [
  { month: "Jan", revenue: 18000, expenses: 11000 },
  { month: "Feb", revenue: 24000, expenses: 14000 },
  { month: "Mar", revenue: 21000, expenses: 13000 },
  { month: "Apr", revenue: 32000, expenses: 17000 },
  { month: "May", revenue: 28000, expenses: 16000 },
  { month: "Jun", revenue: 39000, expenses: 21000 },
  { month: "Jul", revenue: 35000, expenses: 19000 },
  { month: "Aug", revenue: 46000, expenses: 24000 },
  { month: "Sep", revenue: 41000, expenses: 22000 },
  { month: "Oct", revenue: 53000, expenses: 27000 },
  { month: "Nov", revenue: 48000, expenses: 25000 },
  { month: "Dec", revenue: 62000, expenses: 31000 },
];

export const transactions = [
  {
    id: "TXN-2026-001",
    customer: "Acme Technologies",
    email: "finance@acme.com",
    amount: 12450,
    date: "Nov 19, 2026",
    status: "Completed",
    method: "Visa •••• 4242",
  },
  {
    id: "TXN-2026-002",
    customer: "Vertex Solutions",
    email: "accounts@vertex.io",
    amount: 8200,
    date: "Nov 19, 2026",
    status: "Pending",
    method: "Mastercard •••• 8821",
  },
  {
    id: "TXN-2026-003",
    customer: "Nexus Digital",
    email: "billing@nexus.com",
    amount: 5600,
    date: "Nov 18, 2026",
    status: "Completed",
    method: "Visa •••• 1902",
  },
  {
    id: "TXN-2026-004",
    customer: "Quantum Systems",
    email: "finance@quantum.io",
    amount: 3100,
    date: "Nov 18, 2026",
    status: "Failed",
    method: "Mastercard •••• 4521",
  },
  {
    id: "TXN-2026-005",
    customer: "Apex Consulting",
    email: "accounts@apex.com",
    amount: 9700,
    date: "Nov 17, 2026",
    status: "Completed",
    method: "Visa •••• 7721",
  },
];

export const invoiceSummary = [
  { label: "Paid", value: 824, color: "#10B981" },
  { label: "Pending", value: 312, color: "#F59E0B" },
  { label: "Overdue", value: 148, color: "#F87171" },
];
