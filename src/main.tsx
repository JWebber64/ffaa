import React from "react";
import ReactDOM from "react-dom/client";
import { ChakraProvider, defaultSystem, defineConfig } from "@chakra-ui/react";
import App from "./App";

const config = defineConfig({
  cssVarsRoot: ":root",
  globalCss: {
    ":root, html, body, #root": {
      height: "100%",
      background: "#181e28",   // dark blue/gray you want
      color: "white",
      margin: 0,
    },
  },
});

// minimal system: start from defaultSystem and override config
const system = {
  ...defaultSystem,
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
