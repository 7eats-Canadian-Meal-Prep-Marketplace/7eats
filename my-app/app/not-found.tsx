import Link from "next/link";

export const metadata = {
  title: "Page not found - 7eats",
};

export default function NotFound() {
  return (
    <main className="notfound">
      <div className="wrap notfound-inner">
        <span className="notfound-code">404</span>
        <h1 className="notfound-title">This page isn&apos;t on the menu.</h1>
        <p className="notfound-body">
          Looks like this dish got taken off. The link might be broken, or the
          page moved. Head back and find something good.
        </p>
        <Link href="/app/browse" className="btn btn-primary">
          Back to home
        </Link>
      </div>
    </main>
  );
}
