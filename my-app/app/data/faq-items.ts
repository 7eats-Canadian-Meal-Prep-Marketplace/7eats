export interface FaqItem {
  id: string;
  question: string;
  answer: string;
}

export const FAQ_ITEMS: FaqItem[] = [
  {
    id: "what-kind",
    question: "What kind of cook is 7eats for?",
    answer:
      "For our first year we're onboarding meal prep businesses that already hold a valid food handler certification and operate out of a permitted space. If you have your cert and a kitchen, you're our person.",
  },
  {
    id: "how-much",
    question: "How much do I keep per order?",
    answer:
      "We charge a 7.5% platform fee per order to cover payment processing and operations. The first 30 cooks to join keep every dollar they make for 90 days straight.",
  },
  {
    id: "how-pickup",
    question: "How does pickup work for customers?",
    answer:
      "Customers choose a 15-minute pickup window when they order. We stagger those windows so you're not flooded at the door at once. You stay in control of how many windows you open.",
  },
  {
    id: "how-paid",
    question: "When do I get paid?",
    answer:
      "Payouts land in your bank account every Tuesday for the previous weekend's orders. We use Stripe for payouts, so you'll need a Canadian bank account.",
  },
  {
    id: "need-cert",
    question: "Do I need a food-handler certificate to join?",
    answer:
      "Yes. Ontario requires it for anyone preparing food commercially. If you don't have one yet, we can point you in the right direction to get certified before you go live.",
  },
  {
    id: "which-neighbourhoods",
    question: "Which neighbourhoods is 7eats launching in?",
    answer:
      "We're launching in Toronto. Join the waitlist and we'll reach out as soon as we're live in your area.",
  },
];
