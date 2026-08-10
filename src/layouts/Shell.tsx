import { useState } from "react";
import type { MouseEvent } from "react";
import {
  Box,
  Button,
  HStack,
  Text,
  VStack,
  Progress,
} from "@/ui/custom";
import { Outlet } from "react-router-dom";
import TopNav from "../components/TopNav";
import SideNav from "../components/SideNav";

interface ShellProps {
  globalLoading?: boolean;
}

export default function Shell({ globalLoading = false }: ShellProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <Box minH="100dvh" bg="var(--bg-0)" color="white">
      <TopNav onMenu={() => setDrawerOpen(true)} />

      {globalLoading && (
        <Progress size="xs" isIndeterminate colorScheme="blue" />
      )}

      <Box display="grid" gridTemplateColumns={{ base: "1fr", lg: "260px 1fr" }}>
        <Box
          display={{ base: "none", lg: "block" }}
          borderRight="1px solid"
          borderColor="gray.700"
          bg="var(--bg-1)"
          minH="calc(100dvh - 64px)"
          position="sticky"
          top="64px"
        >
          <SideNav onNavigate={() => {}} />
        </Box>

        <Box px={{ base: 3, md: 6 }} py={4} opacity={globalLoading ? 0.7 : 1} transition="opacity 0.2s">
          <Outlet />
        </Box>
      </Box>

      {drawerOpen && (
        <Box
          position="fixed"
          inset="0"
          zIndex={50}
          onClick={() => setDrawerOpen(false)}
        >
          <Box position="absolute" inset="0" bg="black" opacity={0.5} />

          <Box
            position="absolute"
            top="0"
            left="0"
            bottom="0"
            width="260px"
            bg="var(--bg-1)"
            borderRight="1px solid var(--line-1)"
            p={3}
            onClick={(event: MouseEvent<HTMLDivElement>) => event.stopPropagation()}
          >
            <HStack justifyContent="space-between" mb={2}>
              <Text fontWeight="bold">FFAA</Text>
              <Button size="sm" variant="outline" onClick={() => setDrawerOpen(false)}>
                Close
              </Button>
            </HStack>
            <VStack alignItems="stretch" gap={1}>
              <SideNav onNavigate={() => setDrawerOpen(false)} />
            </VStack>
          </Box>
        </Box>
      )}
    </Box>
  );
}
