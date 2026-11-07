import { QueryClient } from "@tanstack/react-query";
import { createRouter, rootRouteId } from "@tanstack/react-router";
import { describe, expect, it } from "vitest";

import { routeTree } from "@/routeTree.gen";

// Match routes without running loaders or rendering: loaders may need a server or
// network the test run lacks, and jsdom never loads the stylesheets React waits on.
describe("App routing", () => {
  it.each(["/customers", "/suppliers", "/ai", "/credit", "/insights"])("matches the new %s page", path => {
    const router = createRouter({ routeTree, context: { queryClient: new QueryClient() } });
    expect(router.matchRoutes(path).at(-1)?.routeId).toBe(path);
  });
  it("matches /cards to its index route and /cards/:id to the details page", () => {
    const router = createRouter({ routeTree, context: { queryClient: new QueryClient() } });
    expect(router.matchRoutes("/cards").at(-1)?.routeId).toBe("/cards/");
    expect(router.matchRoutes("/cards/card_0101").at(-1)?.routeId).toBe("/cards/$cardId");
  });
  it("matches a page for / instead of falling back to not found", () => {
    const router = createRouter({ routeTree, context: { queryClient: new QueryClient() } });

    const matches = router.matchRoutes("/");

    expect(matches.at(-1)?.routeId).not.toBe(rootRouteId);
  });
});
