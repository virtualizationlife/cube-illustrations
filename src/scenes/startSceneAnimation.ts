export type SceneAnimationErrorHandler = (error: unknown, animationName: string) => void

const reportAnimationError: SceneAnimationErrorHandler = (error, animationName) => {
    console.error(`[cube-illustrations] ${animationName} animation stopped`, error)
}

/** Starts a background animation task and prevents rejected promises from failing silently. */
export const startSceneAnimation = (
    animationName: string,
    play: () => Promise<void>,
    onError: SceneAnimationErrorHandler = reportAnimationError
): Promise<void> =>
    play().catch((error: unknown) => {
        onError(error, animationName)
    })
