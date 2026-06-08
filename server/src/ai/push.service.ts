import crypto from 'crypto';
import fs from 'fs';
import type { DevicesRepo } from '../db/repositories/devices.repo.js';

/**
 * Sends FCM push notifications for incoming messages. Two transports:
 *   1. HTTP v1 (preferred, required for new Firebase projects) — set
 *      `FCM_SERVICE_ACCOUNT` to the path of (or inline JSON of) a service-account
 *      key (Firebase Console → Project settings → Service accounts → Generate key).
 *   2. Legacy HTTP — set `FCM_SERVER_KEY` (only if your project still has it enabled).
 * If neither is configured, every call is a safe no-op.
 */
export class PushService {
  private sa: { client_email: string; private_key: string; project_id: string } | null;
  private accessToken: { token: string; exp: number } | null = null;

  constructor(private devices: DevicesRepo, private fetchFn: typeof fetch = fetch) {
    this.sa = PushService.loadServiceAccount();
  }

  private static loadServiceAccount() {
    const raw = process.env.FCM_SERVICE_ACCOUNT;
    if (!raw) return null;
    try {
      const json = raw.trim().startsWith('{') ? raw : fs.readFileSync(raw, 'utf8');
      const sa = JSON.parse(json);
      if (sa.client_email && sa.private_key && sa.project_id) return sa;
      return null;
    } catch { return null; }
  }

  get enabled(): boolean {
    return !!this.sa || !!process.env.FCM_SERVER_KEY;
  }

  private b64url(b: Buffer | string): string {
    return Buffer.from(b).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  /** OAuth2 access token for FCM HTTP v1 (cached ~1h). */
  private async getAccessToken(): Promise<string | null> {
    if (!this.sa) return null;
    const now = Math.floor(Date.now() / 1000);
    if (this.accessToken && this.accessToken.exp - 60 > now) return this.accessToken.token;
    const header = this.b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
    const claims = this.b64url(JSON.stringify({
      iss: this.sa.client_email,
      scope: 'https://www.googleapis.com/auth/firebase.messaging',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now, exp: now + 3600,
    }));
    const sig = crypto.sign('RSA-SHA256', Buffer.from(`${header}.${claims}`), this.sa.private_key);
    const jwt = `${header}.${claims}.${this.b64url(sig)}`;
    const resp = await this.fetchFn('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
    });
    const j: any = await resp.json();
    if (!j.access_token) return null;
    this.accessToken = { token: j.access_token, exp: now + (j.expires_in ?? 3600) };
    return j.access_token;
  }

  async notify(userId: string, title: string, body: string, data: Record<string, string> = {}): Promise<void> {
    const tokens = this.devices.tokensForUser(userId);
    if (tokens.length === 0) return;

    // HTTP v1
    if (this.sa) {
      const at = await this.getAccessToken().catch(() => null);
      if (!at) return;
      const url = `https://fcm.googleapis.com/v1/projects/${this.sa.project_id}/messages:send`;
      await Promise.all(tokens.map((token) =>
        this.fetchFn(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${at}` },
          body: JSON.stringify({ message: { token, notification: { title, body }, data, android: { priority: 'HIGH' } } }),
        }).catch(() => { /* best-effort */ }),
      ));
      return;
    }

    // Legacy fallback
    const key = process.env.FCM_SERVER_KEY;
    if (!key) return;
    await Promise.all(tokens.map((token) =>
      this.fetchFn('https://fcm.googleapis.com/fcm/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `key=${key}` },
        body: JSON.stringify({ to: token, notification: { title, body }, data, android: { priority: 'high' } }),
      }).catch(() => { /* best-effort */ }),
    ));
  }
}
