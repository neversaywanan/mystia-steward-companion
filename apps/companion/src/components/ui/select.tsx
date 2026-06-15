import { Select as MantineSelect } from '@mantine/core';
import type { SelectProps as MantineSelectProps } from '@mantine/core';

import { cn } from '@/lib/utils';

type SelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

type SelectBoxProps = Omit<MantineSelectProps, 'data' | 'value' | 'onChange'> & {
  value: string;
  options: SelectOption[];
  onValueChange: (value: string) => void;
  inputClassName?: string;
  dropdownClassName?: string;
  optionClassName?: string;
};

function SelectBox({
  className,
  inputClassName,
  dropdownClassName,
  optionClassName,
  value,
  options,
  onValueChange,
  placeholder,
  size = 'sm',
  searchable = false,
  ...props
}: SelectBoxProps) {
  return (
    <MantineSelect
      data-slot="select"
      value={value}
      data={options}
      placeholder={placeholder}
      searchable={searchable}
      allowDeselect={false}
      checkIconPosition="right"
      maxDropdownHeight={280}
      nothingFoundMessage="无匹配项"
      size={size}
      className={cn('steward-select', className)}
      classNames={{
        input: cn('steward-select-input', inputClassName),
        dropdown: cn('steward-select-dropdown', dropdownClassName),
        option: cn('steward-select-option', optionClassName),
      }}
      comboboxProps={{
        withinPortal: true,
        middlewares: { flip: true, shift: true },
      }}
      onChange={(nextValue) => {
        if (nextValue !== null) {
          onValueChange(String(nextValue));
        }
      }}
      {...props}
    />
  );
}

export { SelectBox };
export type { SelectBoxProps, SelectOption };
