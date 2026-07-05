import { useCallback, useEffect, useRef, useState } from "react";
import { auth, calendar } from "./api.js";

const DAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DAY_FULL = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];
const ROLES = [
  "Manager",
  "Chef",
  "Sous Chef",
  "Waiter",
  "Host",
  "Bartender",
  "Busser",
];
const EVENT_TYPES = [
  { value: "private_party", label: "Private party" },
  { value: "holiday", label: "Holiday / closure" },
  { value: "maintenance", label: "Maintenance" },
  { value: "special_menu", label: "Special menu" },
  { value: "other", label: "Other" },
];
const COLORS = [
  "blue",
  "green",
  "purple",
  "orange",
  "cyan",
  "pink",
  "yellow",
  "gray",
];
const COLOR_HEX = {
  blue: "#7bafe9",
  green: "#3fa266",
  purple: "#9386f2",
  orange: "#d08770",
  cyan: "#81a1c1",
  pink: "#b48ead",
  yellow: "#f1b467",
  gray: "#e4e4e48a",
};
const WEEKS_INIT = 8;
const WEEKS_LOAD = 3;

function blankHours() {
  return Array.from({ length: 7 }, (_, dayIndex) => ({
    dayIndex,
    isOpen: false,
    openTime: "12:00",
    closeTime: "22:00",
  }));
}

function newHoursPeriod(label = "") {
  const y = new Date().getFullYear();
  return {
    id: newId(),
    label,
    startDate: `${y}-01-01`,
    endDate: `${y}-12-31`,
    days: blankHours(),
  };
}

function getHoursForDate(hoursPeriods, dateIso) {
  const wd = dow(fromISO(dateIso));
  const fallback = { dayIndex: wd, isOpen: false, openTime: "12:00", closeTime: "22:00" };
  if (!hoursPeriods?.length) return fallback;

  const matches = hoursPeriods.filter(
    (p) => dateIso >= p.startDate && dateIso <= p.endDate,
  );
  if (!matches.length) return fallback;

  const period = matches.reduce((best, p) => {
    const span = fromISO(p.endDate) - fromISO(p.startDate);
    const bestSpan = fromISO(best.endDate) - fromISO(best.startDate);
    return span < bestSpan ? p : best;
  });
  return period.days.find((d) => d.dayIndex === wd) ?? fallback;
}

function formatPeriodRange(p) {
  const f = { month: "short", day: "numeric", year: "numeric" };
  return `${fromISO(p.startDate).toLocaleDateString("en-US", f)} – ${fromISO(p.endDate).toLocaleDateString("en-US", f)}`;
}

function legacyHoursArray(hoursPeriods) {
  if (!hoursPeriods?.length) return blankHours();
  const today = toISO(new Date());
  const match =
    hoursPeriods.find((p) => today >= p.startDate && today <= p.endDate) ??
    hoursPeriods[0];
  return match.days.map((d, i) => ({ ...blankHours()[i], ...d, dayIndex: i }));
}

function prepareSaveData(data) {
  const normalized = normalizeCalendarData(data);
  return { ...normalized, hours: legacyHoursArray(normalized.hoursPeriods) };
}

function dayFromPeriod(days, i) {
  return days.find((d) => d.dayIndex === i) ?? blankHours()[i];
}

function normalizeCalendarData(data) {
  if (!data) return data;
  if (Array.isArray(data.hoursPeriods) && data.hoursPeriods.length > 0) {
    const { hours: _legacy, ...rest } = data;
    return rest;
  }
  const y = new Date().getFullYear();
  const { hours, ...rest } = data;
  return {
    ...rest,
    hoursPeriods: [
      {
        id: "migrated-default",
        label: "Default",
        startDate: `${y}-01-01`,
        endDate: `${y}-12-31`,
        days: Array.isArray(hours) && hours.length === 7 ? hours : blankHours(),
      },
    ],
  };
}

function newId() {
  return Math.random().toString(36).slice(2, 10);
}

function toISO(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function fromISO(s) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function mondayOf(d) {
  const c = new Date(d);
  const w = c.getDay();
  c.setDate(c.getDate() + (w === 0 ? -6 : 1 - w));
  c.setHours(0, 0, 0, 0);
  return c;
}

function plusDays(d, n) {
  const c = new Date(d);
  c.setDate(c.getDate() + n);
  return c;
}

function dow(d) {
  const w = d.getDay();
  return w === 0 ? 6 : w - 1;
}

function weekTitle(start) {
  const end = plusDays(start, 6);
  const f = { month: "short", day: "numeric" };
  return `${start.toLocaleDateString("en-US", f)} – ${end.toLocaleDateString("en-US", f)}`;
}

function Swatch({ color }) {
  return (
    <span
      className="swatch"
      style={{ background: COLOR_HEX[color] || COLOR_HEX.gray }}
    />
  );
}

function TimeRange({ from, to, setFrom, setTo }) {
  return (
    <div className="time-row">
      <input value={from} onChange={(e) => setFrom(e.target.value)} placeholder="09:00" />
      <span className="muted">to</span>
      <input value={to} onChange={(e) => setTo(e.target.value)} placeholder="22:00" />
    </div>
  );
}

function DayBox({
  date,
  hoursPeriods,
  events,
  shifts,
  staff,
  byStaffId,
  addingOn,
  setAddingOn,
  pickStaff,
  setPickStaff,
  tStart,
  setTStart,
  tEnd,
  setTEnd,
  onAddShift,
  onRemoveShift,
}) {
  const iso = toISO(date);
  const wd = dow(date);
  const rule = getHoursForDate(hoursPeriods, iso);
  const myShifts = shifts
    .filter((s) => s.date === iso)
    .sort((a, b) => a.startTime.localeCompare(b.startTime));
  const myEvents = events.filter((e) => e.date === iso);
  const editing = addingOn === iso;
  const today = iso === toISO(new Date());

  return (
    <div
      id={`day-${iso}`}
      className={`day-box${today ? " today" : ""}${editing ? " editing" : ""}`}
    >
      <div className="day-title">
        {DAY_SHORT[wd]} {date.getDate()}
      </div>
      <div className="muted">
        {rule?.isOpen ? `${rule.openTime}–${rule.closeTime}` : "Closed"}
      </div>
      {myEvents.map((ev) => (
        <div key={ev.id} className="event-chip">
          <div>{ev.title}</div>
          <div className="muted">
            {ev.startTime}–{ev.endTime}
          </div>
        </div>
      ))}
      {myShifts.length > 0 && <hr className="divider" />}
      {myShifts.map((sh) => {
        const person = byStaffId[sh.staffId];
        if (!person) return null;
        return (
          <div key={sh.id} className="shift-row">
            <Swatch color={person.color} />
            <div className="shift-info">
              <div>{person.name}</div>
              <div className="muted">
                {sh.startTime}–{sh.endTime}
              </div>
            </div>
            <button
              type="button"
              className="icon-btn"
              title="Remove shift"
              onClick={() => onRemoveShift(sh.id)}
            >
              ✕
            </button>
          </div>
        );
      })}
      {editing ? (
        <div className="panel-section" style={{ gap: 6 }}>
          {staff.length === 0 ? (
            <p className="muted">Add staff in Menu → Personnel first.</p>
          ) : (
            <>
              <select
                value={pickStaff || staff[0]?.id}
                onChange={(e) => setPickStaff(e.target.value)}
              >
                {staff.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.role})
                  </option>
                ))}
              </select>
              <TimeRange from={tStart} to={tEnd} setFrom={setTStart} setTo={setTEnd} />
              <div className="row">
                <button type="button" className="btn btn-primary" onClick={onAddShift}>
                  Add shift
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setAddingOn(null)}
                >
                  Cancel
                </button>
              </div>
            </>
          )}
        </div>
      ) : (
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => {
            setAddingOn(iso);
            setPickStaff(staff[0]?.id ?? "");
          }}
        >
          + Shift
        </button>
      )}
    </div>
  );
}

function CalendarView({ data, patchData }) {
  const [anchor] = useState(() => toISO(mondayOf(new Date())));
  const [weekCount, setWeekCount] = useState(WEEKS_INIT);
  const [loading, setLoading] = useState(false);
  const [addingOn, setAddingOn] = useState(null);
  const [pickStaff, setPickStaff] = useState("");
  const [tStart, setTStart] = useState("12:00");
  const [tEnd, setTEnd] = useState("22:00");

  const { staff, hoursPeriods, events, shifts } = normalizeCalendarData(data);
  const start = fromISO(anchor);
  const weeks = Array.from({ length: weekCount }, (_, w) =>
    Array.from({ length: 7 }, (_, d) => plusDays(start, w * 7 + d)),
  );
  const byStaffId = Object.fromEntries(staff.map((s) => [s.id, s]));
  const today = toISO(new Date());

  function onScroll(e) {
    if (loading) return;
    const box = e.currentTarget;
    if (box.scrollHeight - box.scrollTop - box.clientHeight > 140) return;
    setLoading(true);
    setWeekCount((n) => n + WEEKS_LOAD);
    setTimeout(() => setLoading(false), 350);
  }

  function commitShift() {
    if (!addingOn) return;
    const sid = pickStaff || staff[0]?.id;
    if (!sid) return;
    patchData((prev) => ({
      ...prev,
      shifts: [
        ...prev.shifts,
        {
          id: newId(),
          staffId: sid,
          date: addingOn,
          startTime: tStart,
          endTime: tEnd,
        },
      ],
    }));
    setAddingOn(null);
  }

  return (
    <div className="calendar-scroll" onScroll={onScroll}>
      {weeks.map((row) => {
        const key = toISO(row[0]);
        return (
          <div key={key} className="week-block" id={`week-${key}`}>
            <div className="week-head">{weekTitle(row[0])}</div>
            <div className="week-grid">
              {row.map((date) => (
                <div key={toISO(date)} className="day-wrap">
                  <DayBox
                    date={date}
                    hoursPeriods={hoursPeriods}
                    events={events}
                    shifts={shifts}
                    staff={staff}
                    byStaffId={byStaffId}
                    addingOn={addingOn}
                    setAddingOn={setAddingOn}
                    pickStaff={pickStaff}
                    setPickStaff={setPickStaff}
                    tStart={tStart}
                    setTStart={setTStart}
                    tEnd={tEnd}
                    setTEnd={setTEnd}
                    onAddShift={commitShift}
                    onRemoveShift={(id) =>
                      patchData((prev) => ({
                        ...prev,
                        shifts: prev.shifts.filter((s) => s.id !== id),
                      }))
                    }
                  />
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function PersonnelPanel({ data, patchData }) {
  const { staff } = data;
  const [editId, setEditId] = useState(null);
  const [name, setName] = useState("");
  const [role, setRole] = useState("Waiter");
  const [phone, setPhone] = useState("");
  const [color, setColor] = useState("blue");

  function reset() {
    setEditId(null);
    setName("");
    setRole("Waiter");
    setPhone("");
    setColor("blue");
  }

  function save() {
    if (!name.trim()) return;
    const row = { name: name.trim(), role, phone: phone.trim(), color };
    if (editId) {
      patchData((prev) => ({
        ...prev,
        staff: prev.staff.map((s) => (s.id === editId ? { ...s, ...row } : s)),
      }));
    } else {
      patchData((prev) => ({
        ...prev,
        staff: [...prev.staff, { id: newId(), ...row }],
      }));
    }
    reset();
  }

  function remove(id) {
    patchData((prev) => ({
      ...prev,
      staff: prev.staff.filter((s) => s.id !== id),
      shifts: prev.shifts.filter((s) => s.staffId !== id),
    }));
    if (editId === id) reset();
  }

  return (
    <div className="panel-section">
      <h2>Personnel</h2>
      <p className="muted">Add, edit, or remove team members.</p>
      {staff.map((m) => (
        <div key={m.id} className="card">
          <div className="card-row">
            <Swatch color={m.color} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 13 }}>{m.name}</div>
              <div className="muted">
                {m.role}
                {m.phone ? ` · ${m.phone}` : ""}
              </div>
            </div>
            <button
              type="button"
              className="icon-btn"
              title="Edit"
              onClick={() => {
                setEditId(m.id);
                setName(m.name);
                setRole(m.role);
                setPhone(m.phone);
                setColor(m.color);
              }}
            >
              ✎
            </button>
            <button type="button" className="icon-btn" title="Remove" onClick={() => remove(m.id)}>
              ✕
            </button>
          </div>
        </div>
      ))}
      {staff.length > 0 && (
        <>
          <hr className="divider" />
          <h3>Legend</h3>
          <div className="legend">
            {staff.map((m) => (
              <div key={m.id} className="legend-item">
                <Swatch color={m.color} />
                {m.name}
              </div>
            ))}
          </div>
        </>
      )}
      <hr className="divider" />
      <h3>{editId ? "Edit member" : "Add member"}</h3>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" />
      <select value={role} onChange={(e) => setRole(e.target.value)}>
        {ROLES.map((r) => (
          <option key={r} value={r}>
            {r}
          </option>
        ))}
      </select>
      <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone" />
      <select value={color} onChange={(e) => setColor(e.target.value)}>
        {COLORS.map((c) => (
          <option key={c} value={c}>
            {c[0].toUpperCase() + c.slice(1)}
          </option>
        ))}
      </select>
      <div className="row">
        <button type="button" className="btn btn-primary" onClick={save}>
          {editId ? "Save" : "Add member"}
        </button>
        {editId && (
          <button type="button" className="btn btn-ghost" onClick={reset}>
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}

function HoursPanel({ data, onApplyAndSave, saveState }) {
  const periods = data.hoursPeriods ?? [];
  const [selectedId, setSelectedId] = useState(periods[0]?.id ?? null);
  const [draft, setDraft] = useState(() =>
    periods[0] ? structuredClone(periods[0]) : newHoursPeriod("Default"),
  );
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const skipDraftReload = useRef(false);

  const savedPeriod = periods.find((p) => p.id === selectedId) ?? null;
  const isNew = draft && !periods.some((p) => p.id === draft.id);

  useEffect(() => {
    if (skipDraftReload.current) {
      skipDraftReload.current = false;
      return;
    }
    if (selectedId && savedPeriod) {
      setDraft(structuredClone(savedPeriod));
      setError("");
    }
  }, [selectedId]);

  useEffect(() => {
    if (!periods.length) {
      setDraft(newHoursPeriod("Default"));
      setSelectedId(null);
    }
  }, [periods.length]);

  function selectPeriod(id) {
    setSelectedId(id);
    setError("");
    setSaved(false);
  }

  function startNew() {
    setSelectedId(null);
    setDraft(newHoursPeriod(""));
    setError("");
    setSaved(false);
  }

  function updateDay(i, patch) {
    setDraft((d) => ({
      ...d,
      days: d.days.map((h) => (h.dayIndex === i ? { ...h, ...patch } : h)),
    }));
    setSaved(false);
  }

  async function save() {
    if (!draft?.startDate || !draft?.endDate) {
      setError("Start and end dates are required.");
      return;
    }
    if (draft.startDate > draft.endDate) {
      setError("End date must be on or after start date.");
      return;
    }

    const row = {
      ...draft,
      label: draft.label?.trim() || formatPeriodRange(draft),
      days: DAY_FULL.map((_, i) => ({
        ...blankHours()[i],
        ...dayFromPeriod(draft.days, i),
        dayIndex: i,
      })),
    };

    const base = normalizeCalendarData(data);
    const list = base.hoursPeriods ?? [];
    const exists = list.some((p) => p.id === row.id);
    const hoursPeriods = exists
      ? list.map((p) => (p.id === row.id ? row : p))
      : [...list, row];
    const next = { ...base, hoursPeriods };

    skipDraftReload.current = true;
    setDraft(structuredClone(row));
    setSelectedId(row.id);
    setError("");

    try {
      await onApplyAndSave(next);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (ex) {
      setError(ex.message || "Could not save to server.");
      setSaved(false);
    }
  }

  async function removePeriod(id) {
    if (periods.length <= 1) {
      setError("Keep at least one hours schedule.");
      return;
    }
    const next = {
      ...normalizeCalendarData(data),
      hoursPeriods: periods.filter((p) => p.id !== id),
    };
    try {
      await onApplyAndSave(next);
      if (selectedId === id) {
        setSelectedId(next.hoursPeriods[0]?.id ?? null);
      }
    } catch (ex) {
      setError(ex.message || "Could not save removal.");
    }
  }

  const dirty =
    draft &&
    (isNew || !savedPeriod || JSON.stringify(draft) !== JSON.stringify(savedPeriod));

  return (
    <div className="panel-section">
      <h2>Opening hours</h2>
      <p className="muted">
        Set hours per date range (e.g. summer vs winter). Edit below, then Save to
        apply on the calendar.
      </p>

      <div className="panel-section" style={{ gap: 8 }}>
        <h3>Schedules</h3>
        {periods.map((p) => (
          <div key={p.id} className={`card${selectedId === p.id ? " card-active" : ""}`}>
            <div className="card-row">
              <button
                type="button"
                className="btn btn-ghost"
                style={{ flex: 1, textAlign: "left" }}
                onClick={() => selectPeriod(p.id)}
              >
                <strong style={{ fontSize: 13 }}>{p.label || "Untitled"}</strong>
                <div className="muted">{formatPeriodRange(p)}</div>
              </button>
              {periods.length > 1 && (
                <button
                  type="button"
                  className="icon-btn"
                  title="Remove schedule"
                  onClick={() => removePeriod(p.id)}
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        ))}
        <button type="button" className="btn btn-secondary" onClick={startNew}>
          + New date range
        </button>
      </div>

      <div className="card">
        <div className="panel-section" style={{ gap: 10 }}>
          <h3>{isNew ? "New schedule" : "Edit schedule"}</h3>
          <div className="field">
            <label htmlFor="hours-label">Label (optional)</label>
            <input
              id="hours-label"
              value={draft.label}
              onChange={(e) => {
                setDraft((d) => ({ ...d, label: e.target.value }));
                setSaved(false);
              }}
              placeholder="e.g. Summer hours"
            />
          </div>
          <div className="row">
            <div className="field" style={{ flex: 1 }}>
              <label htmlFor="hours-start">From</label>
              <input
                id="hours-start"
                type="date"
                value={draft.startDate}
                onChange={(e) => {
                  setDraft((d) => ({ ...d, startDate: e.target.value }));
                  setSaved(false);
                }}
              />
            </div>
            <div className="field" style={{ flex: 1 }}>
              <label htmlFor="hours-end">To</label>
              <input
                id="hours-end"
                type="date"
                value={draft.endDate}
                onChange={(e) => {
                  setDraft((d) => ({ ...d, endDate: e.target.value }));
                  setSaved(false);
                }}
              />
            </div>
          </div>

          {DAY_FULL.map((label, i) => {
            const h = dayFromPeriod(draft.days, i);
            return (
              <div key={i} className="card" style={{ padding: "8px 10px" }}>
                <div className="panel-section" style={{ gap: 8 }}>
                  <strong style={{ fontSize: 13 }}>{label}</strong>
                  <label className="checkbox-row">
                    <input
                      type="checkbox"
                      checked={h.isOpen}
                      onChange={(e) => updateDay(i, { isOpen: e.target.checked })}
                    />
                    Open
                  </label>
                  {h.isOpen ? (
                    <TimeRange
                      from={h.openTime}
                      to={h.closeTime}
                      setFrom={(v) => updateDay(i, { openTime: v })}
                      setTo={(v) => updateDay(i, { closeTime: v })}
                    />
                  ) : (
                    <span className="muted">Closed all day</span>
                  )}
                </div>
              </div>
            );
          })}

          {error && <p className="error">{error}</p>}
          {saveState === "error" && !error && (
            <p className="error">Server save failed — try Save again.</p>
          )}
          {saved && <p className="success">Saved — calendar updated.</p>}
          {dirty && !saved && (
            <p className="muted">Unsaved changes — click Save to apply.</p>
          )}
          <button
            type="button"
            className="btn btn-primary"
            onClick={save}
            disabled={!dirty}
          >
            Save to calendar
          </button>
        </div>
      </div>
    </div>
  );
}

function EventsPanel({ data, patchData }) {
  const { events } = data;
  const [editId, setEditId] = useState(null);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [start, setStart] = useState("12:00");
  const [end, setEnd] = useState("22:00");
  const [type, setType] = useState("other");
  const [notes, setNotes] = useState("");
  const sorted = [...events].sort((a, b) => a.date.localeCompare(b.date));

  function reset() {
    setEditId(null);
    setTitle("");
    setDate("");
    setStart("12:00");
    setEnd("22:00");
    setType("other");
    setNotes("");
  }

  function save() {
    if (!title.trim() || !date.trim()) return;
    const row = {
      id: editId ?? newId(),
      title: title.trim(),
      date: date.trim(),
      startTime: start,
      endTime: end,
      type,
      notes: notes.trim(),
    };
    if (editId) {
      patchData((prev) => ({
        ...prev,
        events: prev.events.map((e) => (e.id === editId ? row : e)),
      }));
    } else {
      patchData((prev) => ({ ...prev, events: [...prev.events, row] }));
    }
    reset();
  }

  function remove(id) {
    patchData((prev) => ({
      ...prev,
      events: prev.events.filter((e) => e.id !== id),
    }));
    if (editId === id) reset();
  }

  return (
    <div className="panel-section">
      <h2>Events</h2>
      {sorted.map((ev) => (
        <div key={ev.id} className="card">
          <div className="card-row" style={{ alignItems: "flex-start" }}>
            <div style={{ flex: 1 }}>
              <div className="row" style={{ alignItems: "center", gap: 6 }}>
                <strong style={{ fontSize: 13 }}>{ev.title}</strong>
                <span className="tag">{ev.type.replace("_", " ")}</span>
              </div>
              <div className="muted">
                {ev.date} · {ev.startTime}–{ev.endTime}
              </div>
              {ev.notes && <div className="muted">{ev.notes}</div>}
            </div>
            <button type="button" className="icon-btn" onClick={() => {
              setEditId(ev.id);
              setTitle(ev.title);
              setDate(ev.date);
              setStart(ev.startTime);
              setEnd(ev.endTime);
              setType(ev.type);
              setNotes(ev.notes);
            }}>✎</button>
            <button type="button" className="icon-btn" onClick={() => remove(ev.id)}>✕</button>
          </div>
        </div>
      ))}
      <hr className="divider" />
      <h3>{editId ? "Edit event" : "Add event"}</h3>
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" />
      <input value={date} onChange={(e) => setDate(e.target.value)} placeholder="YYYY-MM-DD" />
      <select value={type} onChange={(e) => setType(e.target.value)}>
        {EVENT_TYPES.map((t) => (
          <option key={t.value} value={t.value}>{t.label}</option>
        ))}
      </select>
      <TimeRange from={start} to={end} setFrom={setStart} setTo={setEnd} />
      <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes" rows={2} />
      <div className="row">
        <button type="button" className="btn btn-primary" onClick={save}>
          {editId ? "Save" : "Add"}
        </button>
        {editId && (
          <button type="button" className="btn btn-ghost" onClick={reset}>Cancel</button>
        )}
      </div>
    </div>
  );
}

function AccountPanel({ user, onLogout }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  async function changePassword(e) {
    e.preventDefault();
    setMsg("");
    setErr("");
    if (next !== confirm) {
      setErr("New passwords do not match");
      return;
    }
    if (next.length < 8) {
      setErr("Password must be at least 8 characters");
      return;
    }
    try {
      await auth.changePassword(current, next);
      setMsg("Password updated successfully");
      setCurrent("");
      setNext("");
      setConfirm("");
    } catch (ex) {
      setErr(ex.message);
    }
  }

  return (
    <div className="panel-section">
      <h2>Account</h2>
      <p className="muted">
        Signed in as <strong>{user.displayName}</strong> ({user.username})
      </p>
      <form onSubmit={changePassword} className="panel-section">
        <h3>Change password</h3>
        <input
          type="password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          placeholder="Current password"
          autoComplete="current-password"
        />
        <input
          type="password"
          value={next}
          onChange={(e) => setNext(e.target.value)}
          placeholder="New password"
          autoComplete="new-password"
        />
        <input
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="Confirm new password"
          autoComplete="new-password"
        />
        {err && <p className="error">{err}</p>}
        {msg && <p className="success">{msg}</p>}
        <button type="submit" className="btn btn-primary">
          Update password
        </button>
      </form>
      <hr className="divider" />
      <button type="button" className="btn btn-secondary" onClick={onLogout}>
        Log out
      </button>
    </div>
  );
}

function LoginPage({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");

  async function submit(e) {
    e.preventDefault();
    setError("");
    setStatus("");
    setLoading(true);
    try {
      const { user } = await auth.login(username.trim(), password);
      setStatus("Loading calendar…");
      await onLogin(user);
    } catch (ex) {
      setError(ex.message || "Sign in failed");
    } finally {
      setLoading(false);
      setStatus("");
    }
  }

  return (
    <div className="login-page">
      <form className="login-card" onSubmit={submit}>
        <h1>Restaurant Staff Calendar</h1>
        <p className="muted">Sign in to view and edit the schedule.</p>
        <div className="field">
          <label htmlFor="user">Username</label>
          <input
            id="user"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            required
          />
        </div>
        <div className="field">
          <label htmlFor="pass">Password</label>
          <input
            id="pass"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </div>
        {error && <p className="error">{error}</p>}
        {status && <p className="muted">{status}</p>}
        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState(null);
  const [booting, setBooting] = useState(true);
  const [data, setData] = useState(null);
  const [version, setVersion] = useState(1);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuTab, setMenuTab] = useState("personnel");
  const [saveState, setSaveState] = useState("saved");
  const saveTimer = useRef(null);
  const versionRef = useRef(1);
  const dataRef = useRef(null);

  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  const persistData = useCallback(async (payload) => {
    const prepared = prepareSaveData(normalizeCalendarData(payload));
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSaveState("saving");

    let lastError;
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        const res = await calendar.save(prepared, versionRef.current);
        versionRef.current = res.version;
        setVersion(res.version);
        setSaveState("saved");
        return res;
      } catch (ex) {
        lastError = ex;
        if (ex.status === 409 && typeof ex.body?.version === "number") {
          versionRef.current = ex.body.version;
          continue;
        }
        break;
      }
    }

    setSaveState("error");
    throw lastError ?? new Error("Save failed");
  }, []);

  const scheduleSave = useCallback(
    (payload) => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        persistData(payload).catch(() => {});
      }, 600);
    },
    [persistData],
  );

  const applyAndSave = useCallback(
    async (payload) => {
      const prepared = prepareSaveData(normalizeCalendarData(payload));
      setData(prepared);
      dataRef.current = prepared;
      return persistData(prepared);
    },
    [persistData],
  );

  const retrySave = useCallback(() => {
    if (dataRef.current) {
      persistData(dataRef.current).catch(() => {});
    }
  }, [persistData]);

  const patchData = useCallback(
    (updater) => {
      setData((prev) => {
        const base = normalizeCalendarData(prev);
        const next = prepareSaveData(
          typeof updater === "function" ? updater(base) : updater,
        );
        dataRef.current = next;
        scheduleSave(next);
        return next;
      });
    },
    [scheduleSave],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { user: u } = await auth.me();
        if (!u || cancelled) return;
        setUser(u);
        const loaded = await calendar.load();
        if (cancelled) return;
        setData(normalizeCalendarData(loaded.data));
        versionRef.current = loaded.version;
        setVersion(loaded.version);
      } catch (ex) {
        console.error(ex);
      } finally {
        if (!cancelled) setBooting(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function logout() {
    await auth.logout();
    setUser(null);
    setData(null);
    setMenuOpen(false);
  }

  function jumpToday() {
    document
      .getElementById(`week-${toISO(mondayOf(new Date()))}`)
      ?.scrollIntoView({ block: "start", behavior: "smooth" });
  }

  if (booting) {
    return (
      <div className="login-page">
        <p className="muted">Loading…</p>
      </div>
    );
  }

  if (!user) {
    return (
      <LoginPage
        onLogin={async (u) => {
          setUser(u);
          try {
            const loaded = await calendar.load();
            setData(normalizeCalendarData(loaded.data));
            versionRef.current = loaded.version;
            setVersion(loaded.version);
          } catch (ex) {
            setUser(null);
            setData(null);
            throw ex;
          }
        }}
      />
    );
  }

  if (!data) {
    return (
      <div className="login-page">
        <div className="login-card">
          <p className="error">Could not load calendar. Try signing in again.</p>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              setUser(null);
              setData(null);
            }}
          >
            Back to sign in
          </button>
        </div>
      </div>
    );
  }

  const scheduleCount = data.hoursPeriods?.length ?? 0;
  const tabs = [
    { id: "personnel", label: "Personnel" },
    { id: "hours", label: "Hours" },
    { id: "events", label: "Events" },
    { id: "account", label: "Account" },
  ];

  return (
    <div className="app-shell">
      {saveState !== "saved" && (
        <div className={`save-bar ${saveState}`}>
          {saveState === "saving"
            ? "Saving…"
            : "Save failed — your edits are kept locally."}
          {saveState === "error" && (
            <button type="button" className="btn btn-secondary" onClick={retrySave}>
              Retry save
            </button>
          )}
        </div>
      )}
      <CalendarView data={data} patchData={patchData} />
      <button
        type="button"
        className="btn btn-primary menu-fab"
        onClick={() => setMenuOpen(!menuOpen)}
      >
        {menuOpen ? "Close menu" : "Menu"}
      </button>
      {menuOpen && (
        <div className="menu-panel">
          <div className="menu-head">
            <strong>Restaurant calendar</strong>
            <span className="muted" style={{ fontSize: 12 }}>
              {data.staff.length} staff · {data.shifts.length} shifts · {scheduleCount} hour schedules
            </span>
            <button type="button" className="btn btn-secondary" onClick={jumpToday}>
              Jump to today
            </button>
            <div className="pills">
              {tabs.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className={`pill${menuTab === t.id ? " active" : ""}`}
                  onClick={() => setMenuTab(t.id)}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          <div className="menu-body">
            {menuTab === "personnel" && (
              <PersonnelPanel data={data} patchData={patchData} />
            )}
            {menuTab === "hours" && (
              <HoursPanel
                data={data}
                onApplyAndSave={applyAndSave}
                saveState={saveState}
              />
            )}
            {menuTab === "events" && <EventsPanel data={data} patchData={patchData} />}
            {menuTab === "account" && (
              <AccountPanel user={user} onLogout={logout} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
