// src/components/AICoachCard.jsx

export default function AICoachCard({ message }) {
  return (
    <div className="ai-card fade-up fade-up-5">
      <div className="ai-glow" />

      <div className="ai-header">
        <div className="ai-icon-wrap">
          <span className="ai-icon">✨</span>
        </div>
        <div>
          <span className="ai-title">AI Coach</span>
          <span className="ai-powered">Powered by Claude</span>
        </div>
      </div>

      <p className="ai-message">{message}</p>
    </div>
  );
}
