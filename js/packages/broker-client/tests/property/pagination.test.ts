import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { fetchAllPages } from "../../src/pagination.js";
import type { Page, PageParams } from "../../src/types.js";

describe("pagination property tests", () => {
  it("should_collect_exactly_all_items_across_pages", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.string(), { minLength: 0, maxLength: 50 }),
        fc.integer({ min: 1, max: 10 }),
        async (allItems, pageSize) => {
          const pages: Page<string>[] = [];
          const totalPages = Math.ceil(allItems.length / pageSize);

          for (let i = 0; i < Math.max(totalPages, 1); i++) {
            const start = i * pageSize;
            const content = allItems.slice(start, start + pageSize);
            pages.push({
              content,
              page: i,
              size: pageSize,
              totalElements: allItems.length,
              totalPages: Math.max(totalPages, 1),
            });
          }

          let callIdx = 0;
          const fetcher = async (_params: PageParams): Promise<Page<string>> => {
            const page = pages[callIdx];
            if (page === undefined) {
              return {
                content: [],
                page: callIdx,
                size: pageSize,
                totalElements: 0,
                totalPages: 0,
              };
            }
            callIdx++;
            return page;
          };

          const result = await fetchAllPages(fetcher, { size: pageSize });
          expect([...result]).toEqual(allItems);
        },
      ),
      { numRuns: 50 },
    );
  });
});
