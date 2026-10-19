import { useState } from 'react';
import type { AuthUser } from '@/hooks/use-auth';

export function AccountAvatar({ user }: { user: Pick<AuthUser, 'name' | 'avatarUrl'> | null }) {
  const [failed, setFailed] = useState<string | null>(null);
  const source = user?.avatarUrl;
  return source && source.startsWith('data:image/webp;base64,') && failed !== source
    ? <img src={source} width={256} height={256} alt="" className="dash-account-image" onError={() => setFailed(source)} />
    : <>{user?.name.slice(0, 1)}</>;
}
