import { useEffect, useState } from 'react';
import { Check, ChevronsUpDown, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

export interface ComboOption { value: string; label: string }

interface CreatableComboboxProps {
  value?: string | null;
  options: ComboOption[];
  placeholder?: string;
  emptyText?: string;
  onChange: (value: string | null) => void;
  /** Called when user types a new value and clicks "Cadastrar". Should persist and return the new id. */
  onCreate?: (label: string) => Promise<string | null>;
  disabled?: boolean;
  allowClear?: boolean;
}

export function CreatableCombobox({
  value, options, placeholder = 'Selecione...', emptyText = 'Sem opções', onChange, onCreate, disabled, allowClear,
}: CreatableComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);

  const selected = options.find(o => o.value === value);
  const showCreate = !!onCreate && search.trim().length > 0 && !options.some(o => o.label.toLowerCase() === search.trim().toLowerCase());

  const handleCreate = async () => {
    if (!onCreate) return;
    setCreating(true);
    const id = await onCreate(search.trim());
    setCreating(false);
    if (id) {
      onChange(id);
      setSearch('');
      setOpen(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button" variant="outline" role="combobox" disabled={disabled}
          className={cn('w-full justify-between bg-background font-normal', !selected && 'text-muted-foreground')}
        >
          {selected?.label ?? placeholder}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0 bg-popover" align="start">
        <Command shouldFilter={true}>
          <CommandInput placeholder="Buscar..." value={search} onValueChange={setSearch} />
          <CommandList>
            <CommandEmpty>
              {showCreate ? null : <span className="text-xs text-muted-foreground">{emptyText}</span>}
            </CommandEmpty>
            {options.length > 0 && (
              <CommandGroup>
                {options.map(o => (
                  <CommandItem key={o.value} value={o.label} onSelect={() => { onChange(o.value); setOpen(false); }}>
                    <Check className={cn('mr-2 h-4 w-4', value === o.value ? 'opacity-100' : 'opacity-0')} />
                    {o.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {showCreate && (
              <CommandGroup>
                <CommandItem onSelect={handleCreate} disabled={creating}>
                  <Plus className="mr-2 h-4 w-4 text-accent" />
                  Cadastrar "<span className="font-medium">{search.trim()}</span>"
                </CommandItem>
              </CommandGroup>
            )}
            {allowClear && value && (
              <CommandGroup>
                <CommandItem onSelect={() => { onChange(null); setOpen(false); }} className="text-muted-foreground">
                  Limpar seleção
                </CommandItem>
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
