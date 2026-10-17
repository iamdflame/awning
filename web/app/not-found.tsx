import Link from "next/link";

export default function NotFound() {
  return (
    <main className="wrap section">
      <h1>Nothing here yet</h1>
      <p className="muted">This shop hasn&apos;t opened, or the link is wrong.</p>
      <p>
        <Link href="/directory">Browse the directory →</Link>
      </p>
    </main>
  );
}
