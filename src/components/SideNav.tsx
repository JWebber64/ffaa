import { VStack } from "@chakra-ui/react";
import { NavLink } from "react-router-dom";

type Props = { onNavigate: () => void };

const itemStyle = ({ isActive }: { isActive: boolean }) => ({
  display: "block",
  padding: "10px 12px",
  borderRadius: "8px",
  margin: "2px 0",
  background: isActive ? "#233347" : "transparent",
  color: "white",
  textDecoration: "none",
  border: "1px solid",
  borderColor: isActive ? "#2a3a52" : "transparent",
});

export default function SideNav({ onNavigate }: Props) {
  return (
    <VStack alignItems="stretch" spacing={1} p={2}>
      <NavLink to="/" style={itemStyle} onClick={onNavigate}>🏠 Home</NavLink>
      <NavLink to="/setup" style={itemStyle} onClick={onNavigate}>🛠️ Setup</NavLink>
      <NavLink to="/board" style={itemStyle} onClick={onNavigate}>📋 Draft Board</NavLink>
      <NavLink to="/auctioneer" style={itemStyle} onClick={onNavigate}>🎙️ Auctioneer</NavLink>
      <NavLink to="/results" style={itemStyle} onClick={onNavigate}>📈 Results</NavLink>
      <NavLink to="/tools" style={itemStyle} onClick={onNavigate}>🧰 Tools</NavLink>
      <NavLink to="/players" style={itemStyle} onClick={onNavigate}>👥 Player Pool</NavLink>
    </VStack>
  );
}
