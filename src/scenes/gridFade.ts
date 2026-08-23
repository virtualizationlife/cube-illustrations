export interface GridFadeRadii {
    readonly innerRadiusCells: number
    readonly outerRadiusCells: number
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
        innerRadiusCells:
            outerRadiusCells * Math.min(1, Math.max(0, opaqueRadiusRatio)),
        outerRadiusCells,
    }
}
