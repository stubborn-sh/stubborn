import { useState, useRef, useEffect, useCallback } from "react";

interface AsyncComboBoxProps {
  fetchOptions: (query: string) => Promise<string[]>;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  debounceMs?: number;
  id?: string;
}

export default function AsyncComboBox({
  fetchOptions,
  value,
  onChange,
  placeholder = "Select...",
  disabled = false,
  className = "",
  debounceMs = 300,
  id,
}: AsyncComboBoxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fetchIdRef = useRef(0);

  const doFetch = useCallback(
    (q: string) => {
      const id = ++fetchIdRef.current;
      setLoading(true);
      setError(false);
      fetchOptions(q)
        .then((result) => {
          if (id === fetchIdRef.current) {
            setOptions(result);
            setLoading(false);
          }
        })
        .catch(() => {
          if (id === fetchIdRef.current) {
            setOptions([]);
            setLoading(false);
            setError(true);
          }
        });
    },
    [fetchOptions],
  );

  const debouncedFetch = useCallback(
    (q: string) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        doFetch(q);
      }, debounceMs);
    },
    [doFetch, debounceMs],
  );

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
        setActiveIndex(-1);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleSelect = (option: string) => {
    onChange(option);
    setOpen(false);
    setQuery("");
    setActiveIndex(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      setOpen(false);
      setQuery("");
      setActiveIndex(-1);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open) {
        setOpen(true);
        doFetch("");
        setActiveIndex(0);
      } else {
        setActiveIndex((prev) => (prev < options.length - 1 ? prev + 1 : 0));
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (open) {
        setActiveIndex((prev) => (prev > 0 ? prev - 1 : options.length - 1));
      }
    } else if (e.key === "Enter" && open && options.length > 0) {
      e.preventDefault();
      handleSelect(options[activeIndex >= 0 ? activeIndex : 0]);
    }
  };

  useEffect(() => {
    if (activeIndex >= 0 && listRef.current) {
      // activeIndex is a bounded numeric index controlled by this component, not user input
      // eslint-disable-next-line security/detect-object-injection
      const active = listRef.current.children[activeIndex] as HTMLElement | undefined;
      if (active && typeof active.scrollIntoView === "function") {
        active.scrollIntoView({ block: "nearest" });
      }
    }
  }, [activeIndex]);

  const listboxId = "async-combobox-listbox";

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div className="relative">
        <input
          ref={inputRef}
          id={id}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-activedescendant={
            activeIndex >= 0 ? `async-combobox-option-${activeIndex}` : undefined
          }
          value={open ? query : ""}
          placeholder={value || placeholder}
          disabled={disabled}
          className="flex h-9 w-full items-center rounded-md border bg-input-background px-3 py-2 pr-8 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:opacity-50 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100"
          onFocus={() => {
            setOpen(true);
            setQuery("");
            setActiveIndex(-1);
            doFetch("");
          }}
          onChange={(e) => {
            const q = e.target.value;
            setQuery(q);
            setActiveIndex(-1);
            if (!open) setOpen(true);
            debouncedFetch(q);
          }}
          onKeyDown={handleKeyDown}
        />
        <button
          type="button"
          tabIndex={-1}
          disabled={disabled}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"
          onClick={() => {
            if (!disabled) {
              if (!open) {
                setOpen(true);
                doFetch("");
                inputRef.current?.focus();
              } else {
                setOpen(false);
              }
            }
          }}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>
      </div>
      {open && !disabled && (
        <ul
          ref={listRef}
          id={listboxId}
          role="listbox"
          className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border bg-popover shadow-md"
        >
          {loading && <li className="px-3 py-2 text-sm text-muted-foreground">Loading...</li>}
          {error && <li className="px-3 py-2 text-sm text-red-500">Failed to load options</li>}
          {!loading && !error && options.length === 0 && (
            <li
              role="option"
              aria-selected={false}
              className="px-3 py-2 text-sm text-muted-foreground"
            >
              No matches
            </li>
          )}
          {!loading &&
            !error &&
            options.map((option, index) => (
              <li
                role="option"
                id={`async-combobox-option-${index}`}
                aria-selected={option === value}
                key={option}
                className={`cursor-pointer px-3 py-2 text-sm hover:bg-accent ${option === value ? "bg-accent font-medium" : ""} ${index === activeIndex ? "bg-accent" : ""}`}
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleSelect(option);
                }}
                onMouseEnter={() => {
                  setActiveIndex(index);
                }}
              >
                {option}
              </li>
            ))}
        </ul>
      )}
    </div>
  );
}
