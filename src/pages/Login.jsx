import { useState } from "react";
import { Link } from "react-router-dom";
import { useSession } from "../lib/session.jsx";
import { IconeEscudo } from "../components/Icones.jsx";

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
      // A API nao distingue email invalido de password errada — o mesmo
      // erro e mostrado nos dois casos.
      setErro("Email ou password incorretos.");
    } finally {
      setASubmeter(false);
    }
  }

  return (
    <main className="login-wrap">
      <section className="login">
        <Link
          to="/"
          className="landing-logo"
          style={{ marginBottom: 22, color: "var(--sf-text)" }}
        >
          <IconeEscudo />
          SeeFast
        </Link>

        <h1>Entrar</h1>
        <p className="login-subtitulo">
          O teu painel. Vê os teus dispositivos e o que se passa neles.
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

        <div className="login-rodape">
          <p style={{ margin: "0 0 12px" }}>
            Ainda não tens conta? Instala a app e cria-a lá — fica ligado ao teu
            telemóvel.
          </p>
          <Link to="/">Voltar ao site</Link>
        </div>
      </section>
    </main>
  );
}
