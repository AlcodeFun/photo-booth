export interface CanvasPoint {
  x: number;
  y: number;
}

export type ResizeHandle = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

export type DragState =
  | {
      type: 'select';
      start: CanvasPoint;
      current: CanvasPoint;
    }
  | {
      type: 'draw';
      start: CanvasPoint;
      current: CanvasPoint;
    }
  | {
      type: 'move';
      areaSlotNumber: number;
      start: CanvasPoint;
      current: CanvasPoint;
      origins: Array<{
        slotNumber: number;
        x: number;
        y: number;
      }>;
    }
  | {
      type: 'resize';
      areaSlotNumber: number;
      handle: ResizeHandle;
      start: CanvasPoint;
      current: CanvasPoint;
      origins: Array<{
        slotNumber: number;
        x: number;
        y: number;
        width: number;
        height: number;
      }>;
    };

export interface DrawingRectangle {
  x: number;
  y: number;
  width: number;
  height: number;
}