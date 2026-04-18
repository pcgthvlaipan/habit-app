// src/components/HeaderSection.jsx


function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export default function HeaderSection({ user }) {
  return (
    <div className="header fade-up">
      <div>
        <div className="header-active-badge">
          <div className="header-dot" />
          <span className="header-active-text">Active today</span>
        </div>
        <p className="header-greeting">
          {getGreeting()}, {user.name} 👋
        </p>
        <p className="header-subtitle">
          Small progress is still progress. Keep going.
        </p>
      </div>

      <div className="avatar-wrap">
        <div className="avatar">{user.avatarInitial}</div>
        <div className="avatar-ring" />
        <div className="avatar-online" />
      </div>
    </div>
  );
}
