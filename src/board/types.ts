export interface BoardLayout {
  centers: Array<{ x: number; y: number }>
  radius: number
}

export interface CameraState {
  zoom: number
  panX: number
  panY: number
}
