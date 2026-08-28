import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="fs-nav">
      <Link href="/" className="fs-logo">
        FirstSkill
      </Link>
      <nav>
        <Link href="/leaderboard">Leaderboard</Link>
        <Link href="/score">Score a product</Link>
      </nav>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="fs-footer">
      <p>
        FirstSkill proves agents can finish one job on your API — then ships the official
        skill pack so they keep choosing you.
      </p>
    </footer>
  );
}
