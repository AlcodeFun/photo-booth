# PHOTO BOOTH — PROJECT

> Single source of truth for the Self Photo Booth project (merged and updated from the
> former `README.md` + `AGENTS.md`). Product vision, build status, run/test instructions,
> and agent handoff protocol all live here.
>
> Related docs: `docs/linux-camera-direct.md` (Linux camera setup).

---

## 1. Product Vision

Build a self-service photo booth: a customer completes a full photo session with minimal
staff assistance — pay manually, follow a guided flow, take up to 3 photos (max 3
attempts per slot), review a final framed composition, and receive a printed photo plus a
QR code for digital download.

The booth is **offline-first** (capture/process/print/local storage never depend on the
Internet). Cloud services are used for **digital delivery** (QR gallery), sync, remote
management, and future analytics.

### MVP principles

| Principle | Meaning |
|---|---|
| **UI first** | Validate the customer journey visually before hardware |
| **Local-first** | Booth keeps operating without Internet |
| **Simple over clever** | Smallest architecture that reliably ships |
| **Hardware isolation** | Camera/printer behind adapter services; React never touches hardware |
| **AI-agent friendly** | Small, independently testable tasks handed between agents |
| **Reliability first** | Stable capture → process → print → QR beats feature count |

### Priority order

```
P0  Static customer flow · Camera capture · 3-attempt retake · Image composition ·
    Printing · Local persistence · QR digital delivery · Offline recovery
P1  Admin dashboard · Booth monitoring · Template management · Auto-update
P2  GIF/live-photo improvements · Analytics · Remote management
P3  AI effects · Payment automation · Mobile application
```

---

## 2. Current Situation (updated)

- **Phase 0 (foundation) & Phase 1 (static customer UI) are complete through TASK-031.**
  Open: **TASK-032** loading states, **TASK-033** error states, **TASK-034** timeout/reset flow.
- **Camera integration is live on Windows via gphoto2** (no Canon SDK). Live-view mirror
  streams over IPC, full-res shutter persists originals to `Pictures\Photo Booth`.
  Remaining hardware blockers: the **camera is flaky (needs healthy PTP, i.e. charged
  battery / AC + Auto Power Off = Disable)**, the **HDMI→USB capture card has never
  appeared on the booth PC's USB bus**, and **firmware update to 600D v1.0.3 is pending**.
- **Digital gallery worker (`apps/gallery`)** is built (R2 + QR download page); the booth
  uses it when `VITE_GALLERY_URL` is set, otherwise it runs simulated/offline.
- **Typecheck:** Electron passes clean; renderer has known pre-existing errors in
  `App.tsx`, `mockData.ts`, `FrameTemplateAdminScreen.tsx` (see §10).

Details on all of the above follow in §3–§9.

---

## 3. Repository Overview (pnpm monorepo)

```
apps/booth/            Electron app: main + preload + React/Vite renderer
apps/gallery/          Cloudflare Worker: R2 storage + customer gallery page + download API
packages/types/        Shared TypeScript interfaces (session, layouts, frames, camera)
packages/ui/           Shared React/Tailwind UI component library
docs/                  PROJECT.md (this file), APP-CONTEXT.md, linux-camera-direct.md
```

- **booth renderer:** React 18 + TypeScript + Vite + Tailwind CSS + Zustand
  (`renderer/src/store/sessionStore.ts` drives the screen router).
- **Electron:** `electron/main.ts` (IPC + camera service), `electron/preload.ts`
  (contextBridge), `electron/camera/GphotoCameraService.ts` (gphoto2 backend).
- **Hardware rule:** renderer never accesses hardware directly — everything goes through
  the preload-exposed `window.electronAPI` bridge.

---

## 4. Customer Flow & Screen Map

```
SCREEN-01 MANUAL PAYMENT → SCREEN-02 TUTORIAL/START → SCREEN-03 SELECT LAYOUT
  → SCREEN-04 SELECT FRAME → SCREEN-05 READY/START → SCREEN-06 PHOTO CAPTURE
  → SCREEN-07 PHOTO REVIEW → ×3 → SCREEN-08 FINAL PREVIEW → SCREEN-09 PRINT + QR
  → SCREEN-10 COMPLETE → back to SCREEN-02 (session reset)
```

### Attempt rules

- Each photo slot: **max 3 capture attempts**. After attempt 3, **RETAKE is disabled**.
- The customer's **selected** photos (not rejected attempts) are the final outputs.

### Session state (Zustand + shared types)

```ts
interface PhotoAttempt { attemptNumber: number; status: "CAPTURED" | "SELECTED" | "RETAKEN"; }
interface PhotoSlotState { slotNumber: number; maxAttempts: 3; attempts: PhotoAttempt[]; selectedAttempt?: number; }
interface BoothSessionState { sessionId: string; layoutId?: string; frameId?: string;
  currentPhotoSlot: number; photoSlots: PhotoSlotState[]; status: string; }
```

### Customer output set (3-photo session)

```
photo-1.jpg · photo-2.jpg · photo-3.jpg · final.gif · live-1..3
```

Retake attempts stay local only; rejected attempts are **not** uploaded to the cloud.

---

## 5. Camera Architecture (current decisions — ground truth)

| Job | Implementation |
|---|---|
| **Full-res shutter** | `gphoto2` over USB PTP via `GphotoCameraService.takePicture()` → IPC `camera:takePicture` |
| **In-app live view** | `startLiveView()` → `gphoto2 --stdout --capture-movie` → MJPEG frames → IPC `camera:liveview` (memory only; never recorded) |
| **Mirror feed (target)** | Camera HDMI-out → HDMI-to-USB capture card (UVC webcam) or OBS Virtual Camera → renderer `getUserMedia` |
| **Webcam fallback** | `navigator.mediaDevices.getUserMedia` in PhotoCaptureScreen when the Canon bridge is unavailable |
| **No Canon SDK** | EDSDK was uninstalled; only a 32-bit remnant remained. `koffi` FFI and `@brick-a-brack/napi-canon-cameras` were evaluated and **rejected** |

### Driver / PTP history (Windows — don't re-litigate)

- Camera is bound to **libusbK (Zadig, oem48.inf)** — **correct and fine**.
- Past `PTP Timeout` / "Could not query kernel driver" errors were **the camera refusing
  PTP** (battery / Auto Power Off), not a driver problem — `--debug` showed
  `libusb_bulk_transfer` timing out on `PTP_OC 0x1002`.
- Camera health check: `--get-config /main/settings/capturetarget` must not time out.
- gphoto2 build on the booth: MSYS2 `C:\msys64\mingw64\bin\gphoto2.exe`; needs
  `IOLIBS`/`CAMLIBS` (auto-derived in `spawnEnv()`, see service source).
- **Capture latency experiment** (untested on hardware — keep OFF): set
  `CAMERA_SKIP_VIEWFINDER_DROP=1` to skip the `viewfinder=0` drop before the
  shutter and shoot directly after the live-view stream stops. Default off.

### Capture persistence (current behavior)

`takePicture()` returns `{ dataUrl, filePath }` per `CameraCaptureResult`. The full-res
original is written to the user's Pictures folder (`Pictures\Photo Booth`, auto-created);
the temp JPEG in `%TEMP%\photo-booth-camera-*` is then removed. Camera Settings shows
"Saved to: …". **The screen model is Canon 600D / Rebel T3i, firmware target v1.0.3.**

### 600D operational facts

- **Auto Power Off must be Disable** — sleep kills Live View + PTP.
- HDMI out works **only during Live View**; port is **mini-HDMI (Type-C)**.
- Wireless/remote capture uses wired USB PTP only in this product.

### Firmware (pending)

Official **v1.0.3** (`CCF11103.FIR`, 12,232,300 bytes). Updates are **card-based only**.
There is no card reader and no SD slot on the booth laptop, so the plan is: download the
FIR → format the card **in the camera** → upload over PTP
(`gphoto2 --upload-file CCF11103.FIR --folder /store_00010001 --filename CCF11103.FIR`) →
verify (`--list-files`) → run the in-camera Firmware Version update. Blocked on a PTP-ok
camera.

---

## 6. Digital Gallery & QR Delivery

`apps/gallery` is a Cloudflare Worker:

| Route | Purpose |
|---|---|
| `POST /api/sessions` | Multipart upload → R2 at `sessions/<token>/` |
| `GET /p/<token>` | Customer gallery HTML page |
| `GET /api/sessions/<token>` | JSON file list with `/d/` download URLs |
| `GET /d/<token>/<name>` | Streams the stored file |

- **No ZIP anywhere** — photos display/download individually (product decision).
- GIF is generated at the camera's original aspect ratio (no crop) in
  `renderer/src/utils/resultExport.ts#createResultGif`.
- Booth renderer: `VITE_GALLERY_URL` set → real upload + real QR (`utils/qr.ts`,
  `qrcode`) on PrintQRScreen; unset → simulated upload, no QR URL (offline mode).
  Env file location: `apps/booth/renderer/.env.local` (Vite root is `renderer/`).
- Local exports (framed PNG / PDF) go to the OS Downloads folder via the `save-file` IPC.

### Gallery commands

```bash
corepack pnpm --filter @photo-booth/gallery dev            # wrangler dev
corepack pnpm --filter @photo-booth/gallery run typecheck
corepack pnpm --filter @photo-booth/gallery exec wrangler r2 bucket create photo-booth-gallery
corepack pnpm --filter @photo-booth/gallery exec wrangler login   # then: deploy
```

---

## 7. Physical Devices (MVP)

| Device | Model | Connection | Role |
|---|---|---|---|
| Camera | **Canon EOS 600D / Rebel T3i** | USB tethered (PTP) + HDMI for mirror | Capture + live view |
| Printer | Canon SELPHY CP1000 | **USB cable (no Wi-Fi dependency)** | Physical photo print |
| Main PC | Acer Nitro 5 (Windows 11) | USB / power | Booth application + controllers |
| Power | Taffware 220V / 69 800 mAh | AC | Backup / portable power (test total load) |
| Optional | Huawei MatePad 11 (2020) | Network / secondary | Optional secondary display — not a core dependency |

Integration order: static UI/mock → camera USB → real capture → local storage → image
processing → printer USB → real printing → full E2E booth test.

---

## 8. Run & Test Instructions

> Always use `corepack pnpm`.

```bash
corepack pnpm install                 # install (pnpm build-script approval lives in pnpm-workspace.yaml)
corepack pnpm --filter booth dev      # Vite renderer + Electron
corepack pnpm --filter booth build    # vite build + electron tsc
corepack pnpm --filter booth typecheck# tsc electron + renderer (--noEmit)
```

**Known pre-existing renderer typecheck debt** (Electron is clean):
- `renderer/src/App.tsx` — unused `resetSession`, `activeStepIdx` (TS6133).
- `renderer/src/data/mockData.ts` — unused `CLASSIC_BLACK_TEMPLATES` (TS6133).
- `renderer/src/screens/FrameTemplateAdminScreen.tsx` — `sourcePhotoSlot` optional/required
  mismatch; `PointerEvent` type mismatches on two handlers.

---

## 9. Task Roadmap (status)

### Phase 0 — Foundation (DONE)
```
[TASK-001] monorepo      [TASK-002] TS strict      [TASK-003] ESLint/Prettier
[TASK-004] Electron shell[TASK-005] React+Vite     [TASK-006] secure preload
[TASK-007] Tailwind      [TASK-008] shadcn/ui      [TASK-009] design tokens
[TASK-010] shared UI pkg [TASK-011] shared types   [TASK-012] Zustand session store
```

### Phase 1 — Static customer UI (DONE through TASK-031)
```
[TASK-013] app shell/router      [TASK-014] mock data           [TASK-015] payment screen
[TASK-016] tutorial/start        [TASK-017] layout selection    [TASK-018] frame selection
[TASK-019] ready/start           [TASK-020] capture screen      [TASK-021] countdown
[TASK-022] review screen         [TASK-023] use/retake          [TASK-024] 3-attempt rule
[TASK-025] photo 1 flow          [TASK-026] photo 2 flow        [TASK-027] photo 3 flow
[TASK-028] session progress      [TASK-029] final preview       [TASK-030] print + QR
[TASK-031] completion screen
[ ] TASK-032 loading states      [ ] TASK-033 error states      [ ] TASK-034 timeout/reset
```

### Phases 2–9 (not started)
Phase 2: real session state store · Phase 3: camera adapter/production camera ·
Phase 4: image processing & outputs · Phase 5: printing · Phase 6: SQLite persistence ·
Phase 7: cloud + QR gallery · Phase 8: Clerk + admin · Phase 9: realtime + monitoring.

### Completed-camera work (beyond the original roadmap)
- `GphotoCameraService` (gphoto2): detect, Live View stream, shutter, retry, dispose.
- IPC + renderer bridge incl. `CameraCaptureResult { dataUrl, filePath }`.
- Capture originals persisted to `Pictures\Photo Booth`; Settings screen shows path.
- Driver/root-cause analysis, EDSDK evaluation, firmware research (see §5).
- Linux direct-attach docs + v4l2loopback dev appendix (`docs/linux-camera-direct.md`).

---

## 10. Agent Handoff Protocol

Every agent must:

1. Read `docs/PROJECT.md` (this file).
2. Inspect the current repository state.
3. Implement **only** the assigned task.
4. Run typecheck, lint, and relevant tests.
5. Report files changed, tests executed, unresolved issues, and a suggested next task.
6. Update task status in this document when a roadmap item completes.

Commit style: `feat(booth): …` / `fix(camera): …` / `docs: …`.

### AI-agent prompt template

```text
Read docs/PROJECT.md first.

TASK: <one numbered task>
GOAL: <one sentence>
CONTEXT: <only what is needed for this task>
REQUIREMENTS:
1. …
DO NOT:
- Implement future tasks. · Refactor unrelated code. · Add unnecessary dependencies.
ACCEPTANCE CRITERIA:
- …
BEFORE FINISHING: run typecheck + lint + relevant tests.
REPORT: 1) files changed 2) what was implemented 3) tests 4) unresolved issues 5) next task.
```

### Definition of Done

Requirements implemented · TypeScript passes · lint passes · relevant tests pass ·
loading/error states present · shared UI components used · no duplicate utils ·
docs updated when a contract changes · hardware paths tested with real hardware before
release.

---

## 12. Conventions & Gotchas

- TypeScript strict everywhere; share types through `packages/types`.
- Use the shared `packages/ui` components and the Tailwind design tokens — no arbitrary
  colors/spacings in components.
- **Renderer must never touch hardware directly.** Camera is always the Electron main
  process service over IPC; preload exposes `window.electronAPI.camera`, typed in
  `renderer/src/global.d.ts`.
- gphoto2 on Windows needs `IOLIBS`/`CAMLIBS` env (auto-derived in `spawnEnv()` when the
  binary is at `<root>\mingw64\bin\gphoto2.exe`); the MSYS2 relocation gotcha is
  documented inside `GphotoCameraService.ts`.
- Don't re-add EDSDK or OBS as dependencies without an explicit user request — both were
  explicitly removed from the architecture after evaluation.

---

## 13. Roadmap Principles (retained from the original PRD)

- **The first milestone is not a working camera — it is a complete, polished, interactive
  customer UI**; then each mock service is replaced with the real implementation.
- Offline-first: no Internet dependency for session start→print; cloud only for upload,
  customer download, monitoring, config, analytics.
- Console/local flow must keep working when the cloud is down.