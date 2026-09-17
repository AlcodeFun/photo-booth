export interface CanvasPoint {
  x: number;
  y: number;
}

export type DragState =
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
      origin: {
        x: number;
        y: number;
      };
    }
  | {
      type: 'resize';
      areaSlotNumber: number;
      start: CanvasPoint;
      current: CanvasPoint;
      origin: {
        x: number;
        y: number;
        width: number;
        height: number;
      };
    };

export interface DrawingRectangle {
  x: number;
  y: number;
  width: number;
  height: number;
}