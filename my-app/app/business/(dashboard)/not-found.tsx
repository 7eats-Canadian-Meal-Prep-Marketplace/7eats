import Link from "next/link";

export default function DashboardNotFound() {
  return (
    <div>
      <h1>Page not found</h1>
      <p style={{ color: "var(--grey-700)", marginTop: 8 }}>
        This section doesn&apos;t exist.{" "}
        <Link
          href="/business/dashboard"
          style={{ color: "var(--red)", fontWeight: 600 }}
        >
          Back to Dashboard
        </Link>
      </p>
    </div>
  );
}
