// src/components/StatusScreens.jsx
// ── Shown while Firestore data is loading ─────────────────────────────────────
export function LoadingScreen() {
  return (
    <div style={center}>
      <div style={pulse} />
      <p style={{ fontSize: 14, color: "#8891A5", fontFamily: "inherit", marginTop: 14 }}>
        Loading your habits…
      </p>
    </div>
  );
}

// ── Shown if Firestore throws an error ────────────────────────────────────────
export function ErrorScreen({ message }) {
  return (
    <div style={center}>
      <p style={{ fontSize: 36, marginBottom: 10 }}>⚠️</p>
      <p style={{ fontSize: 17, fontWeight: 700, color: "#1A1D2E", marginBottom: 8, fontFamily: "inherit" }}>
        Something went wrong
      </p>
      <p style={{ fontSize: 13, color: "#8891A5", textAlign: "center", maxWidth: 260, fontFamily: "inherit" }}>
        {message}
      </p>
    </div>
  );
}

// ── Shared layout ──────────────────────────────────────────────────────────────
const center = {
  display:        "flex",
  flexDirection:  "column",
  alignItems:     "center",
  justifyContent: "center",
  minHeight:      "100vh",
  padding:        24,
};

const pulse = {
  width:        48,
  height:       48,
  borderRadius: "50%",
  background:   "#4CAF82",
  animation:    "pulse 1.5s ease-in-out infinite",
};
