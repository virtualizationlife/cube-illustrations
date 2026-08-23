/** Returns a shuffled copy without mutating the source collection. */
export const shuffle = <Item,>(
    items: readonly Item[],
    random: () => number = Math.random
): Item[] => {
    const shuffled = [...items]
    for (let index = shuffled.length - 1; index > 0; index -= 1) {
        const randomIndex = Math.floor(random() * (index + 1))
        const current = shuffled[index]
        shuffled[index] = shuffled[randomIndex]
        shuffled[randomIndex] = current
    }
    return shuffled
}

export const getRandomIndex = (
    itemCount: number,
    random: () => number = Math.random
): number => (itemCount <= 0 ? -1 : Math.floor(random() * itemCount))

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

export const getRandomItem = <Item,>(
    items: readonly Item[],
    random: () => number = Math.random
): Item | undefined => items[getRandomIndex(items.length, random)]
