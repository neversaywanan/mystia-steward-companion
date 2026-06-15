import { Tree as MantineTree } from '@mantine/core';
import type {
  RenderTreeNodePayload,
  TreeNodeData,
  TreeProps as MantineTreeProps,
} from '@mantine/core';

import { cn } from '@/lib/utils';

function Tree({ className, levelOffset = 'md', ...props }: MantineTreeProps) {
  return (
    <MantineTree
      data-slot="tree"
      levelOffset={levelOffset}
      className={cn('steward-tree', className)}
      {...props}
    />
  );
}

export { Tree };
export type { RenderTreeNodePayload, TreeNodeData };
