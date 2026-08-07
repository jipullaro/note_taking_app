import { vi } from "vitest";

/**
 * Shared stand-in for `next/navigation`, which has no working implementation
 * outside a Next request context — every client component in the app calls at
 * least one of these hooks.
 *
 * Tests opt in with a bare `vi.mock("next/navigation")` (Vitest picks up
 * `__mocks__/next/navigation.ts`, which re-exports this module), then drive it
 * through the helpers below:
 *
 *   vi.mock("next/navigation");
 *   setPathname("/archive");
 *   expect(routerMock.push).toHaveBeenCalledWith("/dashboard");
 */
export const routerMock = {
  push: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
  back: vi.fn(),
  forward: vi.fn(),
  prefetch: vi.fn(),
};

let pathname = "/dashboard";
let searchParams = new URLSearchParams();

export function setPathname(next: string): void {
  pathname = next;
}

/** Accepts "category=3" or "?category=3". */
export function setSearchParams(next: string): void {
  searchParams = new URLSearchParams(next);
}

/** Clears router call history and restores the default route. Call in beforeEach. */
export function resetNavigation(): void {
  Object.values(routerMock).forEach((fn) => fn.mockReset());
  pathname = "/dashboard";
  searchParams = new URLSearchParams();
}

export const useRouter = () => routerMock;
export const usePathname = () => pathname;
export const useSearchParams = () => searchParams;
export const useParams = () => ({});

// The real versions throw to halt rendering; tests assert on the throw.
export const redirect = vi.fn((url: string) => {
  throw new Error(`NEXT_REDIRECT:${url}`);
});
export const notFound = vi.fn(() => {
  throw new Error("NEXT_NOT_FOUND");
});
