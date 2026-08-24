export type GridFadeRadii = {
    readonly innerRadiusCells: number
    readonly outerRadiusCells: number
}

export type GridVisibility =
    | {
          readonly shape: 'radial'
          readonly innerRadiusCells: number
          readonly outerRadiusCells: number
      }
    | {
          readonly shape: 'rounded-rectangle'
          /** Width of the fully visible rectangular area, measured in grid cells. */
          readonly widthCells: number
          /** Height of the fully visible rectangular area, measured in grid cells. */
          readonly heightCells: number
          /** Radius of each corner, measured in grid cells. */
          readonly cornerRadiusCells: number
          /** Width of the soft fade beyond the rounded boundary, measured in grid cells. */
          readonly fadeCells: number
      }

/** Nominal distance from the grid center to its outermost regular cell. */
export const getMaximumGridFadeRadiusCells = (gridCellCount: number): number =>
    Math.ceil(Math.max(0, gridCellCount) / 2)

/** Keeps a compact opaque center and uses most of the radius for a gradual fade. */
export const getWideGridFadeRadii = (
    gridCellCount: number,
    opaqueRadiusRatio = 0.4
): GridFadeRadii => {
    const outerRadiusCells = getMaximumGridFadeRadiusCells(gridCellCount)
    return {
        innerRadiusCells: outerRadiusCells * Math.min(1, Math.max(0, opaqueRadiusRatio)),
        outerRadiusCells,
    }
}
