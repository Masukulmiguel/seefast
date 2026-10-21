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

function go(path) {
  window.history.pushState({}, "", path);
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
  // Por omissão a API não responde: pendente para não gerar updates assíncronos.
  vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("navegação", () => {
  it.each(routes)("a rota $path renderiza a página $heading", ({ path, heading }) => {
    go(path);
    render(<App />);
    expect(screen.getByRole("heading", { level: 1, name: heading })).toBeInTheDocument();
  });

  it.each(routes)("o link $label aponta para $path", ({ path, label }) => {
    go("/");
    render(<App />);
    // hidden: true — o objetivo é o contrato do href, não a visibilidade
    // (a visibilidade é verada em "sidebar e acessibilidade").
    expect(
      screen.getByRole("link", { name: label, hidden: true })
    ).toHaveAttribute("href", path);
  });

  it("rota desconhecida mostra 404 com regresso ao dashboard", async () => {
    go("/rota-inexistente");
    render(<App />);
    expect(
      screen.getByRole("heading", { level: 1, name: /página não encontrada/i })
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("link", { name: /voltar ao dashboard/i }));
    expect(
      await screen.findByRole("heading", { level: 1, name: "Dashboard" })
    ).toBeInTheDocument();
  });
});

describe("sidebar e acessibilidade", () => {
  it("em desktop a sidebar visível não está oculta a leitores de ecrã", () => {
    mockViewport({ desktop: true });
    go("/");
    const { container } = render(<App />);
    const aside = container.querySelector("aside");
    expect(aside).not.toHaveAttribute("aria-hidden", "true");
  });

  it("em mobile a sidebar fechada está oculta", () => {
    mockViewport({ desktop: false });
    go("/");
    const { container } = render(<App />);
    expect(container.querySelector("aside")).toHaveAttribute("aria-hidden", "true");
  });

  it("em mobile o botão de menu abre e Escape fecha a sidebar", () => {
    mockViewport({ desktop: false });
    go("/");
    const { container } = render(<App />);
    fireEvent.click(
      screen.getByRole("button", { name: /abrir menu/i, hidden: true })
    );
    expect(container.querySelector(".sidebar-overlay")).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(container.querySelector(".sidebar-overlay")).not.toBeInTheDocument();
  });
});

describe("header", () => {
  it("mostra o título da página atual", () => {
    go("/dispositivos");
    render(<App />);
    expect(screen.getByRole("banner")).toHaveTextContent("Dispositivos");
  });
});

describe("ligação à API", () => {
  it("o Dashboard mostra os dispositivos e alertas da API", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url) => ({
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
      vi.fn(async () => ({ ok: true, json: async () => devicesPayload }))
    );
    go("/dispositivos");
    render(<App />);
    expect(await screen.findByText(/Tablet do João/)).toBeInTheDocument();
  });

  it("a página de Alertas mostra as mensagens da API", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, json: async () => alertsPayload }))
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
      vi.fn(async () => {
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
      vi.fn(async (url) => ({
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
      vi.fn(async () => ({ ok: true, json: async () => alerts }))
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
      vi.fn(async () => ({ ok: true, json: async () => payload }))
    );
    go(path);
    render(<App />);
    expect(await screen.findByText(texto)).toBeInTheDocument();
  });
});
