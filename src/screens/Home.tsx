import { Box, Button, Heading, Stack, Text } from "@chakra-ui/react";
import { NavLink } from "react-router-dom";

export default function Home() {
  return (
    <Box maxW="2xl" mx="auto" py={10}>
      <Heading mb={2}>Fantasy Football Auction App</Heading>
      <Text opacity={0.85} mb={8}>
        Set up your league, nominate players, run the live auction with voice input,
        and export results—dark blues & grays theme.
      </Text>

      <Stack gap={3} maxW="sm">
        <NavLink to="/setup" style={{ textDecoration: "none" }}>
          <Button bg="#2372b2" width="100%">Start New Draft</Button>
        </NavLink>
        <NavLink to="/board" style={{ textDecoration: "none" }}>
          <Button variant="outline" width="100%">View Draft Board</Button>
        </NavLink>
        <NavLink to="/auctioneer" style={{ textDecoration: "none" }}>
          <Button variant="outline" width="100%">Auctioneer</Button>
        </NavLink>
        <NavLink to="/results" style={{ textDecoration: "none" }}>
          <Button variant="outline" width="100%">Results</Button>
        </NavLink>
      </Stack>
    </Box>
  );
}
