import { Input } from '@/components/ui/input';
import { forwardRef } from 'react';

/** Formats a numeric value into Brazilian currency string "R$ 1.234,56" */
export function formatBRL(value: number | string | null | undefined): string {
  const n = typeof value === 'number' ? value : parseFloat(String(value ?? '').replace(/\./g, '').replace(',', '.'));
  if (!isFinite(n)) return '';
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/** Parses currency input into number (digits only / 100). */
export function parseCurrencyDigits(raw: string): number {
  const digits = raw.replace(/\D/g, '');
  if (!digits) return 0;
  return parseInt(digits, 10) / 100;
}

interface CurrencyInputProps {
  value: string | null | undefined;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

/** Stores value as decimal string (e.g. "1234.56"); displays formatted BRL. */
export const CurrencyInput = forwardRef<HTMLInputElement, CurrencyInputProps>(({ value, onChange, placeholder, className, disabled }, ref) => {
  const num = parseFloat(value ?? '');
  const display = isFinite(num) && num > 0 ? formatBRL(num) : '';

  return (
    <Input
      ref={ref}
      inputMode="numeric"
      placeholder={placeholder ?? 'R$ 0,00'}
      className={className}
      disabled={disabled}
      value={display}
      onChange={e => {
        const n = parseCurrencyDigits(e.target.value);
        onChange(n ? n.toFixed(2) : '');
      }}
    />
  );
});
CurrencyInput.displayName = 'CurrencyInput';
