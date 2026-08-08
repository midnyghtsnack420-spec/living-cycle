import { createClientFromRequest } from "npm:@base44/sdk@0.8.31";

const CLIENT_ID = Deno.env.get("CANVA_CLIENT_ID");
const CLIENT_SECRET = Deno.env.get("CANVA_CLIENT_SECRET");

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type" },
    });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "POST required" }), { status: 405, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });
  }

  const body = await req.json();
  const { action, imageUrl, dataUrl, name } = body;

  // Get access token
  let token = null;
  const tokens = await base44.asServiceRole.entities.CanvaToken.list({ filter: { is_active: true } });
  const connected = tokens.data?.find(t => t.data.access_token);

  if (!connected || connected.data.expires_at < Date.now()) {
    if (connected?.data.refresh_token) {
      const refreshRes = await fetch("https://api.canva.com/rest/v1/oauth/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", "Authorization": "Basic " + btoa(CLIENT_ID + ":" + CLIENT_SECRET) },
        body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: connected.data.refresh_token }),
      });
      const refreshData = await refreshRes.json();
      if (refreshData.access_token) {
        await base44.asServiceRole.entities.CanvaToken.update(connected.id, {
          access_token: refreshData.access_token, refresh_token: refreshData.refresh_token, expires_at: Date.now() + (refreshData.expires_in * 1000),
        });
        token = refreshData.access_token;
      }
    }
    if (!token) {
      return new Response(JSON.stringify({ error: "not_connected", message: "Please connect your Canva account first" }), { status: 401, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });
    }
  } else {
    token = connected.data.access_token;
  }

  // Handle data URL (base64 image from canvas)
  let imgBytes: Uint8Array;
  if (dataUrl) {
    // Decode base64 data URL
    const base64 = dataUrl.split(",")[1] || dataUrl;
    const binary = atob(base64);
    imgBytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) imgBytes[i] = binary.charCodeAt(i);
  } else if (imageUrl) {
    // Download from URL
    const imgRes = await fetch(imageUrl);
    const imgBuffer = await imgRes.arrayBuffer();
    imgBytes = new Uint8Array(imgBuffer);
  } else {
    return new Response(JSON.stringify({ error: "no_image", message: "Provide either dataUrl or imageUrl" }), { status: 400, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });
  }

  const assetName = name || "Living Cycle Avatar";
  const nameBase64 = btoa(unescape(encodeURIComponent(assetName)));

  // Upload to Canva
  const uploadRes = await fetch("https://api.canva.com/rest/v1/asset-uploads", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/octet-stream",
      "Asset-Upload-Metadata": JSON.stringify({ name_base64: nameBase64 }),
      "Content-Length": imgBytes.length.toString(),
    },
    body: imgBytes,
  });

  const uploadData = await uploadRes.json();

  // Poll for completion if in_progress
  if (uploadData.job && uploadData.job.status === "in_progress") {
    let pollCount = 0;
    let jobStatus = uploadData;
    while (jobStatus.job.status === "in_progress" && pollCount < 15) {
      await new Promise(r => setTimeout(r, 2000));
      const pollRes = await fetch(`https://api.canva.com/rest/v1/asset-uploads/${uploadData.job.id}`, { headers: { "Authorization": `Bearer ${token}` } });
      jobStatus = await pollRes.json();
      pollCount++;
    }
    return new Response(JSON.stringify({
      success: jobStatus.job.status === "success",
      asset: jobStatus.job.asset || null,
      message: jobStatus.job.status === "success" ? "Avatar uploaded to Canva!" : `Upload status: ${jobStatus.job.status}`,
    }), { headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });
  }

  return new Response(JSON.stringify({
    success: uploadData.job?.status === "success",
    asset: uploadData.job?.asset || null,
    message: uploadData.job?.status === "success" ? "Avatar uploaded to Canva!" : `Upload status: ${uploadData.job?.status}`,
  }), { headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });
});
