export default function HomePage() {
  return (
    <main className="shell landing-shell">
      <section className="landing-intro">
        <p className="eyebrow">TODAY → PROGRAM → LIVE</p>
        <h1>Событие начинается с ясного ответа: что происходит сейчас?</h1>
        <p className="lede">
          Отдельный web-first продукт для программы события. LIVE Q&amp;A подключается
          безопасной внешней ссылкой и остаётся независимой системой.
        </p>
      </section>
      <section className="boundary-grid" aria-label="Границы продукта">
        <article>
          <span>01</span>
          <h2>TODAY</h2>
          <p>Текущая и следующая сессии определяются состоянием события.</p>
        </article>
        <article>
          <span>02</span>
          <h2>PROGRAM</h2>
          <p>Публичный маршрут получает только опубликованную программу.</p>
        </article>
        <article>
          <span>03</span>
          <h2>LIVE</h2>
          <p>Переход в существующий SANCHEZ LIVE Q&amp;A без iframe и общей базы.</p>
        </article>
      </section>
    </main>
  );
}
