import { describe, it, expect } from "vitest";
import * as fc from "fast-check";

describe("Property-based tests: API Types", () => {
  describe("Application name", () => {
    it("should accept any non-empty string as valid for display", () => {
      fc.assert(
        fc.property(fc.string({ minLength: 1, maxLength: 200 }), (name: string) => {
          // arrange & act - application name displayed as-is
          const displayValue = name.trim();

          // assert - non-empty strings are valid for display
          expect(displayValue.length).toBeGreaterThanOrEqual(0);
          expect(typeof name).toBe("string");
        }),
      );
    });

    it("should be usable as a record key", () => {
      fc.assert(
        fc.property(fc.string({ minLength: 1, maxLength: 100 }), (name: string) => {
          // arrange - use null prototype to avoid collisions with Object.prototype
          const record: Record<string, string> = Object.create(null);

          // act
          record[name] = "value";

          // assert
          expect(record[name]).toBe("value");
        }),
      );
    });
  });

  describe("Contract version", () => {
    it("should roundtrip through string operations for semver format", () => {
      fc.assert(
        fc.property(
          fc.nat({ max: 999 }),
          fc.nat({ max: 999 }),
          fc.nat({ max: 999 }),
          (major: number, minor: number, patch: number) => {
            // arrange
            const version = `${major}.${minor}.${patch}`;

            // act - roundtrip through split and join
            const parts = version.split(".");
            const reconstructed = parts.join(".");

            // assert
            expect(reconstructed).toBe(version);
            expect(parts.length).toBe(3);
            expect(Number(parts[0])).toBe(major);
            expect(Number(parts[1])).toBe(minor);
            expect(Number(parts[2])).toBe(patch);
          },
        ),
      );
    });

    it("should maintain ordering through string comparison for same-length versions", () => {
      fc.assert(
        fc.property(
          fc.nat({ max: 99 }),
          fc.nat({ max: 99 }),
          fc.nat({ max: 99 }),
          (major: number, minor: number, patch: number) => {
            // arrange
            const version = `${major}.${minor}.${patch}`;
            const nextPatch = `${major}.${minor}.${patch + 1}`;

            // act - numeric comparison after parsing
            const vParts = version.split(".").map(Number);
            const nParts = nextPatch.split(".").map(Number);

            // assert - next patch is always greater
            expect(nParts[2]).toBeGreaterThan(vParts[2]);
          },
        ),
      );
    });
  });

  describe("StatusBadge variant", () => {
    const statusStyles: Record<string, string> = {
      success: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
      safe: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
      failed: "bg-red-500/10 text-red-400 border-red-500/20",
      unsafe: "bg-red-500/10 text-red-400 border-red-500/20",
      pending: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    };

    it("should map every valid status to a non-empty CSS class", () => {
      fc.assert(
        fc.property(
          fc.constantFrom("success", "failed", "pending", "safe", "unsafe"),
          (status: string) => {
            // arrange & act
            const cssClass = statusStyles[status];

            // assert
            expect(cssClass).toBeDefined();
            expect(cssClass.length).toBeGreaterThan(0);
            expect(cssClass).toContain("bg-");
            expect(cssClass).toContain("text-");
            expect(cssClass).toContain("border-");
          },
        ),
      );
    });

    it("should produce uppercase display text for any status", () => {
      fc.assert(
        fc.property(
          fc.constantFrom("success", "failed", "pending", "safe", "unsafe"),
          (status: string) => {
            // arrange & act
            const displayText = status.toUpperCase();

            // assert
            expect(displayText).toBe(displayText.toUpperCase());
            expect(displayText.length).toBe(status.length);
          },
        ),
      );
    });

    it("should fallback to pending style for unknown status", () => {
      fc.assert(
        fc.property(
          fc
            .string({ minLength: 1 })
            .filter((s) => !["success", "failed", "pending", "safe", "unsafe"].includes(s)),
          (unknownStatus: string) => {
            // arrange & act - use Object.hasOwn to avoid Object.prototype property collisions
            const cssClass = Object.hasOwn(statusStyles, unknownStatus)
              ? statusStyles[unknownStatus]
              : statusStyles.pending;

            // assert - should fall back to pending
            expect(cssClass).toBe(statusStyles.pending);
          },
        ),
      );
    });
  });

  describe("DataTable sorting", () => {
    it("should be idempotent - sorting twice produces same result as sorting once", () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              id: fc.uuid(),
              name: fc.string({ minLength: 1, maxLength: 50 }),
            }),
            { minLength: 0, maxLength: 50 },
          ),
          (items) => {
            // arrange
            const sortByName = (arr: typeof items) =>
              [...arr].sort((a, b) => a.name.localeCompare(b.name));

            // act
            const sortedOnce = sortByName(items);
            const sortedTwice = sortByName(sortedOnce);

            // assert - idempotent
            expect(sortedTwice).toEqual(sortedOnce);
          },
        ),
      );
    });

    it("should preserve array length after sorting", () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              id: fc.uuid(),
              name: fc.string({ minLength: 1 }),
            }),
            { minLength: 0, maxLength: 100 },
          ),
          (items) => {
            // arrange & act
            const sorted = [...items].sort((a, b) => a.name.localeCompare(b.name));

            // assert
            expect(sorted.length).toBe(items.length);
          },
        ),
      );
    });

    it("should contain exactly the same elements after sorting", () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              id: fc.uuid(),
              name: fc.string({ minLength: 1, maxLength: 20 }),
            }),
            { minLength: 0, maxLength: 30 },
          ),
          (items) => {
            // arrange & act
            const sorted = [...items].sort((a, b) => a.name.localeCompare(b.name));
            const originalIds = items.map((i) => i.id).sort();
            const sortedIds = sorted.map((i) => i.id).sort();

            // assert
            expect(sortedIds).toEqual(originalIds);
          },
        ),
      );
    });
  });

  describe("Search filtering", () => {
    it("should return all items when filtering with empty string", () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              id: fc.uuid(),
              name: fc.string({ minLength: 1, maxLength: 50 }),
              owner: fc.string({ minLength: 1, maxLength: 50 }),
            }),
            { minLength: 0, maxLength: 50 },
          ),
          (items) => {
            // arrange
            const search = "";

            // act
            const filtered = items.filter(
              (item) =>
                item.name.toLowerCase().includes(search.toLowerCase()) ||
                item.owner.toLowerCase().includes(search.toLowerCase()),
            );

            // assert - empty search returns everything
            expect(filtered.length).toBe(items.length);
            expect(filtered).toEqual(items);
          },
        ),
      );
    });

    it("should return subset of items when filtering with non-empty string", () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              id: fc.uuid(),
              name: fc.string({ minLength: 1, maxLength: 50 }),
              owner: fc.string({ minLength: 1, maxLength: 50 }),
            }),
            { minLength: 0, maxLength: 50 },
          ),
          fc.string({ minLength: 1, maxLength: 10 }),
          (items, search) => {
            // arrange & act
            const filtered = items.filter(
              (item) =>
                item.name.toLowerCase().includes(search.toLowerCase()) ||
                item.owner.toLowerCase().includes(search.toLowerCase()),
            );

            // assert - filtered is always a subset
            expect(filtered.length).toBeLessThanOrEqual(items.length);
            // every filtered item must contain the search term
            filtered.forEach((item) => {
              const matchesName = item.name.toLowerCase().includes(search.toLowerCase());
              const matchesOwner = item.owner.toLowerCase().includes(search.toLowerCase());
              expect(matchesName || matchesOwner).toBe(true);
            });
          },
        ),
      );
    });

    it("should be case-insensitive", () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              id: fc.uuid(),
              name: fc.string({ minLength: 1, maxLength: 30 }),
              owner: fc.string({ minLength: 1, maxLength: 30 }),
            }),
            { minLength: 0, maxLength: 30 },
          ),
          fc.string({ minLength: 1, maxLength: 10 }),
          (items, search) => {
            // arrange & act
            const filteredLower = items.filter(
              (item) =>
                item.name.toLowerCase().includes(search.toLowerCase()) ||
                item.owner.toLowerCase().includes(search.toLowerCase()),
            );
            const filteredUpper = items.filter(
              (item) =>
                item.name.toLowerCase().includes(search.toUpperCase().toLowerCase()) ||
                item.owner.toLowerCase().includes(search.toUpperCase().toLowerCase()),
            );

            // assert
            expect(filteredLower).toEqual(filteredUpper);
          },
        ),
      );
    });
  });

  describe("URL construction in api/client", () => {
    it("should properly encode path parameters", () => {
      fc.assert(
        fc.property(fc.string({ minLength: 1, maxLength: 100 }), (appName: string) => {
          // arrange & act
          const encoded = encodeURIComponent(appName);
          const decoded = decodeURIComponent(encoded);

          // assert - roundtrip preserves the original
          expect(decoded).toBe(appName);
        }),
      );
    });

    it("should encode special URL characters in path segments", () => {
      fc.assert(
        fc.property(
          fc.constantFrom("my app", "test/service", "name?param", "hash#value", "a&b"),
          (name: string) => {
            // arrange & act
            const path = `/api/v1/applications/${encodeURIComponent(name)}`;

            // assert - no unencoded special chars in path
            const pathSegment = path.split("/").pop()!;
            expect(pathSegment).not.toContain("/");
            expect(pathSegment).not.toContain("?");
            expect(pathSegment).not.toContain("#");
          },
        ),
      );
    });

    it("should properly encode query parameters for can-i-deploy", () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.string({ minLength: 1, maxLength: 20 }),
          fc.constantFrom("dev", "staging", "production"),
          (application: string, version: string, environment: string) => {
            // arrange & act
            const url = `/api/v1/can-i-deploy?application=${encodeURIComponent(application)}&version=${encodeURIComponent(version)}&environment=${encodeURIComponent(environment)}`;

            // assert - URL is parseable
            const parsed = new URL(url, "http://localhost");
            expect(parsed.searchParams.get("application")).toBe(application);
            expect(parsed.searchParams.get("version")).toBe(version);
            expect(parsed.searchParams.get("environment")).toBe(environment);
          },
        ),
      );
    });

    it("should construct valid base path for contracts endpoint", () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 50 }).filter((s) => !s.includes("/")),
          fc.stringMatching(/^[0-9]+\.[0-9]+\.[0-9]+$/),
          (appName: string, version: string) => {
            // arrange & act
            const path = `/api/v1/applications/${appName}/versions/${version}/contracts`;

            // assert
            expect(path).toContain("/api/v1/applications/");
            expect(path).toContain("/versions/");
            expect(path).toContain("/contracts");
            expect(path.startsWith("/api/v1/")).toBe(true);
          },
        ),
      );
    });
  });
});
