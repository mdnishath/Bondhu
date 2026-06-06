import type { UpsertMessage } from '../db/repositories/messages.repo.js';

/** Convert a Baileys WAMessage-ish object into our domain UpsertMessage.
 *  Returns null if the message has no usable id. */
export function normalizeMessage(accountId: string, m: any): UpsertMessage | null {
  const msgId = m?.key?.id;
  const chatJid = m?.key?.remoteJid;
  if (!msgId || !chatJid) return null;

  const fromMe = !!m.key.fromMe;
  const content = m.message ?? {};

  // Control / protocol messages must NEVER show up as a chat bubble:
  //  - protocolMessage: delete-for-everyone (REVOKE=0), edit (MESSAGE_EDIT=14),
  //    ephemeral timer changes, history sync, app-state sync, etc.
  //  - reactionMessage: handled via the dedicated messages.reaction event.
  //  - senderKeyDistributionMessage / messageContextInfo: signal-layer plumbing.
  if (
    content.protocolMessage ||
    content.reactionMessage ||
    content.senderKeyDistributionMessage ||
    content.messageContextInfo ||
    content.pollUpdateMessage ||
    (Object.keys(content).length === 1 && content.messageContextInfo)
  ) {
    return null;
  }

  let type = 'text';
  let body: string | null = null;

  if (typeof content.conversation === 'string') {
    body = content.conversation;
  } else if (content.extendedTextMessage?.text != null) {
    body = content.extendedTextMessage.text;
  } else if (content.imageMessage) {
    type = 'image';
    body = content.imageMessage.caption ?? '[image]';
  } else if (content.videoMessage) {
    type = 'video';
    body = content.videoMessage.caption ?? '[video]';
  } else if (content.audioMessage) {
    type = content.audioMessage.ptt ? 'ptt' : 'audio';
    body = '[voice]';
  } else if (content.documentMessage) {
    type = 'document';
    body = content.documentMessage.fileName ?? '[document]';
  } else if (content.stickerMessage) {
    type = 'sticker';
    body = '[sticker]';
  } else {
    body = '[message]';
  }

  // sender: in groups it's key.participant; in 1:1 it's the remoteJid
  const senderJid = fromMe ? chatJid : (m.key.participant ?? chatJid);

  const tsRaw = Number(m.messageTimestamp ?? 0);
  const timestamp = tsRaw < 1e12 ? tsRaw * 1000 : tsRaw; // seconds -> ms

  return { accountId, msgId, chatJid, senderJid, fromMe, type, body, timestamp, ack: 0 };
}
