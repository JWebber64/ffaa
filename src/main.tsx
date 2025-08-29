import React from "react";
import ReactDOM from "react-dom/client";
import { ChakraProvider, extendTheme } from "@chakra-ui/react";
import App from "./App";

// Extend the default theme with custom styles
const theme = extendTheme({
  config: {
    initialColorMode: 'dark',
    useSystemColorMode: false,
  },
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
        _focus: { 
          boxShadow: '0 0 0 3px var(--chakra-colors-blue-400)' 
        },
        _disabled: { 
          opacity: 0.75, 
          cursor: 'not-allowed' 
        },
      },
      variants: {
        solid: (props: any) => {
          const { colorScheme: cs = 'blue' } = props;
          return {
            bg: `${cs}.500`,
            color: 'white',
            _hover: { bg: `${cs}.600` },
            _active: { bg: `${cs}.700` },
            _disabled: {
              bg: `${cs}.500`,
              color: 'white',
              opacity: 0.75,
              boxShadow: 'none',
            },
          };
        },
        outline: (props: any) => {
          const { colorScheme: cs = 'blue' } = props;
          return {
            border: '1px solid',
            borderColor: `${cs}.500`,
            color: 'white',
            _hover: { bg: 'rgba(255,255,255,0.08)' },
            _active: { bg: 'rgba(255,255,255,0.12)' },
            _disabled: {
              borderColor: `${cs}.500`,
              color: 'whiteAlpha.800',
              opacity: 0.6,
              bg: 'transparent',
            },
          };
        },
        ghost: (props: any) => ({
          color: props.colorMode === 'dark' ? 'white' : 'gray.800',
          '&[disabled], &[disabled]:hover, &[disabled][data-active]': {
            opacity: 1,
            cursor: 'not-allowed',
            color: 'gray.500 !important',
            backgroundColor: 'transparent !important',
            boxShadow: 'none !important',
            '&:hover, &:active, &[data-hover], &[data-active]': {
              backgroundColor: 'transparent !important',
              color: 'gray.500 !important',
            },
          },
          _hover: {
            bg: 'rgba(255, 255, 255, 0.08)',
          },
          _active: {
            bg: 'rgba(255, 255, 255, 0.12)',
          },
        }),
      },
    },
    Input: {
      baseStyle: {
        field: {
          bg: 'gray.800',
          borderColor: 'gray.600',
          color: 'white',
          _hover: {
            borderColor: 'blue.500',
          },
          _focus: {
            borderColor: 'blue.400',
            boxShadow: '0 0 0 1px var(--chakra-colors-blue-400)',
          },
          _placeholder: {
            color: 'gray.400',
          },
        },
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
