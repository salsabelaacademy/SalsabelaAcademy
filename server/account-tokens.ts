import { insertSecurityNotice } from './security-notifications';
import { pool } from './db';

type TokenKind = 'invitation' | 'reset' | 'verification';
// Identifiers are server-owned constants, never request input.
const tokenTables = {
  invitation: ['invitations', 'accepted_at'],
  reset: ['password_reset_tokens', 'used_at'],
  verification: ['verification_tokens', 'used_at'],
} as const;

/** Consume the link and update its account atomically; a failed update leaves it usable. */
export async function completeAccountToken(kind: TokenKind, hash: string, passwordHash?: string): Promise<boolean> {
  if (kind !== 'verification' && !passwordHash) throw new Error('Password hash required');
  const [table, used] = tokenTables[kind];
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const token = (await client.query(`SELECT user_id FROM ${table} WHERE token_hash=$1 AND ${used} IS NULL AND expires_at>now()`, [hash])).rows[0];
    if (!token) { await client.query('ROLLBACK'); return false; }
    // Always lock the account first, including when different links target the same account.
    const user = (await client.query('SELECT role,status,password_hash FROM users WHERE id=$1 FOR UPDATE', [token.user_id])).rows[0];
    const eligible = user && ['admin', 'student'].includes(user.role) && (
      kind === 'invitation' ? user.role === 'student' && user.status === 'invited' :
      kind === 'reset' ? user.status === 'active' :
      ['active', 'invited'].includes(user.status) && Boolean(user.password_hash)
    );
    if (!eligible) { await client.query('ROLLBACK'); return false; }
    const consumed = await client.query(`UPDATE ${table} SET ${used}=now() WHERE token_hash=$1 AND ${used} IS NULL AND expires_at>now() RETURNING id`, [hash]);
    if (!consumed.rows.length) { await client.query('ROLLBACK'); return false; }
    if (kind === 'invitation') {
      await client.query("UPDATE users SET password_hash=$1,email_verified_at=now(),status='active',failed_login_attempts=0,locked_until=NULL WHERE id=$2", [passwordHash, token.user_id]);
    } else if (kind === 'reset') {
      await client.query('UPDATE users SET password_hash=$1,failed_login_attempts=0,locked_until=NULL WHERE id=$2', [passwordHash, token.user_id]);
    } else {
      await client.query("UPDATE users SET email_verified_at=now(),status='active' WHERE id=$1", [token.user_id]);
    }
    await client.query(`UPDATE ${table} SET ${used}=now() WHERE user_id=$1 AND ${used} IS NULL`, [token.user_id]);
    if (kind !== 'verification') await client.query('UPDATE auth_sessions SET revoked_at=now() WHERE user_id=$1 AND revoked_at IS NULL', [token.user_id]);
    if (kind === 'reset') await insertSecurityNotice(client, token.user_id, 'password');
    await client.query('COMMIT');
    return true;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }
}
