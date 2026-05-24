import Image from "next/image";
import Link from "next/link";

export default function BusinessHeader() {
  return (
    <header className="header">
      <div className="wrap header-inner">
        <Link href="/business/home" className="brand">
          <Image
            src="/7eats-logo.svg"
            alt="7eats"
            width={120}
            height={32}
            style={{ width: "auto" }}
            priority
          />
        </Link>
        <Link href="/business/application" className="btn btn-primary btn-sm">
          Apply
        </Link>
      </div>
    </header>
  );
}
