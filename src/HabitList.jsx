// src/components/HabitList.jsx


// ── HabitList ─────────────────────────────────────────────────────────────────
export default function HabitList({ habits, selectedId, onSelect }) {
  if (!habits.length) {
    return (
      <div className="habit-empty fade-up fade-up-2">
        <span className="habit-empty-icon">🌱</span>
        <p className="habit-empty-title">No habits yet</p>
        <p className="habit-empty-sub">Add your first habit to get started!</p>
      </div>
    );
  }

  return (
    <div className="habit-list fade-up fade-up-2">
      {habits.map((h) => (
        <HabitCard
          key={h.id}
          habit={h}
          isSelected={h.id === selectedId}
          onSelect={() => onSelect(h)}
        />
      ))}
    </div>
  );
}

// ── HabitCard ─────────────────────────────────────────────────────────────────
function HabitCard({ habit, isSelected, onSelect }) {
  const done    = habit.todayStatus === "done";
  const pending = habit.todayStatus === "none";

  return (
    <div
      className={`habit-card ${isSelected ? "habit-card--selected" : ""}`}
      style={{
        borderColor:   isSelected ? habit.color : "transparent",
        boxShadow:     isSelected ? `0 4px 22px ${habit.color}30` : undefined,
      }}
      onClick={onSelect}
    >
      {/* Icon bubble */}
      <div
        className="habit-icon-wrap"
        style={{ background: `${habit.color}20` }}
      >
        <span className="habit-icon">{habit.icon}</span>
      </div>

      {/* Name + frequency */}
      <div className="habit-info">
        <span className="habit-name">{habit.name}</span>
        <span className="habit-freq">{habit.frequency}</span>
      </div>

      {/* Right side — badge + streak */}
      <div className="habit-right">
        <span
          className="habit-badge"
          style={{
            background: done    ? "#4CAF8218"
                       : pending ? "#F4F5F9"
                       : "#F4845F16",
            color:      done    ? "var(--green)"
                       : pending ? "var(--text-sub)"
                       : "var(--coral)",
          }}
        >
          {done ? "✓ Done" : pending ? "— Pending" : "✗ Missed"}
        </span>
        {habit.streak > 0 && (
          <span className="habit-streak">🔥 {habit.streak}</span>
        )}
      </div>
    </div>
  );
}
