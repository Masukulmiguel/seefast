import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import {
  IconeAlerta,
  IconeAplicacoes,
  IconeCheck,
  IconeCadeado,
  IconeEscudo,
  IconeLocalizacao,
  IconeRaio,
  IconeRelogio,
  IconeTelemovel,
} from "../components/Icones.jsx";

gsap.registerPlugin(ScrollTrigger, SplitText);

/**
 * Site publico do SeeFast.
 *
 * As animacoes sao de "marketing": revelam a historia enquanto se rola.
 * O reveal corre ao descer e REVERTE ao subir (toggleActions
 * "play none none reverse"), para a pagina parecer viva nos dois sentidos.
 *
 * prefers-reduced-motion desliga tudo e mostra o estado final.
 */

const RECURSOS = [
  {
    icone: <IconeTelemovel />,
    titulo: "Estado em tempo real",
    texto:
      "Bateria, conectividade e estado do telemóvel, atualizados de 15 em 15 minutos.",
  },
  {
    icone: <IconeLocalizacao />,
    titulo: "Localização",
    texto:
      "Onde está o aparelho, de 5 em 5 minutos, com serviço em primeiro plano e notificação visível.",
  },
  {
    icone: <IconeAplicacoes />,
    titulo: "Apps instaladas",
    texto:
      "O que está instalado no telemóvel e quanto espaço cada aplicação ocupa.",
  },
  {
    icone: <IconeRelogio />,
    titulo: "Tempo de uso",
    texto:
      "Minutos por aplicação, com os limites de ecrã que definires para cada dispositivo.",
  },
  {
    icone: <IconeAlerta />,
    titulo: "Alertas",
    texto:
      "Avisos quando um dispositivo deixa de reportar, a bateria desce ou o consentimento muda.",
  },
  {
    icone: <IconeCadeado />,
    titulo: "Consentimento explícito",
    texto:
      "Nada é recolhido sem autorização. O utilizador vê sempre o que se recolhe e pode revogar.",
  },
];

const PASSOS = [
  {
    titulo: "Instala a app",
    texto:
      "Descarrega o APK e instala-o no telemóvel. Sem loja, sem conta de programador.",
  },
  {
    titulo: "Cria a tua conta",
    texto:
      "Com email e senha. A app regista o aparelho e liga-o à tua conta no painel.",
  },
  {
    titulo: "Autoriza o que quiseres",
    texto:
      "Localização, aplicações e tempo de uso são interruptores separados. Podes desligar quando quiseres.",
  },
  {
    titulo: "Acompanha no painel",
    texto:
      "Entra no teu painel e vê tudo o que se passa no telemóvel, de qualquer dispositivo.",
  },
];

const PLANOS = [
  {
    nome: "Gratuito",
    preco: "0",
    unidade: "€ / mês",
    descricao: "Para testar com um telemóvel.",
    recursos: [
      "1 dispositivo",
      "Estado e bateria",
      "Localização",
      "Consentimento explícito",
    ],
    accao: "Começar grátis",
    destaque: false,
  },
  {
    nome: "Família",
    preco: "4,90",
    unidade: "€ / mês",
    descricao: "Para quem gere vários telemóveis.",
    recursos: [
      "Até 5 dispositivos",
      "Tempo de uso por app",
      "Limites de ecrã por dispositivo",
      "Alertas e histórico",
      "Esconder a app do ecrã principal",
    ],
    accao: "Escolher Família",
    destaque: true,
  },
  {
    nome: "Negócio",
    preco: "19,90",
    unidade: "€ / mês",
    descricao: "Para famílias numerosas e pequenas empresas.",
    recursos: [
      "Dispositivos ilimitados",
      "Painel de administração",
      "Relatórios de exportação",
      "Suporte prioritário",
    ],
    accao: "Falar connosco",
    destaque: false,
  },
];

const FAQ = [
  {
    p: "O SeeFast espia o telemóvel?",
    r: "Não. A app só lê o estado do próprio aparelho onde corre, e apenas o que o próprio dono autorizou. Não há câmara, microfone, SMS, contactos nem leitura de conteúdo de apps. Não usa AccessibilityService, MediaProjection nem Google Play Services.",
  },
  {
    p: "A app é invisível para quem usa o telemóvel?",
    r: "Não, e essa é uma decisão deliberada. Há sempre uma notificação visível a dizer que a recolha está activa. Podes esconder o ícone do ecrã principal depois de configurado, mas o serviço continua visível na barra de notificações.",
  },
  {
    p: "Preciso de uma conta de programador?",
    r: "Não. Descarrega-se o APK e instala-se diretamente. Sem loja, sem conta de programador, sem_root.",
  },
  {
    p: "Funciona fora da minha rede de casa?",
    r: "Sim. A app aponta para o endereço do teu servidor, que pode ser na LAN ou na internet. Fora de redes privadas a ligação tem de ser HTTPS.",
  },
  {
    p: "Como revogo o consentimento?",
    r: "Na app, desligas o interruptor principal. A recolha pára imediatamente, o serviço em primeiro plano é parado e o painel passa a mostrar o consentimento como pendente.",
  },
];

export default function Landing() {
  const raiz = useRef(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      // O bloco abaixo só corre quando o utilizador NAO pediu menos movimento.
      const mm = gsap.matchMedia();

      mm.add("(prefers-reduced-motion: no-preference)", () => {
        // ---- Entrada do hero: o titulo sobe letra a letra (estilo video) ----
        const titulo = new SplitText("[data-split]", { type: "chars" });
        gsap.set(titulo.chars, { opacity: 0, yPercent: 60, rotateX: -70 });
        gsap.to(titulo.chars, {
          opacity: 1,
          yPercent: 0,
          rotateX: 0,
          duration: 0.9,
          ease: "expo.out",
          stagger: 0.016,
        });
        gsap.from("[data-hero-fade]", {
          opacity: 0,
          y: 22,
          duration: 0.7,
          ease: "expo.out",
          stagger: 0.09,
          delay: 0.25,
        });

        // A previa do painel entra com perspectiva 3D, como um video de produto.
        gsap.from("[data-preview]", {
          opacity: 0,
          y: 70,
          rotateX: 12,
          scale: 0.96,
          duration: 1.1,
          ease: "expo.out",
          delay: 0.15,
        });

        // ---- Parallax: os orbes e a previa reagem ao scroll (scrub) ----
        gsap.to("[data-orb-a]", {
          yPercent: -28,
          ease: "none",
          scrollTrigger: {
            trigger: "[data-hero]",
            start: "top top",
            end: "bottom top",
            scrub: 1,
          },
        });
        gsap.to("[data-orb-b]", {
          yPercent: 22,
          ease: "none",
          scrollTrigger: {
            trigger: "[data-hero]",
            start: "top top",
            end: "bottom top",
            scrub: 1,
          },
        });
        gsap.to("[data-preview]", {
          yPercent: 12,
          ease: "none",
          scrollTrigger: {
            trigger: "[data-hero]",
            start: "top top",
            end: "bottom top",
            scrub: 1,
          },
        });

        // ---- Reveal com reversao: entra ao descer, sai ao subir ----
        gsap.utils.toArray("[data-reveal]").forEach((el) => {
          gsap.from(el, {
            opacity: 0,
            y: 34,
            duration: 0.65,
            ease: "power2.out",
            scrollTrigger: {
              trigger: el,
              start: "top 88%",
              // play ao entrar, reverse ao voltar para cima.
              toggleActions: "play none none reverse",
            },
          });
        });

        // ---- Listas em cascata (cards, planos, FAQ) ----
        gsap.utils.toArray("[data-stagger]").forEach((grupo) => {
          gsap.from(grupo.children, {
            opacity: 0,
            y: 30,
            duration: 0.55,
            ease: "power2.out",
            stagger: 0.055,
            scrollTrigger: {
              trigger: grupo,
              start: "top 86%",
              toggleActions: "play none none reverse",
            },
          });
        });

        // ---- Secao "como funciona" presa: o progresso segue o scroll ----
        const passos = gsap.utils.toArray("[data-passo]");
        passos.forEach((passo, i) => {
          gsap.from(passo, {
            opacity: 0.25,
            scale: 0.94,
            duration: 0.5,
            ease: "power2.out",
            scrollTrigger: {
              trigger: passo,
              start: "top 92%",
              end: "top 55%",
              scrub: 0.6,
            },
          });
          gsap.to(passo, {
            opacity: 1,
            scale: 1,
            duration: 0.5,
            ease: "power2.out",
            scrollTrigger: {
              trigger: passo,
              start: "top 55%",
              end: "top 35%",
              scrub: 0.6,
            },
          });
        });

        // ---- Contadores que sobem quando entram no ecra ----
        gsap.utils.toArray("[data-contador]").forEach((el) => {
          const alvo = Number(el.dataset.contador);
          const obj = { valor: 0 };
          gsap.to(obj, {
            valor: alvo,
            duration: 1.4,
            ease: "power2.out",
            scrollTrigger: {
              trigger: el,
              start: "top 90%",
              toggleActions: "play none none reverse",
              onUpdate: () => {
                el.textContent = String(Math.round(obj.valor));
              },
            },
            onComplete: () => {
              el.textContent = String(alvo);
            },
          });
        });

        // ---- Brilho que segue o rato no hero ----
        const hero = document.querySelector("[data-hero]");
        const brilho = document.querySelector("[data-brilho]");
        if (hero && brilho) {
          let agendado = false;
          const aoMover = (e) => {
            if (agendado) return;
            agendado = true;
            requestAnimationFrame(() => {
              const r = hero.getBoundingClientRect();
              brilho.style.setProperty("--mx", `${e.clientX - r.left}px`);
              brilho.style.setProperty("--my", `${e.clientY - r.top}px`);
              agendado = false;
            });
          };
          hero.addEventListener("mousemove", aoMover);
        }

        // ---- Botao magnetico: segue o rato, mas so com rato de verdade ----
        const botao = document.querySelector("[data-magnetico]");
        if (botao) {
          const mover = (e) => {
            const r = botao.getBoundingClientRect();
            gsap.to(botao, {
              x: (e.clientX - (r.left + r.width / 2)) * 0.22,
              y: (e.clientY - (r.top + r.height / 2)) * 0.32,
              duration: 0.4,
              ease: "power3.out",
            });
          };
          const sair = () => gsap.to(botao, { x: 0, y: 0, duration: 0.6, ease: "elastic.out(1, 0.4)" });
          botao.addEventListener("mousemove", mover);
          botao.addEventListener("mouseleave", sair);
        }
      });

      // Com menos movimento: mostra logo o estado final, sem surpresas.
      mm.add("(prefers-reduced-motion: reduce)", () => {
        gsap.set("[data-split], [data-hero-fade], [data-preview], [data-reveal], [data-stagger] > *, [data-passo]", {
          opacity: 1,
          y: 0,
          yPercent: 0,
          rotateX: 0,
          scale: 1,
        });
      });
    }, raiz);

    return () => ctx.revert();
  }, []);

  return (
    <div className="landing" ref={raiz}>
      <header className="landing-nav">
        <div className="landing-logo">
          <IconeEscudo />
          SeeFast
        </div>
        <nav className="landing-links" aria-label="Navegação principal">
          <a href="#como-funciona">Como funciona</a>
          <a href="#funcionalidades">Funcionalidades</a>
          <a href="#planos">Planos</a>
          <a href="#perguntas">Perguntas</a>
        </nav>
        <div className="landing-cta">
          <Link className="btn btn-ghost" to="/entrar">
            Entrar
          </Link>
          <Link className="btn btn-primary" to="/entrar">
            Criar conta
          </Link>
        </div>
      </header>

      <main>
        {/* ================= HERO ================= */}
        <section className="hero" data-hero>
          <div className="orb orb-a" data-orb-a aria-hidden="true" />
          <div className="orb orb-b" data-orb-b aria-hidden="true" />
          <div className="brilho" data-brilho aria-hidden="true" />

          <span className="hero-badge" data-hero-fade>
            <IconeRaio style={{ width: 14, height: 14 }} />
            Consentimento explícito, sempre visível
          </span>

          <h1 data-split>Veja o telemóvel. Com consentimento.</h1>

          <p data-hero-fade>
            O SeeFast é uma app Android que instala no telemóvel da tua família e
            envia o estado, a localização e o tempo de uso para o teu painel.
            Tu decides o que se recolhe — e podes parar quando quiseres.
          </p>

          <div className="hero-acoes" data-hero-fade>
            <Link className="btn btn-primary" to="/entrar" data-magnetico>
              Criar a minha conta
            </Link>
            <a className="btn btn-ghost" href="#como-funciona">
              Ver como funciona
            </a>
          </div>

          <div className="hero-confianca" data-hero-fade>
            <span>
              <IconeCheck /> Sem câmara nem microfone
            </span>
            <span>
              <IconeCheck /> Sem Google Play Services
            </span>
            <span>
              <IconeCheck /> Revogável a qualquer momento
            </span>
          </div>

          {/* Previa do painel (parallax) */}
          <div className="hero-preview" data-preview aria-hidden="true">
            <div className="hero-preview-bar">
              <i />
              <i />
              <i />
              <span>seefast.onrender.com/painel</span>
            </div>
            <div className="hero-preview-body">
              <div className="hero-preview-side">
                <b>Painel</b>
                <span>Dashboard</span>
                <span>Dispositivos</span>
                <span>Localização</span>
                <span>Tempo de uso</span>
                <span>Alertas</span>
              </div>
              <div className="hero-preview-main">
                <div className="hero-mini">
                  <em>Dispositivos</em>
                  <strong>3</strong>
                </div>
                <div className="hero-mini">
                  <em>Online</em>
                  <strong>2</strong>
                </div>
                <div className="hero-mini">
                  <em>Bateria média</em>
                  <strong>68%</strong>
                </div>
                <div className="hero-mini">
                  <em>Alertas</em>
                  <strong>1</strong>
                </div>
                <div className="hero-mini wide">
                  <em>Tempo de uso hoje</em>
                  <div className="hero-barra">
                    <i style={{ width: "72%" }} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ================= NUMEROS ================= */}
        <section className="seccao seccao-centro">
          <dl className="stat-row stagger" data-stagger>
            <div className="stat" data-tone="cyan">
              <dt>Cadência do estado</dt>
              <dd>
                <span data-contador="15">0</span> min
              </dd>
              <span className="stat-foot">a cada reporte</span>
            </div>
            <div className="stat" data-tone="cyan">
              <dt>Cadência da localização</dt>
              <dd>
                <span data-contador="5">0</span> min
              </dd>
              <span className="stat-foot">serviço em primeiro plano</span>
            </div>
            <div className="stat">
              <dt>Permissões sensors</dt>
              <dd>0</dd>
              <span className="stat-foot">câmara, microfone, SMS</span>
            </div>
            <div className="stat" data-tone="muted">
              <dt>Serviços Google</dt>
              <dd>0</dd>
              <span className="stat-foot">funciona em qualquer Android</span>
            </div>
          </dl>
        </section>

        {/* ================= COMO FUNCIONA ================= */}
        <section className="seccao" id="como-funciona">
          <div className="seccao-centro" data-reveal>
            <h2 className="seccao-titulo">Quatro passos, e está a funcionar</h2>
            <p className="seccao-sub">
              Da instalação ao primeiro dado no painel — sem serviços técnicos.
            </p>
          </div>
          <div className="passos">
            {PASSOS.map((p, i) => (
              <article className="passo" key={p.titulo} data-passo>
                <h3>{p.titulo}</h3>
                <p>{p.texto}</p>
                <span className="sr-only">Passo {i + 1}</span>
              </article>
            ))}
          </div>
        </section>

        {/* ================= FUNCIONALIDADES ================= */}
        <section className="seccao" id="funcionalidades">
          <div className="seccao-centro" data-reveal>
            <h2 className="seccao-titulo">Tudo o que precisas, nada mais</h2>
            <p className="seccao-sub">
              Cada recolha é uma categoria que o dono do telemóvel liga e desliga
              à vontade. O que não está autorizado, não é recolhido.
            </p>
          </div>
          <div className="grelha" data-stagger>
            {RECURSOS.map((r) => (
              <article className="recurso" key={r.titulo}>
                <div className="recurso-icone">{r.icone}</div>
                <h3>{r.titulo}</h3>
                <p>{r.texto}</p>
              </article>
            ))}
          </div>
        </section>

        {/* ================= PLANOS ================= */}
        <section className="seccao" id="planos">
          <div className="seccao-centro" data-reveal>
            <h2 className="seccao-titulo">Preços simples</h2>
            <p className="seccao-sub">
              Sem custos escondidos. Cancelas quando quiseres.
            </p>
          </div>
          <div className="planos" data-stagger>
            {PLANOS.map((p) => (
              <article
                className={`plano${p.destaque ? " plano-destaque" : ""}`}
                key={p.nome}
              >
                {p.destaque && <span className="plano-selo">Mais escolhido</span>}
                <h3>{p.nome}</h3>
                <p className="plano-descricao">{p.descricao}</p>
                <div className="plano-preco">
                  {p.preco}
                  <small>{p.unidade}</small>
                </div>
                <ul>
                  {p.recursos.map((r) => (
                    <li key={r}>
                      <IconeCheck />
                      {r}
                    </li>
                  ))}
                </ul>
                <Link
                  className={`btn ${p.destaque ? "btn-primary" : "btn-ghost"}`}
                  to="/entrar"
                >
                  {p.accao}
                </Link>
              </article>
            ))}
          </div>
        </section>

        {/* ================= FAQ ================= */}
        <section className="seccao" id="perguntas">
          <div className="seccao-centro" data-reveal>
            <h2 className="seccao-titulo">Perguntas frequentes</h2>
            <p className="seccao-sub">
              As dúvidas que nos fazem mais — respondidas sem rodeios.
            </p>
          </div>
          <div className="faq" data-stagger>
            {FAQ.map((f) => (
              <details className="faq-item" key={f.p}>
                <summary>{f.p}</summary>
                <p>{f.r}</p>
              </details>
            ))}
          </div>
        </section>

        {/* ================= CTA FINAL ================= */}
        <section className="seccao">
          <div className="cta-final" data-reveal>
            <h2>Pronto para ver o teu telemóvel?</h2>
            <p>
              Instala a app, cria a tua conta em menos de dois minutos e acompanha
              tudo a partir do teu painel.
            </p>
            <div className="hero-acoes">
              <Link className="btn btn-primary" to="/entrar">
                Criar conta grátis
              </Link>
              <a className="btn btn-ghost" href="#planos">
                Ver planos
              </a>
            </div>
          </div>
        </section>
      </main>

      <footer className="landing-rodape">
        <nav aria-label="Ligações do rodapé">
          <a href="#como-funciona">Como funciona</a>
          <a href="#funcionalidades">Funcionalidades</a>
          <a href="#planos">Planos</a>
          <a href="#perguntas">Perguntas</a>
          <Link to="/entrar">Entrar</Link>
        </nav>
        <p>
          SeeFast — supervisão com consentimento explícito. Os dados recolhidos
          nunca são apagados pelo administrador sem pedido do dono.
        </p>
      </footer>
    </div>
  );
}
