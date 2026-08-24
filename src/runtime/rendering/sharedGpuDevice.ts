/**
 * A single `GPUDevice` shared by every scene on the page.
 *
 * Each `WebGPURenderer` otherwise requests its own adapter and device, so a page with many
 * scenes ends up with many devices, many swap chains and many duplicated backend caches.
 * three only destroys a device the backend created itself, so a device handed in here
 * survives an individual scene unmounting.
 */

let devicePromise: Promise<GPUDevice | null> | null = null

const requestSharedDevice = async (): Promise<GPUDevice | null> => {
    if (typeof navigator === 'undefined' || navigator.gpu === undefined) return null
    try {
        const adapter = await navigator.gpu.requestAdapter()
        if (adapter === null) return null
        return await adapter.requestDevice()
    } catch {
        return null
    }
}

/**
 * Resolves to the shared device, or to `null` when WebGPU is unavailable — in which case
 * the caller should let the renderer pick its own backend instead of failing outright.
 */
export const getSharedGpuDevice = async (): Promise<GPUDevice | null> => {
    devicePromise ??= requestSharedDevice()
    return devicePromise
}

/** Test seam: forgets the cached device so the next call requests a fresh one. */
export const resetSharedGpuDevice = (): void => {
    devicePromise = null
}
