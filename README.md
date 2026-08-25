# Self Photo Booth System

> MVP source of truth for a self-service photo booth platform.
>
> Goal: launch a reliable first production version in **1 month** with an **AI-assisted, agent-by-agent development workflow**.

---

# 1. Product Vision

Build a self-service photo booth that lets customers complete a photo session with minimal staff assistance.

The first MVP prioritizes the **customer-facing booth experience and static UI** before hardware and cloud implementation.

The long-term booth experience is:

```text
MANUAL PAYMENT
      ↓
TUTORIAL + START SCREEN
      ↓
SELECT LAYOUT
      ↓
SELECT FRAME
      ↓
START
      ↓
PHOTO 1
      ↓
PHOTO 1 REVIEW
      ├── USE PHOTO
      └── RETAKE (maximum 3 attempts)
      ↓
PHOTO 2
      ↓
PHOTO 2 REVIEW
      ├── USE PHOTO
      └── RETAKE (maximum 3 attempts)
      ↓
PHOTO 3
      ↓
PHOTO 3 REVIEW
      ├── USE PHOTO
      └── RETAKE (maximum 3 attempts)
      ↓
FINAL PREVIEW
      ↓
PRINT + QR DOWNLOAD
      ↓
SESSION COMPLETE
```

The booth must remain **offline-first**. Camera capture, processing, printing, and local storage must not depend on the Internet.

Cloud services are used for digital delivery, synchronization, remote management, and future analytics.

---

# 2. Important Development Strategy Change

## 2.1 UI-first MVP development

The first implementation phase is **static booth UI only**.

Do **not** begin by integrating the camera, printer, database, cloud API, or payment system.

The purpose of the first UI phase is to make the complete customer experience visible and testable before hardware integration.

The UI should use realistic mock data and simulated transitions.

### Static UI phase should include

- Tutorial / Start screen
- Layout selection
- Frame selection
- Photo 1 capture screen
- Photo 1 review
- Retake flow
- Photo 2 capture screen
- Photo 2 review
- Photo 3 capture screen
- Photo 3 review
- Final preview
- Print + QR result screen
- Error state
- Loading state
- Session completion / return-to-home state

### Static UI phase should NOT include yet

- Real camera SDK
- Real printer
- Real payment terminal
- Real cloud upload
- Real QR generation
- PostgreSQL
- Redis
- R2
- Clerk
- Remote monitoring

The UI must be designed so these real services can replace mocks later without redesigning the customer flow.

---

# 3. MVP Principles

### 3.1 UI first

Finish and validate the customer journey visually before implementing hardware.

### 3.2 Local-first

The physical booth must continue operating when Internet access is unavailable.

### 3.3 Simple over clever

Prefer the smallest architecture that can reliably support the first production booth.

### 3.4 Hardware isolation

Camera and printer integrations must be isolated behind adapters/services. React must never directly control hardware.

### 3.5 AI-agent friendly

Every development task should be small, independently testable, and easy to hand from one AI agent to another.

### 3.6 Production reliability before feature count

A stable capture → process → print → QR flow is more important than advanced AI features or a large admin dashboard.

---

# 4. Final Technology Stack

## 4.1 Booth

| Layer | Technology | Purpose |
|---|---|---|
| OS | Windows 11 Pro | Booth operating system |
| Desktop app | Electron | Desktop shell, kiosk mode, hardware-friendly runtime |
| Frontend | React + TypeScript + Vite | Booth UI |
| Styling | Tailwind CSS | Utility-first styling |
| UI components | shadcn/ui | Reusable UI components |
| Design tokens | Tailwind CSS variables/tokens | Centralized visual system |
| State | Zustand | Lightweight client state |
| Local backend | Node.js + Fastify | Booth controller/API |
| Database | SQLite + Prisma | Local persistence |
| Image processing | Sharp | Resize, crop, compose, transform |
| Video processing | FFmpeg | GIF/live-photo/video generation |
| Logging | Pino | Structured application logging |
| Hardware | Adapter interfaces | Camera/printer abstraction |
| Printing | Dedicated print service | Print queue/retry/status |
| Packaging | electron-builder | Windows packaging |
| Updates | electron-updater | Automatic application updates |

## 4.2 Cloud

| Layer | Technology | Purpose |
|---|---|---|
| Admin frontend | Next.js | Admin dashboard |
| Customer gallery | Next.js | QR-based photo delivery |
| API | NestJS + Fastify | Backend API |
| Database | PostgreSQL | Cloud metadata/application state |
| Object storage | Cloudflare R2 | Photo storage |
| Queue | Redis + BullMQ | Background jobs |
| Realtime | Socket.IO | Booth/device status and realtime events |
| Authentication | Clerk | Admin/operator authentication |
| Deployment | Docker Compose | Simple production deployment |
| Infrastructure | Cloudflare + single VPS | MVP infrastructure |

## 4.3 Development

| Area | Choice |
|---|---|
| Package manager | pnpm |
| Repository | Monorepo |
| Language | TypeScript |
| Source control | Git + GitHub |
| AI development | Small, independent coding-agent tasks |
| Documentation | Markdown |
| Testing | Unit + integration + critical E2E tests |

### Intentionally excluded from MVP

- Kubernetes
- Microservice architecture
- Native C++ service unless a device specifically requires it
- Custom authentication system
- AI image generation
- Face replacement
- AR filters
- Mobile app
- Customer accounts
- Loyalty system
- Automated payment processing
- Booking platform

---


# 5. Physical Device Setup (MVP)

The first MVP will be built and tested against the following physical equipment.

| Device | Model | Connection | Role | MVP Requirement |
|---|---|---|---|---|
| Printer | **Canon SELPHY CP1000** | **USB cable** | Physical photo printer | **Wajib kabel; no Wi-Fi dependency** |
| Camera | **Canon EOS 600 / EOS 600D if this is the intended model** | **USB tethered** | Photo capture | Wired capture to booth PC |
| Main computer | **Acer Nitro 5** | USB / power | Booth application + camera + printer controller | **Primary booth computer** |
| Optional tablet/display | **Huawei MatePad 11 (2020)** | Network / external setup as applicable | Optional secondary display/control/testing device | Not required for core Electron runtime |
| Power supply | **Taffware 220V, 69,800 mAh** | AC power | Power backup / portable power source | Must be tested against the booth's total load |

### Hardware architecture

```text
                    ┌────────────────────────┐
                    │ Taffware 220V Power    │
                    │ 69,800 mAh             │
                    └───────────┬────────────┘
                                │ AC Power
                                ▼
              ┌─────────────────────────────────┐
              │          BOOTH SETUP            │
              │                                 │
              │  ┌───────────────────────────┐  │
              │  │ Acer Nitro 5               │  │
              │  │ Windows 11 + Electron      │  │
              │  └───────┬───────────┬───────┘  │
              │          │ USB       │ USB       │
              │          ▼           ▼           │
              │  ┌────────────┐ ┌────────────┐  │
              │  │ Canon EOS  │ │ SELPHY     │  │
              │  │ 600/600D   │ │ CP1000     │  │
              │  │ Camera     │ │ Printer    │  │
              │  └────────────┘ └────────────┘  │
              │                                 │
              │  Huawei MatePad 11 (2020)       │
              │  Optional / secondary device   │
              └─────────────────────────────────┘
```

### Hardware rules

1. **Printer must use a physical cable.** Wi-Fi is not part of the printer MVP path.
2. **Camera uses wired/tethered capture** to the booth computer.
3. **Acer Nitro 5 is the primary compute device** for the MVP because the booth software is based on Windows + Electron.
4. **Huawei MatePad 11 (2020) is optional** and should not become a dependency for the booth's core operation.
5. The booth must be able to complete the core session without Internet connectivity.
6. Power behavior must be tested with the actual camera, laptop, printer, screen, and accessories connected.
7. USB disconnect/reconnect must be treated as a normal hardware failure case and handled by the device services.

### Camera model note

The device list says **Canon EOS 600**. For the software implementation, the exact camera model must be verified before building the real camera adapter. If the intended camera is **Canon EOS 600D (Rebel T3i)**, Canon documents it as the EOS 600D/T3i, and Canon provides EOS software/support for this model. Wired USB tethering is therefore the expected integration path. citeturn777158search7turn777158search3

Do not assume compatibility with the literal film-era **EOS 600** model. The codebase should initially use a mock camera adapter until the exact physical camera model is confirmed.

### Physical hardware integration order

Do not integrate all hardware at once. Use this order:

```text
1. Static UI / mock capture
       ↓
2. Camera USB connection
       ↓
3. Real photo capture
       ↓
4. Local photo storage
       ↓
5. Image processing
       ↓
6. Printer USB connection
       ↓
7. Real printing
       ↓
8. Full end-to-end booth test
```

---

# 6. High-Level Architecture

```text
                           INTERNET
                              │
                  ┌───────────▼───────────┐
                  │       CLOUDFLARE      │
                  │                       │
                  │ DNS / CDN / R2        │
                  └───────────┬───────────┘
                              │ HTTPS
                              ▼
                 ┌────────────────────────┐
                 │          VPS           │
                 │                        │
                 │ Docker Compose         │
                 │                        │
                 │ ┌────────────────────┐ │
                 │ │ Next.js            │ │
                 │ │ Admin + Gallery    │ │
                 │ └──────────┬─────────┘ │
                 │            │           │
                 │ ┌──────────▼─────────┐ │
                 │ │ NestJS API         │ │
                 │ │ Fastify             │ │
                 │ └────┬────────┬──────┘ │
                 │      │        │        │
                 │ PostgreSQL   Redis      │
                 │      │        │        │
                 └──────┼────────┼────────┘
                        │        │
                        │        └── BullMQ
                        │
              ┌─────────▼────────────────┐
              │       PHOTO BOOTH        │
              │                          │
              │ Windows 11               │
              │                          │
              │ Electron                 │
              │ ├── React                │
              │ ├── Zustand              │
              │ └── Shared UI            │
              │                          │
              │ Local Controller         │
              │ ├── Fastify              │
              │ ├── SQLite + Prisma      │
              │ ├── Camera Service       │
              │ ├── Processing Service   │
              │ ├── Print Service        │
              │ └── Sync Service         │
              │                          │
              │ Local SSD                │
              └──────────┬───────────────┘
                         │
                ┌────────┼────────┐
                ▼        ▼        ▼
             Camera   Printer    USB
```

---

# 7. Booth Application Architecture

```text
React Renderer
      │
      │ IPC
      ▼
Electron Main Process
      │
      ▼
Local Fastify Controller
      │
      ├── Session Manager
      ├── Camera Service
      ├── Processing Service
      ├── Print Service
      ├── Storage Service
      ├── Sync Service
      └── Device Health Service
```

## Responsibilities

### React Renderer

Responsible for:

- UI rendering
- User interaction
- Screen navigation
- Presentation state
- Calling approved application commands
- Mocking service responses during UI-first development

Not responsible for:

- Direct hardware access
- Database access
- Direct printing
- Direct cloud storage access
- Filesystem orchestration

### Electron Main Process

Responsible for:

- Window lifecycle
- Kiosk mode
- Secure IPC bridge
- Application lifecycle
- Native integrations that belong to Electron

### Local Fastify Controller

Responsible for:

- Session orchestration
- Hardware commands
- Local storage
- Processing jobs
- Print jobs
- Sync jobs
- Device health

---

# 8. Customer Flow — MVP

The customer flow is the most important product requirement.

## 7.1 Full flow

```text
MANUAL PAYMENT
      ↓
TUTORIAL AND START SCREEN
      ↓
SELECT LAYOUT
      ↓
SELECT FRAME
      ↓
START
      ↓
┌─────────────────────────┐
│ PHOTO 1                 │
│                         │
│ Countdown: 5 seconds    │
│          📸             │
│                         │
│ Attempt 1 / 3           │
└─────────────────────────┘
      ↓
[ USE PHOTO ]  [ RETAKE ]
      │               │
      │               └──→ Attempt 2 / 3
      │                         ↓
      │                    [ USE PHOTO ] [ RETAKE ]
      │                                      │
      │                                      └──→ Attempt 3 / 3
      ↓
PHOTO 1 CONFIRMED
      ↓
PHOTO 2
      ↓
PHOTO 2 REVIEW
      ↓
PHOTO 2 CONFIRMED
      ↓
PHOTO 3
      ↓
PHOTO 3 REVIEW
      ↓
PHOTO 3 CONFIRMED
      ↓
FINAL PREVIEW
      ↓
PRINT + QR DOWNLOAD
      ↓
SESSION COMPLETE
```

## 7.2 Attempt rules

Each required photo slot has a maximum of **3 capture attempts**.

Example:

```text
Photo Slot 1
 ├── Attempt 1 → Use
 ├── Attempt 1 → Retake
 │      └── Attempt 2 → Use
 │      └── Attempt 2 → Retake
 │             └── Attempt 3 → Must use
```

The UI must clearly show:

- Current photo number
- Current attempt number
- Countdown
- Primary action: `USE PHOTO`
- Secondary action: `RETAKE`
- Maximum attempts remaining

When the third attempt has been taken, the customer cannot request a fourth attempt for that photo slot.

---

# 9. Booth UI Screen Map

The first implementation phase is static UI.

```text
SCREEN-01  MANUAL PAYMENT
      ↓
SCREEN-02  TUTORIAL / START
      ↓
SCREEN-03  SELECT LAYOUT
      ↓
SCREEN-04  SELECT FRAME
      ↓
SCREEN-05  READY / START
      ↓
SCREEN-06  PHOTO CAPTURE
      ↓
SCREEN-07  PHOTO REVIEW
      ├── USE
      └── RETAKE
             ↓
        SCREEN-06
      ↓
PHOTO CONFIRMED
      ↓
NEXT PHOTO
      ↓
SCREEN-06
      ↓
SCREEN-07
      ↓
...
      ↓
SCREEN-08  FINAL PREVIEW
      ↓
SCREEN-09  PRINT + QR
      ↓
SCREEN-10  COMPLETE
      ↓
SCREEN-02
```

## Required UI states

Every important screen should have:

```text
DEFAULT
LOADING
DISABLED
ERROR
SUCCESS
EMPTY (when applicable)
```

---

# 10. Static UI Development Rules

## 9.1 No real backend dependency

During the static UI phase, use local mock data and mock services.

Example:

```text
MockSessionService
MockCameraService
MockPrinterService
MockPaymentService
```

These interfaces must mirror the future real services.

## 9.2 Static UI must be interactive

"Static" means **no real hardware/cloud integration**, not an image-only mockup.

The customer must be able to click/touch through the entire flow.

Example:

```text
Start
  ↓
Select Layout
  ↓
Select Frame
  ↓
Start
  ↓
Countdown simulation
  ↓
Mock photo
  ↓
Use / Retake
  ↓
Next photo
  ↓
Final preview
  ↓
Mock print + QR screen
```

## 9.3 Use realistic placeholder assets

The UI should use realistic placeholder photos, frames, layout previews, and QR placeholders so spacing can be validated before real hardware is added.

---

# 11. Customer UI Design System

The booth UI should feel like a **premium consumer photo product**, not enterprise software.

## Design goals

- Minimal
- Large touch targets
- Strong visual hierarchy
- Photography-focused
- Very little text
- One primary action per screen
- Fast transitions
- Consistent animations
- Clear feedback

## Foundation tokens

Centralize the following:

```text
Colors
Typography
Font sizes
Font weights
Spacing
Border radius
Shadows
Motion duration
Motion easing
Z-index
Breakpoints
```

No new arbitrary colors, spacing values, or font sizes should be introduced inside individual components without a design-token reason.

## Shared primitives

```text
Button
IconButton
Card
Dialog
Drawer
Input
Select
Checkbox
Switch
Tabs
Badge
Toast
Alert
Progress
Spinner
Skeleton
Dropdown
Tooltip
```

## Booth-specific components

```text
PaymentStatus
TutorialCard
StartButton
LayoutCard
LayoutGrid
FrameCard
FrameGrid
CameraPreview
CountdownOverlay
CaptureButton
PhotoSlot
PhotoAttemptIndicator
PhotoReview
UsePhotoButton
RetakeButton
SessionProgress
FinalPreview
PrintStatus
QRCodeDisplay
CompletionScreen
ErrorScreen
```

---

# 12. Static UI Screen Requirements

## 11.1 Manual Payment

Purpose: represent the physical/manual payment step before a customer can start.

MVP behavior:

- Show payment instruction/status.
- Provide operator/customer action to mark payment as complete.
- Move to Tutorial / Start after payment is confirmed.
- Use mock payment state during static development.

No payment gateway integration in the UI-first phase.

---

## 11.2 Tutorial and Start Screen

Purpose: introduce the experience and let the customer begin.

Requirements:

- Very clear instruction.
- Large `START` button.
- Minimal text.
- Optional short tutorial animation.
- Easy return/timeout path.

---

## 11.3 Select Layout

Purpose: choose the photo arrangement/output format.

Requirements:

- Show layout cards with visual previews.
- Clearly indicate selected layout.
- Show number of photo slots.
- Continue button remains disabled until a layout is selected.

Example:

```text
┌──────────┐  ┌──────────┐  ┌──────────┐
│          │  │    ──    │  │  ┌────┐  │
│  1 PHOTO │  │  2 PHOTO │  │  │    │  │
│          │  │    ──    │  │  └────┘  │
└──────────┘  └──────────┘  └──────────┘
```

---

## 11.4 Select Frame

Purpose: choose visual frame/theme.

Requirements:

- Show frame previews.
- Clearly indicate selected frame.
- Maintain consistent card sizing.
- Continue only after selection.

---

## 11.5 Ready / Start

Purpose: final confirmation before camera session begins.

Requirements:

- Show selected layout.
- Show selected frame.
- Large `START` button.
- Transition into Photo 1.

---

## 11.6 Photo Capture

Reference layout:

```text
┌────────────────────────────────────┐
│ PHOTO 1                            │
│                                    │
│         CAMERA PREVIEW             │
│                                    │
│                                    │
│             5                      │
│          📸                        │
│                                    │
│        Attempt 1 / 3               │
│                                    │
└────────────────────────────────────┘
```

Requirements:

- Large live-preview area.
- Countdown prominently visible.
- Current photo number.
- Current attempt number.
- Capture indicator/animation.
- No unnecessary controls.

Static phase: countdown and capture are simulated.

---

## 11.7 Photo Review

Reference:

```text
┌────────────────────────────────────┐
│ PHOTO 1                            │
│                                    │
│        [ CAPTURED PHOTO ]          │
│                                    │
│   Attempt 1 / 3                    │
│                                    │
│ [ RETAKE ]          [ USE PHOTO ] │
└────────────────────────────────────┘
```

Requirements:

- Show captured photo clearly.
- Show attempt number.
- `USE PHOTO` is primary.
- `RETAKE` is secondary.
- Retake returns to capture screen.
- Attempt counter increments correctly.
- After 3 attempts, disable further retakes.

---

## 11.8 Final Preview

Purpose: show the finished customer output before printing.

Requirements:

- Show final framed output.
- Show all selected photos as part of the composition.
- Clearly indicate that this is the final result.
- Continue to Print + QR.

---

## 11.9 Print + QR Download

Purpose: communicate the final delivery state.

Requirements:

- Print status.
- QR code placeholder in static mode.
- Clear download instruction.
- Show final completion state.

Later hardware/cloud implementation will replace the placeholders.

---

## 11.10 Completion

Requirements:

- Confirm success.
- Show simple thank-you message.
- Return to Tutorial / Start or attract screen after a timeout.
- Clear session state before starting the next customer session.

---

# 13. Core Session State Machine

The state machine now reflects the actual customer journey.

```text
IDLE
  ↓
PAYMENT_PENDING
  ↓
TUTORIAL
  ↓
SELECT_LAYOUT
  ↓
SELECT_FRAME
  ↓
READY
  ↓
PHOTO_CAPTURE
  ↓
PHOTO_REVIEW
  ├── RETAKE
  │      ↓
  │ PHOTO_CAPTURE
  │
  └── USE_PHOTO
         ↓
PHOTO_CONFIRMED
         ↓
NEXT_PHOTO
         ↓
PHOTO_CAPTURE
         ...
         ↓
ALL_PHOTOS_CONFIRMED
         ↓
FINAL_PREVIEW
         ↓
PRINTING
         ↓
QR_READY
         ↓
COMPLETE
         ↓
IDLE
```

## Session state data

Conceptually:

```ts
interface PhotoAttempt {
  attemptNumber: number;
  localPath?: string;
  status: "CAPTURED" | "SELECTED" | "RETAKEN";
}

interface PhotoSlotState {
  slotNumber: number;
  maxAttempts: 3;
  attempts: PhotoAttempt[];
  selectedAttempt?: number;
}

interface BoothSessionState {
  sessionId: string;
  layoutId?: string;
  frameId?: string;
  currentPhotoSlot: number;
  photoSlots: PhotoSlotState[];
  status: string;
}
```

The exact implementation should be centralized in the shared types and validation packages.

---

# 14. Customer Output

A completed session produces:

```text
                 CUSTOMER
                    │
                    ▼
             ┌─────────────┐
             │ 3 PHOTOS    │
             └─────────────┘
                    │
          ┌─────────┴─────────┐
          ▼                   ▼
    Individual photos       Final framed output
          │                   │
          │              ┌────▼────┐
          │              │ 1 GIF   │
          │              └─────────┘
          │
          └───────────────┐
                          ▼
                  3 LIVE PHOTOS
```

## MVP output set

For the planned 3-photo experience:

```text
photo-1.jpg
photo-2.jpg
photo-3.jpg
final.gif
live-1
live-2
live-3
```

The exact technical file format for the 3 live-photo outputs should be finalized during implementation based on the intended mobile compatibility and generation pipeline.

### Output rule

The customer's selected/confirmed photos—not every rejected attempt—are the final customer outputs.

Temporary retake attempts may remain locally until the session is finalized and any cleanup policy is applied.

---

# 15. Storage Flow

```text
CAMERA
   │
   │ USB / tethered capture
   ▼
BOOTH PC
   │
   ├── Temporary capture
   │     ├── attempt 1
   │     ├── attempt 2
   │     └── attempt 3
   │
   ▼
Customer chooses best photos
   │
   ▼
Generate final outputs
   │
   ├── photo-1.jpg
   ├── photo-2.jpg
   ├── photo-3.jpg
   ├── final.gif
   ├── live-1
   ├── live-2
   └── live-3
   │
   ▼
UPLOAD
   │
   ▼
CLOUDFLARE R2
   │
   ▼
QR DOWNLOAD
```

## 14.1 Local storage responsibilities

The booth PC temporarily stores:

- Capture attempts
- Selected photos
- Generated final outputs
- Print-ready files
- Upload queue state
- Session metadata

## 14.2 Cloud storage responsibilities

Cloudflare R2 stores final digital assets intended for customer download.

The default MVP strategy is:

```text
Temporary capture attempts
→ local only

Selected/final customer outputs
→ local
→ upload to R2
```

Rejected attempts should not be uploaded to R2 unless a future product requirement explicitly requires them.

---

# 16. Storage Lifecycle

```text
CAPTURE ATTEMPT
      ↓
LOCAL TEMPORARY FILE
      ↓
CUSTOMER SELECTS PHOTO
      ↓
MARK SELECTED
      ↓
GENERATE FINAL OUTPUTS
      ↓
SAVE LOCALLY
      ↓
PRINT
      ↓
QUEUE UPLOAD
      ↓
R2 UPLOAD
      ↓
QR DOWNLOAD AVAILABLE
      ↓
LOCAL CLEANUP POLICY
```

Local cleanup must never delete a session that has not been safely synchronized unless an explicit retention/recovery rule allows it.

---

# 17. Camera Architecture

Camera access must use an adapter abstraction.

```ts
interface CameraAdapter {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  getStatus(): Promise<CameraStatus>;
  startPreview(): Promise<void>;
  stopPreview(): Promise<void>;
  capture(): Promise<CapturedPhoto>;
}
```

Potential implementations:

```text
CameraAdapter
├── CanonCameraAdapter
├── SonyCameraAdapter
├── NikonCameraAdapter
└── WebcamAdapter
```

The MVP only needs to support **one production camera model** initially.

---

# 18. Image / Motion Output Architecture

## Still images

```text
Selected capture
      ↓
Crop / resize
      ↓
Frame composition
      ↓
Final digital image
      ↓
Print image
```

## GIF

```text
Selected photo sequence / motion frames
      ↓
Frame preparation
      ↓
FFmpeg/GIF pipeline
      ↓
final.gif
```

## Live photos

The exact live-photo implementation is intentionally deferred until the UI and core capture pipeline are stable.

The implementation must define a concrete mobile-compatible output format before production use.

---

# 19. Printing Architecture

Printing is a separate service with a queue.

```text
Final Output Ready
    ↓
Create Print Job
    ↓
Print Queue
    ↓
Printer Service
    ↓
Printer
    ↓
Success / Retry / Error
```

The system must handle:

- Printer disconnected
- Printer unavailable
- Paper out
- Print failure
- Duplicate print prevention
- Retry
- Job status

---

# 20. QR / Digital Gallery

Each completed session receives a secure public session identifier/token.

Example:

```text
https://yourdomain.com/p/{secure-session-token}
```

The QR code points to the application URL, not directly to an R2 object URL.

Benefits:

- Links can expire.
- Access can be revoked.
- Storage provider can change later.
- Multiple outputs can be shown.
- Download analytics can be added later.

---

# 21. Cloud Backend

Suggested initial NestJS modules:

```text
src/
├── auth/
├── users/
├── booths/
├── sessions/
├── photos/
├── templates/
├── uploads/
├── devices/
├── print-jobs/
├── analytics/
├── realtime/
└── health/
```

API responsibilities:

- Authentication/authorization
- Booth registration
- Booth heartbeat
- Session synchronization
- Photo metadata
- Signed/download URLs
- Template management
- Device status
- Realtime events
- Admin operations

---

# 22. Realtime Architecture

Use Socket.IO.

Primary use cases:

```text
Booth → Cloud
├── connected
├── heartbeat
├── session started
├── print status
├── sync status
└── error status

Cloud → Booth
├── configuration update
├── template update
└── future remote command
```

The booth must continue operating if Socket.IO is disconnected.

Realtime is a convenience layer, not a dependency for local capture.

---

# 23. Offline-First Requirements

## Internet NOT required for

| Feature | Offline |
|---|---:|
| Start session | Yes |
| Tutorial | Yes |
| Select layout | Yes |
| Select frame | Yes |
| Camera preview | Yes |
| Countdown | Yes |
| Capture photos | Yes |
| Review/retake | Yes |
| Image processing | Yes |
| Print | Yes |
| Save session | Yes |
| Generate local session identifier | Yes |

## Internet required for

| Feature | Internet |
|---|---:|
| Upload final photos | Yes |
| Customer cloud download | Yes |
| Remote monitoring | Yes |
| Cloud analytics | Yes |
| Remote configuration | Yes |

### Sync strategy

```text
Session completed
      ↓
Stored in SQLite
      ↓
Final files stored locally
      ↓
Upload job created
      ↓
Sync queue
      ↓
Internet available?
   ┌────┴────┐
   │         │
  NO        YES
   │         │
 Retry     Upload
   │         │
   └────┬────┘
        ▼
     SUCCESS
```

Cloud failure must never prevent the customer from completing the local photo experience.

---

# 24. Database Model

## Local SQLite entities

Initial tables:

```text
sessions
photos
photo_attempts
templates
print_jobs
upload_jobs
settings
device_status
events
```

## Cloud PostgreSQL entities

Initial entities:

```text
users
organizations
booths
booth_heartbeats
sessions
photos
templates
print_jobs
upload_jobs
audit_logs
```

Rejected temporary attempts may be represented in local SQLite for recovery/cleanup but do not need to become permanent cloud records for MVP.

---

# 25. Authentication

Use Clerk for MVP authentication.

Initial roles:

```text
ADMIN
OPERATOR
```

Do not implement custom password authentication for MVP.

---

# 26. Admin Dashboard MVP

The dashboard should focus on operational management.

### Pages

```text
Dashboard
Booths
Sessions
Photos
Templates
Settings
Activity / Logs
```

### Dashboard information

- Booth online/offline status
- Last heartbeat
- Today's sessions
- Successful prints
- Upload failures
- Storage status
- Recent errors

### Booth detail

- Device name
- Online/offline
- App version
- Camera status
- Printer status
- Disk space
- Last sync
- Last error

---

# 27. UI Design System

Use one shared design system where practical, but the booth should prioritize touch interaction and visual simplicity.

## Foundation

```text
Colors
Typography
Spacing
Radius
Shadows
Motion
Z-index
Breakpoints
```

## Booth-specific layout rules

- Minimum touch-target size should be generous.
- Primary actions should be visually dominant.
- Secondary actions should never compete with the main CTA.
- Do not overload the screen with settings.
- Use full-screen compositions where useful.
- Keep customer-facing copy short.
- Keep progress visible throughout multi-photo sessions.

---

# 28. Suggested Monorepo Structure

```text
photo-booth/
│
├── apps/
│   ├── booth/
│   │   ├── electron/
│   │   └── renderer/
│   │
│   ├── admin/
│   │   └── nextjs/
│   │
│   └── api/
│       └── nestjs/
│
├── packages/
│   ├── ui/
│   ├── types/
│   ├── database/
│   ├── validation/
│   ├── config/
│   └── eslint-config/
│
├── docs/
│   ├── PRD.md
│   ├── ARCHITECTURE.md
│   ├── API.md
│   ├── DATABASE.md
│   ├── DESIGN-SYSTEM.md
│   ├── TASKS.md
│   └── AI-TASK-TEMPLATE.md
│
├── AGENTS.md
├── package.json
├── pnpm-workspace.yaml
└── docker-compose.yml
```

---

# 29. AI-Agent Development Strategy

The project is intentionally designed for **small, independent AI-agent tasks**.

## Core rule

> One agent task = one independently testable outcome.

Do not ask an agent to "build the booth" or "continue building the whole application."

Instead:

```text
TASK-001
Create monorepo

TASK-002
Configure TypeScript

TASK-003
Create Electron shell

TASK-004
Create booth UI shell

TASK-005
Create layout selection screen

TASK-006
Create frame selection screen

...
```

An agent may be replaced by another agent at any time.

The repository is the source of truth, not the previous agent's conversation.

---

# 30. Agent Handoff Rules

Every agent should:

1. Read `README.md`.
2. Read `AGENTS.md`.
3. Read the specific task.
4. Inspect the current repository state.
5. Implement only the assigned task.
6. Run typecheck.
7. Run lint.
8. Run relevant tests.
9. Report files changed.
10. Report unresolved issues.
11. Update task status.
12. Do not implement unrelated future tasks.

Recommended commit style:

```text
feat(booth): create static tutorial screen
feat(booth): add layout selection UI
feat(booth): add frame selection UI
feat(booth): add photo review flow
```

---

# 31. Initial Task Slicing — UI FIRST

This is now the first development roadmap.

## Phase 0 — Repository foundation

```text
TASK-001  Initialize pnpm monorepo
TASK-002  Configure TypeScript strict mode
TASK-003  Configure ESLint and Prettier
TASK-004  Create Electron application shell
TASK-005  Create React + Vite renderer
TASK-006  Create secure Electron preload / contextBridge
TASK-007  Configure Tailwind CSS
TASK-008  Configure shadcn/ui
TASK-009  Create shared design tokens
TASK-010  Create shared UI package
TASK-011  Create shared types package
TASK-012  Create basic Zustand store
```

## Phase 1 — Static customer UI

This is the **highest-priority implementation phase**.

```text
TASK-013  Create booth app shell and screen router
TASK-014  Create mock session data
TASK-015  Create manual payment screen
TASK-016  Create tutorial / start screen
TASK-017  Create layout selection screen
TASK-018  Create frame selection screen
TASK-019  Create ready / start screen
TASK-020  Create photo capture screen
TASK-021  Create countdown component
TASK-022  Create photo review screen
TASK-023  Create use-photo / retake interaction
TASK-024  Implement 3-attempt rule
TASK-025  Implement photo 1 flow
TASK-026  Implement photo 2 flow
TASK-027  Implement photo 3 flow
TASK-028  Create session progress UI
TASK-029  Create final preview screen
TASK-030  Create print + QR screen
TASK-031  Create completion screen
TASK-032  Create loading states
TASK-033  Create error states
TASK-034  Create session timeout/reset flow
TASK-035  Add realistic placeholder assets
TASK-036  Add booth touch UX polish
```

### Phase 1 exit criteria

A developer can run the booth application on a PC and complete:

```text
Manual payment
→ Tutorial
→ Layout
→ Frame
→ Start
→ Photo 1
→ Retake/use
→ Photo 2
→ Retake/use
→ Photo 3
→ Retake/use
→ Final preview
→ Print + QR mock result
→ Complete
→ Reset
```

No real hardware is required for this milestone.

---

# 32. Phase 2 — Convert Static UI to Real Session State

Once the UI is stable:

```text
TASK-037  Define final session state machine
TASK-038  Define photo slot data model
TASK-039  Implement session store actions
TASK-040  Implement photo attempt state
TASK-041  Connect screen flow to centralized state
TASK-042  Add validation for invalid transitions
TASK-043  Add session-level unit tests
```

Goal:

The UI is no longer just screen navigation; it is driven by a real deterministic local session state model.

---

# 33. Phase 3 — Camera

Only after the UI flow is stable:

```text
TASK-044  Create CameraAdapter interface
TASK-045  Create MockCameraAdapter
TASK-046  Create CameraService
TASK-047  Connect CameraService to local Fastify
TASK-048  Connect live preview to UI
TASK-049  Connect capture action
TASK-050  Save captured attempts locally
TASK-051  Integrate production camera model
TASK-052  Handle camera disconnect/reconnect
```

---

# 34. Phase 4 — Image Processing and Outputs

```text
TASK-053  Create ImageProcessor interface
TASK-054  Implement Sharp resize/crop
TASK-055  Implement frame composition
TASK-056  Implement layout renderer
TASK-057  Generate final photo outputs
TASK-058  Generate print-ready output
TASK-059  Create GIF pipeline
TASK-060  Define live-photo output format
TASK-061  Implement live-photo generation
```

---

# 35. Phase 5 — Printing

```text
TASK-062  Create PrinterAdapter interface
TASK-063  Create MockPrinterAdapter
TASK-064  Create PrintService
TASK-065  Create print queue
TASK-066  Add print retry/error handling
TASK-067  Add printer status UI
TASK-068  Integrate production printer
```

---

# 36. Phase 6 — Local Persistence and Recovery

```text
TASK-069  Configure Prisma SQLite schema
TASK-070  Add session persistence
TASK-071  Add photo metadata persistence
TASK-072  Add photo attempt persistence
TASK-073  Add upload job persistence
TASK-074  Implement recovery after application restart
TASK-075  Implement local cleanup policy
```

---

# 37. Phase 7 — Cloud and Digital Delivery

```text
TASK-076  Create NestJS API foundation
TASK-077  Create PostgreSQL schema
TASK-078  Create booth registration
TASK-079  Create session sync API
TASK-080  Create R2 storage service
TASK-081  Create upload queue
TASK-082  Implement retryable upload
TASK-083  Create customer gallery
TASK-084  Generate QR code
TASK-085  Connect QR screen to real session URL
```

---

# 38. Phase 8 — Authentication and Admin

```text
TASK-086  Configure Clerk
TASK-087  Add API authentication
TASK-088  Add admin login
TASK-089  Create admin shell
TASK-090  Create booth list
TASK-091  Create booth status
TASK-092  Create session list
TASK-093  Create session detail
TASK-094  Create template management
```

---

# 39. Phase 9 — Realtime and Monitoring

```text
TASK-095  Create Socket.IO server
TASK-096  Add booth heartbeat
TASK-097  Add online/offline status
TASK-098  Add device health reporting
TASK-099  Add logging/monitoring
TASK-100  Add auto-update
```

Task numbering may expand; agents should not renumber completed tasks.

---

# 40. One-Month Roadmap — Updated

## Week 1 — Static Booth UI

### Main objective

Finish the customer experience as an interactive static prototype.

Tasks:

- Electron shell
- React/Vite
- Tailwind + shadcn/ui
- Design system
- Layout selection
- Frame selection
- Photo capture mock
- Retake/use flow
- 3-photo session
- Final preview
- Print + QR mock result
- Error/loading states
- Session reset

### Week 1 exit criteria

A customer can complete the entire flow using a mouse/touchscreen and no real hardware.

---

## Week 2 — Real Capture + Processing + Print

### Main objective

Replace mocks with physical workflow.

Tasks:

- Camera integration
- Capture attempts
- Local image storage
- Image processing
- Frame/layout composition
- GIF/live-photo generation
- Printer integration
- Print queue

### Week 2 exit criteria

A real customer can complete:

```text
Start
→ Select layout
→ Select frame
→ Capture 3 selected photos
→ Generate outputs
→ Print
```

---

## Week 3 — Cloud + QR

### Main objective

Add digital delivery and synchronization.

Tasks:

- PostgreSQL
- NestJS API
- R2
- Upload queue
- QR gallery
- Session synchronization
- Clerk
- Socket.IO
- Basic admin dashboard

### Week 3 exit criteria

```text
Complete session
→ Local save
→ Upload final outputs
→ Generate QR
→ Customer scans QR
→ Customer downloads outputs
```

---

## Week 4 — Reliability + Launch

### Main objective

Turn the prototype into a production-ready booth.

Tasks:

- Camera stress tests
- Printer stress tests
- Internet-offline tests
- Upload retry tests
- Restart recovery
- Disk-space tests
- Error handling
- Logging
- Monitoring
- Auto-update
- Installer
- Production deployment
- UX polish

### Week 4 exit criteria

A non-developer operator can run the booth for real customers.

---

# 41. Priority Order

When time is limited, prioritize in this order:

```text
P0  Static customer flow
P0  Camera capture
P0  3-attempt retake logic
P0  Image composition
P0  Printing
P0  Local persistence
P0  QR digital delivery
P0  Offline recovery

P1  Admin dashboard
P1  Booth monitoring
P1  Template management
P1  Auto-update

P2  GIF/live-photo improvements
P2  Analytics
P2  Advanced remote management

P3  AI effects
P3  Generative AI
P3  Payment automation
P3  Mobile application
```

---

# 42. Definition of Done

A feature is complete when:

- Requirements are implemented.
- TypeScript passes.
- Lint passes.
- Relevant tests pass.
- Loading states exist where needed.
- Error states exist where needed.
- Shared UI components are used.
- No duplicate utility/component was introduced unnecessarily.
- Documentation is updated when a contract changes.
- Hardware-related features are tested with the real hardware before release.

For static UI tasks, the feature is done when the screen is visually usable, interactive, responsive to the intended booth resolution, and connected to the mock flow.

---

# 43. Recommended AI-Agent Prompt Structure

Every agent task should use this pattern:

```text
Read README.md and AGENTS.md first.

TASK:
<one numbered task>

GOAL:
<one sentence>

CONTEXT:
<only information needed for this task>

REQUIREMENTS:
1. ...
2. ...
3. ...

DO NOT:
- Implement future tasks.
- Refactor unrelated code.
- Add unnecessary dependencies.

ACCEPTANCE CRITERIA:
- ...
- ...

BEFORE FINISHING:
- Run typecheck.
- Run lint.
- Run relevant tests.
- Inspect changed files.

REPORT:
1. Files changed.
2. What was implemented.
3. Tests executed.
4. Any unresolved issue.
5. Suggested next task.
```

This prompt format is intentionally small so free agents can complete tasks without exhausting their context unnecessarily.

---

# 44. Key Product Principle

> **The first milestone is not a working camera. The first milestone is a complete, polished, interactive customer UI that can be demonstrated from start to finish.**

After that UI is approved, replace each mock service with the corresponding real implementation:

```text
Mock Payment
    ↓
Manual payment confirmation

Mock Camera
    ↓
Real camera adapter

Mock Image Processor
    ↓
Sharp + FFmpeg

Mock Printer
    ↓
Real printer adapter

Mock QR
    ↓
R2 + customer gallery
```

This separation allows AI agents to work on small pieces and allows you to replace one agent with another without requiring the new agent to understand the entire product history.

---

# 45. Architecture Decision Summary

| Decision | Final choice | Reason |
|---|---|---|
| First development target | Static interactive booth UI | Fastest way to validate customer UX |
| Desktop | Electron | Hardware-friendly and familiar ecosystem |
| Frontend | React + TypeScript + Vite | Fast development and strong AI-agent support |
| UI | Tailwind + shadcn/ui | Maintainable reusable design system |
| State | Zustand | Minimal complexity |
| Local API | Fastify | Lightweight and fast |
| Local DB | SQLite + Prisma | Beginner-friendly and offline-first |
| Image | Sharp | Simple, capable image pipeline |
| Video/GIF | FFmpeg | Flexible media processing |
| Cloud API | NestJS + Fastify | Structured backend for API/realtime/jobs |
| Cloud DB | PostgreSQL | Reliable relational production DB |
| Storage | Cloudflare R2 | Cost-friendly photo object storage |
| Queue | Redis + BullMQ | Background jobs |
| Realtime | Socket.IO | Easier connection/reconnection behavior |
| Auth | Clerk | Avoid custom auth in MVP |
| Deployment | Docker Compose | Simple single-server deployment |
| Infrastructure | Cloudflare + one VPS | Enough for MVP |

---

# 46. Final MVP Definition

The MVP is considered complete when one physical booth can perform the following flow reliably:

```text
MANUAL PAYMENT
      ↓
TUTORIAL / START
      ↓
SELECT LAYOUT
      ↓
SELECT FRAME
      ↓
START
      ↓
PHOTO 1
  ├── attempt 1
  ├── attempt 2 (optional)
  └── attempt 3 (optional)
      ↓
PHOTO 1 CONFIRMED
      ↓
PHOTO 2
  ├── attempt 1
  ├── attempt 2 (optional)
  └── attempt 3 (optional)
      ↓
PHOTO 2 CONFIRMED
      ↓
PHOTO 3
  ├── attempt 1
  ├── attempt 2 (optional)
  └── attempt 3 (optional)
      ↓
PHOTO 3 CONFIRMED
      ↓
FINAL PREVIEW
      ↓
PRINT
      ↓
GENERATE / DISPLAY QR
      ↓
CUSTOMER DOWNLOAD
      ↓
SESSION COMPLETE
```

Final customer outputs:

```text
3 individual photos
1 framed GIF
3 live-photo outputs
```

Final digital storage flow:

```text
Camera
  ↓
Booth PC
  ↓
Temporary attempts
  ↓
Customer-selected photos
  ↓
Final output generation
  ↓
Local storage
  ↓
Upload queue
  ↓
Cloudflare R2
  ↓
Customer QR gallery
```

The entire architecture remains designed so that the **booth's core customer experience does not depend on the cloud**.

---

# 47. External References

- Electron: https://www.electronjs.org/
- React: https://react.dev/
- Next.js: https://nextjs.org/
- NestJS: https://nestjs.com/
- Fastify: https://fastify.dev/
- Prisma: https://www.prisma.io/
- Tailwind CSS: https://tailwindcss.com/
- shadcn/ui: https://ui.shadcn.com/
- Socket.IO: https://socket.io/
- Cloudflare R2: https://developers.cloudflare.com/r2/
