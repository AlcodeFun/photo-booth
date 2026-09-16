# Self Photo Booth System

**End-to-end, offline-first photo booth terminal — driven by a real Canon DSLR, architected
for reliability, built to be handed between developers and AI agents.**

> A customer walks up, pays, takes up to three real photos with a live mirror and
> retakes, watches the three compose into one framed print, and leaves with a printed
> photo plus a QR code for the digital copies — with **zero staff, zero internet
> dependency, and zero audio feedback** for the operators. I designed, built, and
> hardware-tested the whole product myself.

---

## 1. The problem

Commercial photo booths are closed black boxes — you rent the machine, you pay for
the software license, and you can't change an inch of the experience. DIY booths
collapse under real-world conditions (camera not responding, power cuts, lost
uploads, staff needing a manual). And the "easy" route, the camera vendor SDK, is a
maintenance trap.

**The goal:** an open, reliable booth from off-the-shelf parts that a child can use
with no help and that keeps working when the internet doesn't.

## 2. Why this project is interesting

| Engineering problem | How I solved it |
|---|---|
| **Drive a Canon DSLR without its closed SDK** | Built a full camera service on **gphoto2 (PTP)** instead of EDSDK. Live-view mirror streams MJPEG over IPC; the shutter fires `--capture-image-and-download` for true full-resolution originals, every time. |
| **"Could not query kernel driver" mystery** | Root-caused a multi-day failure that looked like a driver problem to the actual bug: the camera refusing **PTP open-session** (`PTP_OC 0x1002`) because of battery/auto-power-off state. `--debug` trace bookkeeping — not guessing. |
| **Offline-first, by design** | Capture, review, processing, printing, and local persistence never touch the network. Only QR digital delivery and monitoring are cloud-bound, and they degrade gracefully. |
| **Hardware isolation** | React never talks to hardware. Electron's main process owns the camera service behind a typed **contextBridge/IPC** surface — swap a camera or printer without touching UI. |
| **Architecting for AI-assisted development** | pnpm monorepo, strictly typed shared packages, small independently testable tasks, and self-maintaining docs. A fresh agent can pick up a numbered task and ship it. |
| **Full-resolution archives** | Every capture is persisted at native resolution to the user's Pictures folder (`{ dataUrl, filePath }`) — no silent data loss. |
| **Cloud digital delivery** | A **Cloudflare Worker + R2** gallery: upload → tokenized gallery page → QR download. Scrubbed of any ZIP shortcuts; photos flow individually by product decision. |

## 3. Architecture

```
┌────────────────────────────── apps/booth (Electron) ──────────────────────────────┐
│                                                                                     │
│  React renderer   ──contextBridge/IPC──►   Electron main                            │
│  (screens, session │                          │                                     │
│   store, live view)│                          ├── GphotoCameraService (gphoto2/PTP) │
│                     │                          │     • Live-view stream ──MJPEG───── │
│                     │                          │     • takePicture() → Pictures\    │
│                     └──────────────────────────┤       Photo Booth originals        │
│                                                 │                                  │
│  Rendered: most screens, countdown, retake,     │                                  │
│  gallery/QR screens                             │                                  │
└─────────────────────────────────────────────────┴──────────────────────────────────┘
                                    │  upload (VITE_GALLERY_URL)
                                    ▼
                          apps/gallery (Cloudflare Worker)
                          POST /api/sessions · GET /p/<token> · GET /d/<token>/<name>
```

- **Booth** — Electron + React 18 + TypeScript + Vite + Tailwind + Zustand.
- **Shared packages** — `packages/types` (single source of truth for contracts),
  `packages/ui` (design-system components).
- **Gallery** — Cloudflare Worker + R2, token-based secure delivery.

## 4. Customer flow (the product)

```
PAY → TUTORIAL → LAYOUT → FRAME → READY
  → PHOTO 1 (5s countdown, live mirror, up to 3 attempts)
  → REVIEW (USE / RETAKE) → PHOTO 2 → PHOTO 3
  → FINAL PREVIEW → PRINT + QR → COMPLETE → auto-reset
```

- **3-attempt rule:** third retake disables RETAKE; the customer never gets stuck.
- **Countdown + flash**; retake cycles guard customer patience and paper.
- **Everything local**; a session round-trips end-to-end on a single PC.

## 5. Moving parts I extended beyond the UI

- **`GphotoCameraService`** — detect, health-check, concurrent-command queue, MJPEG
  live-view decoding over `--stdout`, full-res capture with stream pause/resume,
  error surfacing, and Windows MSYS2 `IOLIBS/CAMLIBS` auto-detection.
- **Capture persistence** — success-path originals survive restarts (the reported
  "photos missing" bug was a delete-on-success; now files persist and the UI shows
  "Saved to …").
- **Driver & firmware archaeology** — established libusbK is correct, documented the
  600D firmware update path over PTP (no card reader available), and wrote a Linux
  direct-attach guide (`docs/linux-camera-direct.md`, incl. v4l2loopback dev harness).
- **Gallery worker** — multipart upload, R2 keys, tokenized gallery + download URLs.

## 6. Stack

| Layer | Technology |
|---|---|
| Desktop | Electron (Windows 11), kiosk-style |
| Frontend | React 18 · TypeScript · Vite · Tailwind CSS · shared component library |
| State | Zustand |
| Camera | gphoto2 / libgphoto2 over USB PTP (no vendor SDK) |
| Cloud | Cloudflare Workers · R2 |
| Tooling | pnpm monorepo · strict TypeScript · git/GitHub |

## 7. Repo at a glance

```
apps/booth/      Desktop application (main + preload + renderer)
apps/gallery/    QR gallery Worker + R2
packages/types/  Shared TypeScript contracts
packages/ui/     Shared UI components
docs/            PROJECT.md (product/status/roadmap) · linux-camera-direct.md
```

## 8. Try it

```bash
corepack pnpm install
corepack pnpm --filter booth dev      # launch the booth
corepack pnpm --filter booth build
corepack pnpm --filter booth typecheck
```

Hardware: Canon EOS 600D / Rebel T3i · Canon SELPHY CP1000 (USB) · any Windows 11
laptop. Optional: HDMI→USB capture card for the mirror.

---

## About me 

I take projects from a blank repo to a working physical product — including the parts
most engineers skip: hardware bring-up, driver-level debugging, offline resilience,
and documentation a team can actually hand off with. This project demonstrates:

- **Full-stack + hardware confidence** — TypeScript/React/Electron on one side, USB
  protocol tracing and physical-device troubleshooting on the other.
- **Diagnosis over guessing** — a stubborn camera "driver" issue solved with evidence
  from wire-level traces, not might-be fixes.
- **Product thinking** — a flow non-technical customers use unaided, and error states
  that never abandon them.
- **Architecture you can hand to a team** — typed contracts, isolated services, small
  tasks, and docs written for the next person (or machine) that touches the code.

