/**
 * 2048 — the pure game logic, kept out of the component so `npm test` can assert
 * the merge rules (see scripts/test.mjs).
 *
 * A board is a flat list of tiles: { id, row, col, value, isNew, merged }.
 * Ids are stable across a move so React keys survive and tiles can slide with CSS.
 */

export const SIZE = 4
export const WIN = 2048

let nextId = 1
const makeTile = (row, col, value) => ({ id: nextId++, row, col, value, isNew: true, merged: false })
const mergedTile = (row, col, value) => ({ id: nextId++, row, col, value, isNew: false, merged: true })

/** Keep freshly minted ids clear of a board restored from localStorage. */
export const adoptIds = (tiles) => {
    for (const t of tiles) if (t.id >= nextId) nextId = t.id + 1
    return tiles
}

export const tileAt = (tiles, row, col) => tiles.find(t => t.row === row && t.col === col) || null

/**
 * Is this a board we can safely render? Guards a restored (or hand-edited)
 * localStorage blob: stray values, off-board or stacked tiles and duplicate ids
 * would all break the grid or React's keys.
 */
export const isValidBoard = (tiles) => {
    if (!Array.isArray(tiles) || !tiles.length || tiles.length > SIZE * SIZE) return false
    const cells = new Set()
    const ids = new Set()
    for (const t of tiles) {
        if (!t || typeof t !== 'object') return false
        if (!Number.isInteger(t.row) || t.row < 0 || t.row >= SIZE) return false
        if (!Number.isInteger(t.col) || t.col < 0 || t.col >= SIZE) return false
        if (!Number.isInteger(t.value) || t.value < 2 || !Number.isInteger(Math.log2(t.value))) return false
        if (!Number.isInteger(t.id)) return false
        const cell = t.row * SIZE + t.col
        if (cells.has(cell) || ids.has(t.id)) return false
        cells.add(cell)
        ids.add(t.id)
    }
    return true
}

/** Drop the per-move animation flags a restored board shouldn't replay. */
export const normalizeBoard = (tiles) => tiles.map(t => ({
    id: t.id, row: t.row, col: t.col, value: t.value, isNew: false, merged: false
}))

export const emptyCells = (tiles) => {
    const taken = new Set(tiles.map(t => t.row * SIZE + t.col))
    const out = []
    for (let i = 0; i < SIZE * SIZE; i++) {
        if (!taken.has(i)) out.push({ row: Math.floor(i / SIZE), col: i % SIZE })
    }
    return out
}

/** Drop one tile on a random free cell — 90% a 2, 10% a 4, same as the original. */
export const spawn = (tiles) => {
    const free = emptyCells(tiles)
    if (!free.length) return tiles
    const { row, col } = free[Math.floor(Math.random() * free.length)]
    return [...tiles, makeTile(row, col, Math.random() < 0.9 ? 2 : 4)]
}

export const newGame = () => spawn(spawn([]))

const VEC = { up: [-1, 0], down: [1, 0], left: [0, -1], right: [0, 1] }

/** Visit cells starting from the edge the tiles move toward, so they settle in order. */
const traversal = (dr, dc) => {
    const rows = [0, 1, 2, 3]
    const cols = [0, 1, 2, 3]
    if (dr > 0) rows.reverse()
    if (dc > 0) cols.reverse()
    return { rows, cols }
}

/**
 * Slide + merge every tile in `dir`.
 *
 * Returns { tiles, dead, gained, moved }:
 *   tiles  — survivors at their new positions (a merge target carries merged: true)
 *   dead   — tiles consumed by a merge, parked on the target cell for one beat so
 *            they can be rendered sliding in before they vanish
 *   gained — score earned (sum of the tiles created by merges)
 *   moved  — false when nothing shifted or merged; the caller must not spawn then
 */
export const move = (tiles, dir) => {
    const vec = VEC[dir]
    if (!vec) return { tiles, dead: [], gained: 0, moved: false }
    const [dr, dc] = vec

    // work on copies in a grid so positions can be mutated freely
    const grid = Array.from({ length: SIZE }, () => Array(SIZE).fill(null))
    for (const t of tiles) grid[t.row][t.col] = { ...t, isNew: false, merged: false }

    const dead = []
    let gained = 0
    let moved = false
    const { rows, cols } = traversal(dr, dc)
    const inside = (r, c) => r >= 0 && r < SIZE && c >= 0 && c < SIZE

    for (const r of rows) {
        for (const c of cols) {
            const tile = grid[r][c]
            if (!tile) continue

            // slide until the next cell is blocked or off the board
            let row = r
            let col = c
            let nr = row + dr
            let nc = col + dc
            while (inside(nr, nc) && !grid[nr][nc]) {
                grid[row][col] = null
                row = nr
                col = nc
                grid[row][col] = tile
                tile.row = row
                tile.col = col
                moved = true
                nr = row + dr
                nc = col + dc
            }

            // merge into the blocker — but only once per tile per move.
            // Like the original, the result is a brand-new tile and both sources
            // become "dead": they slide onto the cell, then vanish.
            if (inside(nr, nc)) {
                const target = grid[nr][nc]
                if (target && target.value === tile.value && !target.merged) {
                    const result = mergedTile(nr, nc, target.value * 2)
                    gained += result.value
                    grid[nr][nc] = result
                    grid[row][col] = null
                    dead.push({ ...tile, row: nr, col: nc }, { ...target })
                    moved = true
                }
            }
        }
    }

    // Always hand back the same id order, whatever the traversal was: React keys
    // its tiles by id, and reordering the DOM nodes cancels the CSS slide — that
    // made 'down'/'right' snap into place instead of animating.
    const out = []
    for (const r of rows) for (const c of cols) if (grid[r][c]) out.push(grid[r][c])
    out.sort((a, b) => a.id - b.id)
    return { tiles: out, dead, gained, moved }
}

/** Any empty cell, or any pair of equal neighbours, means the game can continue. */
export const canMove = (tiles) => {
    if (tiles.length < SIZE * SIZE) return true
    for (const t of tiles) {
        const right = tileAt(tiles, t.row, t.col + 1)
        const down = tileAt(tiles, t.row + 1, t.col)
        if ((right && right.value === t.value) || (down && down.value === t.value)) return true
    }
    return false
}

export const maxValue = (tiles) => tiles.reduce((m, t) => Math.max(m, t.value), 0)
