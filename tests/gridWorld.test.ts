import { describe, expect, it } from 'vitest'

import { createGridWorld } from '../src/scenes/gridWorld'

describe('grid world', () => {
    it('models collision-safe movement without a rendering dependency', async () => {
        const world = createGridWorld()
        world.addCube({ id: 'main', position: { column: 0, row: 0 } })
        world.addCube({ id: 'blocker', position: { column: 1, row: 0 } })

        const movement = world.moveCubeTo(
            'main',
            { column: 2, row: 0 },
            { duration: 1, easing: 'linear' }
        )
        world.update(0.5)
        expect(world.getCubePosition('main')).not.toEqual({ column: 1, row: 0 })
        world.update(0.5)
        await movement

        expect(world.getCubePosition('main')).toEqual({ column: 2, row: 0 })
    })

    it('reserves a moving cube route until the movement completes', async () => {
        const world = createGridWorld()
        world.addCube({ id: 'leader', position: { column: 0, row: 0 } })
        world.addCube({ id: 'follower', position: { column: -1, row: 0 } })

        const leadingMove = world.moveCubeTo(
            'leader',
            { column: 2, row: 0 },
            { duration: 1, easing: 'linear' }
        )
        world.update(0.25)
        await world.moveCubeTo(
            'follower',
            { column: 0, row: 0 },
            { duration: 1 }
        )

        expect(world.getCubePosition('follower')).toEqual({ column: -1, row: 0 })
        world.update(0.75)
        await leadingMove
    })

    it('tracks a traveling cube with the grid focus', async () => {
        const world = createGridWorld()
        world.addCube({ id: 'main' })
        const travel = world.travelWithCube(
            'main',
            { column: 2, row: -1 },
            { duration: 1, easing: 'linear' }
        )

        world.update(0.5)
        expect(world.getGridFocus()).toEqual(world.getCubePosition('main'))
        world.update(0.5)
        await travel
    })
})
