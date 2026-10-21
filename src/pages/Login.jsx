import { useState } from "react";
import { useSession } from "../lib/session.jsx";

export default function Login() {
  const { entrar } = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [erro, setErro] = useState(null);
  const [aSubmeter, setASubmeter] = useState(false);

  async function submeter(event) {
    event.preventDefault();
    setErro(null);
    setASubmeter(true);
    try {
      await entrar(email, password);
    } catch {
      // A API não distingue email inválido de password errada — o mesmo
      // erro é mostrado nos dois casos.
      setErro("Email ou password incorretos.");
    } finally {
      setASubmeter(false);
    }
  }

  return (
    <main className="app-content">
      <section className="login">
        <h1>Entrar</h1>
        <p className="login-subtitulo">
          Painel SeeFast — acesso reservado ao supervisor da conta.
        </p>
        <form className="login-form" onSubmit={submeter}>
          <label htmlFor="login-email">Email</label>
          <input
            id="login-email"
            name="email"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <label htmlFor="login-password">Password</label>
          <input
            id="login-password"
            name="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          {erro && (
            <p className="login-erro" role="alert">
              {erro}
            </p>
          )}

          <button type="submit" className="login-submit" disabled={aSubmeter}>
            {aSubmeter ? "A entrar…" : "Entrar"}
          </button>
        </form>
      </section>
    </main>
  );
}
