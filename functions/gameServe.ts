// Living Cycle - game server (serves latest HTML directly)
const GAME_URL = "https://base44.app/api/apps/6a7618cf2d5c7e698307984e/files/mp/public/6a7618cf2d5c7e698307984e/af8418e24_living_cycle_human.html";

Deno.serve(async (req) => {
  try {
    const response = await fetch(GAME_URL + "?nocache=" + Date.now());
    const html = await response.text();
    return new Response(html, {
      headers: { 'Content-Type': 'text/html', 'Cache-Control': 'no-cache' }
    });
  } catch(e) {
    return new Response('Error: ' + (e?.message || String(e)), { status: 500 });
  }
});
