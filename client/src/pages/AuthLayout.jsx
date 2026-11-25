export function AuthLayout({ title, subtitle, children, footer }) {
  return (
    <main className="auth-screen">
      <section className="auth-card">
        <p className="wordmark">ChatNest</p>
        <h1>{title}</h1>
        <p className="muted">{subtitle}</p>
        {children}
        <div className="auth-footer">{footer}</div>
      </section>
    </main>
  );
}
