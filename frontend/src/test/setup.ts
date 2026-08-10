import "@testing-library/jest-dom/vitest";

import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Testing Library only auto-cleans when a global `afterEach` exists at import
// time, which isn't guaranteed here — do it explicitly so a component left
// mounted by one test can't leak into the next one's queries.
afterEach(() => {
  cleanup();
});
