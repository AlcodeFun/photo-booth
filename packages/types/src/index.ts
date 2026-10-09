export interface PhotoAttempt {
  attemptNumber: number;
  localPath?: string;
  status: 'CAPTURED' | 'SELECTED' | 'RETAKEN';
  /**
   * A few seconds of live view frames captured just before this shot was taken
   * (downscaled JPEG data URLs). When present, the framed "live photo" result
   * animates each slot with its own recorded clip instead of a static image.
   */
  liveFrames?: string[];
}

export interface PhotoSlotState {
  slotNumber: number;
  maxAttempts: number;
  attempts: PhotoAttempt[];
  selectedAttempt?: number;
}

export interface BoothSessionState {
  sessionId: string;
  layoutId?: string;
  frameId?: string;
  filterId?: string;
  currentPhotoSlot: number;
  photoSlots: PhotoSlotState[];
  status: string;
}

export interface LayoutConfig {
  id: string;
  name: string;
  photoSlots: number;
  aspectRatio: string;
  previewUrl: string;
}

export type FramePhotoFit = 'cover' | 'contain';

export interface FramePhotoPlacement {
  slotNumber: number;
  sourcePhotoSlot?: number;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  borderRadius?: number;
  zIndex?: number;
  objectFit?: FramePhotoFit;
  objectPosition?: string;
  photoScale?: number;
  photoOffsetX?: number;
  photoOffsetY?: number;
}

export interface FrameQRPlacement {
  slotNumber: number;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  borderRadius?: number;
  zIndex?: number;
}

export interface FrameTemplateConfig {
  assetUrl: string;
  width: number;
  height: number;
  backgroundColor?: string;
  frameLayerZIndex?: number;
  photoSlots: FramePhotoPlacement[];
  qrSlots?: FrameQRPlacement[];
}

export interface FrameConfig {
  id: string;
  name: string;
  previewUrl: string;
  photoSlots?: number;
  template?: FrameTemplateConfig;
  templatesByPhotoSlots?: Partial<Record<number, FrameTemplateConfig>>;
}

/**
 * Booth appearance.
 *
 * Copy and background style the guest journey (start screen -> tutorial ->
 * capture -> results). The theme also drives the admin dashboard, booth set-up,
 * organize screen and gallery, via contrast-checked tokens derived from it in
 * `themeTokens.ts`.
 */

export type BoothBackgroundType = 'color' | 'image';

export type BoothBackgroundFit = 'cover' | 'contain' | 'repeat';

export type BoothCopyGroupId =
  | 'bumper'
  | 'tutorial'
  | 'frame'
  | 'capture'
  | 'review'
  | 'filter'
  | 'results'
  | 'complete';

/**
 * Every customer-facing string. Values may embed `{token}` placeholders which
 * are filled in at render time via `formatBoothCopy`.
 */
export interface BoothCopywriting {
  bumperBrand: string;
  bumperTapToStart: string;
  bumperCaption1: string;
  bumperCaption2: string;
  bumperCaption3: string;
  bumperPinTitle: string;
  bumperPinSubtitle: string;
  bumperPinError: string;

  tutorialEyebrow: string;
  tutorialTitle: string;
  tutorialStep1Title: string;
  tutorialStep1Body: string;
  tutorialStep2Title: string;
  tutorialStep2Body: string;
  tutorialStep3Title: string;
  tutorialStep3Body: string;
  tutorialStartButton: string;

  frameEyebrow: string;
  frameTitle: string;
  frameConfirmButton: string;

  readyTitle: string;
  readySubtitle: string;
  readyFrameLabel: string;
  readyInstruction: string;
  readyStartButton: string;

  captureSlotLabel: string;  captureAttemptLabel: string;
  captureTimedSessionLabel: string;
  captureTimedPhotoCount: string;
  captureTimeLeftLabel: string;
  captureSessionLabel: string;
  captureMirrorOn: string;
  captureMirrorOff: string;
  captureStarting: string;
  captureRetry: string;
  capturePreparing: string;
  captureHoldPose: string;
  captureCheese: string;
  captureGetReady: string;
  captureTapToStart: string;
  captureTapToCapture: string;
  capturePreviousPhoto: string;
  captureHoldStill: string;

  reviewHeader: string;
  reviewPhotoLabel: string;
  reviewAttemptLabel: string;
  reviewQuestion: string;
  reviewLastChance: string;
  reviewRetakeButton: string;
  reviewUseButton: string;
  reviewNoPhoto: string;

  filterTitle: string;
  filterEffectsLabel: string;
  filterApplyButton: string;
  filterGuideMove: string;
  filterGuideZoom: string;
  filterGuideHint: string;
  filterReset: string;
  filterSelectHint: string;

  resultsTitle: string;
  resultsSubtitle: string;
  resultsScanMe: string;
  resultsPrinting: string;
  resultsPrintQueued: string;
  resultsPrintReady: string;
  resultsPrintError: string;
  resultsUploading: string;
  resultsUploaded: string;
  resultsUploadError: string;
  resultsNoFramed: string;
  resultsViewAllPhotos: string;
  resultsQrDownload: string;
  resultsQrArrange: string;
  resultsGeneratingQr: string;
  resultsFinishButton: string;
  resultsFinishDone: string;
  resultsQrModalTitle: string;
  resultsClose: string;
  resultsLiveBadge: string;
  resultsGifBadge: string;
  resultsFramedLiveBadge: string;
  resultsAnimatedGifBadge: string;
  resultsPhotoLabel: string;
  resultsFramedPhotoLabel: string;

  completeTitle: string;
  completeBody: string;
  completeButton: string;
  completeFootnote: string;
}

/** Design-system colors, applied to the booth as `--pb-*` CSS variables. */
export interface BoothTheme {
  primary: string;
  primaryForeground: string;
  secondary: string;
  secondaryForeground: string;
  tertiary: string;
  tertiaryForeground: string;
  accent: string;
  accentForeground: string;
  action: string;
  actionForeground: string;
  background: string;
  foreground: string;
  card: string;
  cardForeground: string;
  surface: string;
  surfaceForeground: string;
  muted: string;
  mutedForeground: string;
  destructive: string;
  destructiveForeground: string;
  deep: string;
  bumperInner: string;
  bumperMid: string;
  bumperOuter: string;
  bumperAltInner: string;
  bumperAltMid: string;
  bumperAltOuter: string;
}

export interface BoothBackground {
  type: BoothBackgroundType;
  color: string;
  imageUrl?: string;
  fit: BoothBackgroundFit;
  position: string;
}

/**
 * Layout of the attract loop (start screen). Every style reads its colors from
 * the theme, so any palette works with any style.
 *  - gradient3d: animated radial gradient, balloons and a 3D polaroid collage
 *  - flat:       flat travel-journal collage (paper, tape, stamps, film strip)
 *  - camera:     fullscreen live camera behind a film / polaroid overlay
 */
export type BoothStartScreenStyle = 'gradient3d' | 'flat' | 'camera';

export interface BoothStartScreen {
  style: BoothStartScreenStyle;
}

export interface BoothAppearance {
  copy: BoothCopywriting;
  theme: BoothTheme;
  background: BoothBackground;
  startScreen: BoothStartScreen;
}

export interface BoothStartScreenPreset {
  id: BoothStartScreenStyle;
  label: string;
  description: string;
}

export const BOOTH_START_SCREEN_PRESETS: BoothStartScreenPreset[] = [
  {
    id: 'gradient3d',
    label: '3D Gradient',
    description: 'Animated gradient, floating balloons and a spinning 3D photo collage.',
  },
  {
    id: 'flat',
    label: 'Flat Journal',
    description: 'Flat travel-journal collage: polaroids, tape, stamps and a film strip.',
  },
  {
    id: 'camera',
    label: 'Fullscreen Camera',
    description: 'Live camera fills the screen behind a film-grain polaroid overlay.',
  },
];

/**
 * The appearance shipped with the app. There is no "default mode": the booth
 * always renders whatever is saved. This value is the merge base for partial
 * stored documents and is exposed to the editor as the `Default` theme preset,
 * so an operator can always return to the look the booth launched with.
 */
export const DEFAULT_BOOTH_APPEARANCE: BoothAppearance = {
  copy: {
    bumperBrand: 'Photostrip',
    bumperTapToStart: 'Click dimana saja untuk mulai',
    bumperCaption1: 'The Best',
    bumperCaption2: 'Photostrip',
    bumperCaption3: 'Experience',
    bumperPinTitle: 'Admin PIN',
    bumperPinSubtitle: 'Masukkan PIN untuk membuka setting kamera',
    bumperPinError: 'PIN salah — coba lagi',

    tutorialEyebrow: 'Panduan',
    tutorialTitle: 'How it works',
    tutorialStep1Title: 'Pilih Gaya',
    tutorialStep1Body: 'Pilih bingkai yang paling cocok dengan moodmu.',
    tutorialStep2Title: 'Pose Santai',
    tutorialStep2Body: 'Ambil 3 foto dengan hitungan mundur dan retake sampai hasilnya pas.',
    tutorialStep3Title: 'Cetak & Simpan',
    tutorialStep3Body: 'Lihat hasil akhir, pilih filter, dan bagikan momen lewat QR.',
    tutorialStartButton: 'Ayo mulai',

    frameEyebrow: 'Bingkai',
    frameTitle: 'Pilih gaya foto',
    frameConfirmButton: 'Pilih bingkai',

    readyTitle: 'Preview & Capture',
    readySubtitle: 'Get ready to take {count} beautiful photos!',
    readyFrameLabel: 'Frame Style',
    readyInstruction:
      'Stand directly in front of the camera, wait for the 5-second countdown, and smile! You will review each photo right after capturing.',
    readyStartButton: 'Start Photo Session',

    captureSlotLabel: 'Slot ke {current} dari {total}',
    captureAttemptLabel: 'Kesempatan ke {current} dari {total}',
    captureTimedSessionLabel: 'Sesi',
    captureTimedPhotoCount: '{count} photo diambil',
    captureTimeLeftLabel: 'Time left',
    captureSessionLabel: 'Session',
    captureMirrorOn: 'Mirror on',
    captureMirrorOff: 'Mirror off',
    captureStarting: 'Starting camera...',
    captureRetry: 'Retry camera',
    capturePreparing: 'Tunggu Sebentar',
    captureHoldPose: 'Tahan Posemu',
    captureCheese: 'Cheese!',
    captureGetReady: 'Get ready',
    captureTapToStart: 'Click dimana saja untuk memulai',
    captureTapToCapture: 'Click dimana saja untuk mengambil foto',
    capturePreviousPhoto: 'Foto Sebelumnya',
    captureHoldStill: 'Tahan posisimu ya!',

    reviewHeader: 'Photo review',
    reviewPhotoLabel: 'Photo {current}',
    reviewAttemptLabel: 'Attempt',
    reviewQuestion: 'Apakah foto ini sudah pas?',
    reviewLastChance: 'Kesempatan terakhir',
    reviewRetakeButton: 'Foto Ulang',
    reviewUseButton: 'Pakai Foto',
    reviewNoPhoto: 'No photo captured',

    filterTitle: 'Pilih Filter yang Kamu Suka',
    filterEffectsLabel: 'Efek foto',
    filterApplyButton: 'Gunakan Filter',
    filterGuideMove: 'Geser foto buat atur posisi',
    filterGuideZoom: 'Cubit atau scroll buat zoom',
    filterGuideHint: 'Tap di mana saja untuk mulai',
    filterReset: 'Reset posisi',
    filterSelectHint: 'Tap foto lain buat pilih',

    resultsTitle: 'Yeay, fotomu jadi!',
    resultsSubtitle: 'Scan QR buat simpan semua foto, live photo & GIF-nya.',
    resultsScanMe: 'Scan aku!',
    resultsPrinting: 'Lagi dicetak…',
    resultsPrintQueued: 'Cetakan masuk antrean',
    resultsPrintReady: 'Cetakan siap diambil',
    resultsPrintError: 'Cetak gagal, panggil kru ya',
    resultsUploading: 'Menyimpan ke cloud…',
    resultsUploaded: 'Tersimpan di cloud',
    resultsUploadError: 'Unggahan tertunda, kru akan bantu',
    resultsNoFramed: 'No framed photo',
    resultsViewAllPhotos: 'Semua foto ({count})',
    resultsQrDownload: 'Scan QR to download your photos',
    resultsQrArrange: 'Scan QR ya buat atur semua fotomu',
    resultsGeneratingQr: 'Generating QR...',
    resultsFinishButton: 'Finish Session',
    resultsFinishDone: '✓ Selesai 🎉',
    resultsQrModalTitle: 'Scan untuk unduh',
    resultsClose: 'Tutup',
    resultsLiveBadge: 'Live',
    resultsGifBadge: 'GIF',
    resultsFramedLiveBadge: '📹 Framed live photo',
    resultsAnimatedGifBadge: '🎞️ Animated GIF',
    resultsPhotoLabel: 'Photo {index}',
    resultsFramedPhotoLabel: 'Foto',

    completeTitle: 'Thank You!',
    completeBody:
      'Your photo session is complete. Enjoy your prints and save this moment for later.',
    completeButton: 'Start New Session',
    completeFootnote: 'Automatically returning to start screen in a few seconds...',
  },
  theme: {
    primary: '#ff4bb5',
    primaryForeground: '#ffffff',
    secondary: '#a35ef6',
    secondaryForeground: '#ffffff',
    tertiary: '#d9f85a',
    tertiaryForeground: '#4d2d85',
    accent: '#4acaf1',
    accentForeground: '#4d2d85',
    action: '#ff7d57',
    actionForeground: '#ffffff',
    background: '#d9f85a',
    foreground: '#4d2d85',
    card: '#fdf3ff',
    cardForeground: '#3b2a7a',
    surface: '#ff4bb5',
    surfaceForeground: '#4d2d85',
    muted: '#7d6ea6',
    mutedForeground: '#ffffff',
    destructive: '#b0003a',
    destructiveForeground: '#ffffff',
    deep: '#1a0b2e',
    bumperInner: '#ff4bb5',
    bumperMid: '#7a2b8c',
    bumperOuter: '#1a0b2e',
    bumperAltInner: '#d9f85a',
    bumperAltMid: '#5c8f26',
    bumperAltOuter: '#0a1405',
  },
  background: {
    type: 'color',
    color: '#d9f85a',
    fit: 'cover',
    position: 'center',
  },
  startScreen: {
    style: 'gradient3d',
  },
};

export interface BoothCopyField {
  key: keyof BoothCopywriting;
  label: string;
  hint?: string;
  multiline?: boolean;
}

export interface BoothCopyGroup {
  id: BoothCopyGroupId;
  label: string;
  fields: BoothCopyField[];
}

/**
 * Drives the admin appearance editor (and keeps the copy map exhaustive at
 * compile time: a new copy key without a field entry fails the build).
 */
export const BOOTH_COPY_GROUPS: BoothCopyGroup[] = [
  {
    id: 'bumper',
    label: 'Start screen',
    fields: [
      { key: 'bumperBrand', label: 'Brand wordmark' },
      { key: 'bumperTapToStart', label: 'Tap to start hint' },
      { key: 'bumperCaption1', label: 'Collage caption 1' },
      { key: 'bumperCaption2', label: 'Collage caption 2' },
      { key: 'bumperCaption3', label: 'Collage caption 3' },
      { key: 'bumperPinTitle', label: 'Setup PIN title' },
      { key: 'bumperPinSubtitle', label: 'Setup PIN subtitle' },
      { key: 'bumperPinError', label: 'Setup PIN error' },
    ],
  },
  {
    id: 'tutorial',
    label: 'Tutorial',
    fields: [
      { key: 'tutorialEyebrow', label: 'Eyebrow' },
      { key: 'tutorialTitle', label: 'Title' },
      { key: 'tutorialStep1Title', label: 'Step 1 title' },
      { key: 'tutorialStep1Body', label: 'Step 1 body', multiline: true },
      { key: 'tutorialStep2Title', label: 'Step 2 title' },
      { key: 'tutorialStep2Body', label: 'Step 2 body', multiline: true },
      { key: 'tutorialStep3Title', label: 'Step 3 title' },
      { key: 'tutorialStep3Body', label: 'Step 3 body', multiline: true },
      { key: 'tutorialStartButton', label: 'Start button' },
    ],
  },
  {
    id: 'frame',
    label: 'Frame selection',
    fields: [
      { key: 'frameEyebrow', label: 'Eyebrow' },
      { key: 'frameTitle', label: 'Title' },
      { key: 'frameConfirmButton', label: 'Confirm button' },
    ],
  },
  {
    id: 'capture',
    label: 'Capture screen',
    fields: [
      { key: 'captureSlotLabel', label: 'Slot label', hint: 'Tokens: {current}, {total}' },
      {
        key: 'captureAttemptLabel',
        label: 'Attempt label',
        hint: 'Tokens: {current}, {total}',
      },
      { key: 'captureTimedSessionLabel', label: 'Timed session label' },
      { key: 'captureTimedPhotoCount', label: 'Timed photo count', hint: 'Token: {count}' },
      { key: 'captureTimeLeftLabel', label: 'Time left label' },
      { key: 'captureSessionLabel', label: 'Session label' },
      { key: 'captureMirrorOn', label: 'Mirror button (on)' },
      { key: 'captureMirrorOff', label: 'Mirror button (off)' },
      { key: 'captureStarting', label: 'Camera starting message' },
      { key: 'captureRetry', label: 'Camera retry button' },
      { key: 'capturePreparing', label: 'Preparing message' },
      { key: 'captureHoldPose', label: 'Hold pose message' },
      { key: 'captureCheese', label: 'Shutter message' },
      { key: 'captureGetReady', label: 'Get ready message' },
      { key: 'captureTapToStart', label: 'Tap to start hint' },
      { key: 'captureTapToCapture', label: 'Tap to capture hint' },
      { key: 'capturePreviousPhoto', label: 'Previous photo label' },
      { key: 'captureHoldStill', label: 'Fullscreen hold message' },
    ],
  },
  {
    id: 'review',
    label: 'Photo review',
    fields: [
      { key: 'reviewHeader', label: 'Header' },
      { key: 'reviewPhotoLabel', label: 'Photo label', hint: 'Token: {current}' },
      { key: 'reviewAttemptLabel', label: 'Attempt label' },
      { key: 'reviewQuestion', label: 'Question' },
      { key: 'reviewLastChance', label: 'Last chance badge' },
      { key: 'reviewRetakeButton', label: 'Retake button' },
      { key: 'reviewUseButton', label: 'Use photo button' },
      { key: 'reviewNoPhoto', label: 'Empty state' },
    ],
  },
  {
    id: 'filter',
    label: 'Filter selection',
    fields: [
      { key: 'filterTitle', label: 'Title' },
      { key: 'filterEffectsLabel', label: 'Effects label' },
      { key: 'filterApplyButton', label: 'Apply button' },
      { key: 'filterGuideMove', label: 'Guide: move' },
      { key: 'filterGuideZoom', label: 'Guide: zoom' },
      { key: 'filterGuideHint', label: 'Guide: dismiss hint' },
      { key: 'filterReset', label: 'Reset adjustments button' },
      { key: 'filterSelectHint', label: 'Hint: pick another photo' },
    ],
  },
  {
    id: 'results',
    label: 'Results & QR',
    fields: [
      { key: 'resultsTitle', label: 'Headline' },
      { key: 'resultsSubtitle', label: 'Subtitle', multiline: true },
      { key: 'resultsScanMe', label: 'QR sticker' },
      { key: 'resultsPrinting', label: 'Print status: printing' },
      { key: 'resultsPrintQueued', label: 'Print status: queued' },
      { key: 'resultsPrintReady', label: 'Print status: ready' },
      { key: 'resultsPrintError', label: 'Print status: failed' },
      { key: 'resultsUploading', label: 'Upload status: uploading' },
      { key: 'resultsUploaded', label: 'Upload status: done' },
      { key: 'resultsUploadError', label: 'Upload status: failed' },
      { key: 'resultsNoFramed', label: 'No framed photo' },
      { key: 'resultsViewAllPhotos', label: 'Photo strip label', hint: 'Token: {count}' },
      { key: 'resultsQrDownload', label: 'QR hint (standard flow)' },
      { key: 'resultsQrArrange', label: 'QR hint (timed flow)' },
      { key: 'resultsGeneratingQr', label: 'Generating QR message' },
      { key: 'resultsFinishButton', label: 'Finish button' },
      { key: 'resultsFinishDone', label: 'Finish button (done)' },
      { key: 'resultsQrModalTitle', label: 'QR modal title' },
      { key: 'resultsClose', label: 'Close button' },
      { key: 'resultsLiveBadge', label: 'Live tab' },
      { key: 'resultsGifBadge', label: 'GIF tab' },
      { key: 'resultsFramedLiveBadge', label: 'Framed live badge' },
      { key: 'resultsAnimatedGifBadge', label: 'Animated GIF badge' },
      { key: 'resultsPhotoLabel', label: 'Photo thumbnail label', hint: 'Token: {index}' },
      { key: 'resultsFramedPhotoLabel', label: 'Framed photo tab' },
    ],
  },
  {
    id: 'complete',
    label: 'Complete screen',
    fields: [
      { key: 'completeTitle', label: 'Title' },
      { key: 'completeBody', label: 'Body', multiline: true },
      { key: 'completeButton', label: 'Button' },
      { key: 'completeFootnote', label: 'Footnote' },
    ],
  },
];

export type BoothThemeGroupId = 'brand' | 'accents' | 'surfaces' | 'bumper';

export interface BoothThemeField {
  key: keyof BoothTheme;
  label: string;
}

/**
 * A named, ready-to-apply colorway. The four brand colors are the anchors; the
 * remaining tokens are tints/shades of those anchors so a palette stays
 * internally consistent instead of mixing in unrelated hues.
 *
 * The shipped look is a preset like any other (`Default`), not a separate
 * rendering mode — applying it just writes its colors into the saved document.
 */
export interface BoothThemePreset {
  id: string;
  label: string;
  /** The source colors the palette was built from, in brand order. */
  swatches: string[];
  theme: BoothTheme;
  /** Suggested flat background color to pair with the theme. */
  backgroundColor: string;
}

/**
 * "Earthy" — muted olive / clay / slate with a warm cream base, lifted by a
 * single brand gold.
 *
 * NOTE: the cream was supplied as `#FSF0E6`, which is not a valid hex value
 * (`S` is not a hex digit). It is read here as `#FDF0E6`. Correct the earthy
 * preset's `swatches[3]` and `backgroundColor` if a different cream was meant.
 */
export const BOOTH_THEME_PRESETS: BoothThemePreset[] = [
  {
    id: 'default',
    label: 'Default',
    swatches: [
      DEFAULT_BOOTH_APPEARANCE.theme.primary,
      DEFAULT_BOOTH_APPEARANCE.theme.secondary,
      DEFAULT_BOOTH_APPEARANCE.theme.tertiary,
      DEFAULT_BOOTH_APPEARANCE.theme.accent,
      DEFAULT_BOOTH_APPEARANCE.theme.deep,
    ],
    backgroundColor: DEFAULT_BOOTH_APPEARANCE.background.color,
    theme: DEFAULT_BOOTH_APPEARANCE.theme,
  },
  {
    id: 'earthy',
    label: 'Earthy',
    swatches: ['#3F4B38', '#674A38', '#668B98', '#FDF0E6', '#E8B85F'],
    backgroundColor: '#FDF0E6',
    theme: {
      // Brand darks carry the foreground text, so they all pair with the cream.
      primary: '#3F4B38',
      primaryForeground: '#FDF0E6',
      secondary: '#674A38',
      secondaryForeground: '#FDF0E6',
      // A darker shade of the brand teal: the raw #668B98 only reaches 3.29:1
      // against the cream, which fails AA for the 14px button labels.
      tertiary: '#45636E',
      tertiaryForeground: '#FDF0E6',

      // Highlight: the brand gold. It is the one warm, saturated note in an
      // otherwise muted palette, so it carries the attention (review dots, card
      // borders, balloons). Only ever a fill/border here — gold text on the
      // cream would sit at 1.64:1 — hence the near-black foreground.
      accent: '#E8B85F',
      accentForeground: '#241E18',

      // Call to action uses the most chromatic brand color so the primary
      // buttons still read as buttons against the olive and clay.
      action: '#45636E',
      actionForeground: '#FDF0E6',

      // Light surfaces layered from the cream, each one step deeper.
      background: '#FDF0E6',
      foreground: '#3F4B38',
      card: '#F3E6D8',
      cardForeground: '#4A3B2A',
      surface: '#F8EDE1',
      surfaceForeground: '#3F4B38',
      muted: '#B9AC99',
      mutedForeground: '#4A3B2A',

      // Muted brick rather than pure red, to stay inside the earthy range.
      destructive: '#9B3B2E',
      destructiveForeground: '#FDF0E6',

      // Darkest tone: photo/review backdrop and text on light surfaces.
      deep: '#241E18',

      // Bumper gradients run bright center -> brand dark -> near-black.
      bumperInner: '#668B98',
      bumperMid: '#3F4B38',
      bumperOuter: '#241E18',
      bumperAltInner: '#E8B85F',
      bumperAltMid: '#674A38',
      bumperAltOuter: '#2A2119',
    },
  },
  {
    id: 'kelana',
    label: 'Kelana',
    // Warm Cream, Sunset Orange, Butter Yellow, Travel Blue, Charcoal.
    swatches: ['#F5EBDD', '#F07842', '#FFC34A', '#344D66', '#29251F'],
    backgroundColor: '#F5EBDD',
    theme: {
      // White on Sunset Orange is only ~2.9:1, so brand fills carry charcoal.
      primary: '#F07842',
      primaryForeground: '#29251F',
      secondary: '#344D66',
      secondaryForeground: '#F5EBDD',
      tertiary: '#FFC34A',
      tertiaryForeground: '#29251F',
      // A lifted Travel Blue for secondary highlights on the cream.
      accent: '#7FA6C4',
      accentForeground: '#29251F',
      // Butter Yellow is the brief's call-to-action color.
      action: '#FFC34A',
      actionForeground: '#29251F',
      background: '#F5EBDD',
      foreground: '#29251F',
      card: '#FBF5EC',
      cardForeground: '#29251F',
      surface: '#EFE1CC',
      surfaceForeground: '#29251F',
      muted: '#A79A88',
      mutedForeground: '#29251F',
      destructive: '#B23A2E',
      destructiveForeground: '#F5EBDD',
      deep: '#29251F',
      bumperInner: '#F07842',
      bumperMid: '#344D66',
      bumperOuter: '#29251F',
      bumperAltInner: '#FFC34A',
      bumperAltMid: '#F07842',
      bumperAltOuter: '#29251F',
    },
  },
];

export const DEFAULT_BOOTH_THEME_PRESET_ID = 'default';

export interface BoothThemeGroup {
  id: BoothThemeGroupId;
  label: string;
  fields: BoothThemeField[];
}

export const BOOTH_THEME_GROUPS: BoothThemeGroup[] = [
  {
    id: 'brand',
    label: 'Brand',
    fields: [
      { key: 'primary', label: 'Primary' },
      { key: 'primaryForeground', label: 'Primary text' },
      { key: 'secondary', label: 'Secondary' },
      { key: 'secondaryForeground', label: 'Secondary text' },
      { key: 'surface', label: 'Panel' },
      { key: 'surfaceForeground', label: 'Panel text' },
    ],
  },
  {
    id: 'accents',
    label: 'Accents',
    fields: [
      { key: 'tertiary', label: 'Tertiary' },
      { key: 'tertiaryForeground', label: 'Tertiary text' },
      { key: 'accent', label: 'Accent' },
      { key: 'accentForeground', label: 'Accent text' },
      { key: 'action', label: 'Action button' },
      { key: 'actionForeground', label: 'Action text' },
    ],
  },
  {
    id: 'surfaces',
    label: 'Surfaces',
    fields: [
      { key: 'background', label: 'Background' },
      { key: 'foreground', label: 'Background text' },
      { key: 'card', label: 'Card' },
      { key: 'cardForeground', label: 'Card text' },
      { key: 'muted', label: 'Muted' },
      { key: 'mutedForeground', label: 'Muted text' },
      { key: 'destructive', label: 'Destructive' },
      { key: 'destructiveForeground', label: 'Destructive text' },
      { key: 'deep', label: 'Deep (overlays)' },
    ],
  },
  {
    id: 'bumper',
    label: 'Start screen gradient',
    fields: [
      { key: 'bumperInner', label: 'Gradient inner' },
      { key: 'bumperMid', label: 'Gradient middle' },
      { key: 'bumperOuter', label: 'Gradient outer' },
      { key: 'bumperAltInner', label: 'Alt inner' },
      { key: 'bumperAltMid', label: 'Alt middle' },
      { key: 'bumperAltOuter', label: 'Alt outer' },
    ],
  },
];

/** Fills `{token}` placeholders in a copy string; unknown tokens are left as-is. */
export const formatBoothCopy = (
  template: string,
  vars: Record<string, string | number> = {},
): string =>
  template.replace(/\{(\w+)\}/g, (match, token: string) =>
    token in vars ? String(vars[token]) : match,
  );

export type CameraStatus =
  | 'DISCONNECTED'
  | 'CONNECTING'
  | 'LIVE_VIEW'
  | 'CAPTURING'
  | 'READY'
  | 'ERROR';

export interface CameraInfo {
  model: string | null;
  connected: boolean;
}

export interface CameraLiveFrame {
  /** Raw JPEG bytes of the frame (transferred via structured clone over IPC). */
  frame: Uint8Array;
  timestamp: number;
}

export interface CameraCaptureResult {
  dataUrl: string;
  /** Absolute path where the full-res original was persisted on disk. */
  filePath: string;
}

export interface CameraStatePayload {
  status: CameraStatus;
  info?: CameraInfo;
  error?: string;
}

/**
 * Configurable shooting settings of the tethered camera, keyed by a stable
 * camelCase name. The gphoto2 config path behind each key lives in the Electron
 * camera service (the renderer only deals in keys + values).
 */
export type CameraSettingKey =
  | 'exposureMode'
  | 'aperture'
  | 'shutterSpeed'
  | 'iso'
  | 'exposureCompensation'
  | 'whiteBalance'
  | 'meteringMode'
  | 'imageQuality'
  | 'imageSize'
  | 'pictureStyle'
  | 'focusMode'
  | 'driveMode'
  | 'flashMode'
  | 'autoPowerOff';

/** One `Key: Label` choice reported by the camera for a setting. */
export interface CameraSettingOption {
  /** Value written back with `--set-config <path>=<value>`. */
  value: string;
  /** Human label as printed by the camera (falls back to the raw value). */
  label: string;
}

export interface CameraSettingState {
  key: CameraSettingKey;
  label: string;
  /** Every value this camera offers for the setting, in menu order. */
  options: CameraSettingOption[];
  /** Last value the camera service pushed to the hardware (null = never). */
  applied: string | null;
  /** Set when the camera could not be queried for this setting. */
  error?: string;
}

/** Values to push to the camera; empty/undefined keys are left untouched. */
export type CameraSettingsValues = Partial<Record<CameraSettingKey, string>>;

export interface CameraSettingsSnapshot {
  model: string | null;
  items: CameraSettingState[];
}

export interface CameraSettingChange {
  key: CameraSettingKey;
  value: string;
}

export interface CameraSettingFailure extends CameraSettingChange {
  error: string;
}

export interface CameraSettingsApplyResult {
  ok: boolean;
  applied: CameraSettingChange[];
  /** Values the connected camera does not offer (nothing was written). */
  skipped: CameraSettingChange[];
  failed: CameraSettingFailure[];
  /** Freshly read state after applying, so the UI can show what stuck. */
  snapshot?: CameraSettingsSnapshot;
  /** Set when the whole operation failed (no camera / gphoto2 missing). */
  error?: string;
}

/** Renderer → main configuration pushed whenever the booth setup changes. */
export interface CameraAutoConfig {
  /** Auto-detect + re-apply settings + start live view when a camera appears. */
  autoConnect: boolean;
  /** How often the camera port is polled for a hot-plugged device. */
  pollIntervalSeconds: number;
  /** Settings re-applied every time the camera is (re)connected. */
  settings: CameraSettingsValues;
}

export interface CameraAutoConfigResult {
  autoConnect: boolean;
  pollIntervalSeconds: number;
}

export * from './themeTokens';
