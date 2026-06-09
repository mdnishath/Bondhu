/**
 * Resolve who REACTED to a message (not who sent the reacted-to message).
 *
 * The reactor is identified by the reaction message's OWN key:
 *  - 1:1 chat: `key.remoteJid` is the other person (or "me" when `fromMe`).
 *  - group:    `key.participant` is the reactor; `key.remoteJid` is the group jid.
 *
 * NOTE: `r.reaction.key` (when present) is the TARGET message's key, NOT the
 * reactor — reading it (the old behaviour) mislabelled every group reactor and,
 * because reactions are keyed on `(account, msg, sender)`, made different
 * participants overwrite each other.
 */
export interface ReactionLike {
  key?: { remoteJid?: string | null; participant?: string | null; fromMe?: boolean | null } | null;
  reaction?: { text?: string | null } | null;
}

export function resolveReactionSender(r: ReactionLike): string {
  if (r.key?.fromMe) return 'me';
  return String(r.key?.participant || r.key?.remoteJid || 'unknown');
}
