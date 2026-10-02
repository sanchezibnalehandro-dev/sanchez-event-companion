import { redirect } from "next/navigation";

export default function HomePage() {
  if (process.env.EVENT_COMPANION_LOCAL_DEMO === "true") {
    redirect("/e/future-industry-day");
  }

  return (
    <main className="guest-shell root-shell">
      <section className="neutral-home" aria-labelledby="home-title">
        <div className="guest-brand" aria-label="SANCHEZ">
          <span className="guest-brand-mark" aria-hidden="true">S</span>
          <span className="guest-brand-name">SANCHEZ</span>
        </div>
        <p className="guest-kicker">Программа события</p>
        <h1 id="home-title">Откройте ссылку вашего события</h1>
        <p>Программа и вопросы спикерам доступны по персональной ссылке от организатора.</p>
      </section>
    </main>
  );
}
