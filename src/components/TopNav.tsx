import { Box, Button, HStack, Text } from "@chakra-ui/react";
import { NavLink, useLocation } from "react-router-dom";

type Props = { onMenu: () => void };

const linkStyle = ({ isActive }: { isActive: boolean }) => ({
  padding: "8px 10px",
  borderRadius: "8px",
  background: isActive ? "#233347" : "transparent",
  color: "white",
  textDecoration: "none",
  border: "1px solid",
  borderColor: isActive ? "#2a3a52" : "transparent",
});

export default function TopNav({ onMenu }: Props) {
  const { pathname } = useLocation();

  return (
    <Box
      as="header"
      height="64px"
      borderBottom="1px solid"
      borderColor="gray.700"
      bg="#1a2230"
      position="sticky"
      top="0"
      zIndex={40}
    >
      <HStack height="100%" justifyContent="space-between" px={{ base: 3, md: 6 }}>
        <HStack gap={3}>
          <Button display={{ base: "inline-flex", lg: "none" }} onClick={onMenu} variant="outline" size="sm">
            ☰
          </Button>

          <Text fontWeight="bold">🏈 FFAA</Text>

          <HStack gap={2} display={{ base: "none", md: "flex" }}>
            <NavLink to="/" style={linkStyle}>Home</NavLink>
            <NavLink to="/setup" style={linkStyle}>Setup</NavLink>
            <NavLink to="/board" style={linkStyle}>Board</NavLink>
            <NavLink to="/auctioneer" style={linkStyle}>Auctioneer</NavLink>
            <NavLink to="/results" style={linkStyle}>Results</NavLink>
            <NavLink to="/tools" style={linkStyle}>Tools</NavLink>
          </HStack>
        </HStack>

        <HStack gap={2}>
          {pathname !== "/auctioneer" && (
            <NavLink to="/auctioneer" style={{ textDecoration: "none" }}>
              <Button size="sm" bg="#2372b2">Start Auction</Button>
            </NavLink>
          )}
          <NavLink to="/results" style={{ textDecoration: "none" }}>
            <Button size="sm" variant="outline">Export</Button>
          </NavLink>
        </HStack>
      </HStack>
    </Box>
  );
}
