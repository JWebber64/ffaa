import React from "react";
import ReactDOM from "react-dom/client";
import { ChakraProvider, extendTheme } from "@chakra-ui/react";
import App from "./AppV2";

// Extend the default theme with custom styles
const theme = extendTheme({
  styles: {
    global: {
      ":root, html, body, #root": {
        height: "100%",
        background: "#181e28",
        color: "white",
        margin: 0,
      },
    },
  },
  components: {
    Button: {
      baseStyle: {
        fontWeight: 'semibold',
        borderRadius: 'md',
      },
    },
  },
});

// minimal system: start from defaultSystem and override config
const system = {
  ...ChakraProvider.defaultSystem,
  config,
};

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {/* Chakra v3 uses `value`, not `theme` */}
    <ChakraProvider value={system}>
      <App />
    </ChakraProvider>
  </React.StrictMode>
);
