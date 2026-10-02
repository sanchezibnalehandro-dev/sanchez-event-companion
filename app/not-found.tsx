import Link from "next/link";

export default function NotFoundPage() {
  return (
    <main className="shell narrow-shell">
      <section className="state-card">
        <p className="eyebrow">404</p>
        <h1>Событие или сессия не найдены</h1>
        <p>Проверьте ссылку или уточните её у организатора.</p>
        <Link className="text-link" href="/">
          На главную
        </Link>
      </section>
    </main>
  );
}
