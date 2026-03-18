import { describe, it, expect, vi } from "vitest";
import { pageIterator, fetchAllPages } from "../../src/pagination.js";
import type { Page, PageParams } from "../../src/types.js";

function makePage<T>(content: T[], page: number, totalPages: number): Page<T> {
  return {
    content,
    page,
    size: content.length,
    totalElements: totalPages * content.length,
    totalPages,
  };
}

describe("pageIterator", () => {
  it("should_iterate_over_single_page", async () => {
    const fetcher = vi
      .fn<(params: PageParams) => Promise<Page<string>>>()
      .mockResolvedValueOnce(makePage(["a", "b"], 0, 1));

    const items: string[] = [];
    for await (const item of pageIterator(fetcher)) {
      items.push(item);
    }

    expect(items).toEqual(["a", "b"]);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("should_iterate_over_multiple_pages", async () => {
    const fetcher = vi
      .fn<(params: PageParams) => Promise<Page<number>>>()
      .mockResolvedValueOnce(makePage([1, 2], 0, 3))
      .mockResolvedValueOnce(makePage([3, 4], 1, 3))
      .mockResolvedValueOnce(makePage([5], 2, 3));

    const items: number[] = [];
    for await (const item of pageIterator(fetcher)) {
      items.push(item);
    }

    expect(items).toEqual([1, 2, 3, 4, 5]);
    expect(fetcher).toHaveBeenCalledTimes(3);
  });

  it("should_handle_empty_page", async () => {
    const fetcher = vi
      .fn<(params: PageParams) => Promise<Page<string>>>()
      .mockResolvedValueOnce(makePage([], 0, 0));

    const items: string[] = [];
    for await (const item of pageIterator(fetcher)) {
      items.push(item);
    }

    expect(items).toEqual([]);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("should_pass_page_params_to_fetcher", async () => {
    const fetcher = vi
      .fn<(params: PageParams) => Promise<Page<string>>>()
      .mockResolvedValueOnce(makePage(["a"], 2, 3));

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    for await (const _item of pageIterator(fetcher, { page: 2, size: 5 })) {
      break;
    }

    expect(fetcher).toHaveBeenCalledWith(expect.objectContaining({ page: 2, size: 5 }));
  });

  it("should_increment_page_number", async () => {
    const fetcher = vi
      .fn<(params: PageParams) => Promise<Page<string>>>()
      .mockResolvedValueOnce(makePage(["a"], 0, 2))
      .mockResolvedValueOnce(makePage(["b"], 1, 2));

    const items: string[] = [];
    for await (const item of pageIterator(fetcher)) {
      items.push(item);
    }

    expect(fetcher).toHaveBeenNthCalledWith(1, expect.objectContaining({ page: 0 }));
    expect(fetcher).toHaveBeenNthCalledWith(2, expect.objectContaining({ page: 1 }));
  });
});

describe("fetchAllPages", () => {
  it("should_collect_all_items", async () => {
    const fetcher = vi
      .fn<(params: PageParams) => Promise<Page<string>>>()
      .mockResolvedValueOnce(makePage(["a", "b"], 0, 2))
      .mockResolvedValueOnce(makePage(["c"], 1, 2));

    const items = await fetchAllPages(fetcher);
    expect(items).toEqual(["a", "b", "c"]);
  });

  it("should_return_empty_array_for_empty_result", async () => {
    const fetcher = vi
      .fn<(params: PageParams) => Promise<Page<string>>>()
      .mockResolvedValueOnce(makePage([], 0, 0));
    const items = await fetchAllPages(fetcher);
    expect(items).toEqual([]);
  });

  it("should_throw_when_exceeding_max_pages_limit", async () => {
    // Mock a fetcher that always reports more pages
    const fetcher = vi
      .fn<(params: PageParams) => Promise<Page<string>>>()
      .mockImplementation((params) => Promise.resolve(makePage(["item"], params.page ?? 0, 99999)));

    await expect(fetchAllPages(fetcher)).rejects.toThrow("Exceeded maximum page limit");
  });
});
