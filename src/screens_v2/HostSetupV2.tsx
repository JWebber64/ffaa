import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Button,
  Select,
  VStack,
  HStack,
  Text,
  Heading,
  Divider,
  useColorModeValue,
  Grid,
  GridItem,
} from "@chakra-ui/react";
import { DEFAULT_CONFIG_AUCTION_12 } from "../types/draftConfig";
import { DraftConfigV2, LeagueType, DraftTypeV2, ScoringType, TeamCountV2 } from "../types/draftConfig";
import RosterBuilder from "../components/premium/RosterBuilder";
import AuctionSettingsForm from "../components/premium/AuctionSettingsForm";
import SnakeSettingsForm from "../components/premium/SnakeSettingsForm";

export default function HostSetupV2() {
  const navigate = useNavigate();
  const [config, setConfig] = useState<DraftConfigV2>(DEFAULT_CONFIG_AUCTION_12);
  const [creating, setCreating] = useState(false);

  const bgColor = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.600');
  const cardBgColor = useColorModeValue('gray.50', 'gray.700');

  const updateConfig = <K extends keyof DraftConfigV2>(key: K, val: DraftConfigV2[K]) => {
    setConfig({ ...config, [key]: val });
  };

  const updateAuctionSettings = (settings: typeof config.auctionSettings) => {
    if (settings) {
      setConfig({ ...config, auctionSettings: settings });
    }
  };

  const updateSnakeSettings = (settings: typeof config.snakeSettings) => {
    if (settings) {
      setConfig({ ...config, snakeSettings: settings });
    }
  };

  async function onCreateLobby() {
    setCreating(true);
    try {
      // Store config temporarily - will be persisted when draft is created
      sessionStorage.setItem('draftConfigV2', JSON.stringify(config));
      navigate('/host');
    } finally {
      setCreating(false);
    }
  }

  return (
    <Box minH="100vh" bg={cardBgColor} py={8}>
      <Box maxW="4xl" mx="auto" px={4}>
        <VStack spacing={8} align="stretch">
          {/* Header */}
          <Box textAlign="center">
            <Heading size="2xl" mb={4}>
              Setup Your Draft
            </Heading>
            <Text color="gray.600" fontSize="lg">
              Configure your draft settings and create your lobby
            </Text>
          </Box>

          {/* Configuration Form */}
          <Box bg={bgColor} border="1px" borderColor={borderColor} borderRadius="lg" p={8}>
            <VStack spacing={8} align="stretch">
              {/* League Basics */}
              <Box>
                <Heading size="md" mb={6}>
                  League Basics
                </Heading>
                
                <Grid templateColumns={{ base: '1fr', md: 'repeat(2, 1fr)' }} gap={6}>
                  <GridItem>
                    <VStack align="stretch" spacing={2}>
                      <Text fontSize="sm" fontWeight="medium">
                        League Type
                      </Text>
                      <Select
                        value={config.leagueType}
                        onChange={(e) => updateConfig('leagueType', e.target.value as LeagueType)}
                        size="md"
                      >
                        <option value="redraft">Redraft</option>
                        <option value="keeper">Keeper</option>
                        <option value="dynasty">Dynasty</option>
                      </Select>
                    </VStack>
                  </GridItem>

                  <GridItem>
                    <VStack align="stretch" spacing={2}>
                      <Text fontSize="sm" fontWeight="medium">
                        Scoring
                      </Text>
                      <Select
                        value={config.scoring}
                        onChange={(e) => updateConfig('scoring', e.target.value as ScoringType)}
                        size="md"
                      >
                        <option value="standard">Standard</option>
                        <option value="half_ppr">Half PPR</option>
                        <option value="ppr">PPR</option>
                      </Select>
                    </VStack>
                  </GridItem>

                  <GridItem>
                    <VStack align="stretch" spacing={2}>
                      <Text fontSize="sm" fontWeight="medium">
                        Draft Type
                      </Text>
                      <Select
                        value={config.draftType}
                        onChange={(e) => updateConfig('draftType', e.target.value as DraftTypeV2)}
                        size="md"
                      >
                        <option value="auction">Auction Draft</option>
                        <option value="snake">Snake Draft</option>
                      </Select>
                    </VStack>
                  </GridItem>

                  <GridItem>
                    <VStack align="stretch" spacing={2}>
                      <Text fontSize="sm" fontWeight="medium">
                        Team Count
                      </Text>
                      <Select
                        value={config.teamCount}
                        onChange={(e) => updateConfig('teamCount', parseInt(e.target.value) as TeamCountV2)}
                        size="md"
                      >
                        <option value={8}>8 Teams</option>
                        <option value={10}>10 Teams</option>
                        <option value={12}>12 Teams</option>
                        <option value={14}>14 Teams</option>
                        <option value={16}>16 Teams</option>
                      </Select>
                    </VStack>
                  </GridItem>
                </Grid>
              </Box>

              <Divider />

              {/* Roster Builder */}
              <Box>
                <Heading size="md" mb={4}>
                  Roster Configuration
                </Heading>
                <RosterBuilder
                  value={config.rosterSlots}
                  onChange={(slots) => updateConfig('rosterSlots', slots)}
                  allowIdp={true}
                />
              </Box>

              <Divider />

              {/* Draft-Specific Settings */}
              <Box>
                <Heading size="md" mb={4}>
                  {config.draftType === 'auction' ? 'Auction Settings' : 'Snake Settings'}
                </Heading>
                
                {config.draftType === 'auction' && config.auctionSettings && (
                  <AuctionSettingsForm
                    value={config.auctionSettings}
                    onChange={updateAuctionSettings}
                    teamCount={config.teamCount}
                  />
                )}
                
                {config.draftType === 'snake' && config.snakeSettings && (
                  <SnakeSettingsForm
                    value={config.snakeSettings}
                    onChange={updateSnakeSettings}
                  />
                )}
              </Box>

              {/* Create Lobby Button */}
              <Box pt={4}>
                <Button
                  onClick={onCreateLobby}
                  disabled={creating}
                  isLoading={creating}
                  size="lg"
                  colorScheme="blue"
                  width="full"
                >
                  {creating ? 'Creating Lobby...' : 'Create Lobby'}
                </Button>
              </Box>
            </VStack>
          </Box>

          {/* Info Box */}
          <Box bg={bgColor} border="1px" borderColor={borderColor} borderRadius="lg" p={6}>
            <HStack spacing={4} align="start">
              <Box color="blue.500" mt={1}>
                <svg width="20" height="20" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
              </Box>
              <VStack align="start" spacing={2} flex={1}>
                <Text fontWeight="medium">Next Steps</Text>
                <Text fontSize="sm" color="gray.600">
                  After creating the lobby, you'll get a room code to share with other managers. 
                  The draft configuration will be locked once the lobby is created.
                </Text>
              </VStack>
            </HStack>
          </Box>
        </VStack>
      </Box>
    </Box>
  );
}
