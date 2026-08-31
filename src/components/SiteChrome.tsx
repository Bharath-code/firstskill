import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="fs-nav">
      <Link href="/" className="fs-logo">
        FirstSkill
      </Link>
      <nav>
        <Link href="/#price">Pricing</Link>
        <Link href="/#check">Get a recording</Link>
      </nav>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="fs-footer">
      <p>
        FirstSkill records an AI assistant trying one real job on your product, fixes
        whatever stopped it, and checks again every week.
      </p>
    </footer>
  );
}
