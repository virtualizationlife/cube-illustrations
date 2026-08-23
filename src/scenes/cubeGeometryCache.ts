import type * as ThreeWebGpuNamespace from 'three/webgpu'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js'

/**
 * `three/webgpu` defaults `BufferGeometry` to the attribute union that also permits
 * `GLBufferAttribute`, while `Mesh` and `LineSegments` accept only the normal one. The
 * geometries built here never hold a `GLBufferAttribute`, so they are narrowed on the way
 * out rather than forcing every consumer to widen.
 */
type CubeBufferGeometry = ThreeWebGpuNamespace.BufferGeometry<
    ThreeWebGpuNamespace.NormalBufferAttributes
>

const narrowGeometry = (
    geometry: ThreeWebGpuNamespace.BufferGeometry<ThreeWebGpuNamespace.NormalOrGLBufferAttributes>
): CubeBufferGeometry => geometry as CubeBufferGeometry

const ROUNDED_BODY_SEGMENTS = 3
const ROUNDED_EDGE_SEGMENTS = 1
const ROUNDED_EDGE_THRESHOLD_DEG = 30

export interface CubeGeometrySet {
    readonly body: CubeBufferGeometry
    readonly edges: CubeBufferGeometry
}

export interface CubeGeometryCache {
    /** Returns shared geometry for the given cube shape, adding one reference to it. */
    readonly acquire: (size: number, cornerRadius: number) => CubeGeometrySet
    /** Drops one reference; the geometry is disposed once nothing holds it. */
    readonly release: (size: number, cornerRadius: number) => void
    readonly dispose: () => void
}

interface CacheEntry extends CubeGeometrySet {
    references: number
}

const getCacheKey = (size: number, cornerRadius: number): string => `${size}:${cornerRadius}`

/**
 * Cubes of the same size and corner radius share one body geometry and one edges geometry.
 *
 * `EdgesGeometry` runs a full edge-merge pass over the source mesh, which is the most
 * expensive part of adding a cube — scenes that spawn cubes mid-animation paid it on the
 * frame the cube appeared. The cache is per-runtime so `dispose()` stays a full teardown.
 */
export const createCubeGeometryCache = (
    THREE: typeof ThreeWebGpuNamespace
): CubeGeometryCache => {
    const entries = new Map<string, CacheEntry>()

    const createGeometrySet = (size: number, cornerRadius: number): CubeGeometrySet => {
        // `mergeVertices` only welds vertices whose every attribute matches, so hard normal
        // and UV seams survive and the mesh rasterises identically — it just stops storing
        // the shared corners several times over.
        const body: CubeBufferGeometry =
            cornerRadius === 0
                ? new THREE.BoxGeometry(size, size, size)
                : narrowGeometry(
                      mergeVertices(
                          new RoundedBoxGeometry(
                              size,
                              size,
                              size,
                              ROUNDED_BODY_SEGMENTS,
                              cornerRadius
                          )
                      )
                  )
        const edgeSource: CubeBufferGeometry =
            cornerRadius === 0
                ? body
                : narrowGeometry(
                      new RoundedBoxGeometry(
                          size,
                          size,
                          size,
                          ROUNDED_EDGE_SEGMENTS,
                          cornerRadius
                      )
                  )
        const edges = new THREE.EdgesGeometry(
            edgeSource,
            cornerRadius === 0 ? 1 : ROUNDED_EDGE_THRESHOLD_DEG
        )
        if (edgeSource !== body) edgeSource.dispose()
        return { body, edges }
    }

    const disposeEntry = (entry: CacheEntry): void => {
        entry.body.dispose()
        entry.edges.dispose()
    }

    return {
        acquire: (size, cornerRadius) => {
            const key = getCacheKey(size, cornerRadius)
            const existing = entries.get(key)
            if (existing !== undefined) {
                existing.references += 1
                return existing
            }
            const entry: CacheEntry = { ...createGeometrySet(size, cornerRadius), references: 1 }
            entries.set(key, entry)
            return entry
        },
        release: (size, cornerRadius) => {
            const key = getCacheKey(size, cornerRadius)
            const entry = entries.get(key)
            if (entry === undefined) return
            entry.references -= 1
            if (entry.references > 0) return
            entries.delete(key)
            disposeEntry(entry)
        },
        dispose: () => {
            for (const entry of entries.values()) disposeEntry(entry)
            entries.clear()
        },
    }
}
