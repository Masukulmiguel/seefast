import { describe, it, expect } from "vitest";
import { sortByDateDesc } from "./dates.js";

describe("sortByDateDesc", () => {
  it("ordena do mais recente para o mais antigo", () => {
    const items = [
      { id: "a1", em: "2026-10-19T09:00:00Z" },
      { id: "a3", em: "2026-10-21T09:00:00Z" },
      { id: "a2", em: "2026-10-20T09:00:00Z" },
    ];
    expect(sortByDateDesc(items).map((a) => a.id)).toEqual(["a3", "a2", "a1"]);
  });

  it("não altera o array original", () => {
    const items = [
      { id: "a1", em: "2026-10-19T09:00:00Z" },
      { id: "a2", em: "2026-10-21T09:00:00Z" },
    ];
    const copia = [...items];
    sortByDateDesc(items);
    expect(items).toEqual(copia);
  });

  it("coloca itens sem data válida no fim, mantendo a ordem entre eles", () => {
    const items = [
      { id: "sem-data-1" },
      { id: "com-data", em: "2026-10-21T09:00:00Z" },
      { id: "sem-data-2" },
    ];
    expect(sortByDateDesc(items).map((a) => a.id)).toEqual([
      "com-data",
      "sem-data-1",
      "sem-data-2",
    ]);
  });

  it("usa o campo indicado", () => {
    const items = [
      { id: "a1", atualizadoEm: "2026-10-19T09:00:00Z" },
      { id: "a2", atualizadoEm: "2026-10-21T09:00:00Z" },
    ];
    expect(sortByDateDesc(items, "atualizadoEm").map((a) => a.id)).toEqual([
      "a2",
      "a1",
    ]);
  });
});
