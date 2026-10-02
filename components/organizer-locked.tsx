export function OrganizerLocked() {
  return (
    <main className="shell narrow-shell">
      <section className="state-card" aria-labelledby="organizer-access-title">
        <p className="eyebrow">Organizer boundary</p>
        <h1 id="organizer-access-title">Доступ организатора закрыт</h1>
        <p>
          Локальный editor доступен только с loopback-адреса и явно включённым demo mode
          или development Bearer token. На внешнем хосте placeholder всегда закрыт.
        </p>
      </section>
    </main>
  );
}
