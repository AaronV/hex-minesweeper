export function generateRectangleMask(rows: number, cols: number): boolean[] {
  return new Array<boolean>(rows * cols).fill(true)
}
