import { useState, useEffect } from 'react';
import { Box, Text, HStack, Icon, Tooltip } from '@chakra-ui/react';
import { Info } from 'lucide-react';
import { getVersionInfo, formatVersionShort, formatVersionFull, type VersionInfo } from '../lib/version';

export default function AppFooter() {
  const [versionInfo, setVersionInfo] = useState<VersionInfo | null>(null);
  const [showFullVersion, setShowFullVersion] = useState(false);

  useEffect(() => {
    getVersionInfo().then(setVersionInfo);
  }, []);

  if (!versionInfo) {
    return null;
  }

  return (
    <Box
      position="fixed"
      bottom={0}
      left={0}
      right={0}
      bg="gray.50"
      borderTop="1px"
      borderColor="gray.200"
      px={4}
      py={2}
      zIndex={20}
    >
      <HStack justify="space-between" align="center" maxW="container.xl" mx="auto">
        <Text fontSize="xs" color="gray.600">
          Fantasy Football Auction Assistant
        </Text>
        
        <Tooltip 
          label={formatVersionFull(versionInfo)}
          placement="top"
          hasArrow
        >
          <HStack 
            spacing={1} 
            cursor="pointer" 
            onClick={() => setShowFullVersion(!showFullVersion)}
            _hover={{ color: 'blue.600' }}
            transition="color 0.2s"
          >
            <Icon as={Info} boxSize={3} color="gray.500" />
            <Text fontSize="xs" color="gray.600" fontFamily="mono">
              {showFullVersion ? formatVersionFull(versionInfo) : formatVersionShort(versionInfo)}
            </Text>
          </HStack>
        </Tooltip>
      </HStack>
    </Box>
  );
}
