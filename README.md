# Living Cycle

An interactive, choice-driven reincarnation simulation game.

## Features

- **26 Being Types** — Human, Demon, Vampire, Angel, Dragon, Neko, Merfolk, Phoenix, Ghost, Lich, Android, Synth, and more
- **AI-Generated Portraits** — Hyper-realistic, full-body character portraits via Pollinations.ai, reflecting all avatar selections
- **3D Avatar Generator** — Real-time Three.js 3D avatars with skin/hair/feature customization
- **16 Stats** — Consciousness, Wisdom, Power, and 13 more tracking your spiritual evolution
- **40 Scenarios** — Including 10 love-focused arcs and 26 multi-part quests
- **15 Eras** — Historical and futuristic world eras with AI-generated background imagery
- **Height & Weight Sliders** — Physical customization with live cm/ft and kg/lbs display
- **Facial Features** — Nose shape (14 options) and mouth shape (12 options) selectors
- **IRL Monitor** — Maps 20 real-life activities to the same 16-stat system for habit tracking
- **Meta-Progression** — Between-Lives upgrade shop with Evolution Points (EP)
- **30 Random Events** — God's blessings, cosmic interventions, and more
- **Ascension Mechanic** — Evolve beyond the standard reincarnation cycle
- **Procedural Audio** — In-browser Web Audio engine with adaptive soundscapes
- **Canva Integration** — Export AI portraits directly to your Canva content library

## Tech Stack

- Pure HTML/CSS/JS — no build step, no external dependencies
- Three.js for 3D avatar rendering
- Web Audio API for procedural sound
- Pollinations.ai for AI portrait generation
- Base44 backend functions for Canva OAuth and asset export

## Files

- `living_cycle.html` — The complete game (self-contained)
- `functions/gameServe.ts` — Backend function serving the game (gzip-compressed HTML patcher)
- `functions/canvaAuth.ts` — Canva OAuth PKCE handler
- `functions/canvaUpload.ts` — Canva asset upload pipeline

## Play

The game is deployed as a Base44 backend function and accessible via browser.

## License

Personal project.
