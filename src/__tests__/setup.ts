// Mock for window.localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

// Mock for React
const originalConsoleError = console.error;
const jsDomCssError = 'Error: Could not parse CSS stylesheet';
console.error = (...params) => {
  if (!params.find((p) => p.toString().includes(jsDomCssError))) {
    originalConsoleError(...params);
  }
};

// Mock for React 18
let originalError: typeof console.error;
let originalWarn: typeof console.warn;

beforeAll(() => {
  originalError = console.error;
  originalWarn = console.warn;
  console.error = (...args) => {
    if (args[0] && typeof args[0] === 'string' && args[0].includes('ReactDOM.render is no longer supported in React 18')) {
      return;
    }
    originalError.call(console, ...args);
  };
  console.warn = (...args) => {
    if (args[0] && typeof args[0] === 'string' && (
      args[0].includes('componentWillReceiveProps') ||
      args[0].includes('componentWillUpdate') ||
      args[0].includes('componentWillMount')
    )) {
      return;
    }
    originalWarn.call(console, ...args);
  };
});

afterAll(() => {
  console.error = originalError;
  console.warn = originalWarn;
});
