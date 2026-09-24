# Canon SELPHY CP1000 on Ubuntu — print setup

The booth's production device runs Ubuntu and prints through **CUPS**. Canon does
not publish a Linux driver for the CP1000, but the printer is fully supported by
the community **Gutenprint / `selphy_print`** stack. This document is the
enablement + verification runbook for that device. The Windows dev machine does
not need any of this — the app degrades gracefully there.

> Everything below runs on the **Ubuntu booth device**, not on the Windows
> development machine.

## 1. Why not driverless / IPP

The CP1000 is a dye-sublimation printer that advertises USB printer class but
does **not** obey it: it needs two-way handshaking. The `selphy_print` CUPS
backend (`canonselphyneo`) provides that over **libusb**. The CP1000 is in its
verified-supported list (alongside CP1200/CP1300).

Driverless `ipp-usb` / IPP-over-USB does **not** work for the CP1000 — that path
needs the printer to have a working network connection, and the CP1000 has no
Wi-Fi.

## 2. Install

```bash
sudo apt update
sudo apt install cups printer-driver-gutenprint libusb-1.0-0
```

Gutenprint 5.3.x bundles the `canonselphyneo` backend and the `canon-cp1000`
model. (CP1000 support landed in Gutenprint 5.2.12+.)

## 3. Free the USB interface

Two things fight the libusb backend and must be disabled:

```bash
# 1. The usblp kernel module claims the interface.
echo "blacklist usblp" | sudo tee /etc/modprobe.d/blacklist-usblp.conf
sudo modprobe -r usblp

# 2. ipp-usb (if installed) holds the interface and exposes a broken IPP queue.
sudo systemctl stop ipp-usb
sudo systemctl disable ipp-usb
sudo systemctl mask ipp-usb

sudo systemctl restart cups
```

## 4. Create the CUPS queue

Plug in the CP1000, then:

```bash
# Find the Gutenprint backend device URI, e.g.
#   direct gutenprint52+usb://Canon/SELPHY_CP1000?serial=...
lpinfo -v | grep -i gutenprint

# Create the queue using the canon-cp1000 model.
sudo lpadmin -p SELPHY_CP1000 -E \
  -v "<the gutenprint52+usb:// URI from above>" \
  -m gutenprint.5.3://canon-cp1000/expert

# Optional: keep it local-only, and let the booth user manage it.
sudo lpadmin -p SELPHY_CP1000 -o printer-is-shared=false
sudo usermod -aG lpadmin "$USER"

lpstat -p SELPHY_CP1000
```

If hotplug auto-creates a queue, it may be the driverless/IPP one; remove it and
use the manual queue above.

## 5. Smoke test

```bash
lp -d SELPHY_CP1000 /path/to/photo.jpg
lpstat -o SELPHY_CP1000     # pending/processing jobs
lpq -P SELPHY_CP1000        # queue view
cancel SELPHY_CP1000-42     # cancel a job id
```

The app submits with exactly these commands (`lp` / `lpstat` / `lpq` / `cancel`),
so if the smoke test prints, the booth print queue works.

## 6. Verify the option mapping (important)

The app sends print options through `lp -o`. Generic CUPS/IPP option names
(`media`, `media-type`, `print-quality`, `print-color-mode`) may not all be
defined by the Gutenprint PPD. Enumerate what this queue actually accepts:

```bash
lpoptions -p SELPHY_CP1000 -l
```

Map the booth's settings to the real keys:

| Booth setting | Preferred CUPS key | Gutenprint PPD option |
| --- | --- | --- |
| Paper size (4×6) | `media` / `PageSize` | `PageSize` (e.g. `w288h432` / `Postcard`) |
| Media type | `media-type` | `StpMediaType` |
| Quality | `print-quality` | `StpQuality` |
| Color mode | `print-color-mode` | `StpColorCorrection` / `StpColorMode` |

If the generic keys are ignored, set explicit overrides from the booth's printer
settings (the app accepts a `cupsOptions` map on the print payload) or adjust the
defaults in `apps/booth/electron/printer/PrinterService.ts`.

The 4×6 paper size is the critical one — printing on the wrong size wastes a
ribbon segment.

## 7. Status / paper-out detection

Because the backend is libusb (not IPP), CUPS may report only a coarse
`idle` / `printing` / `stopped` state. The `canonselphyneo` backend can report
media state directly:

```bash
# If the multi-call symlink is installed:
canonselphyneo -s
# Otherwise:
BACKEND=canonselphyneo gutenprint52+usb -s
```

It reports **media empty** and ribbon-depleted conditions. The booth's
"needs attention" banner keys off `media-empty`, `media-needed`, `media-jam`,
`marker-supply-empty`, and `paused`; verify the exact strings this queue emits
with the ribbon/paper removed and, if they differ, extend the keyword list in
`PrinterService.printerReasons()`.

## 8. Booth settings that must match

- CUPS queue name: `SELPHY_CP1000` (Admin → Setup → Printer).
- Paper size: `100x148mm` (4×6).
- Print mode: **Manual (batch)** — the operator releases prints from
  Admin → Print Queue. Auto mode submits immediately per session.

## 9. Disk note

The booth stages **no** print images on disk. Each job references the session
token and the framed image is resolved just-in-time from IndexedDB (or the
gallery) when the job becomes active. A single transient temp file exists only
for the seconds around `lp` accepting the job, then it is deleted.
