import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface SearchableSelectProps {
  value: string;
  onValueChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  allLabel?: string;
  className?: string;
}

const substringFilter = (value: string, search: string) => {
  if (value.toLowerCase().includes(search.toLowerCase())) return 1;
  return 0;
};

export const SearchableSelect = ({
  value,
  onValueChange,
  options,
  placeholder = "Оберіть...",
  searchPlaceholder = "Пошук...",
  emptyText = "Не знайдено",
  allLabel,
  className,
}: SearchableSelectProps) => {
  const [open, setOpen] = useState(false);

  const selectedLabel = value === "all"
    ? allLabel
    : options.find(o => o.value === value)?.label;

  return (
    <Popover open={open} onOpenChange={setOpen} modal={true}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          className={cn("justify-between font-normal", className)}
        >
          <span className={cn("truncate", !selectedLabel && "text-muted-foreground")}>
            {selectedLabel || placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0 pointer-events-auto" align="start">
        <Command filter={substringFilter}>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList className="max-h-[250px]">
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {allLabel && (
                <CommandItem
                  value={`__all__ ${allLabel}`}
                  onSelect={() => { onValueChange("all"); setOpen(false); }}
                >
                  <Check className={cn("mr-2 h-4 w-4", value === "all" ? "opacity-100" : "opacity-0")} />
                  {allLabel}
                </CommandItem>
              )}
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.label}
                  onSelect={() => { onValueChange(option.value); setOpen(false); }}
                >
                  <Check className={cn("mr-2 h-4 w-4", value === option.value ? "opacity-100" : "opacity-0")} />
                  {option.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

// Multi-select variant
interface SearchableMultiSelectProps {
  values: string[];
  onValuesChange: (values: string[]) => void;
  options: Array<{ value: string; label: string }>;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  className?: string;
}

export const SearchableMultiSelect = ({
  values,
  onValuesChange,
  options,
  placeholder = "Оберіть...",
  searchPlaceholder = "Пошук...",
  emptyText = "Не знайдено",
  className,
}: SearchableMultiSelectProps) => {
  const [open, setOpen] = useState(false);

  const toggle = (val: string) => {
    if (values.includes(val)) {
      onValuesChange(values.filter(v => v !== val));
    } else {
      onValuesChange([...values, val]);
    }
  };

  const selectedLabels = values.map(v => options.find(o => o.value === v)?.label).filter(Boolean);

  return (
    <Popover open={open} onOpenChange={setOpen} modal={true}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          className={cn("justify-between font-normal h-auto min-h-10", className)}
        >
          {selectedLabels.length > 0 ? (
            <span className="flex flex-wrap gap-1 truncate">
              {selectedLabels.length <= 2
                ? selectedLabels.join(", ")
                : `${selectedLabels.length} обрано`}
            </span>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0 pointer-events-auto" align="start">
        <Command filter={substringFilter}>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList className="max-h-[250px]">
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {values.length > 0 && (
                <CommandItem
                  value="__clear__ очистити скинути"
                  onSelect={() => { onValuesChange([]); setOpen(false); }}
                >
                  <X className="mr-2 h-4 w-4" />
                  Скинути всі
                </CommandItem>
              )}
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.label}
                  onSelect={() => toggle(option.value)}
                >
                  <Check className={cn("mr-2 h-4 w-4", values.includes(option.value) ? "opacity-100" : "opacity-0")} />
                  {option.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};
