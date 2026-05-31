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
  account: string;
};

// Generates ~84 weekly payouts going backwards from the most recent one so the
// "Show more" pagination has plenty of data to page through during testing.
function generateMockPayouts(count: number): MockPayout[] {
  const accounts = ["•••• 4321", "•••• 9087", "•••• 1556"];
  const start = new Date("2026-05-08T00:00:00");
  const payouts: MockPayout[] = [];

  for (let i = 0; i < count; i++) {
    const date = new Date(start);
    date.setDate(start.getDate() - i * 7);

    // Pseudo-random but deterministic amount between ~$1,500 and ~$4,500.
    const wobble = Math.round((Math.sin(i * 1.7) + 1) * 750);
    const amount = 1500 + ((i * 137) % 1500) + wobble;

    payouts.push({
      id: `po-${i + 1}`,
      date: date.toISOString().slice(0, 10),
      amount,
      status: i === 0 ? "pending" : "paid",
      account: accounts[i % accounts.length],
    });
  }

  return payouts;
}

export const MOCK_PAYOUTS: MockPayout[] = generateMockPayouts(84);
