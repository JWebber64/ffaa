import { Box, Button, HStack, Text } from "@/ui/custom";
import { Download, Menu, Play } from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import AdminLogin from "./AdminLogin";

type Props = { onMenu: () => void };

const linkStyle = ({ isActive }: { isActive: boolean }) => ({
  padding: "8px 10px",
  borderRadius: "8px",
  background: isActive ? "var(--bg-2)" : "transparent",
  color: "white",
  textDecoration: "none",
  border: "1px solid",
  borderColor: isActive ? "var(--line-1)" : "transparent",
});

export default function TopNav({ onMenu }: Props) {
  const { pathname } = useLocation();

  return (
    <Box
      as="header"
      height="64px"
      borderBottom="1px solid"
      borderColor="gray.700"
      bg="var(--bg-1)"
      position="sticky"
      top="0"
      zIndex={40}
    >
      <HStack height="100%" justifyContent="space-between" px={{ base: 3, md: 6 }}>
        <HStack spacing={3}>
          <Button
            display={{ base: "inline-flex", lg: "none" }}
            onClick={onMenu}
            variant="outline"
            size="sm"
            aria-label="Open navigation"
          >
            <Menu size={16} />
          </Button>

          <Box>
            <Text fontWeight="bold">Fantasy Football</Text>
            <Text fontSize="xs" color="var(--text-1)">Presented by GameHQ</Text>
          </Box>

          <HStack spacing={2} display={{ base: "none", md: "flex" }}>
            <NavLink to="/legacy" style={linkStyle}>Home</NavLink>
            <NavLink to="/legacy/setup" style={linkStyle}>Setup</NavLink>
            <NavLink to="/legacy/player-pool" style={linkStyle}>Player Pool</NavLink>
            <NavLink to="/legacy/stats" style={linkStyle}>Stats</NavLink>
            <NavLink to="/legacy/board" style={linkStyle}>Board</NavLink>
            <NavLink to="/legacy/auctioneer" style={linkStyle}>Auctioneer</NavLink>
            <NavLink to="/legacy/results" style={linkStyle}>Results</NavLink>
            <NavLink to="/legacy/ping" style={linkStyle}>Ping</NavLink>
          </HStack>
        </HStack>

        <HStack spacing={2}>
          <AdminLogin />
          {pathname !== "/legacy/auctioneer" && (
            <NavLink to="/legacy/auctioneer" style={{ textDecoration: "none" }}>
              <Button size="sm" bg="var(--accent-2)" leftIcon={<Play size={14} />}>
                Start Auction
              </Button>
            </NavLink>
          )}
          <NavLink to="/legacy/results" style={{ textDecoration: "none" }}>
            <Button size="sm" variant="outline" leftIcon={<Download size={14} />}>
              Export
            </Button>
          </NavLink>
        </HStack>
      </HStack>
    </Box>
  );
}
