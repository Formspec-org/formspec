// Tell React's act() that this is a test environment
(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
