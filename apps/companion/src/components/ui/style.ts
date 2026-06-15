import { clsx, type ClassValue } from 'clsx';

export function composeClassNames(...values: ClassValue[]): string {
  return clsx(...values);
}
