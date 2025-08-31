import { Box, Button, Divider, Heading, Stack, Text } from "@chakra-ui/react";
import { NavLink } from "react-router-dom";
import { ResetDraftButton } from "../components/auction/ResetDraftButton";

export default function Home() {
  return (
    <Box maxW="2xl" mx="auto" py={10} px={4} textAlign="center">
      <Heading mb={4}>Fantasy Football Auction App</Heading>
      <Text opacity={0.85} mb={8} maxW="2xl" mx="auto">
        Set up your league, nominate players, run the live auction with voice input,
        and export results—dark blues & grays theme.
      </Text>

      <Stack spacing={3} maxW="sm" mx="auto">
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
        
        <Divider my={4} borderColor="gray.600" />
        
        <ResetDraftButton />
      </Stack>
    </Box>
  );
}
