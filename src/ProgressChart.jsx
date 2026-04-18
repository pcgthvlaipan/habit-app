// src/components/ProgressChart.jsx


export default function ProgressChart({ habit, chartData, period, onPeriodChange }) {
  if (!chartData?.length) return null;

  // For 30-day view, only label every 5th bar to avoid crowding
  const showLabel = (i) => period === "7" || i % 5 === 0;

  return (
    <div className="chart-card fade-up fade-up-3">
      {/* Header row */}
      <div className="chart-header">
        <div>
          <span className="chart-title">{habit.name} Progress</span>
          <span className="chart-sub">
            {period === "7" ? "Last 7 days" : "Last 30 days"}
          </span>
        </div>

        {/* Period toggle */}
        <div className="period-tabs">
          {["7", "30"].map((p) => (
            <button
              key={p}
              className={`period-btn ${period === p ? "period-btn--active" : ""}`}
              style={
                period === p
                  ? { background: habit.color, color: "#fff" }
                  : undefined
              }
              onClick={() => onPeriodChange(p)}
            >
              {p}D
            </button>
          ))}
        </div>
      </div>

      {/* Bar chart */}
      <div className="bar-chart">
        {chartData.map((d, i) => (
          <div key={i} className="bar-col">
            <div className="bar-track">
              <div
                className="bar-fill"
                style={{
                  height:     `${d.val * 100}%`,
                  background: d.val ? habit.color : undefined,
                  opacity:    d.val ? 1 : 0,
                }}
              />
            </div>
            {showLabel(i) && (
              <span className="bar-label">{d.day}</span>
            )}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="chart-legend">
        <span className="legend-dot" style={{ background: habit.color }} />
        <span className="legend-text">Done</span>
        <span className="legend-dot legend-dot--miss" />
        <span className="legend-text">Missed</span>
      </div>
    </div>
  );
}
