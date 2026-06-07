# Bondhu — Deployment (VPS)

Production lives on the VPS and is updated from git. Keep this file accurate.

## Live URL
- **https://wa.client-flow.xyz** (Let's Encrypt SSL, auto-renew via certbot)
- DNS: `wa.client-flow.xyz` → `144.79.218.148` (managed at dnsowl.com / Namesilo)

## Server facts
- **VPS:** `ssh root@144.79.218.148` (Ubuntu 22.04)
- **App dir:** `/opt/bondhu` (git clone of `github.com/mdnishath/Bondhu`, branch `master`)
- **Process:** pm2 app **`bondhu`** → `node /opt/bondhu/server/dist/index.js`, cwd `/opt/bondhu/server`
- **Port:** `PORT=3060` (internal; nginx proxies to it). 3050 is the old project.
- **DB:** `/opt/bondhu/server/bondhu.db` (SQLite, gitignored, **persists across deploys**)
- **nginx vhost:** `/etc/nginx/sites-available/bondhu.conf` (server_name `wa.client-flow.xyz`,
  proxies `127.0.0.1:3060`, websocket upgrade headers, `client_max_body_size 50M`)
- **pm2 reboot-persistence:** `pm2-root` systemd unit enabled + `pm2 save` done.
- A 2G `/swapfile` was added for build headroom (RAM is tight on this box).

## First-time setup after deploy (do in the browser)
The DB starts empty. At https://wa.client-flow.xyz:
1. Register / log in.
2. Settings → add Google Gemini API key(s) (translation / TTS / transcription).
3. Link a WhatsApp account (QR or pairing code).

## Update workflow (professional: fix → git → deploy)
1. Develop + commit + push on your machine:
   ```bash
   git push origin master
   ```
2. Deploy on the VPS (one command):
   ```bash
   ssh root@144.79.218.148 'bash /opt/bondhu/deploy.sh'
   ```
   `deploy.sh` = `git pull` → build server → build web → `pm2 reload bondhu` → `pm2 save`.

## Handy ops
```bash
pm2 logs bondhu --lines 100      # tail logs
pm2 restart bondhu               # hard restart
pm2 describe bondhu              # status / restarts
nginx -t && systemctl reload nginx
curl -s https://wa.client-flow.xyz/api/health    # -> {"ok":true}
```

## Rollback
```bash
cd /opt/bondhu && git log --oneline -5
git checkout <good-sha> && bash deploy.sh   # then git checkout master once fixed
```

## Old project (kept, not running)
- `whatsapp-mcp` (old whatsapp-web.js app) at `/opt/whatsapp-mcp`, pm2 id 2 — **stopped**
  (code retained, 0 RAM/CPU). Its old nginx config was replaced by `bondhu.conf` on the
  same `wa.client-flow.xyz` host. To revive it, re-point nginx to `:3050` and `pm2 start whatsapp-mcp`.
