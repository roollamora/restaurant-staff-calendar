import { useState } from "react";
import {
  blankIngredient,
  blankMenuItem,
  fmtEur,
  fmtPct,
  isDecimalInput,
  itemCosts,
  totalTimeMin,
  uid,
} from "./menuCosting.js";

function DecimalInput({ value, onChange, className }) {
  return (
    <input
      type="text"
      inputMode="decimal"
      className={className}
      value={value ?? ""}
      onChange={(e) => {
        const v = e.target.value.replace(",", ".");
        if (isDecimalInput(v)) onChange(v);
      }}
    />
  );
}

function OptionSelect({ value, options, onChange, onAddOption, placeholder, addLabel }) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");

  function commitAdd() {
    const name = draft.trim();
    if (!name) return;
    onAddOption(name);
    onChange(name);
    setDraft("");
    setAdding(false);
  }

  if (adding) {
    return (
      <div className="row" style={{ gap: 4 }}>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={addLabel}
          autoFocus
          onKeyDown={(e) => {
            if (e.key === "Enter") commitAdd();
            if (e.key === "Escape") setAdding(false);
          }}
        />
        <button type="button" className="btn btn-primary" onClick={commitAdd}>
          Add
        </button>
        <button type="button" className="btn btn-ghost" onClick={() => setAdding(false)}>
          ✕
        </button>
      </div>
    );
  }

  return (
    <select
      value={value || ""}
      onChange={(e) => {
        if (e.target.value === "__add__") setAdding(true);
        else onChange(e.target.value);
      }}
    >
      <option value="">{placeholder}</option>
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
      <option value="__add__">+ {addLabel}…</option>
    </select>
  );
}

function MenuItemBox({
  item,
  suppliers,
  storageLocations,
  onChange,
  onRemove,
  onAddSupplier,
  onAddStorage,
}) {
  const costs = itemCosts(item);
  const time = totalTimeMin(item);
  const expanded = !!item.expanded;
  const editing = !!item.editing;

  function patch(partial) {
    onChange({ ...item, ...partial });
  }

  function toggleExpanded() {
    if (expanded) patch({ expanded: false, editing: false });
    else patch({ expanded: true, editing: false });
  }

  function patchIngredient(id, partial) {
    patch({
      ingredients: item.ingredients.map((ing) =>
        ing.id === id ? { ...ing, ...partial } : ing,
      ),
    });
  }

  function addIngredient() {
    patch({ ingredients: [...item.ingredients, blankIngredient()] });
  }

  function removeIngredient(id) {
    if (item.ingredients.length <= 1) return;
    patch({ ingredients: item.ingredients.filter((ing) => ing.id !== id) });
  }

  const ingredientRows = item.ingredients.map((ing) =>
    editing ? (
      <div key={ing.id} className="menu-ing-grid">
        <input
          value={ing.name}
          onChange={(e) => patchIngredient(ing.id, { name: e.target.value })}
          placeholder="Ingredient"
        />
        <DecimalInput
          className="menu-ing-num"
          value={ing.amount}
          onChange={(v) => patchIngredient(ing.id, { amount: v })}
        />
        <DecimalInput
          className="menu-ing-num"
          value={ing.pricePerUnit}
          onChange={(v) => patchIngredient(ing.id, { pricePerUnit: v })}
        />
        <OptionSelect
          value={ing.supplier}
          options={suppliers}
          onChange={(v) => patchIngredient(ing.id, { supplier: v })}
          onAddOption={onAddSupplier}
          placeholder="Supplier"
          addLabel="Add supplier"
        />
        <OptionSelect
          value={ing.storage}
          options={storageLocations}
          onChange={(v) => patchIngredient(ing.id, { storage: v })}
          onAddOption={onAddStorage}
          placeholder="Storage"
          addLabel="Add storage"
        />
        <button
          type="button"
          className="icon-btn"
          title="Remove ingredient"
          disabled={item.ingredients.length <= 1}
          onClick={() => removeIngredient(ing.id)}
        >
          ✕
        </button>
      </div>
    ) : (
      <div key={ing.id} className="menu-ing-grid menu-ing-read">
        <span>{ing.name || "—"}</span>
        <span className="menu-ing-num">{ing.amount || ""}</span>
        <span className="menu-ing-num">{ing.pricePerUnit || ""}</span>
        <span>{ing.supplier || "—"}</span>
        <span>{ing.storage || "—"}</span>
        <span />
      </div>
    ),
  );

  return (
    <div className={`menu-item-box${expanded ? " expanded" : ""}${editing ? " editing" : ""}`}>
      <button type="button" className="menu-item-head" onClick={toggleExpanded}>
        <span className="menu-item-chevron">{expanded ? "▾" : "▸"}</span>
        {!expanded && (
          <>
            <span className="menu-item-name">{item.name || "Untitled"}</span>
            <span className="menu-item-summary muted">
              {time} min · {fmtEur(costs.totalCost)} cost · {fmtEur(costs.profit)} profit (
              {fmtPct(costs.marginPct)})
            </span>
          </>
        )}
        {expanded && (
          <span className="menu-item-name">{item.name || "Untitled"}</span>
        )}
        <div className="menu-item-actions" onClick={(e) => e.stopPropagation()}>
          {expanded && !editing && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => patch({ editing: true })}
            >
              Edit
            </button>
          )}
          {editing && (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => patch({ editing: false })}
            >
              Done
            </button>
          )}
          <button
            type="button"
            className="icon-btn menu-item-remove"
            title="Remove item"
            onClick={onRemove}
          >
            ✕
          </button>
        </div>
      </button>

      {expanded && (
        <div className="menu-item-body">
          {editing && (
            <label className="field">
              <span className="muted">Item name</span>
              <input value={item.name} onChange={(e) => patch({ name: e.target.value })} />
            </label>
          )}
          <div className="menu-item-cols">
            <div className="menu-item-col">
              <h4>Ingredients</h4>
              <div className="menu-ing-grid menu-ing-head muted">
                <span>Name</span>
                <span className="menu-ing-num-head">Amount</span>
                <span className="menu-ing-num-head">€/unit</span>
                <span>Supplier</span>
                <span>Storage</span>
                <span />
              </div>
              {ingredientRows}
              {editing && (
                <button type="button" className="btn btn-secondary" onClick={addIngredient}>
                  + Ingredient
                </button>
              )}
            </div>

            <div className="menu-item-col">
              <h4>Time</h4>
              {editing ? (
                <>
                  <label className="field">
                    <span className="muted">Prep (min)</span>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={item.prepTimeMin || ""}
                      onChange={(e) => patch({ prepTimeMin: Number(e.target.value) || 0 })}
                    />
                  </label>
                  <label className="field">
                    <span className="muted">Cooking (min)</span>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={item.cookTimeMin || ""}
                      onChange={(e) => patch({ cookTimeMin: Number(e.target.value) || 0 })}
                    />
                  </label>
                </>
              ) : (
                <>
                  <div className="menu-cost-row">
                    <span className="muted">Prep</span>
                    <span>{item.prepTimeMin || 0} min</span>
                  </div>
                  <div className="menu-cost-row">
                    <span className="muted">Cooking</span>
                    <span>{item.cookTimeMin || 0} min</span>
                  </div>
                </>
              )}
              <p className="muted" style={{ fontSize: 11, margin: 0 }}>
                Labour includes +5 min buffer at €14/h
              </p>
            </div>

            <div className="menu-item-col">
              <h4>Costs &amp; price</h4>
              <div className="menu-cost-row">
                <span className="muted">Material</span>
                <strong>{fmtEur(costs.material)}</strong>
              </div>
              <div className="menu-cost-row">
                <span className="muted">Labour</span>
                <strong>{fmtEur(costs.labour)}</strong>
              </div>
              {editing ? (
                <>
                  <label className="field">
                    <span className="muted">Fixed cost (€)</span>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={item.fixedCost || ""}
                      onChange={(e) => patch({ fixedCost: Number(e.target.value) || 0 })}
                    />
                  </label>
                  <label className="field">
                    <span className="muted">Price (€)</span>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={item.price || ""}
                      onChange={(e) => patch({ price: Number(e.target.value) || 0 })}
                    />
                  </label>
                </>
              ) : (
                <>
                  <div className="menu-cost-row">
                    <span className="muted">Fixed cost</span>
                    <span>{fmtEur(costs.fixed)}</span>
                  </div>
                  <div className="menu-cost-row">
                    <span className="muted">Price</span>
                    <span>{fmtEur(costs.price)}</span>
                  </div>
                </>
              )}
              <div className="menu-cost-row">
                <span className="muted">Profit</span>
                <strong className={costs.profit >= 0 ? "success-text" : "error-text"}>
                  {fmtEur(costs.profit)}{" "}
                  <span className="muted">({fmtEur(costs.materialProfit)})</span>
                </strong>
              </div>
              <div className="menu-cost-row">
                <span className="muted">Margin</span>
                <strong>
                  {fmtPct(costs.marginPct)}{" "}
                  <span className="muted">({fmtPct(costs.materialMarginPct)})</span>
                </strong>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function MenuCostingPage({ data, patchData }) {
  const mc = data.menuCosting ?? { suppliers: [], storageLocations: [], tabs: [] };
  const [activeTabId, setActiveTabId] = useState(mc.tabs[0]?.id ?? null);
  const [newTabTitle, setNewTabTitle] = useState("");
  const [showLists, setShowLists] = useState(false);

  const activeTab = mc.tabs.find((t) => t.id === activeTabId) ?? mc.tabs[0];

  function patchMenu(updater) {
    patchData((prev) => {
      const base = prev.menuCosting ?? {
        suppliers: [],
        storageLocations: [],
        tabs: [],
      };
      const next =
        typeof updater === "function"
          ? updater(base)
          : { ...base, ...updater };
      return { ...prev, menuCosting: next };
    });
  }

  function addTab() {
    const title = newTabTitle.trim() || "New tab";
    const tab = { id: uid(), title, items: [] };
    patchMenu((m) => ({ ...m, tabs: [...m.tabs, tab] }));
    setActiveTabId(tab.id);
    setNewTabTitle("");
  }

  function removeTab(tabId) {
    const tab = mc.tabs.find((t) => t.id === tabId);
    if (!tab || !window.confirm(`Remove tab “${tab.title}” and all its items?`)) return;
    patchMenu((m) => {
      const tabs = m.tabs.filter((t) => t.id !== tabId);
      return { ...m, tabs: tabs.length ? tabs : [{ id: uid(), title: "Menu", items: [] }] };
    });
    if (activeTabId === tabId) {
      const remaining = mc.tabs.filter((t) => t.id !== tabId);
      setActiveTabId(remaining[0]?.id ?? null);
    }
  }

  function renameTab(tabId, title) {
    patchMenu((m) => ({
      ...m,
      tabs: m.tabs.map((t) => (t.id === tabId ? { ...t, title } : t)),
    }));
  }

  function patchTabItems(tabId, items) {
    patchMenu((m) => ({
      ...m,
      tabs: m.tabs.map((t) => (t.id === tabId ? { ...t, items } : t)),
    }));
  }

  function addSupplier(name) {
    if (mc.suppliers.includes(name)) return;
    patchMenu((m) => ({ ...m, suppliers: [...m.suppliers, name].sort() }));
  }

  function removeSupplier(name) {
    patchMenu((m) => ({ ...m, suppliers: m.suppliers.filter((s) => s !== name) }));
  }

  function addStorage(name) {
    if (mc.storageLocations.includes(name)) return;
    patchMenu((m) => ({
      ...m,
      storageLocations: [...m.storageLocations, name].sort(),
    }));
  }

  function removeStorage(name) {
    patchMenu((m) => ({
      ...m,
      storageLocations: m.storageLocations.filter((s) => s !== name),
    }));
  }

  return (
    <div className="menu-costing-page">
      <div className="menu-costing-toolbar">
        <div className="menu-costing-tabs">
          {mc.tabs.map((tab) => (
            <div key={tab.id} className={`menu-cost-tab${activeTab?.id === tab.id ? " active" : ""}`}>
              <button type="button" className="pill" onClick={() => setActiveTabId(tab.id)}>
                {tab.title}
              </button>
              {mc.tabs.length > 1 && (
                <button
                  type="button"
                  className="icon-btn"
                  title="Remove tab"
                  onClick={() => removeTab(tab.id)}
                >
                  ✕
                </button>
              )}
            </div>
          ))}
          <div className="row" style={{ gap: 4 }}>
            <input
              value={newTabTitle}
              onChange={(e) => setNewTabTitle(e.target.value)}
              placeholder="New tab title"
              style={{ width: 120 }}
              onKeyDown={(e) => e.key === "Enter" && addTab()}
            />
            <button type="button" className="btn btn-secondary" onClick={addTab}>
              + Tab
            </button>
          </div>
        </div>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => setShowLists(!showLists)}
        >
          {showLists ? "Hide" : "Manage"} suppliers &amp; storage
        </button>
      </div>

      {showLists && (
        <div className="menu-lists-panel card">
          <div className="menu-lists-grid">
            <div>
              <h4>Suppliers</h4>
              {mc.suppliers.length === 0 && <p className="muted">None yet — add from an ingredient row.</p>}
              {mc.suppliers.map((s) => (
                <div key={s} className="menu-list-row">
                  <span>{s}</span>
                  <button type="button" className="icon-btn" onClick={() => removeSupplier(s)}>
                    ✕
                  </button>
                </div>
              ))}
            </div>
            <div>
              <h4>Storage</h4>
              {mc.storageLocations.length === 0 && (
                <p className="muted">None yet — add from an ingredient row.</p>
              )}
              {mc.storageLocations.map((s) => (
                <div key={s} className="menu-list-row">
                  <span>{s}</span>
                  <button type="button" className="icon-btn" onClick={() => removeStorage(s)}>
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab && (
        <div className="menu-costing-body">
          <div className="row" style={{ alignItems: "center", gap: 8, marginBottom: 8 }}>
            <label className="field" style={{ flex: 1, margin: 0 }}>
              <span className="muted">Tab title</span>
              <input
                value={activeTab.title}
                onChange={(e) => renameTab(activeTab.id, e.target.value)}
              />
            </label>
            <button
              type="button"
              className="btn btn-primary"
              style={{ alignSelf: "flex-end" }}
              onClick={() =>
                patchTabItems(activeTab.id, [...activeTab.items, blankMenuItem()])
              }
            >
              + Item
            </button>
          </div>

          {activeTab.items.length === 0 && (
            <p className="muted">No items yet. Click + Item to add a menu item.</p>
          )}

          {activeTab.items.map((item) => (
            <MenuItemBox
              key={item.id}
              item={item}
              suppliers={mc.suppliers}
              storageLocations={mc.storageLocations}
              onChange={(next) =>
                patchTabItems(
                  activeTab.id,
                  activeTab.items.map((i) => {
                    if (i.id === item.id) return next;
                    if (next.editing) return { ...i, editing: false };
                    return i;
                  }),
                )
              }
              onRemove={() => {
                if (!window.confirm(`Remove “${item.name}”?`)) return;
                patchTabItems(
                  activeTab.id,
                  activeTab.items.filter((i) => i.id !== item.id),
                );
              }}
              onAddSupplier={addSupplier}
              onAddStorage={addStorage}
            />
          ))}
        </div>
      )}
    </div>
  );
}
