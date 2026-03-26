import type { Page, PageParams } from "./types.js";

/** Maximum number of pages to fetch to prevent infinite loops. */
const MAX_PAGES = 1000;

/** Async iterator that fetches all pages from a paginated endpoint. */
export async function* pageIterator<T>(
  fetcher: (params: PageParams) => Promise<Page<T>>,
  params: PageParams = {},
): AsyncGenerator<T, void, undefined> {
  let currentPage = params.page ?? 0;
  const size = params.size ?? 20;
  let hasMore = true;
  let pagesRead = 0;

  while (hasMore) {
    if (pagesRead >= MAX_PAGES) {
      throw new Error(`Exceeded maximum page limit (${String(MAX_PAGES)})`);
    }
    const page = await fetcher({ ...params, page: currentPage, size });
    for (const item of page.content) {
      yield item;
    }
    currentPage++;
    pagesRead++;
    hasMore = currentPage < page.totalPages;
  }
}

/** Collect all items from all pages into a single array. */
export async function fetchAllPages<T>(
  fetcher: (params: PageParams) => Promise<Page<T>>,
  params: PageParams = {},
): Promise<readonly T[]> {
  const items: T[] = [];
  for await (const item of pageIterator(fetcher, params)) {
    items.push(item);
  }
  return items;
}
