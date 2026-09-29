import React, { useState } from 'react';
import { Check, Loader2, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { cn } from '@/lib/utils';
import { useItemSearch } from '@/features/items/hooks';
import { formatCurrency } from '@/lib/format';

/**
 * اختيار صنف بالبحث على الخادم (كانت الصفحة تُنزّل كل الأصناف وتفلترها محليًا
 * وهو ما يبطئ النظام مع آلاف الأصناف).
 */
export default function ItemCombobox({ value, valueLabel, onSelect, disabled = false, placeholder = 'ابحث برقم الصنف أو الاسم...', autoFocus = false }) {
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState('');
  const { data, isLoading } = useItemSearch(term, { limit: 30 });

  const items = data?.rows ?? [];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          autoFocus={autoFocus}
          className="w-full justify-start overflow-hidden font-normal"
        >
          <Search className="ml-2 h-4 w-4 shrink-0 text-slate-400" />
          <span className={cn('truncate', valueLabel ? 'text-slate-800' : 'text-slate-400')}>
            {valueLabel || placeholder}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[320px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput placeholder="اكتب رقم الصنف أو اسمه..." value={term} onValueChange={setTerm} />
          <CommandList>
            {isLoading ? (
              <div className="flex items-center justify-center gap-2 py-6 text-sm text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                جاري البحث...
              </div>
            ) : (
              <>
                <CommandEmpty>لا توجد نتائج مطابقة</CommandEmpty>
                <CommandGroup>
                  {items.map((item) => (
                    <CommandItem
                      key={item.id}
                      value={item.id}
                      onSelect={() => {
                        onSelect?.(item);
                        setOpen(false);
                        setTerm('');
                      }}
                    >
                      <Check className={cn('ml-2 h-4 w-4', value === item.id ? 'opacity-100' : 'opacity-0')} />
                      <span dir="ltr" className="font-mono text-xs">
                        {item.item_number}
                      </span>
                      <span className="mx-2 truncate text-sm text-slate-600">{item.item_name}</span>
                      <span className="mr-auto text-xs text-slate-400">{formatCurrency(item.cost)}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
