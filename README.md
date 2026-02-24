# Hex Minesweeper

Hex Minesweeper is a Minesweeper-style game played on a hex grid.

## What Makes It Different
- Cells have up to 6 neighbors (not 8 like square Minesweeper).
- Boards are generated to be no-guess solvable by the smart generator.
- Multiple layout styles are available: Rectangle, Rorschach Mirror, and Snowflake.

## Goal
Reveal every non-mine cell without revealing a mine.

## How To Play
- Your first reveal starts from the designated safe start cell.
- Number hints tell you how many neighboring cells are mines.
- Use flags to mark suspected mines.
- You win when all safe cells are revealed.

## Controls
- Left click: reveal a cell
- Right click: flag/unflag a hidden cell
- Right click on a revealed numbered cell: chord reveal (if flags match)
- Drag: pan the board
- Mouse wheel: zoom
- Undo: revert your last move

## UI Notes
- `New Board` generates a fresh random seed and starts play immediately.
- `Mines` shows `flagged/total` (for example `58/65`).
- `Show Debug Tools` reveals stepped generation controls and generator logs.

## Running Locally
```bash
npm install
npm run dev
```
