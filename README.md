# Kromskop

An AI-first RAW photo editor. Your own agent connects over MCP and does the colour work; you compare the versions side by side and choose.

> **Status: early development.** Nothing here is usable yet. The interface is being designed first, and the engine follows.

## The idea

Colour-correcting a shoot is mostly judgement: try a few interpretations, look at them next to each other, pick one, refine. Kromskop gives that loop to an agent and a person working together.

- **Your agent edits.** Any MCP client (Claude Code first) can open a folder of RAW files, read histograms and colour statistics, and adjust Lightroom-style controls.
- **Versions cost nothing.** Every version is a small set of parameters pointing at the same RAW file. The agent can make three or thirty interpretations of one photo without copying it, and originals are never modified.
- **You compare and choose.** Put two to six versions side by side with linked zoom, flip between them in place, pick one, or pin a comment to a region. The agent reads your picks and comments and iterates.
- **Local only.** A desktop app with no account, no cloud service and no built-in model. Launch it, edit, close it.

The first release covers colour and tone only: white balance, exposure, contrast, highlights, shadows, whites, blacks, vibrance, saturation, tone curve, and an HSL mixer. Masks, retouching and local adjustments come later.

## The name

The Kromskop was Frederic Ives's colour viewer from the 1890s. It recombined three grey separation records into one full-colour image for a person to inspect. It is pronounced "chrome-scope".

## Planned architecture

| Part | Choice |
|---|---|
| App shell | Tauri 2, macOS first, built so Windows and Linux can follow |
| Interface | TypeScript and React in the webview; it displays what the engine renders |
| Engine | Rust; LibRaw for decoding, wgpu shaders for a scene-linear colour pipeline |
| Edits | Stored in a `.kromskop/` folder beside the photos, so they travel with the shoot |
| MCP | Served by the running app and reached through a `kromskop mcp` stdio command over a private local socket; no network port is opened |

## Licence

Licensed under either of [Apache License, Version 2.0](LICENSE-APACHE) or [MIT licence](LICENSE-MIT), at your option.

Contributions are accepted under the same dual licence. Kromskop does not copy code from GPL or AGPL projects; see [AGENTS.md](AGENTS.md) for the rule that applies to people and coding agents alike.
