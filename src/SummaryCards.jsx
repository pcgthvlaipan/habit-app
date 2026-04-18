// src/components/SummaryCards.jsx


const CARDS = [
  { key: "totalHabits",   label: "Total Habits", icon: "✦", accent: "var(--blue)"   },
  { key: "doneToday",     label: "Done Today",   icon: "✓", accent: "var(--green)"  },
  { key: "currentStreak", label: "Streak",        icon: "🔥", accent: "var(--coral)"  },
  { key: "successRate",   label: "Success",       icon: "◎", accent: "var(--violet)" },
];

function formatValue(key, val) {
  if (key === "currentStreak") return `${val}d`;
  if (key === "successRate")   return `${val}%`;
  return val;
}

export default function SummaryCards({ data }) {
  return (
    <div className="summary-grid fade-up fade-up-1">
      {CARDS.map(({ key, label, icon, accent }) => (
        <div
          key={key}
          className="stat-card"
          style={{ borderTop: `3px solid ${accent}` }}
        >
          <span className="stat-icon" style={{ color: accent }}>{icon}</span>
          <span className="stat-value">{formatValue(key, data[key])}</span>
          <span className="stat-label">{label}</span>
        </div>
      ))}
    </div>
  );
}
