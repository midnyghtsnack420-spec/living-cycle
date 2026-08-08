import { createClientFromRequest } from "npm:@base44/sdk@0.8.31";

const CLIENT_ID = Deno.env.get("CANVA_CLIENT_ID");
const CLIENT_SECRET = Deno.env.get("CANVA_CLIENT_SECRET");
const REDIRECT_URI = "https://miro-8307984e.base44.app/functions/canvaAuth";
const SCOPES = "asset:read asset:write design:meta:read design:content:read design:content:write folder:read";

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const base44 = createClientFromRequest(req);

  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  }

  // Handle Canva OAuth redirect (GET with code param)
  if (url.searchParams.get("code")) {
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state") || "";

    // Find the stored code_verifier by state
    const tokens = await base44.asServiceRole.entities.CanvaToken.list({
      filter: { state: state, is_active: true },
    });

    if (!tokens.data || tokens.data.length === 0) {
      return new Response(
        `<html><body style="font-family:sans-serif;padding:40px;text-align:center">
          <h2>❌ Connection Failed</h2>
          <p>Could not find the authorization session. Please try again.</p>
          <script>setTimeout(()=>window.close(),3000)</script>
        </body></html>`,
        { headers: { "Content-Type": "text/html" } }
      );
    }

    const stored = tokens.data[0];
    const codeVerifier = stored.data.code_verifier;

    // Exchange code for tokens
    const tokenRes = await fetch("https://api.canva.com/rest/v1/oauth/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Authorization": "Basic " + btoa(CLIENT_ID + ":" + CLIENT_SECRET),
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code_verifier: codeVerifier,
        code: code,
        redirect_uri: REDIRECT_URI,
      }),
    });

    const tokenData = await tokenRes.json();

    if (tokenData.access_token) {
      // Store the tokens
      await base44.asServiceRole.entities.CanvaToken.update(stored.id, {
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        expires_at: Date.now() + (tokenData.expires_in * 1000),
      });

      return new Response(
        `<html><body style="font-family:sans-serif;padding:40px;text-align:center;background:#1a1a2a;color:#e0e0f0">
          <h2 style="color:#a5b4fc">✅ Canva Connected!</h2>
          <p>Your Living Cycle avatars can now be exported to Canva.</p>
          <script>
            window.opener && window.opener.postMessage({type:"canva_connected", success:true}, "*");
            setTimeout(()=>window.close(),2000);
          </script>
        </body></html>`,
        { headers: { "Content-Type": "text/html" } }
      );
    } else {
      return new Response(
        `<html><body style="font-family:sans-serif;padding:40px;text-align:center">
          <h2>❌ Token Exchange Failed</h2>
          <p>${JSON.stringify(tokenData)}</p>
          <script>setTimeout(()=>window.close(),5000)</script>
        </body></html>`,
        { headers: { "Content-Type": "text/html" } }
      );
    }
  }

  // Handle API calls (POST with JSON body)
  if (req.method === "POST") {
    const body = await req.json();
    const { action } = body;

    if (action === "start") {
      // Generate PKCE
      const codeVerifier = crypto.randomUUID() + crypto.randomUUID() + crypto.randomUUID();
      const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(codeVerifier));
      const codeChallenge = btoa(String.fromCharCode(...new Uint8Array(hash)))
        .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
      const state = crypto.randomUUID();

      // Store the code_verifier
      await base44.asServiceRole.entities.CanvaToken.create({
        state: state,
        code_verifier: codeVerifier,
        is_active: true,
      });

      const authUrl = `https://www.canva.com/api/oauth/authorize?code_challenge=${codeChallenge}&code_challenge_method=S256&scope=${encodeURIComponent(SCOPES)}&response_type=code&client_id=${CLIENT_ID}&state=${state}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}`;

      return new Response(JSON.stringify({ authUrl, state }), {
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }

    if (action === "status") {
      const tokens = await base44.asServiceRole.entities.CanvaToken.list({
        filter: { is_active: true },
      });

      if (!tokens.data || tokens.data.length === 0) {
        return new Response(JSON.stringify({ connected: false }), {
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
        });
      }

      // Find the one with an access_token
      const connected = tokens.data.find(t => t.data.access_token);
      if (!connected) {
        return new Response(JSON.stringify({ connected: false }), {
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
        });
      }

      const isExpired = connected.data.expires_at && connected.data.expires_at < Date.now();

      // Try to refresh if expired
      if (isExpired && connected.data.refresh_token) {
        const refreshRes = await fetch("https://api.canva.com/rest/v1/oauth/token", {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "Authorization": "Basic " + btoa(CLIENT_ID + ":" + CLIENT_SECRET),
          },
          body: new URLSearchParams({
            grant_type: "refresh_token",
            refresh_token: connected.data.refresh_token,
          }),
        });
        const refreshData = await refreshRes.json();

        if (refreshData.access_token) {
          await base44.asServiceRole.entities.CanvaToken.update(connected.id, {
            access_token: refreshData.access_token,
            refresh_token: refreshData.refresh_token,
            expires_at: Date.now() + (refreshData.expires_in * 1000),
          });
          return new Response(JSON.stringify({ connected: true }), {
            headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
          });
        }
      }

      return new Response(JSON.stringify({ connected: !isExpired }), {
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }

    if (action === "get_token") {
      const tokens = await base44.asServiceRole.entities.CanvaToken.list({
        filter: { is_active: true },
      });
      const connected = tokens.data?.find(t => t.data.access_token);
      if (connected && connected.data.expires_at > Date.now()) {
        return new Response(JSON.stringify({ token: connected.data.access_token }), {
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
        });
      }
      return new Response(JSON.stringify({ error: "not_connected" }), {
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }
  }

  return new Response(JSON.stringify({ error: "invalid_request" }), {
    status: 400,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
  });
});
