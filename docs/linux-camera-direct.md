# Linux: Camera Setup for the Photo Booth (OBS-free direct attach)

> Platform note: the booth runs on **Windows 11** in production. This document is the
> **Linux development/test** story. It is also the reference for the future "run the
> booth on Linux" path.

On Linux the booth can attach a webcam **directly into the app with no OBS**, no
virtual-camera software, and no extra broadcasts — two already-implemented paths:

| Path | Source | How it reaches the renderer | Needs |
|---|---|---|---|
| **A. Canon DSLR (600D) — direct** | gphoto2 Live View (`--stdout --capture-movie`) | Electron main → IPC `camera:liveview` frames | gphoto2, camera on PTP/USB, udev permission |
| **B. Generic UVC webcam — direct** | any USB/webcam device | `navigator.mediaDevices.getUserMedia` (renderer fallback) | nothing (kernel driver only) |

Both paths are OBS-free by design. The Electron/Chromium renderer consumes them
exactly as it does on Windows — no booth code changes are required for Linux.

---

## 1. Path A — Canon EOS 600D, direct into the app

This is the real booth flow. `GphotoCameraService` (Electron main) drives the
`gphoto2` CLI as a subprocess:

- **Live-view mirror:** `gphoto2 --stdout --capture-movie` streams concatenated MJPEG
  frames. The service splits on SOI markers (`0xFF D8`) and pushes frames over IPC
  (`camera:liveview`) to the renderer. Frames are **memory-only — never recorded**,
  and the shutter is never re-triggered to serve the preview.
- **Shutter:** `--set-config viewfinder=0` → `--capture-image-and-download` → the
  full-res JPEG is read, returned to the renderer as a data URL, and **persisted at
  full resolution** under the user's Pictures folder.

### 1.1 Packages (install once)

```bash
# Arch
sudo pacman -S gphoto2 ffmpeg v4l-utils
# Ubuntu / Debian
sudo apt install gphoto2 ffmpeg v4l-utils
```

(`ffmpeg` is only needed for the optional virtual-camera appendix and for debugging
the Live View pipe; the booth itself uses `gphoto2` only.)

### 1.2 udev permission so gphoto2 can open the camera as non-root

https://github.com/gphoto/libgphoto2 supported the 600D via libusb out of the box
on Linux — **no Zadig/libusbK driver dance is needed** (that is a Windows-only
requirement). But the camera must be accessible to your user:

```bash
sudo tee /etc/udev/rules.d/99-canon.rules > /dev/null <<'EOF'
# Canon EOS 600D / Rebel T3i — allow booth user to open over PTP/USB
SUBSYSTEM=="usb", ATTR{idVendor}=="04a9", MODE="0666", GROUP="users"
EOF
sudo udevadm control --reload
```

Replug the camera after reloading udev.

### 1.3 Verify the camera is reachable

```bash
gphoto2 --auto-detect
# Expected:
#   Camera model                          Port
#   Canon EOS 600D / Rebel T3i            usb:00a,00b
```

### 1.4 Run the booth

```bash
corepack pnpm --filter booth dev
```

Camera Settings screen:
- **Test Connection / Start Live View** — toggles Live View; frames appear over IPC.
- **Take Test Picture** — full-res shutter. The original is written to
  `~/Pictures/Photo Booth/photo-booth-<timestamp>.jpg` (per-user Pictures folder,
  auto-created), and the UI shows *"Saved to: …"*.

Photo Capture screen uses **Path A automatically** whenever `available && isLiveViewing
&& liveFrame`. Otherwise it falls back to **Path B** (`getUserMedia`) — so a plain
webcam also works without any Canon.

> 600D reminders: keep **Auto Power Off = Disable** (sleep kills Live View and PTP);
> HDMI out only works while Live View is active; the HDMI port is **mini-HDMI (Type-C)**.

---

## 2. Path B — generic UVC webcam, direct via getUserMedia

No OBS, no v4l2loopback, no ffmpeg. Chromium's `getUserMedia`
(`PhotoCaptureScreen.tsx`, fallback path) enumerates every `/dev/videoN` and renders
it directly. The laptop webcam, a USB webcam, or an HDMI→UVC capture card all work.

The booth requests `facingMode: 'user'`, `1280x720` — any capable UVC device is
satisfied by V4L2 automatically.

---

## 3. Optional appendix — v4l2loopback virtual camera (`canon600d-cam`)

**Dev/testing only.** A `v4l2loopback` device is a fake webcam that Chromium sees as
a real camera. Use it to exercise the **getUserMedia** path (Path B) with a synthetic
feed when you have no camera hardware, or to feed the 600D's Live View into *other*
applications.

> Why not for the booth itself? The booth's primary live view already arrives
> in-app over IPC (Path A) or via `getUserMedia` from a real UVC device (Path B).
> The virtual device only simulates a webcam for other software / hardware-less dev.

### 3.1 Install

```bash
# Arch
sudo pacman -S v4l2loopback-dkms linux-headers
# Ubuntu / Debian
sudo apt install v4l2loopback-dkms v4l2loopback-utils linux-headers-$(uname -r)
```

DKMS builds the module at install time — kernel headers are mandatory.

### 3.2 Load the module (create the fake camera)

```bash
sudo modprobe v4l2loopback \
  exclusive_caps=1 \
  devices=1 \
  max_buffers=6 \
  card_label="canon600d-cam" \
  video_nr=2
```

Notes on the options:
- `exclusive_caps=1` — required so Chromium enumerates it as a camera.
- `max_buffers=6` — **Chromium requests ≥4 buffers; `max_buffers=2` causes busy/EBUSY**
  and no video flow. (Your original snippet used 2.)
- If the module is already loaded: `sudo modprobe -r v4l2loopback` first (close any
  consumer), then re-run. Alternatively use `v4l2loopback-ctl`.

### 3.3 Verify

```bash
v4l2-ctl --list-devices
#   canon600d-cam (platform:v4l2loopback)
#       /dev/video2
```

### 3.4 Feed it

**Headless dummy pattern (no camera needed):**

```bash
ffmpeg -re -f lavfi -i testsrc2=size=1280x720:rate=30 \
  -vf format=yuv422p -f v4l2 -pix_fmt yuv422p /dev/video2
```

**Real 600D Live View → fake webcam (for other apps):**

```bash
gphoto2 --stdout --capture-movie | ffmpeg -re -i pipe:0 \
  -vf format=yuv422p -f v4l2 -pix_fmt yuv422p /dev/video2
```

Sanity check the feed: `ffplay /dev/video2`. Then open the booth or any browser —
the device appears as webcam `canon600d-cam`.

### 3.5 Persist across boots (optional)

```bash
# /etc/modules-load.d/v4l2loopback.conf
v4l2loopback

# /etc/modprobe.d/v4l2loopback.conf
options v4l2loopback exclusive_caps=1 devices=1 max_buffers=6 card_label="canon600d-cam" video_nr=2
```

### 3.6 Cleanup

```bash
# stop the ffmpeg feed first (Ctrl-C), then:
sudo modprobe -r v4l2loopback
# or just reboot
```

---

## 4. Troubleshooting (Linux)

| Symptom | Cause / fix |
|---|---|
| `gphoto2 --auto-detect` shows nothing | Camera off, USB cable, battery, or udev rule not applied — replug after `udevadm control --reload` |
| PTP commands time out ("Could not query kernel driver …") | **Camera-side, not driver.** Low battery / auto-power-off / camera state. Recharge, power-cycle, replug. (On Windows the active driver `libusbK` was proven correct; the failure was the camera refusing PTP.) |
| Live View starts then stops | 600D **Auto Power Off** — set to Disable in the camera menu |
| No HDMI signal | 600D outputs HDMI **only during Live View**; port is mini-HDMI (Type-C) |
| Fake cam shows in `v4l2-ctl` but not in Chromium | `exclusive_caps` not set; or `max_buffers` too low (use 6) |
| `ffplay /dev/videoN`: no frames | Feed process died — check it's still running; verify with `v4l2-ctl --list-formats-ext /dev/videoN` |