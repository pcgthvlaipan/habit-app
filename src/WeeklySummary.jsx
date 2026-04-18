// src/components/WeeklySummary.jsx


export default function WeeklySummary({ days }) {
  if (!days?.length) return null;

  return (
    <div className="weekly-card fade-up fade-up-4">
      <p className="section-label" style={{ padding: 0, marginBottom: 14 }}>
        This Week
      </p>
      <div className="weekly-row">
        {days.map((d) => (
          <div key={d.day} className="week-day">
            <div
              className={`week-dot ${d.done ? "week-dot--done" : "week-dot--miss"}`}
            >
              <span>{d.done ? "✓" : "✗"}</span>
            </div>
            <span className="week-label">{d.day}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
