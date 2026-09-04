import { LayoutConfig, FrameConfig, FrameTemplateConfig } from '@photo-booth/types';

const publicAsset = (path: string) => `${import.meta.env.DEV ? '/' : import.meta.env.BASE_URL}${path}`;

const classicTemplate = (
  assetName: string,
  photoSlots: FrameTemplateConfig['photoSlots'],
): FrameTemplateConfig => ({
  assetUrl: publicAsset(`frame-templates/${assetName}`),
  width: 1200,
  height: 1600,
  backgroundColor: '#111111',
  frameLayerZIndex: 30,
  photoSlots,
});

const customThreePhotoTemplate: FrameConfig['templatesByPhotoSlots'] = {
  3: {
    assetUrl: publicAsset('frame-templates/3-photo.png'),
    width: 1200,
    height: 1600,
    backgroundColor: '#2f4fee',
    frameLayerZIndex: 30,
    photoSlots: [
      {
        slotNumber: 1,
        sourcePhotoSlot: 1,
        x: 99.13043478260863,
        y: 254.78370283799967,
        width: 440.4346233865488,
        height: 342.60867799913376,
        borderRadius: 0,
        zIndex: 10,
        objectFit: 'cover',
        objectPosition: 'center',
      },
      {
        slotNumber: 2,
        sourcePhotoSlot: 1,
        x: 656.8694856063179,
        y: 254.26161376200554,
        width: 440.4346233865488,
        height: 342.60867799913376,
        borderRadius: 0,
        zIndex: 10,
        objectFit: 'cover',
        objectPosition: 'center',
      },
      {
        slotNumber: 3,
        sourcePhotoSlot: 2,
        x: 92.869485606318,
        y: 587.6555231447278,
        width: 440.4346233865488,
        height: 342.60867799913376,
        borderRadius: 0,
        zIndex: 10,
        objectFit: 'cover',
        objectPosition: 'center',
      },
      {
        slotNumber: 4,
        sourcePhotoSlot: 2,
        x: 658.434623386549,
        y: 594.9596272896339,
        width: 440.4346233865488,
        height: 342.60867799913376,
        borderRadius: 0,
        zIndex: 10,
        objectFit: 'cover',
        objectPosition: 'center',
      },
      {
        slotNumber: 5,
        sourcePhotoSlot: 3,
        x: 94.95652173913044,
        y: 928.8755063307262,
        width: 440.4346233865488,
        height: 342.60867799913376,
        borderRadius: 0,
        zIndex: 10,
        objectFit: 'cover',
        objectPosition: 'center',
      },
      {
        slotNumber: 6,
        sourcePhotoSlot: 3,
        x: 663.1303551715353,
        y: 923.1361010623391,
        width: 440.4346233865488,
        height: 342.60867799913376,
        borderRadius: 0,
        zIndex: 10,
        objectFit: 'cover',
        objectPosition: 'center',
      },
    ],
  },
};

const CLASSIC_BLACK_TEMPLATES: FrameConfig['templatesByPhotoSlots'] = {
  1: classicTemplate('classic-black-1-photo.svg', [
    {
      slotNumber: 1,
      sourcePhotoSlot: 1,
      x: 120,
      y: 160,
      width: 960,
      height: 1160,
      borderRadius: 0,
      zIndex: 10,
      objectFit: 'cover',
      objectPosition: 'center',
    },
  ]),
  2: classicTemplate('classic-black-2-photo.svg', [
    {
      slotNumber: 1,
      sourcePhotoSlot: 1,
      x: 130,
      y: 150,
      width: 940,
      height: 520,
      borderRadius: 0,
      zIndex: 10,
      objectFit: 'cover',
      objectPosition: 'center',
    },
    {
      slotNumber: 2,
      sourcePhotoSlot: 2,
      x: 130,
      y: 740,
      width: 940,
      height: 520,
      borderRadius: 0,
      zIndex: 10,
      objectFit: 'cover',
      objectPosition: 'center',
    },
  ]),
  3: classicTemplate('classic-black-3-photo.svg', [
    {
      slotNumber: 1,
      sourcePhotoSlot: 1,
      x: 145,
      y: 140,
      width: 910,
      height: 340,
      borderRadius: 0,
      zIndex: 10,
      objectFit: 'cover',
      objectPosition: 'center',
    },
    {
      slotNumber: 2,
      sourcePhotoSlot: 2,
      x: 145,
      y: 520,
      width: 910,
      height: 340,
      borderRadius: 0,
      zIndex: 10,
      objectFit: 'cover',
      objectPosition: 'center',
    },
    {
      slotNumber: 3,
      sourcePhotoSlot: 3,
      x: 145,
      y: 900,
      width: 910,
      height: 340,
      borderRadius: 0,
      zIndex: 10,
      objectFit: 'cover',
      objectPosition: 'center',
    },
  ]),
};

// Example of the correct mapping pattern:
// Each frame must define a template for each grid count it supports.
// The key must match frame.photoSlots value.
// Example:
// const exampleFrame: FrameConfig = {
//   id: 'example-frame',
//   name: 'Example Frame',
//   previewUrl: 'https://example.com/preview.jpg',
//   theme: 'bg-white border-zinc-200 text-zinc-900',
//   photoSlots: 3,
//   templatesByPhotoSlots: {
//     1: classicTemplate('example-1-photo.svg', [
//       { slotNumber: 1, sourcePhotoSlot: 1, x: 140, y: 180, width: 920, height: 1180, borderRadius: 0, zIndex: 10, objectFit: 'cover', objectPosition: 'center' },
//     ]),
//     2: classicTemplate('example-2-photo.svg', [
//       { slotNumber: 1, sourcePhotoSlot: 1, x: 120, y: 180, width: 960, height: 500, borderRadius: 0, zIndex: 10, objectFit: 'cover', objectPosition: 'center' },
//       { slotNumber: 2, sourcePhotoSlot: 2, x: 120, y: 760, width: 960, height: 500, borderRadius: 0, zIndex: 10, objectFit: 'cover', objectPosition: 'center' },
//     ]),
//     3: classicTemplate('example-3-photo.svg', [
//       { slotNumber: 1, sourcePhotoSlot: 1, x: 150, y: 150, width: 900, height: 330, borderRadius: 0, zIndex: 10, objectFit: 'cover', objectPosition: 'center' },
//       { slotNumber: 2, sourcePhotoSlot: 2, x: 150, y: 520, width: 900, height: 330, borderRadius: 0, zIndex: 10, objectFit: 'cover', objectPosition: 'center' },
//       { slotNumber: 3, sourcePhotoSlot: 3, x: 150, y: 890, width: 900, height: 330, borderRadius: 0, zIndex: 10, objectFit: 'cover', objectPosition: 'center' },
//     ]),
//   },
// };

export const MOCK_LAYOUTS: LayoutConfig[] = [
  {
    id: 'layout-1',
    name: 'Single Portrait',
    photoSlots: 1,
    aspectRatio: '3:4',
    previewUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=200',
  },
  {
    id: 'layout-2',
    name: 'Double Strip',
    photoSlots: 2,
    aspectRatio: '1:2',
    previewUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=200',
  },
  {
    id: 'layout-3',
    name: 'Classic 3-Photo',
    photoSlots: 3,
    aspectRatio: '3:4',
    previewUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=200',
  },
];

export const MOCK_FRAMES: FrameConfig[] = [
  {
    id: 'frame-static-3-photo',
    name: 'Biru Culture',
    previewUrl: publicAsset('frame-templates/3-photo.png'),
    theme: 'bg-blue-600 border-blue-400 text-white',
    photoSlots: 3,
    templatesByPhotoSlots: {
      3: customThreePhotoTemplate[3],
    },
  },
  {
  id: 'frame-static-photo-2-static',
  name: 'Biru Lucu',
  previewUrl: '/frame-templates/1.png',
  theme: 'bg-zinc-950 border-zinc-900 text-white',
  photoSlots: 8,
  templatesByPhotoSlots: {
    8: {
  assetUrl: "/frame-templates/1.png",
  width: 1200,
  height: 1600,
  backgroundColor: "#26c942",
  frameLayerZIndex: 30,
  photoSlots: [
    {
      slotNumber: 1,
      sourcePhotoSlot: 1,
      x: 103.75706401839966,
      y: 164.33779752649036,
      width: 404.5406534548326,
      height: 245.8916502255318,
      borderRadius: 0,
      zIndex: 10,
      objectFit: "cover",
      objectPosition: "center"
    },
    {
      slotNumber: 2,
      sourcePhotoSlot: 2,
      x: 696.2928231267492,
      y: 161.6889080183809,
      width: 404.5406534548326,
      height: 245.8916502255318,
      borderRadius: 0,
      zIndex: 10,
      objectFit: "cover",
      objectPosition: "center"
    },
    {
      slotNumber: 3,
      sourcePhotoSlot: 3,
      x: 98.46049051871319,
      y: 458.56829518907097,
      width: 404.5406534548326,
      height: 245.8916502255318,
      borderRadius: 0,
      zIndex: 10,
      objectFit: "cover",
      objectPosition: "center"
    },
    {
      slotNumber: 4,
      sourcePhotoSlot: 4,
      x: 694.8610663600857,
      y: 455.9194852950323,
      width: 404.5406534548326,
      height: 245.8916502255318,
      borderRadius: 0,
      zIndex: 10,
      objectFit: "cover",
      objectPosition: "center"
    },
    {
      slotNumber: 5,
      sourcePhotoSlot: 5,
      x: 104.75832741155813,
      y: 747.0016146728733,
      width: 404.5406534548326,
      height: 245.8916502255318,
      borderRadius: 0,
      zIndex: 10,
      objectFit: "cover",
      objectPosition: "center"
    },
    {
      slotNumber: 6,
      sourcePhotoSlot: 6,
      x: 691.4968216138357,
      y: 744.3528047788346,
      width: 404.5406534548326,
      height: 245.8916502255318,
      borderRadius: 0,
      zIndex: 10,
      objectFit: "cover",
      objectPosition: "center"
    },
    {
      slotNumber: 7,
      sourcePhotoSlot: 7,
      x: 97.52922612574753,
      y: 1035.4349341566758,
      width: 404.5406534548326,
      height: 245.8916502255318,
      borderRadius: 0,
      zIndex: 10,
      objectFit: "cover",
      objectPosition: "center"
    },
    {
      slotNumber: 8,
      sourcePhotoSlot: 8,
      x: 690.0649852340971,
      y: 1032.7861242626373,
      width: 404.5406534548326,
      height: 245.8916502255318,
      borderRadius: 0,
      zIndex: 10,
      objectFit: "cover",
      objectPosition: "center"
    }
  ]
},
  },
},
{
  id: 'custom-static-frame-2',
  name: 'Merah Cinta',
  previewUrl: '/frame-templates/2.png',
  theme: 'bg-zinc-950 border-zinc-900 text-white',
  photoSlots: 6,
  templatesByPhotoSlots: {
    6: {
  assetUrl: "/frame-templates/2.png",
  width: 1200,
  height: 1600,
  backgroundColor: "#ec3c3c",
  frameLayerZIndex: 30,
  photoSlots: [
    {
      slotNumber: 1,
      sourcePhotoSlot: 1,
      x: 92.16265362586813,
      y: 131.4864046534425,
      width: 495.3642845527879,
      height: 385.02734992125676,
      borderRadius: 0,
      zIndex: 10,
      objectFit: "cover",
      objectPosition: "center"
    },
    {
      slotNumber: 2,
      sourcePhotoSlot: 2,
      x: 609.3342077945049,
      y: 128.83761466292157,
      width: 495.3642845527879,
      height: 385.02734992125676,
      borderRadius: 0,
      zIndex: 10,
      objectFit: "cover",
      objectPosition: "center"
    },
    {
      slotNumber: 3,
      sourcePhotoSlot: 3,
      x: 90.7308968592045,
      y: 543.5959436630934,
      width: 495.3642845527879,
      height: 385.02734992125676,
      borderRadius: 0,
      zIndex: 10,
      objectFit: "cover",
      objectPosition: "center"
    },
    {
      slotNumber: 4,
      sourcePhotoSlot: 4,
      x: 607.9024510278414,
      y: 540.9470541549839,
      width: 495.3642845527879,
      height: 385.02734992125676,
      borderRadius: 0,
      zIndex: 10,
      objectFit: "cover",
      objectPosition: "center"
    },
    {
      slotNumber: 5,
      sourcePhotoSlot: 5,
      x: 93.16395682556401,
      y: 973.0972759548092,
      width: 495.3642845527879,
      height: 385.02734992125676,
      borderRadius: 0,
      zIndex: 10,
      objectFit: "cover",
      objectPosition: "center"
    },
    {
      slotNumber: 6,
      sourcePhotoSlot: 6,
      x: 606.4706544546402,
      y: 949.191668387492,
      width: 495.3642845527879,
      height: 385.02734992125676,
      borderRadius: 0,
      zIndex: 10,
      objectFit: "cover",
      objectPosition: "center"
    }
  ]
},
  },
},
{
  id: 'custom-static-frame-3',
  name: 'Koran 1',
  previewUrl: '/frame-templates/3.png',
  theme: 'bg-zinc-950 border-zinc-900 text-white',
  photoSlots: 6,
  templatesByPhotoSlots: {
    6: {
  assetUrl: "/frame-templates/3.png",
  width: 1200,
  height: 1600,
  backgroundColor: "#ec2727",
  frameLayerZIndex: 30,
  photoSlots: [
    {
      slotNumber: 1,
      sourcePhotoSlot: 1,
      x: 58.16265362586819,
      y: 256.38260345475305,
      width: 536.8009356659344,
      height: 377.42664496353905,
      borderRadius: 0,
      zIndex: 10,
      objectFit: "cover",
      objectPosition: "center"
    },
    {
      slotNumber: 2,
      sourcePhotoSlot: 2,
      x: 604.3204527117906,
      y: 255.6662659010446,
      width: 536.8009356659344,
      height: 377.42664496353905,
      borderRadius: 0,
      zIndex: 10,
      objectFit: "cover",
      objectPosition: "center"
    },
    {
      slotNumber: 3,
      sourcePhotoSlot: 3,
      x: 56.73089685920456,
      y: 625.9784077932222,
      width: 536.8009356659344,
      height: 377.42664496353905,
      borderRadius: 0,
      zIndex: 10,
      objectFit: "cover",
      objectPosition: "center"
    },
    {
      slotNumber: 4,
      sourcePhotoSlot: 4,
      x: 600.9562477720779,
      y: 634.9242727130235,
      width: 536.8009356659344,
      height: 377.42664496353905,
      borderRadius: 0,
      zIndex: 10,
      objectFit: "cover",
      objectPosition: "center"
    },
    {
      slotNumber: 5,
      sourcePhotoSlot: 5,
      x: 63.028773558587034,
      y: 1003.3040218789419,
      width: 536.8009356659344,
      height: 377.42664496353905,
      borderRadius: 0,
      zIndex: 10,
      objectFit: "cover",
      objectPosition: "center"
    },
    {
      slotNumber: 6,
      sourcePhotoSlot: 6,
      x: 597.5920428323652,
      y: 1002.5874454830214,
      width: 536.8009356659344,
      height: 377.42664496353905,
      borderRadius: 0,
      zIndex: 10,
      objectFit: "cover",
      objectPosition: "center"
    }
  ]
},
  },
},
{
  id: 'custom-static-frame-4',
  name: 'Amplop',
  previewUrl: '/frame-templates/4.png',
  theme: 'bg-zinc-950 border-zinc-900 text-white',
  photoSlots: 6,
  templatesByPhotoSlots: {
    6: {
  assetUrl: "/frame-templates/4.png",
  width: 1200,
  height: 1600,
  backgroundColor: "#34d54f",
  frameLayerZIndex: 30,
  photoSlots: [
    {
      slotNumber: 1,
      sourcePhotoSlot: 1,
      x: 193.43191599281397,
      y: 350.57331004621767,
      width: 378.34297193353825,
      height: 291.14016388888194,
      borderRadius: 0,
      zIndex: 10,
      objectFit: "cover",
      objectPosition: "center"
    },
    {
      slotNumber: 2,
      sourcePhotoSlot: 2,
      x: 631.374448488715,
      y: 345.9920278118488,
      width: 378.34297193353825,
      height: 291.14016388888194,
      borderRadius: 0,
      zIndex: 10,
      objectFit: "cover",
      objectPosition: "center"
    },
    {
      slotNumber: 3,
      sourcePhotoSlot: 3,
      x: 190.06771105310116,
      y: 687.3175622834974,
      width: 378.34297193353825,
      height: 291.14016388888194,
      borderRadius: 0,
      zIndex: 10,
      objectFit: "cover",
      objectPosition: "center"
    },
    {
      slotNumber: 4,
      sourcePhotoSlot: 4,
      x: 631.8750602820253,
      y: 690.4662490245204,
      width: 378.34297193353825,
      height: 291.14016388888194,
      borderRadius: 0,
      zIndex: 10,
      objectFit: "cover",
      objectPosition: "center"
    },
    {
      slotNumber: 5,
      sourcePhotoSlot: 5,
      x: 190.56832284641155,
      y: 1033.7241762224285,
      width: 378.34297193353825,
      height: 291.14016388888194,
      borderRadius: 0,
      zIndex: 10,
      objectFit: "cover",
      objectPosition: "center"
    },
    {
      slotNumber: 6,
      sourcePhotoSlot: 6,
      x: 630.4432239022866,
      y: 1031.0754459424606,
      width: 378.34297193353825,
      height: 291.14016388888194,
      borderRadius: 0,
      zIndex: 10,
      objectFit: "cover",
      objectPosition: "center"
    }
  ]
},
  },
},
{
  id: 'custom-static-frame-5',
  name: 'Lemonade',
  previewUrl: '/frame-templates/5.png',
  theme: 'bg-zinc-950 border-zinc-900 text-white',
  photoSlots: 1,
  templatesByPhotoSlots: {
    1: {
  assetUrl: "/frame-templates/5.png",
  width: 1200,
  height: 1600,
  backgroundColor: "#111111",
  frameLayerZIndex: 30,
  photoSlots: [
    {
      slotNumber: 1,
      sourcePhotoSlot: 1,
      x: 65.89232689845164,
      y: 511.0284595423684,
      width: 1048.8910236987558,
      height: 613.8576309672196,
      borderRadius: 0,
      zIndex: 10,
      objectFit: "cover",
      objectPosition: "center"
    }
  ]
},
  },
},
{
  id: 'custom-static-frame',
  name: 'Kertas Memori',
  previewUrl: '/frame-templates/6.png',
  theme: 'bg-zinc-950 border-zinc-900 text-white',
  photoSlots: 6,
  templatesByPhotoSlots: {
    6: {
  assetUrl: "/frame-templates/6.png",
  width: 1200,
  height: 1600,
  backgroundColor: "#111111",
  frameLayerZIndex: 35,
  photoSlots: [
    {
      slotNumber: 1,
      sourcePhotoSlot: 1,
      x: 81.35159383054378,
      y: 525.2309031967534,
      width: 538.7333838389834,
      height: 533.889391176273,
      borderRadius: 0,
      zIndex: 10,
      objectFit: "cover",
      objectPosition: "center"
    },
    {
      slotNumber: 2,
      sourcePhotoSlot: 2,
      x: 545.1019784446272,
      y: 472.75514941321904,
      width: 516.2941201564315,
      height: 296.0326417690247,
      borderRadius: 0,
      zIndex: 11,
      objectFit: "cover",
      objectPosition: "center"
    },
    {
      slotNumber: 3,
      sourcePhotoSlot: 3,
      x: 594.5652659697028,
      y: 760.0753547180043,
      width: 522.2779981106489,
      height: 308.0003085045244,
      borderRadius: 0,
      zIndex: 12,
      objectFit: "cover",
      objectPosition: "center"
    },
    {
      slotNumber: 4,
      sourcePhotoSlot: 4,
      x: 69.58960508000396,
      y: 1090.7781429520398,
      width: 353.23746636430496,
      height: 363.3507173974161,
      borderRadius: 0,
      zIndex: 10,
      objectFit: "cover",
      objectPosition: "center",
      rotation: -2
    },
    {
      slotNumber: 5,
      sourcePhotoSlot: 5,
      x: 425.71967161464113,
      y: 1078.9074760100416,
      width: 353.23746636430496,
      height: 363.3507173974161,
      borderRadius: 0,
      zIndex: 10,
      objectFit: "cover",
      objectPosition: "center",
      rotation: -2
    },
    {
      slotNumber: 6,
      sourcePhotoSlot: 6,
      x: 774.3700897391947,
      y: 1058.0611983410422,
      width: 353.23746636430496,
      height: 363.3507173974161,
      borderRadius: 0,
      zIndex: 10,
      objectFit: "cover",
      objectPosition: "center",
      rotation: -2
    }
  ]
},
  },
},
{
  id: 'custom-static-frame-7-static',
  name: 'Koran 2',
  previewUrl: '/frame-templates/7.png',
  theme: 'bg-zinc-950 border-zinc-900 text-white',
  photoSlots: 3,
  templatesByPhotoSlots: {
    3: {
  assetUrl: "/frame-templates/7.png",
  width: 1200,
  height: 1600,
  backgroundColor: "#111111",
  frameLayerZIndex: 30,
  photoSlots: [
    {
      slotNumber: 1,
      sourcePhotoSlot: 1,
      x: 29.17644851512,
      y: 530.2903317833468,
      width: 1139.714654796711,
      height: 472.7894589311644,
      borderRadius: 0,
      zIndex: 10,
      objectFit: "cover",
      objectPosition: "center"
    },
    {
      slotNumber: 2,
      sourcePhotoSlot: 2,
      x: 448.7009793270717,
      y: 1026.211185445221,
      width: 301.0463188207766,
      height: 211.9099921464034,
      borderRadius: 0,
      zIndex: 10,
      objectFit: "cover",
      objectPosition: "center"
    },
    {
      slotNumber: 3,
      sourcePhotoSlot: 3,
      x: 38.31285536871758,
      y: 1238.0632226946543,
      width: 374.4781552005153,
      height: 316.2617470146796,
      borderRadius: 0,
      zIndex: 10,
      objectFit: "cover",
      objectPosition: "center"
    }
  ]
},
  },
},


];


