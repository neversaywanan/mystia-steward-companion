import * as React from "react"
import { Input as MantineInput } from '@mantine/core';
import type { MantineSize } from '@mantine/core';

import { composeClassNames } from '@/components/ui/style';

type InputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> & {
  size?: MantineSize | (string & {});
  inputClassName?: string;
};

function Input({ className, inputClassName, type, size = 'sm', ...props }: InputProps) {
  return (
    <MantineInput
      type={type}
      data-slot="input"
      size={size}
      className={composeClassNames('steward-input-root', className)}
      classNames={{ input: composeClassNames('steward-input', inputClassName) }}
      {...props}
    />
  )
}

export { Input }
export type { InputProps }
