export type SceneRandomSource = () => number
export type SceneRandomSeed = number | string

export type SceneRandom = {
    readonly next: SceneRandomSource
    readonly index: (length: number) => number
    /** An index other than `excludedIndex`, so a repeated choice never repeats itself. */
    readonly differentIndex: (length: number, excludedIndex: number) => number
    readonly item: <Item>(items: readonly Item[]) => Item | undefined
    readonly shuffle: <Item>(items: readonly Item[]) => Item[]
}

/** Returns a shuffled copy without mutating the source collection. */
export const shuffle = <Item>(
    items: readonly Item[],
    random: () => number = Math.random
): Item[] => {
    const shuffled = [...items]
    for (let index = shuffled.length - 1; index > 0; index -= 1) {
        const randomIndex = Math.floor(random() * (index + 1))
        const current = shuffled[index]
        const replacement = shuffled[randomIndex]
        if (current === undefined || replacement === undefined) continue
        shuffled[index] = replacement
        shuffled[randomIndex] = current
    }
    return shuffled
}

export const getRandomIndex = (itemCount: number, random: () => number = Math.random): number =>
    itemCount <= 0 ? -1 : Math.floor(random() * itemCount)

export const getDifferentRandomIndex = (
    itemCount: number,
    excludedIndex: number,
    random: () => number = Math.random
): number => {
    if (itemCount <= 0) return -1
    if (itemCount === 1) return 0
    if (excludedIndex < 0 || excludedIndex >= itemCount) {
        return getRandomIndex(itemCount, random)
    }

    const compactIndex = getRandomIndex(itemCount - 1, random)
    return compactIndex >= excludedIndex ? compactIndex + 1 : compactIndex
}

export const getRandomItem = <Item>(
    items: readonly Item[],
    random: () => number = Math.random
): Item | undefined => items[getRandomIndex(items.length, random)]

const hashSeed = (seed: SceneRandomSeed): number => {
    const text = String(seed)
    let hash = 2166136261
    for (let index = 0; index < text.length; index += 1) {
        hash ^= text.charCodeAt(index)
        hash = Math.imul(hash, 16777619)
    }
    return hash >>> 0
}

/** Small deterministic PRNG suitable for reproducible animation choices. */
export const createSeededRandom = (seed: SceneRandomSeed): SceneRandomSource => {
    let state = hashSeed(seed)
    return () => {
        state = (state + 0x6d2b79f5) >>> 0
        let value = state
        value = Math.imul(value ^ (value >>> 15), value | 1)
        value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
        return ((value ^ (value >>> 14)) >>> 0) / 4294967296
    }
}

/** Creates the random facade used by SDK scenes. Omit the seed for Math.random behavior. */
export const createSceneRandom = (seed?: SceneRandomSeed): SceneRandom => {
    const next = seed === undefined ? Math.random : createSeededRandom(seed)
    return {
        next,
        index: (length) => getRandomIndex(length, next),
        differentIndex: (length, excludedIndex) =>
            getDifferentRandomIndex(length, excludedIndex, next),
        item: (items) => getRandomItem(items, next),
        shuffle: (items) => shuffle(items, next),
    }
}
