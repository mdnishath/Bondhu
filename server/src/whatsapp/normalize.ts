import type { UpsertMessage } from '../db/repositories/messages.repo.js';

/** Convert a Baileys WAMessage-ish object into our domain UpsertMessage.
 *  Returns null if the message has no usable id. */
export function normalizeMessage(accountId: string, m: any): UpsertMessage | null {
  const msgId = m?.key?.id;
  const chatJid = m?.key?.remoteJid;
  if (!msgId || !chatJid) return null;

  const fromMe = !!m.key.fromMe;
  // Unwrap container messages (disappearing / view-once) — the real content sits
  // one level deeper, so without this their text/media is lost as a bare
  // "[message]" bubble. Unwrap a few levels (they can nest).
  let content = m.message ?? {};
  for (let i = 0; i < 3; i++) {
    const inner =
      content.ephemeralMessage?.message ??
      content.viewOnceMessage?.message ??
      content.viewOnceMessageV2?.message ??
      content.viewOnceMessageV2Extension?.message ??
      content.documentWithCaptionMessage?.message;
    if (!inner) break;
    content = inner;
  }

  // Control / protocol messages must NEVER show up as a chat bubble:
  //  - protocolMessage: delete-for-everyone (REVOKE=0), edit (MESSAGE_EDIT=14),
  //    ephemeral timer changes, history sync, app-state sync, etc.
  //  - reactionMessage: handled via the dedicated messages.reaction event.
  //  - senderKeyDistributionMessage / messageContextInfo: signal-layer plumbing.
  // NOTE: do NOT skip on a bare `content.messageContextInfo` — modern WhatsApp
  // (multi-device / @lid) attaches messageContextInfo (deviceListMetadata) to
  // ordinary text messages, so skipping on its mere presence drops real incoming
  // messages. Only skip when it's the SOLE field (a pure metadata message).
  if (
    content.protocolMessage ||
    content.reactionMessage ||
    content.senderKeyDistributionMessage ||
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

  // Reply context: the quoted message's id + a short text preview (for the
  // "replying to" bubble + tap-to-jump on the client).
  const ci: any =
    content.extendedTextMessage?.contextInfo ||
    content.imageMessage?.contextInfo ||
    content.videoMessage?.contextInfo ||
    content.audioMessage?.contextInfo ||
    content.documentMessage?.contextInfo ||
    content.stickerMessage?.contextInfo;
  const quotedId: string | null = ci?.stanzaId ?? null;
  const qm: any = ci?.quotedMessage;
  const quotedText: string | null = qm
    ? (qm.conversation ??
       qm.extendedTextMessage?.text ??
       (qm.imageMessage ? '📷 Photo' : qm.audioMessage ? '🎤 Voice' : qm.videoMessage ? '🎬 Video' : qm.stickerMessage ? 'Sticker' : null))
    : null;

  return { accountId, msgId, chatJid, senderJid, fromMe, type, body, timestamp, ack: 0, quotedId, quotedText };
}
