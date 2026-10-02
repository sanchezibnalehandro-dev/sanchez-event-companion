export function OrganizerLocked() {
  return (
    <main className="shell narrow-shell">
      <section className="state-card" aria-labelledby="organizer-access-title">
        <p className="eyebrow">Organizer boundary</p>
        <h1 id="organizer-access-title">Доступ организатора закрыт</h1>
        <p>
          Phase 1 принимает только локальный development Bearer token. В production этот
          placeholder всегда отключён.
        </p>
      </section>
    </main>
  );
}
