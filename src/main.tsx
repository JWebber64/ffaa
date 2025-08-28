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
      baseStyle: (props: any) => ({
        _focus: {
          boxShadow: '0 0 0 3px var(--chakra-colors-blue-400)',
        },
        _disabled: {
          '&, &:hover, &[data-hover]': {
            opacity: '1 !important',
            cursor: 'not-allowed !important',
            color: 'gray.100 !important',
            bg: 'transparent !important',
          }
        },
      }),
      variants: {
        solid: (props: any) => ({
          bg: props.colorMode === 'dark' ? 'blue.500' : 'blue.500',
          color: 'white',
          _hover: {
            bg: props.colorMode === 'dark' ? 'blue.400' : 'blue.600',
            _disabled: {
              bg: 'gray.600',
              color: 'gray.300',
            },
          },
          _active: {
            bg: 'blue.600',
          },
        }),
        outline: (props: any) => ({
          border: '1px solid',
          borderColor: 'gray.600',
          color: props.colorMode === 'dark' ? 'white' : 'gray.800',
          '&[disabled], &[disabled]:hover, &[disabled][data-active]': {
            opacity: 1,
            cursor: 'not-allowed',
            borderColor: 'gray.600',
            color: 'gray.500 !important',
            backgroundColor: props.colorMode === 'dark' ? 'gray.800' : 'gray.100' + ' !important',
            boxShadow: 'none !important',
            '&:hover, &:active, &[data-hover], &[data-active]': {
              backgroundColor: (props.colorMode === 'dark' ? 'gray.800' : 'gray.100') + ' !important',
              color: 'gray.500 !important',
            },
          },
          _hover: {
            bg: props.colorMode === 'dark' ? 'gray.700' : 'gray.100',
          },
          _active: {
            bg: props.colorMode === 'dark' ? 'gray.600' : 'gray.200',
          },
        }),
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
