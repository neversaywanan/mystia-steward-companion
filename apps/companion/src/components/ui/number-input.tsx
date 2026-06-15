import { NumberInput as MantineNumberInput } from '@mantine/core';
import type { MantineSize, NumberInputProps as MantineNumberInputProps } from '@mantine/core';

import { cn } from '@/lib/utils';

type NumberInputProps = Omit<MantineNumberInputProps, 'value' | 'onChange' | 'onValueChange' | 'size'> & {
  value: number;
  onValueChange: (value: number) => void;
  size?: MantineSize | (string & {});
  inputClassName?: string;
};

function NumberInput({
  className,
  inputClassName,
  value,
  onValueChange,
  size = 'sm',
  ...props
}: NumberInputProps) {
  return (
    <MantineNumberInput
      data-slot="number-input"
      value={value}
      size={size}
      allowDecimal={false}
      clampBehavior="strict"
      className={cn('steward-number-input-root', className)}
      classNames={{ input: cn('steward-input steward-number-input', inputClassName) }}
      onChange={(nextValue) => {
        const parsed = typeof nextValue === 'number' ? nextValue : Number(nextValue);
        if (Number.isFinite(parsed)) {
          onValueChange(parsed);
        }
      }}
      {...props}
    />
  );
}

export { NumberInput };
export type { NumberInputProps };
