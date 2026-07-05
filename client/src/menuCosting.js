export const LABOUR_RATE_EUR = 14;
export const LABOUR_BUFFER_MIN = 5;

export function defaultMenuCosting() {
  return {
    suppliers: [],
    storageLocations: [],
    tabs: [{ id: uid(), title: "Menu", items: [] }],
  };
}

export function uid() {
  return Math.random().toString(36).slice(2, 10);
}

export function blankIngredient() {
  return {
    id: uid(),
    name: "",
    amount: 0,
    pricePerUnit: 0,
    supplier: "",
    storage: "",
  };
}

export function blankMenuItem() {
  return {
    id: uid(),
    name: "New item",
    editing: false,
    prepTimeMin: 0,
    cookTimeMin: 0,
    fixedCost: 0,
    price: 0,
    ingredients: [blankIngredient()],
  };
}

export function normalizeMenuCosting(raw) {
  if (!raw || typeof raw !== "object") return defaultMenuCosting();
  const tabs =
    Array.isArray(raw.tabs) && raw.tabs.length
      ? raw.tabs.map((t) => ({
          id: t.id || uid(),
          title: t.title ?? "Untitled",
          items: (t.items ?? []).map(normalizeMenuItem),
        }))
      : defaultMenuCosting().tabs;
  return {
    suppliers: Array.isArray(raw.suppliers) ? raw.suppliers.filter(Boolean) : [],
    storageLocations: Array.isArray(raw.storageLocations)
      ? raw.storageLocations.filter(Boolean)
      : [],
    tabs,
  };
}

function normalizeMenuItem(item) {
  return {
    id: item.id || uid(),
    name: item.name ?? "Untitled",
    editing: !!(item.editing ?? item.expanded),
    prepTimeMin: num(item.prepTimeMin),
    cookTimeMin: num(item.cookTimeMin),
    fixedCost: num(item.fixedCost),
    price: num(item.price),
    ingredients: (item.ingredients ?? []).length
      ? item.ingredients.map((ing) => ({
          id: ing.id || uid(),
          name: ing.name ?? "",
          amount: num(ing.amount),
          pricePerUnit: num(ing.pricePerUnit),
          supplier: ing.supplier ?? "",
          storage: ing.storage ?? "",
        }))
      : [blankIngredient()],
  };
}

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export function materialCost(item) {
  return (item.ingredients ?? []).reduce(
    (sum, ing) => sum + num(ing.amount) * num(ing.pricePerUnit),
    0,
  );
}

export function labourCost(item) {
  const minutes = num(item.prepTimeMin) + num(item.cookTimeMin) + LABOUR_BUFFER_MIN;
  return (minutes / 60) * LABOUR_RATE_EUR;
}

export function itemCosts(item) {
  const material = materialCost(item);
  const labour = labourCost(item);
  const fixed = num(item.fixedCost);
  const price = num(item.price);
  const totalCost = material + labour + fixed;
  const profit = price - totalCost;
  const marginPct = price > 0 ? (profit / price) * 100 : 0;
  return { material, labour, fixed, totalCost, profit, marginPct, price };
}

export function totalTimeMin(item) {
  return num(item.prepTimeMin) + num(item.cookTimeMin);
}

export function fmtEur(n) {
  return `€${n.toFixed(2)}`;
}

export function fmtPct(n) {
  return `${n.toFixed(1)}%`;
}
