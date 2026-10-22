import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup, within, waitFor } from "@testing-library/react";
import App from "./App.jsx";

// Tabela literal derivada do plano (path, heading do h1, nome do link).
const routes = [
  { path: "/", heading: "Dashboard", label: "Dashboard" },
  { path: "/dispositivos", heading: "Dispositivos", label: "Dispositivos" },
  { path: "/localizacao", heading: "Localização", label: "Localização" },
  { path: "/controlo-parental", heading: "Controlo Parental", label: "Controlo Parental" },
  { path: "/aplicacoes", heading: "Aplicações", label: "Aplicações" },
  { path: "/alertas", heading: "Alertas", label: "Alertas" },
  { path: "/permissoes", heading: "Permissões", label: "Permissões" },
  { path: "/auditoria", heading: "Auditoria", label: "Auditoria" },
];

// Payloads reais de server/api.js (GET /api/devices, GET /api/alerts).
const devicesPayload = {
  devices: [
    { id: "dev-001", nome: "Telemóvel da Ana", estado: "online", bateria: 82 },
    { id: "dev-002", nome: "Tablet do João", estado: "offline", bateria: 34 },
  ],
};
const alertsPayload = {
  alerts: [
    { id: "alt-001", nivel: "warning", mensagem: "Dispositivo dev-002 sem ligação", em: "2026-10-20T09:00:00Z" },
  ],
};

const UTILIZADOR = { id: "u1", email: "ana@seefast", role: "admin" };

function go(path) {
  window.history.pushState({}, "", path);
}

// Envolve um mock da API de dados de forma a responder à sessão com um
// utilizador autenticado (o painel só aparece depois de /api/session).
function comSessao(mock) {
  return vi.fn(async (url, opts) => {
    if (String(url) === "/api/session") {
      return {
        ok: true,
        status: 200,
        json: async () => ({ user: UTILIZADOR }),
      };
    }
    return mock(url, opts);
  });
}

// Controla o viewport: jsdom não avalia media queries.
function mockViewport({ desktop }) {
  const query = "(min-width: 901px)";
  const mql = {
    matches: desktop,
    media: query,
    onchange: null,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
    dispatchEvent() {
      return false;
    },
  };
  window.matchMedia = vi.fn(() => mql);
}

beforeEach(() => {
  // Por omissão há sessão iniciada e a API de dados não responde (pendente),
  // para não gerar updates assíncronos.
  vi.stubGlobal(
    "fetch",
    comSessao(async (url) => {
      if (String(url) === "/api/logout") {
        return { ok: true, status: 204, json: async () => ({}) };
      }
      return new Promise(() => {});
    })
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("sessão", () => {
  it("sem sessão válida mostra o formulário de login", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url) => {
        if (String(url) === "/api/session") {
          return { ok: false, status: 401, json: async () => ({ error: "nao_autenticado" }) };
        }
        return new Promise(() => {});
      })
    );
    go("/entrar");
    render(<App />);
    expect(
      await screen.findByRole("heading", { level: 1, name: "Entrar" })
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
  });

  it("sem sessão válida mostra o site público", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url) => {
        if (String(url) === "/api/session") {
          return { ok: false, status: 401, json: async () => ({}) };
        }
        return new Promise(() => {});
      })
    );
    go("/");
    render(<App />);
    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: /Veja o telemóvel/i,
      })
    ).toBeInTheDocument();
  });

  it("com sessão válida mostra o painel", async () => {
    go("/");
    render(<App />);
    expect(
      await screen.findByRole("heading", { level: 1, name: "Dashboard" })
    ).toBeInTheDocument();
  });

  it("login com credenciais válidas entra no painel", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url) => {
        if (String(url) === "/api/session") {
          return { ok: false, status: 401, json: async () => ({}) };
        }
        if (String(url) === "/api/login") {
          return { ok: true, status: 200, json: async () => ({ user: UTILIZADOR }) };
        }
        return new Promise(() => {});
      })
    );
    go("/entrar");
    render(<App />);
    await screen.findByRole("heading", { level: 1, name: "Entrar" });
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "ana@seefast" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "segredo123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Entrar" }));
    expect(
      await screen.findByRole("heading", { level: 1, name: "Dashboard" })
    ).toBeInTheDocument();
  });

  it("login inválido mostra mensagem de erro", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url) => {
        if (String(url) === "/api/session") {
          return { ok: false, status: 401, json: async () => ({}) };
        }
        if (String(url) === "/api/login") {
          return { ok: false, status: 401, json: async () => ({ error: "credenciais_invalidas" }) };
        }
        return new Promise(() => {});
      })
    );
    go("/entrar");
    render(<App />);
    await screen.findByRole("heading", { level: 1, name: "Entrar" });
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "ana@seefast" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "errada" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Entrar" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/incorretos/i);
  });

  it("o botão Sair volta ao site público", async () => {
    go("/");
    render(<App />);
    await screen.findByRole("heading", { level: 1, name: "Dashboard" });
    fireEvent.click(screen.getByRole("button", { name: "Sair", hidden: true }));
    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: /Veja o telemóvel/i,
      })
    ).toBeInTheDocument();
  });
});

describe("painéis por papel", () => {
  it("o admin vê a página de administração", async () => {
    vi.stubGlobal(
      "fetch",
      comSessao(async () => ({
        ok: true,
        json: async () => ({ clientes: [], devices: [] }),
      }))
    );
    go("/admin");
    render(<App />);
    expect(
      await screen.findByRole("heading", { level: 1, name: "Administração" })
    ).toBeInTheDocument();
  });

  it("o cliente vê o seu próprio painel", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url) => {
        if (String(url) === "/api/session") {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              user: { id: "u9", email: "miguel@familia.pt", role: "cliente" },
            }),
          };
        }
        return {
          ok: true,
          json: async () => ({ devices: [], locations: [], apps: [], usage: [], alerts: [], permissions: [] }),
        };
      })
    );
    go("/cliente");
    render(<App />);
    expect(
      await screen.findByRole("heading", { level: 1, name: "O meu telemóvel" })
    ).toBeInTheDocument();
  });

  it("o cliente não vê a página de administração de clientes", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url) => {
        if (String(url) === "/api/session") {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              user: { id: "u9", email: "miguel@familia.pt", role: "cliente" },
            }),
          };
        }
        return {
          ok: true,
          json: async () => ({ devices: [], locations: [], apps: [], usage: [], alerts: [], permissions: [] }),
        };
      })
    );
    go("/admin");
    render(<App />);
    await screen.findByRole("heading", { level: 1, name: "O meu telemóvel" });
    expect(
      screen.queryByRole("heading", { level: 1, name: "Administração" })
    ).not.toBeInTheDocument();
  });
});

describe("acções de administrador", () => {
  it("o admin pode bloquear uma aplicação", async () => {
    const chamadas = [];
    vi.stubGlobal(
      "fetch",
      comSessao(async (url, opts) => {
        if (String(url).includes("/api/apps/")) {
          chamadas.push({
            url: String(url),
            metodo: opts?.method,
            corpo: JSON.parse(opts.body),
          });
          return {
            ok: true,
            status: 200,
            json: async () => ({ app: { id: "app-001", bloqueada: true } }),
          };
        }
        return {
          ok: true,
          json: async () => ({
            apps: [
              { id: "app-001", deviceId: "dev-001", nome: "Instagram", pacote: "com.instagram.android", tamanhoMb: 45, bloqueada: false },
            ],
          }),
        };
      })
    );
    go("/aplicacoes");
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "Bloquear" }));
    await waitFor(() => expect(chamadas).toHaveLength(1));
    expect(chamadas[0].metodo).toBe("PATCH");
    expect(chamadas[0].corpo).toEqual({ bloqueada: true });
  });

  it("um visualizador não vê os botões de escrita", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url) => {
        if (String(url) === "/api/session") {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              user: { id: "u2", email: "visor@seefast", role: "visualizador" },
            }),
          };
        }
        return {
          ok: true,
          json: async () => ({
            apps: [
              { id: "app-001", deviceId: "dev-001", nome: "Instagram", pacote: "com.instagram.android", tamanhoMb: 45, bloqueada: false },
            ],
          }),
        };
      })
    );
    go("/aplicacoes");
    render(<App />);
    await screen.findByText(/Instagram/);
    expect(
      screen.queryByRole("button", { name: "Bloquear" })
    ).not.toBeInTheDocument();
  });

  it("o admin pode reconhecer um alerta", async () => {
    const chamadas = [];
    vi.stubGlobal(
      "fetch",
      comSessao(async (url, opts) => {
        if (String(url).includes("/ack")) {
          chamadas.push({ url: String(url), metodo: opts?.method });
          return {
            ok: true,
            status: 200,
            json: async () => ({ alert: { id: "alt-001", reconhecido: true } }),
          };
        }
        return {
          ok: true,
          json: async () => ({
            alerts: [
              { id: "alt-001", nivel: "warning", mensagem: "Dispositivo dev-002 sem ligação", em: "2026-10-20T09:00:00Z", reconhecido: false },
            ],
          }),
        };
      })
    );
    go("/alertas");
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "Reconhecer" }));
    await waitFor(() => expect(chamadas).toHaveLength(1));
    expect(chamadas[0].metodo).toBe("POST");
    expect(chamadas[0].url).toContain("/api/alerts/alt-001/ack");
  });

  it("o admin pode guardar o limite de ecrã", async () => {
    const chamadas = [];
    vi.stubGlobal(
      "fetch",
      comSessao(async (url, opts) => {
        if (String(url).includes("/api/parental-rules/")) {
          chamadas.push({ url: String(url), metodo: opts?.method, corpo: JSON.parse(opts.body) });
          return {
            ok: true,
            status: 200,
            json: async () => ({
              rule: { id: "reg-001", limiteMinutos: 90, inicio: "20:00", fim: "22:00" },
            }),
          };
        }
        return {
          ok: true,
          json: async () => ({
            rules: [
              { id: "reg-001", deviceId: "dev-001", nome: "Telemóvel da Ana", limiteMinutos: 120, inicio: "20:00", fim: "22:00" },
            ],
          }),
        };
      })
    );
    go("/controlo-parental");
    render(<App />);
    const input = await screen.findByLabelText(/limite de ecrã/i);
    fireEvent.change(input, { target: { value: "90" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));
    await waitFor(() => expect(chamadas).toHaveLength(1));
    expect(chamadas[0].metodo).toBe("PATCH");
    expect(chamadas[0].corpo).toEqual({ limiteMinutos: 90 });
  });
});

describe("dispositivos e tempo real", () => {
  it("a página de Aplicações mostra o tempo de uso", async () => {
    vi.stubGlobal(
      "fetch",
      comSessao(async () => ({
        ok: true,
        json: async () => ({
          apps: [
            { id: "app-001", deviceId: "dev-001", nome: "Instagram", pacote: "com.instagram.android", tamanhoMb: 45, bloqueada: false, minutos: 145 },
          ],
        }),
      }))
    );
    go("/aplicacoes");
    render(<App />);
    expect(await screen.findByText(/145 min/)).toBeInTheDocument();
  });

  it("o admin regista um dispositivo e vê o token uma única vez", async () => {
    const chamadas = [];
    vi.stubGlobal(
      "fetch",
      comSessao(async (url, opts) => {
        if (opts?.method === "POST" && String(url).endsWith("/api/devices")) {
          chamadas.push({ url: String(url), corpo: JSON.parse(opts.body) });
          return {
            ok: true,
            status: 200,
            json: async () => ({
              device: { id: "dev-abc123", nome: "Telemóvel do Miguel", token: "tok-secreto-123" },
            }),
          };
        }
        return { ok: true, json: async () => ({ devices: [] }) };
      })
    );
    go("/dispositivos");
    render(<App />);
    fireEvent.change(await screen.findByLabelText(/nome do dispositivo/i), {
      target: { value: "Telemóvel do Miguel" },
    });
    fireEvent.click(screen.getByRole("button", { name: /registar dispositivo/i }));
    expect(await screen.findByText(/tok-secreto-123/)).toBeInTheDocument();
    expect(screen.getByText(/só aparece uma vez/i)).toBeInTheDocument();
    expect(chamadas[0].corpo).toEqual({ nome: "Telemóvel do Miguel" });
  });

  it("um visualizador não vê o formulário de registo de dispositivo", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url) => {
        if (String(url) === "/api/session") {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              user: { id: "u2", email: "visor@seefast", role: "visualizador" },
            }),
          };
        }
        return { ok: true, json: async () => ({ devices: [] }) };
      })
    );
    go("/dispositivos");
    render(<App />);
    await screen.findByRole("heading", { level: 1, name: "Dispositivos" });
    expect(
      screen.queryByRole("button", { name: /registar dispositivo/i })
    ).not.toBeInTheDocument();
  });

  it("a página de Dispositivos volta a perguntar à API periodicamente", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const chamadas = [];
    vi.stubGlobal(
      "fetch",
      comSessao(async (url) => {
        if (String(url) !== "/api/session") chamadas.push(String(url));
        return { ok: true, json: async () => ({ devices: [] }) };
      })
    );
    go("/dispositivos");
    render(<App />);
    await vi.waitFor(() => expect(chamadas.length).toBeGreaterThan(0));
    const inicial = chamadas.length;
    await vi.advanceTimersByTimeAsync(31000);
    expect(chamadas.length).toBeGreaterThan(inicial);
    vi.useRealTimers();
  });
});

describe("navegação", () => {
  it.each(routes)("a rota $path renderiza a página $heading", async ({ path, heading }) => {
    go(path);
    render(<App />);
    expect(
      await screen.findByRole("heading", { level: 1, name: heading })
    ).toBeInTheDocument();
  });

  it.each(routes)("o link $label aponta para $path", async ({ path, label }) => {
    go("/");
    render(<App />);
    // hidden: true — o objetivo é o contrato do href, não a visibilidade
    // (a visibilidade é verada em "sidebar e acessibilidade").
    expect(
      await screen.findByRole("link", { name: label, hidden: true })
    ).toHaveAttribute("href", path);
  });

  it("rota desconhecida mostra 404 com regresso ao dashboard", async () => {
    go("/rota-inexistente");
    render(<App />);
    expect(
      await screen.findByRole("heading", { level: 1, name: /página não encontrada/i })
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("link", { name: /voltar ao dashboard/i }));
    expect(
      await screen.findByRole("heading", { level: 1, name: "Dashboard" })
    ).toBeInTheDocument();
  });
});

describe("sidebar e acessibilidade", () => {
  it("em desktop a sidebar visível não está oculta a leitores de ecrã", async () => {
    mockViewport({ desktop: true });
    go("/");
    const { container } = render(<App />);
    await waitFor(() =>
      expect(container.querySelector("aside")).not.toBeNull()
    );
    const aside = container.querySelector("aside");
    expect(aside).not.toHaveAttribute("aria-hidden", "true");
  });

  it("em mobile a sidebar fechada está oculta", async () => {
    mockViewport({ desktop: false });
    go("/");
    const { container } = render(<App />);
    await waitFor(() =>
      expect(container.querySelector("aside")).not.toBeNull()
    );
    expect(container.querySelector("aside")).toHaveAttribute("aria-hidden", "true");
  });

  it("em mobile o botão de menu abre e Escape fecha a sidebar", async () => {
    mockViewport({ desktop: false });
    go("/");
    const { container } = render(<App />);
    await waitFor(() =>
      expect(container.querySelector("aside")).not.toBeNull()
    );
    fireEvent.click(
      screen.getByRole("button", { name: /abrir menu/i, hidden: true })
    );
    expect(container.querySelector(".sidebar-overlay")).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(container.querySelector(".sidebar-overlay")).not.toBeInTheDocument();
  });
});

describe("header", () => {
  it("mostra o título da página atual", async () => {
    go("/dispositivos");
    render(<App />);
    expect(await screen.findByRole("banner")).toHaveTextContent("Dispositivos");
  });
});

describe("ligação à API", () => {
  it("o Dashboard mostra os dispositivos e alertas da API", async () => {
    vi.stubGlobal(
      "fetch",
      comSessao(async (url) => ({
        ok: true,
        json: async () =>
          String(url).includes("devices") ? devicesPayload : alertsPayload,
      }))
    );
    go("/");
    render(<App />);
    expect(await screen.findByText(/Telemóvel da Ana/)).toBeInTheDocument();
    expect(screen.getByText(/Dispositivo dev-002 sem ligação/)).toBeInTheDocument();
  });

  it("a página de Dispositivos lista os dispositivos da API", async () => {
    vi.stubGlobal(
      "fetch",
      comSessao(async () => ({ ok: true, json: async () => devicesPayload }))
    );
    go("/dispositivos");
    render(<App />);
    expect(await screen.findByText(/Tablet do João/)).toBeInTheDocument();
  });

  it("a página de Alertas mostra as mensagens da API", async () => {
    vi.stubGlobal(
      "fetch",
      comSessao(async () => ({ ok: true, json: async () => alertsPayload }))
    );
    go("/alertas");
    render(<App />);
    expect(
      await screen.findByText(/Dispositivo dev-002 sem ligação/)
    ).toBeInTheDocument();
  });

  it("sem API disponível o Dashboard mostra mensagem de erro", async () => {
    vi.stubGlobal(
      "fetch",
      comSessao(async () => {
        throw new Error("offline");
      })
    );
    go("/");
    render(<App />);
    expect(
      await screen.findByText(/não foi possível carregar/i)
    ).toBeInTheDocument();
  });

  it("o Dashboard mostra os indicadores de estado", async () => {
    const devices = {
      devices: [
        { id: "d1", nome: "Tablet", estado: "online", bateria: 100 },
        { id: "d2", nome: "Telemóvel", estado: "offline", bateria: 50 },
        { id: "d3", nome: "Portátil", estado: "online", bateria: 0 },
      ],
    };
    vi.stubGlobal(
      "fetch",
      comSessao(async (url) => ({
        ok: true,
        json: async () =>
          String(url).includes("devices") ? devices : alertsPayload,
      }))
    );
    go("/");
    const { container } = render(<App />);
    await waitFor(() =>
      expect(container.querySelector(".stat-row")).not.toBeNull()
    );
    const stats = within(container.querySelector(".stat-row"));
    expect(stats.getByText("Dispositivos")).toBeInTheDocument();
    expect(stats.getByText("3")).toBeInTheDocument();
    expect(stats.getByText("Online")).toBeInTheDocument();
    expect(stats.getByText("2")).toBeInTheDocument();
    expect(stats.getByText("Bateria média")).toBeInTheDocument();
    expect(stats.getByText("50%")).toBeInTheDocument();
    expect(stats.getByText("Alertas")).toBeInTheDocument();
  });

  it("a página de Alertas mostra primeiro o alerta mais recente", async () => {
    const alerts = {
      alerts: [
        { id: "a1", nivel: "warning", mensagem: "Alerta antigo", em: "2026-10-19T09:00:00Z" },
        { id: "a2", nivel: "critical", mensagem: "Alerta recente", em: "2026-10-21T09:00:00Z" },
      ],
    };
    vi.stubGlobal(
      "fetch",
      comSessao(async () => ({ ok: true, json: async () => alerts }))
    );
    go("/alertas");
    render(<App />);
    const items = await screen.findAllByRole("listitem");
    expect(items[0]).toHaveTextContent(/Alerta recente/);
    expect(items[1]).toHaveTextContent(/Alerta antigo/);
  });

  // Cada página tem a sua coleção e o seu formato de linha.
  const paginasApi = [
    {
      path: "/localizacao",
      texto: /38\.7223/,
      payload: {
        locations: [
          { deviceId: "dev-001", nome: "Telemóvel da Ana", lat: 38.7223, lon: -9.1393, atualizadoEm: "2026-10-21T08:00:00Z" },
        ],
      },
    },
    {
      path: "/controlo-parental",
      texto: /120 min/,
      payload: {
        rules: [
          { id: "reg-001", deviceId: "dev-001", nome: "Telemóvel da Ana", limiteMinutos: 120, inicio: "20:00", fim: "22:00" },
        ],
      },
    },
    {
      path: "/aplicacoes",
      texto: /Instagram/,
      payload: {
        apps: [
          { id: "app-001", deviceId: "dev-001", nome: "Instagram", pacote: "com.instagram.android", tamanhoMb: 45, bloqueada: true },
        ],
      },
    },
    {
      path: "/permissoes",
      texto: /consentimento concedido/,
      payload: {
        permissions: [
          { deviceId: "dev-001", nome: "Telemóvel da Ana", consentimento: "concedido", camera: false, microfone: false, localizacao: true },
        ],
      },
    },
    {
      path: "/auditoria",
      texto: /atualizou limite de ecrã/,
      payload: {
        entries: [
          { id: "aud-001", em: "2026-10-21T07:45:00Z", ator: "admin@seefast", acao: "atualizou limite de ecrã", alvo: "dev-001" },
        ],
      },
    },
  ];

  it.each(paginasApi)("a página $path mostra os dados da API", async ({ path, payload, texto }) => {
    vi.stubGlobal(
      "fetch",
      comSessao(async () => ({ ok: true, json: async () => payload }))
    );
    go(path);
    render(<App />);
    expect(await screen.findByText(texto)).toBeInTheDocument();
  });
});
