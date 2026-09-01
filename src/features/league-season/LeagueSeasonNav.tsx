import { NavLink } from "react-router-dom";

export function LeagueSeasonNav() {
  return (
    <nav className="league-season-nav" aria-label="Current league">
      <NavLink to="/league/teams" className={({ isActive }) => isActive ? "is-active" : ""}>Teams</NavLink>
      <NavLink to="/league/lineup" className={({ isActive }) => isActive ? "is-active" : ""}>Lineup</NavLink>
      <NavLink to="/league/matchups" className={({ isActive }) => isActive ? "is-active" : ""}>Matchups</NavLink>
      <NavLink to="/my-hq" className={({ isActive }) => isActive ? "is-active" : ""}>This Week</NavLink>
      <NavLink to="/league" end className={({ isActive }) => isActive ? "is-active" : ""}>League setup</NavLink>
    </nav>
  );
}
