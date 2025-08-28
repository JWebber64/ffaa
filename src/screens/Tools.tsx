import { Container, Heading, Stack, Button } from "@chakra-ui/react";

export default function Tools() {
  return (
    <Container maxW="lg" py={8}>
      <Stack spacing={3}>
        <Heading>Tools</Heading>
        <Button variant="ghost" isDisabled>Undo</Button>
        <Button variant="ghost" isDisabled>Redo</Button>
        <Button variant="ghost">Export CSV</Button>
        <Button colorScheme="red" variant="outline">Reset Draft</Button>
      </Stack>
    </Container>
  );
}
