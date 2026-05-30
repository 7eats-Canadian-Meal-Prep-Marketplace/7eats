export type EarningPoint = { label: string; value: number };

export const MOCK_WEEKLY: EarningPoint[] = [
  { label: "Mar 17", value: 1840 },
  { label: "Mar 24", value: 2210 },
  { label: "Mar 31", value: 1690 },
  { label: "Apr 7", value: 2580 },
  { label: "Apr 14", value: 3120 },
  { label: "Apr 21", value: 2740 },
  { label: "Apr 28", value: 3460 },
  { label: "May 5", value: 3980 },
];

export const MOCK_MONTHLY: EarningPoint[] = [
  { label: "Jun", value: 6420 },
  { label: "Jul", value: 7180 },
  { label: "Aug", value: 6890 },
  { label: "Sep", value: 8240 },
  { label: "Oct", value: 9110 },
  { label: "Nov", value: 8760 },
  { label: "Dec", value: 11280 },
  { label: "Jan", value: 7940 },
  { label: "Feb", value: 8650 },
  { label: "Mar", value: 9870 },
  { label: "Apr", value: 11540 },
  { label: "May", value: 12380 },
];

export const MOCK_TOTAL_REVENUE = 108260;

export type PayoutStatus = "pending" | "paid";

export type MockPayout = {
  id: string;
  date: string;
  amount: number;
  status: PayoutStatus;
};

export const MOCK_PAYOUTS: MockPayout[] = [
  { id: "po-1", date: "2026-05-08", amount: 3980, status: "pending" },
  { id: "po-2", date: "2026-05-01", amount: 3460, status: "paid" },
  { id: "po-3", date: "2026-04-24", amount: 2740, status: "paid" },
  { id: "po-4", date: "2026-04-17", amount: 3120, status: "paid" },
  { id: "po-5", date: "2026-04-10", amount: 2580, status: "paid" },
  { id: "po-6", date: "2026-04-03", amount: 1690, status: "paid" },
];
