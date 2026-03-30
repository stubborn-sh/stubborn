import { useState, useRef, useEffect, useMemo } from "react";

interface ComboBoxProps {
  options: string[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export default function ComboBox({
  options,
  value,
  onChange,
  placeholder = "Select...",
  disabled = false,
  className = "",
}: ComboBoxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const sorted = useMemo(() => [...options].sort((a, b) => a.localeCompare(b)), [options]);

  const filtered = query
    ? sorted.filter((o) => o.toLowerCase().includes(query.toLowerCase()))
    : sorted;

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
        setActiveIndex(0);
      } else {
        setActiveIndex((prev) => (prev < filtered.length - 1 ? prev + 1 : 0));
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (open) {
        setActiveIndex((prev) => (prev > 0 ? prev - 1 : filtered.length - 1));
      }
    } else if (e.key === "Enter" && filtered.length > 0) {
      e.preventDefault();
      handleSelect(filtered[activeIndex >= 0 ? activeIndex : 0]);
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

  const listboxId = "combobox-listbox";

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-activedescendant={activeIndex >= 0 ? `combobox-option-${activeIndex}` : undefined}
          value={open ? query : value}
          placeholder={value || placeholder}
          disabled={disabled}
          className="flex h-9 w-full items-center rounded-md border bg-input-background px-3 py-2 pr-8 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:opacity-50 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100"
          onFocus={() => {
            setOpen(true);
            setQuery("");
            setActiveIndex(-1);
          }}
          onChange={(e) => {
            setQuery(e.target.value);
            setActiveIndex(-1);
            if (!open) setOpen(true);
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
              setOpen(!open);
              if (!open) inputRef.current?.focus();
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
          {filtered.length === 0 && (
            <li
              role="option"
              aria-selected={false}
              className="px-3 py-2 text-sm text-muted-foreground"
            >
              No matches
            </li>
          )}
          {filtered.map((option, index) => (
            <li
              role="option"
              id={`combobox-option-${index}`}
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
