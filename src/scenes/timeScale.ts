/**
 * One multiplier for how fast every scene plays. Authored durations stay readable — a
 * scene still says 0.42 seconds — while the whole gallery can be sped up or slowed down
 * from a single place.
 *
 * It works by scaling the clock, not individual durations: each frame advances the scene
 * by `delta * scale`, so grid transitions, cube fades, per-frame physics, `elapsed` and
 * presentation smoothing all change together. Waits in `timeline.wait` run on real timers
 * and are converted separately by `scaleSceneDuration`.
 */
let sceneTimeScale = 1

/** Values above 1 play faster; 0.5 plays at half speed. Ignores values that are not finite. */
export const setSceneTimeScale = (scale: number): void => {
    if (!Number.isFinite(scale)) return
    sceneTimeScale = Math.max(0.01, scale)
}

export const getSceneTimeScale = (): number => sceneTimeScale

/** Converts an authored duration into the real seconds a timer should wait. */
export const scaleSceneDuration = (durationSeconds: number): number =>
    Math.max(0, durationSeconds) / sceneTimeScale
