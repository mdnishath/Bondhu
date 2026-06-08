import type { DevicesRepo } from '../db/repositories/devices.repo.js';

/**
 * Sends FCM push notifications for incoming messages. Dependency-free: uses the
 * FCM HTTP endpoint with a server key from `FCM_SERVER_KEY`. If that env var is
 * unset (no Firebase configured yet), every call is a safe no-op — so the rest of
 * the app works unchanged until the user wires up their Firebase project.
 *
 * To activate: create a Firebase project, set FCM_SERVER_KEY in the server env,
 * and ship the Android client with google-services.json + firebase-messaging
 * (the client registers its token via POST /api/devices/register).
 */
export class PushService {
  constructor(private devices: DevicesRepo, private fetchFn: typeof fetch = fetch) {}

  get enabled(): boolean {
    return !!process.env.FCM_SERVER_KEY;
  }

  async notify(userId: string, title: string, body: string, data: Record<string, string> = {}): Promise<void> {
    const key = process.env.FCM_SERVER_KEY;
    if (!key) return; // Firebase not configured — no-op
    const tokens = this.devices.tokensForUser(userId);
    if (tokens.length === 0) return;
    await Promise.all(
      tokens.map(async (token) => {
        try {
          await this.fetchFn('https://fcm.googleapis.com/fcm/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `key=${key}` },
            body: JSON.stringify({
              to: token,
              notification: { title, body },
              data,
              android: { priority: 'high' },
            }),
          });
        } catch { /* best-effort — never let push failure affect message flow */ }
      }),
    );
  }
}
