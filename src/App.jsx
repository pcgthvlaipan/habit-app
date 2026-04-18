import { useState, useEffect } from "react";
import "./App.css";

// Firebase
import {
  fetchUser,
  subscribeToHabits,
  computeSummary,
  USER_ID,
} from "./firebase/habitService";

// Components
import HeaderSection from "./HeaderSection";
import SummaryCards from "./SummaryCards";
import HabitList from "./HabitList";
import ProgressChart from "./ProgressChart";
import WeeklySummary from "./WeeklySummary";
import AICoachCard from "./AICoachCard";
import { LoadingScreen, ErrorScreen } from "./StatusScreens";

export default function App() {
  const [user, setUser] = useState(null);
  const [habits, setHabits] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchUser(USER_ID).then(setUser).catch(setError);

    const unsub = subscribeToHabits(USER_ID, (data) => {
      setHabits(data);
      setSummary(computeSummary(data));
      setLoading(false);
    });

    return () => unsub && unsub();
  }, []);

  if (loading) return <LoadingScreen />;
  if (error) return <ErrorScreen message={error.message} />;

  return (
    <div className="App">
      <HeaderSection user={user} />
      <SummaryCards data={summary} />
      <HabitList habits={habits} />
      <ProgressChart habits={habits} />
      <WeeklySummary habits={habits} />
      <AICoachCard message="You're doing great! Keep going 💪" />
    </div>
  );
}
