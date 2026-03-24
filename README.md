# mcp-animation-inspector

MCP server that helps AI assistants understand website animations

[![npm version](https://img.shields.io/npm/v/mcp-animation-inspector)](https://www.npmjs.com/package/mcp-animation-inspector)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## What It Does

AI assistants are blind to animations. They can read HTML and CSS, but they cannot see a GSAP timeline play, a Lottie animation loop, or a scroll-triggered reveal. When asked "how does this animation work?", they can only guess from static source code.

**mcp-animation-inspector** solves this by running a real browser via Playwright, detecting all animation systems on the page, capturing frame sequences at key scroll positions, extracting the relevant source code, and optionally generating Claude Vision descriptions of what was captured — all exposed as MCP tools that any AI assistant can call.

Pipeline: **Navigate → Discover → Capture → Extract → Describe → Report**

---

## Quick Start

### Run with npx (once published)

```bash
npx mcp-animation-inspector
```

### Claude Code integration

Add to your `~/.claude.json` or project `.mcp.json`:

```json
{
  "mcpServers": {
    "animation-inspector": {
      "command": "npx",
      "args": ["mcp-animation-inspector"]
    }
  }
}
```

### Local development

```bash
git clone https://github.com/Ak0096/mcp-animation-inspector
cd mcp-animation-inspector
npm install
npx playwright install chromium
npm run build
node dist/index.js
```

---

## Available Tools

| Tool | Description | Key Parameters |
|------|-------------|----------------|
| `inspect_animation` | Full pipeline: discover, capture, extract, and describe all animations on a page | `url` |
| `discover_animations` | Run detectors only — returns an inventory of animation systems found | `url` |
| `capture_frames` | Take screenshots at specified scroll positions | `url`, `inventory?`, `scroll_positions?` |
| `extract_animation_code` | Pull relevant source code snippets for detected animations | `url`, `inventory?`, `filter?` |
| `describe_animations` | Generate Claude Vision descriptions of captured frames (requires `ANTHROPIC_API_KEY`) | `url` |
| `get_page_structure` | Return a simplified DOM outline of the page | `url` |

---

## Built-in Detectors

| Detector | What It Detects |
|----------|-----------------|
| **CSS** | `@keyframes` rules, `transition` properties longer than 200 ms |
| **GSAP** | `gsap.timeline()`, `gsap.to/from/fromTo()`, `ScrollTrigger` |
| **Framer Motion** | `data-framer-*` attributes, `motion.*` components |
| **Lottie** | `<lottie-player>` elements, `bodymovin.loadAnimation()` calls |
| **WebGL** | `<canvas>` with a WebGL context, Three.js scene presence |
| **Scroll Libraries** | Lenis, Locomotive Scroll smooth-scroll instances |
| **Custom Cursors** | `cursor: none` on `body`, fixed-position cursor overlay elements |
| **Page Transitions** | View Transitions API usage, Barba.js, Swup |

---

## Configuration

All options can be passed as environment variables or as JSON config. When running via `npx`, set environment variables before the command.

| Option | Default | Description |
|--------|---------|-------------|
| `headless` | `true` | Run browser in headless mode |
| `viewport` | `1440x900` | Browser viewport width × height |
| `timeout` | `30000` | Page load timeout in milliseconds |
| `scrollPositions` | `[0, 25, 50, 75, 100]` | Scroll percentages at which to capture frames |
| `maxFramesPerAnimation` | `10` | Maximum frames captured per detected animation |
| `maxTotalFrames` | `50` | Hard cap on total frames across all animations |
| `imageFormat` | `jpeg` | Frame image format (`jpeg` or `png`) |
| `imageQuality` | `75` | JPEG quality (1–100) |
| `enabledDetectors` | `"all"` | Comma-separated list of detectors to run, or `"all"` |
| `transport` | `stdio` | MCP transport: `stdio` or `http` |
| `httpPort` | `3100` | Port used when `transport=http` |
| `autoDescribe` | `false` | Automatically run Vision descriptions after capture |
| `descriptionModel` | `claude-opus-4-5` | Anthropic model used for Vision descriptions |
| `ANTHROPIC_API_KEY` | — | Required only for `describe_animations` / `autoDescribe` |

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    MCP Tool Request                      │
└────────────────────────┬────────────────────────────────┘
                         │
              ┌──────────▼──────────┐
              │   BrowserSession    │  Playwright Chromium
              │   (Navigate + Wait) │
              └──────────┬──────────┘
                         │
              ┌──────────▼──────────┐
              │  DetectorRegistry   │  8 pluggable detectors
              │  (Discover)         │  run in parallel
              └──────────┬──────────┘
                         │  AnimationInventory
              ┌──────────▼──────────┐
              │   FrameCapture      │  scroll + screenshot
              │   (Capture)         │  per scroll position
              └──────────┬──────────┘
                         │  Base64 frames
              ┌──────────▼──────────┐
              │   CodeExtractor     │  pulls CSS/JS snippets
              │   (Extract)         │  relevant to detections
              └──────────┬──────────┘
                         │
              ┌──────────▼──────────┐
              │  VisionDescriber    │  optional Claude Vision
              │  (Describe)         │  pass (needs API key)
              └──────────┬──────────┘
                         │
              ┌──────────▼──────────┐
              │   MCP Response      │  structured JSON report
              └─────────────────────┘
```

Each stage is independent. You can call `discover_animations` without capturing frames, or `capture_frames` with a pre-built inventory to skip re-detection.

---

## Contributing

### Adding a New Detector

1. **Create the detector file**

   ```
   src/detectors/your-detector.ts
   ```

   Implement the `AnimationDetector` interface:

   ```ts
   import type { AnimationDetector, DetectionResult } from './types.js';

   export const yourDetector: AnimationDetector = {
     name: 'your-detector',
     detect(page): Promise<DetectionResult> {
       return page.evaluate(() => {
         // run inside the browser context
         const found = /* your detection logic */;
         return { detected: found, details: [] };
       });
     },
   };
   ```

2. **Register the detector**

   Add it to `ALL_DETECTORS` in `src/detectors/index.ts`:

   ```ts
   import { yourDetector } from './your-detector.js';

   export const ALL_DETECTORS = [
     cssDetector,
     gsapDetector,
     // ...existing detectors...
     yourDetector,  // add here
   ];
   ```

3. **Add a test**

   Create a fixture HTML file under `tests/fixtures/` and a test file under `tests/`. The test should assert that your detector returns `detected: true` for the fixture and `detected: false` for an unrelated page.

### Running Tests

```bash
npm test
```

### Build

```bash
npm run build
```

---

## License

MIT — see [LICENSE](./LICENSE)
