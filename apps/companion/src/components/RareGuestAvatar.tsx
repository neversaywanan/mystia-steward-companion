import { useState } from 'react';

import { composeClassNames } from '@/components/ui/style';
import { resolveRareGuestAvatar } from '@/lib/rare-guest-avatar';

const AVATAR_VARIANT_CLASSES = [
  'bg-orange-700',
  'bg-amber-700',
  'bg-lime-700',
  'bg-emerald-700',
  'bg-cyan-700',
  'bg-blue-700',
  'bg-violet-700',
  'bg-rose-700',
] as const;

export function RareGuestAvatar({
  guestId,
  name,
  size = 'md',
  className,
}: {
  guestId?: number | null;
  name: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const [failedAvatarPath, setFailedAvatarPath] = useState<string | null>(null);
  const avatar = resolveRareGuestAvatar({ guestId, name });
  const shouldShowImage = avatar.avatarPath !== null && failedAvatarPath !== avatar.avatarPath;
  const sizeClass = size === 'lg'
    ? 'size-12 text-lg'
    : size === 'sm'
      ? 'size-8 text-sm'
      : 'size-10 text-base';

  return (
    <div
      className={composeClassNames(
        'flex shrink-0 items-center justify-center overflow-hidden rounded-md border border-border/80 font-semibold text-white shadow-sm',
        AVATAR_VARIANT_CLASSES[avatar.variantIndex],
        sizeClass,
        className,
      )}
      data-avatar-kind={shouldShowImage ? 'image' : 'initial'}
      data-slot="rare-guest-avatar"
      aria-hidden="true"
    >
      {shouldShowImage ? (
        <img
          src={avatar.avatarPath ?? ''}
          alt=""
          className="size-full object-cover"
          loading="lazy"
          draggable={false}
          onError={() => setFailedAvatarPath(avatar.avatarPath)}
        />
      ) : (
        <span>{avatar.initial}</span>
      )}
    </div>
  );
}
