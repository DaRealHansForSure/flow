import { CheckIcon, ChevronDownIcon } from "lucide-react";
import { useState, type ReactNode } from "react";

import { Button } from "./ui/button";
import {
  Combobox,
  ComboboxEmpty,
  ComboboxItem,
  ComboboxList,
  ComboboxPopup,
  ComboboxSearchInput,
  ComboboxTrigger,
} from "./ui/combobox";

export interface SearchableSelectOption {
  readonly value: string;
  readonly label: string;
  readonly icon?: ReactNode;
  readonly disabled?: boolean;
}

/**
 * Fork-only: a dropdown with a search field, an icon per option and a check on the current
 * one, like the project picker. Pickers for one kind of thing (BrainSelect) wrap it.
 */
export function SearchableSelect({
  label,
  value,
  options,
  onChange,
  searchLabel,
  emptyLabel,
  disabled = false,
  compact = false,
}: {
  label: string;
  value: string;
  options: readonly SearchableSelectOption[];
  onChange: (value: string) => void;
  /** Placeholder and accessible name of the search field: "Search Brains". */
  searchLabel: string;
  /** Shown when the search matches nothing: "No matching Brains." */
  emptyLabel: string;
  disabled?: boolean;
  /** A small ghost trigger for inline use, such as next to the new-chat headline. */
  compact?: boolean;
}) {
  const [query, setQuery] = useState("");
  const needle = query.trim().toLowerCase();
  const filteredOptions = needle
    ? options.filter((option) => option.label.toLowerCase().includes(needle))
    : options;
  const selected = options.find((option) => option.value === value) ?? null;
  return (
    <Combobox
      items={options}
      filteredItems={filteredOptions}
      autoHighlight
      itemToStringLabel={(option) => option.label}
      isItemEqualToValue={(a, b) => a.value === b.value}
      value={selected}
      onOpenChange={(open) => {
        if (!open) {
          setQuery("");
        }
      }}
      onValueChange={(option) => {
        if (option && !option.disabled && option.value !== value) {
          onChange(option.value);
        }
      }}
    >
      <ComboboxTrigger
        render={
          <Button
            type="button"
            variant={compact ? "ghost" : "outline"}
            size={compact ? "xs" : "sm"}
            disabled={disabled}
            aria-label={label}
          />
        }
      >
        {selected?.icon}
        <span className="max-w-60 truncate">{selected?.label ?? label}</span>
        <ChevronDownIcon className="opacity-60" />
      </ComboboxTrigger>
      <ComboboxPopup align="start" className="w-64">
        <ComboboxSearchInput
          aria-label={searchLabel}
          placeholder={searchLabel}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <ComboboxEmpty>{emptyLabel}</ComboboxEmpty>
        <ComboboxList>
          {(option: SearchableSelectOption) => (
            <ComboboxItem key={option.value} value={option} disabled={option.disabled}>
              {option.icon}
              <span className="min-w-0 flex-1 truncate">{option.label}</span>
              {option.value === value ? <CheckIcon className="ml-auto" /> : null}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxPopup>
    </Combobox>
  );
}
