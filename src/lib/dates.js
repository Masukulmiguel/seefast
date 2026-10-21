// Ordena uma lista do mais recente para o mais antigo.
// Itens sem data válida ficam no fim, mantendo a ordem relativa entre si.
export function sortByDateDesc(items, campo = "em") {
  if (!Array.isArray(items)) return [];
  return [...items].sort((a, b) => {
    const ta = Date.parse(a?.[campo]);
    const tb = Date.parse(b?.[campo]);
    const va = Number.isNaN(ta) ? -Infinity : ta;
    const vb = Number.isNaN(tb) ? -Infinity : tb;
    if (va === vb) return 0;
    return vb - va;
  });
}
