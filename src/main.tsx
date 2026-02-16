import React from "react";
import ReactDOM from "react-dom/client";
import { ChakraProvider, extendTheme } from "@chakra-ui/react";
import App from "./App";
import "./styles/globals.css";

// Keep Chakra temporarily for legacy screens.
// IMPORTANT: do NOT let Chakra set page background/colors anymore.
// Our CSS tokens own the look now.
const theme = extendTheme({
  config: {
    initialColorMode: "dark",
    useSystemColorMode: false,
  },
  styles: {
    global: {
      ":root, html, body, #root": {
        height: "100%",
      },
      body: {
        background: "transparent",
        color: "inherit",
        margin: 0,
      },
    },
  },
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ChakraProvider theme={theme}>
      <App />
    </ChakraProvider>
  </React.StrictMode>
);
