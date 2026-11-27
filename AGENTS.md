# Working on Kromskop

These rules apply to every contributor, human or coding agent.

## Licence provenance

Kromskop is dual-licensed MIT OR Apache-2.0, so no GPL or AGPL code may enter the repo.

- Do not copy, port or paraphrase code from darktable, RawTherapee, ART, Ansel, RapidRAW, or any other GPL/AGPL project. This includes shaders and lookup tables.
- Implement algorithms from papers, specifications (for example the DNG specification) and permissively licensed sources only.
- When you add an image-processing algorithm, name its source (paper, spec section or permissive project) in a comment at the top of the implementation.
- LGPL libraries such as LibRaw may be linked as dependencies. Do not vendor modified copies.
- Do not fit curves, constants or lookup tables to the output of Lightroom or any other proprietary editor, and do not inspect its application bundle, profiles or presets. Kromskop borrows Lightroom's control names, not its measured behaviour.
- Do not write a file-format decoder from recollection. Work from a published specification, or use a maintained library.

## Security

- Originals are read-only. Nothing in the app writes to, moves or deletes a user's photo files.
- The MCP server opens no TCP port by default. It listens on an owner-only Unix socket.
- File access is limited to folders the user opened in the app. Canonicalise a path before checking it against those folders, and refuse symlinks that escape them. Never accept a new root folder from a tool argument.
- Exports never overwrite an existing file unless the caller asked for it explicitly. There is no delete tool.
- Treat file names and EXIF, XMP and IPTC text as untrusted input. Render them as text in the interface, and never put them in MCP tool descriptions.
- RAW files are untrusted input. Cap image dimensions and decode time.

## Interface

- Chrome is neutral grey (R = G = B). No tints, gradients, glows or translucency: a coloured surround changes how the photo's colour is perceived.
- Colour appears in the chrome only where the colour is the information: the RGB channels of a histogram, the hue swatches of the Colour Mixer, and the two reserved accents (amber for the person's pick, a cool hue for the agent). Keep it small and low in chroma.
- The interface typeface is IBM Plex Sans, self-hosted. Numbers use tabular figures.
- Photos have square corners and no shadow. Labels sit beside a photo, not over its pixels.
- No in-app chat, no sparkle or emoji icons, no cards inside cards.
- Every screen has designed empty, loading, disconnected and error states.
- Animate only cause and effect.

## Edits and versions

- A version is an immutable parameter snapshot with a parent. Changing a version creates a new snapshot; it never mutates an old one.
- Every snapshot records the schema version and the process version it was made with. A change that alters how existing edits render needs a new process version, and the old one must keep rendering.

## Commits

- Keep each change small and focused on one thing.
- Write the subject in the imperative mood, at most 72 characters, prefixed with the area: `engine:`, `ui:`, `mcp:`, `app:`, `docs:` or `build:`.
- Do not commit personal photos. Put your own RAW files in `samples/local/`, which is ignored.
