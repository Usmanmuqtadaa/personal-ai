# Connect Usman’s Personal AI on Vercel to Ollama on your PC

This is a free-software, no-paid-API-key option. It is **not cloud AI**: your PC must stay on with internet access and three processes running (Ollama, bridge, cloudflared). Cloudflare Quick Tunnels are temporary, may have usage limits, and change URL when restarted. Responses may exceed Vercel function time limits on a slow CPU; do not expect every answer in seconds. Never expose Ollama port 11434 publicly.

## First: check the new project locally

1. Extract the ZIP to a new folder.
2. In VS Code terminal in the folder: `npm.cmd install`, then `npm.cmd run build`.
3. Ollama is already installed. Run `ollama list` and check `qwen2.5:1.5b`. If missing, run `ollama pull qwen2.5:1.5b`.

## PC connection setup

1. Download cloudflared from the official Cloudflare documentation: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/ . Windows can also try `winget install --id Cloudflare.cloudflared` (verify the publisher/source before installing).
2. In a NEW **PowerShell** terminal, create a random bridge token and save it privately:

   `$bytes = New-Object byte[] 32; [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes); $token = [Convert]::ToBase64String($bytes)`

   `$env:AI_BRIDGE_TOKEN = $token`

   `$token`  (copy the printed value privately; don't share it)

3. In that SAME PowerShell terminal in your project folder, run: `node pc-bridge.js`. Keep it open.
4. In another terminal run: `cloudflared tunnel --url http://127.0.0.1:8787`.
5. Copy the generated `https://...trycloudflare.com` URL. Leave cloudflared running.
6. Open Vercel Dashboard → your existing project → Settings → Environment Variables. Add:
   - `AI_TUNNEL_URL` = Cloudflare HTTPS URL (no `/chat` suffix)
   - `AI_BRIDGE_TOKEN` = token from step 2
   - `AI_SITE_PASSWORD` = a *different*, strong password you choose for your website
   All should be scoped to **Production**. Never add `VITE_` prefix.
7. Upload this project to your **existing GitHub repo**. GitHub Desktop: clone existing repo, copy source files (not `node_modules`, `dist`, `.env`), commit and push. This triggers Vercel deployment. If environment variables are changed after deployment, redeploy from Vercel's Deployments page (ensure Production env vars are applied).
8. On your existing HTTPS Vercel domain, choose `Online AI · PC via secure tunnel`, type your **AI_SITE_PASSWORD** into the password box, ask: `Who was Alexander the Great?`

## Troubleshooting

- Incorrect AI website password: check the password typed in the website and `AI_SITE_PASSWORD` in Vercel; redeploy after changes.
- PC not reachable: check Ollama, `node pc-bridge.js`, and cloudflared are all running; update `AI_TUNNEL_URL` in Vercel and redeploy whenever cloudflared's temporary URL changes.
- Request timeouts: shorten the task or use Local Ollama. Vercel's function duration limits and slow CPU generation affect lengthy answers. Research PDFs may exceed the allowed time and size.
- Keep `AI_BRIDGE_TOKEN` secret. If leaked, generate a fresh token and update both your bridge and Vercel. Keep your website password private too.
- This setup sends question/document excerpts through Vercel and Cloudflare to your computer. Do not use it for highly confidential documents without reviewing the services' privacy policies.
- Cloudflare Quick Tunnel is designed for development and testing. For stable 24/7 use, configure a **named Cloudflare Tunnel with a hostname you control**, or another authenticated tunnel service, and update AI_TUNNEL_URL accordingly.
- The website password protects the AI endpoint, but there is no shared rate limit across Vercel instances. Keep the domain/password private, and consider stronger access controls if making it public.

## Check deployment

`npm.cmd run build` should pass. This is independent of the local Ollama connection. Local AI mode requires http://localhost:5173, and Online AI mode needs the secure bridge setup above.
