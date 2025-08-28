import { useState } from "react";
import {
  Box,
  Button,
  HStack,
  Text,
  VStack,
} from "@chakra-ui/react";
import { Outlet } from "react-router-dom";
import TopNav from "@/components/TopNav";
import SideNav from "@/components/SideNav";

/**
 * App shell:
 * - Top bar (always visible)
 * - Sidebar (visible ≥1024px), Drawer on mobile
 * - Content area with safe max width
 */
export default function Shell() {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <Box minH="100dvh" bg="#181e28" color="white">
      {/* Top Bar */}
      <TopNav onMenu={() => setDrawerOpen(true)} />

      {/* Body */}
      <Box display="grid" gridTemplateColumns={{ base: "1fr", lg: "260px 1fr" }}>
        {/* Sidebar for desktop */}
        <Box
          display={{ base: "none", lg: "block" }}
          borderRight="1px solid"
          borderColor="gray.700"
          bg="#1b2330"
          minH="calc(100dvh - 64px)"
          position="sticky"
          top="64px"
        >
          <SideNav onNavigate={() => {}} />
        </Box>

        {/* Content */}
        <Box px={{ base: 3, md: 6 }} py={4}>
          <Outlet />
        </Box>
      </Box>

      {/* Mobile Drawer */}
      {drawerOpen && (
        <Box
          position="fixed"
          inset="0"
          zIndex={50}
          onClick={() => setDrawerOpen(false)}
        >
          {/* Backdrop */}
          <Box position="absolute" inset="0" bg="black" opacity={0.5} />

          {/* Panel */}
          <Box
            position="absolute"
            top="0"
            left="0"
            bottom="0"
            width="260px"
            bg="#1b2330"
            borderRight="1px solid #334155"
            p={3}
            onClick={(e) => e.stopPropagation()}
          >
            <HStack justifyContent="space-between" mb={2}>
              <Text fontWeight="bold">FFA A</Text>
              <Button size="sm" variant="outline" onClick={() => setDrawerOpen(false)}>
                ✕
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
