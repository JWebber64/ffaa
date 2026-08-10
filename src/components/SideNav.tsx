import { VStack } from "@/ui/custom";
import { NavLink } from "react-router-dom";

type Props = { onNavigate: () => void };

const itemStyle = ({ isActive }: { isActive: boolean }) => ({
  display: "block",
  padding: "10px 12px",
  borderRadius: "8px",
  margin: "2px 0",
  background: isActive ? "var(--bg-2)" : "transparent",
  color: "white",
  textDecoration: "none",
  border: "1px solid",
  borderColor: isActive ? "var(--line-1)" : "transparent",
});

export default function SideNav({ onNavigate }: Props) {
  return (
    <VStack alignItems="stretch" spacing={1} p={2}>
      <NavLink to="/legacy" style={itemStyle} onClick={onNavigate}>Home</NavLink>
      <NavLink to="/legacy/setup" style={itemStyle} onClick={onNavigate}>Setup</NavLink>
      <NavLink to="/legacy/player-pool" style={itemStyle} onClick={onNavigate}>Player Pool</NavLink>
      <NavLink to="/legacy/stats" style={itemStyle} onClick={onNavigate}>Stats</NavLink>
      <NavLink to="/legacy/board" style={itemStyle} onClick={onNavigate}>Draft Board</NavLink>
      <NavLink to="/legacy/auctioneer" style={itemStyle} onClick={onNavigate}>Auctioneer</NavLink>
      <NavLink to="/legacy/results" style={itemStyle} onClick={onNavigate}>Results</NavLink>
      <NavLink to="/legacy/ping" style={itemStyle} onClick={onNavigate}>Ping Test</NavLink>
    </VStack>
  );
}
