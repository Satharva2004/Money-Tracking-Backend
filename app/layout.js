export const metadata = {
  title: 'Money Tracker - Personal Finance Management',
  description: 'Track your expenses, manage budgets, and get AI-powered financial insights',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
