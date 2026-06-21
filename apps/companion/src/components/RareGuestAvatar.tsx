import { SpriteSheetTile } from '@/components/SpriteSheetTile';
import {
  RARE_GUEST_AVATAR_SPRITE_CONFIG,
  RARE_GUEST_AVATAR_SPRITE_URL,
  resolveRareGuestAvatar,
} from '@/lib/rare-guest-avatar';

export function RareGuestAvatar({
  guestId,
  name,
  size = 'md',
  className,
}: {
  guestId?: number | null;
  name?: string | null;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const avatar = resolveRareGuestAvatar({ guestId, name });

  return (
    <SpriteSheetTile
      className={className}
      columns={RARE_GUEST_AVATAR_SPRITE_CONFIG.columns}
      fallbackGlyph={avatar.initial}
      rows={RARE_GUEST_AVATAR_SPRITE_CONFIG.rows}
      size={size}
      spriteIndex={avatar.spriteIndex}
      title={avatar.title ?? undefined}
      url={RARE_GUEST_AVATAR_SPRITE_URL}
    />
  );
}
