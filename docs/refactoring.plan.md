# План рефакторинга cube-illustrations

Документ описывает пять направлений рефакторинга в порядке убывания ценности.
Каждый раздел построен одинаково: **проблема → замеры → что делать → как проверить → риск**.

Замеры сделаны по состоянию на коммит `225be98` (`main`). Объём: 12 329 строк в `src/`,
40 сцен в каталоге, 628 строк тестов.

Разделы независимы, но этап 0 (тесты на отмену) — предусловие для этапа 1, а этап 1
заметно упрощает этапы 2 и 4. Разумный порядок: 0 → 1 → 2 → 3 → 4 → 5.

---

## Сводка

| # | Направление | Эффект | Объём | Приоритет |
|---|---|---|---|---|
| 0 | Тесты на отмену сценария | страховка для этапа 1 | ~150 строк тестов | предусловие |
| 1 | Перенос 40 сцен на SDK `defineScene` | −2000…2500 строк, чинит класс багов | большой, но нарезается по 1 сцене | **высокий** |
| 2 | Единый источник каталога сцен | −78 строк ручных списков, снимает рассинхрон | средний | высокий |
| 3 | Разрезать `useSimpleCubeScene` | −1 эффект на 250 строк, чинит лишние пересборки сцены | средний | средний |
| 4 | Токены движения и пресеты сетки | 349 литералов → именованные константы | средний | средний |
| 5 | Мелочи: `scenePresentation`, документация, мёртвая ветка | точечные чистки | малый | низкий |

---

## Этап 0. Тесты на отмену сценария (предусловие)

### Проблема

Тестов 628 строк на 12 329 строк кода, и все три файла проверяют утилиты:
[`tests/gridWorld.test.ts`](../tests/gridWorld.test.ts),
[`tests/gridSceneRuntime.test.ts`](../tests/gridSceneRuntime.test.ts),
[`tests/sceneUtilities.test.ts`](../tests/sceneUtilities.test.ts).

Ни одного теста на жизненный цикл сценария — а именно там сидит баг-класс из этапа 1,
и именно эту семантику этап 1 будет массово менять в 36 файлах.

### Что делать

Добавить `tests/runSceneScript.test.ts` поверх фейкового `GridSceneRuntime`
(GPU не нужен — [`runSceneScript`](../src/scenes/runSceneScript.ts) работает с любым объектом,
удовлетворяющим интерфейсу). Проверить:

1. `dispose()` во время `delay` → сценарий не выполняет ни одной следующей команды runtime.
2. `dispose()` во время `moveCubeTo` → то же самое.
3. Отмена не логируется как ошибка (`SceneCancelledError` глотается, `onError` не зовётся).
4. Настоящая ошибка внутри сценария доходит до `onError`.
5. `completion` резолвится после отмены и не висит.

Дополнительно — тест на [`createSceneChoreography`](../src/sdk/choreography.ts):
`timeline.stagger` соблюдает задержки, `timeline.loop` прерывается отменой,
`cubes.get(id)` мемоизирует актёра.

### Как проверить

`npm test` — новые тесты зелёные до начала этапа 1.

### Риск

Низкий, новый код.

---

## Этап 1. Перенос сцен на SDK `defineScene`

Это главный этап: он даёт и наибольшее сокращение кода, и единственное исправление
реального дефекта.

### Проблема A: дублирование плиты

На [`defineScene`](../src/sdk/defineScene.tsx) переехали только две сцены из сорока двух —
[`SignalRelayScene`](../src/components/SignalRelayScene.tsx) и
[`HistorySplitScene`](../src/components/HistorySplitScene.tsx). Остальные сорок написаны вручную: 36 из них зовут `useSimpleCubeScene` напрямую,
ещё четыре — тонкие обёртки над другими сценами.

| Признак ручной плиты | Файлов |
|---|---|
| `useSimpleCubeScene(` напрямую | 36 |
| `createCancellableDelay` | 31 |
| `startSceneAnimation(` | 31 |
| собственный `let cancelled` | 30 |
| `controllerRef` + ручной teardown | 14 |
| `createScenePresentation` | 13 |
| **ручных `if (cancelled)`** | **156 вхождений** |

Сравнение размеров при одинаковой сложности хореографии:
[`GuardChangeScene.tsx`](../src/components/GuardChangeScene.tsx) — 199 строк, из них ~70 плиты;
[`SignalRelayScene.tsx`](../src/components/SignalRelayScene.tsx) — 105 строк, плиты нет.

### Проблема B: сценарии продолжают работать после размонтирования

Это не стилистика, а дефект. Цепочка:

1. [`createCancellableDelay.cancel()`](../src/scenes/createCancellableDelay.ts) **резолвит**
   активное ожидание, а не отклоняет его (`cancel: finish`, а `finish()` зовёт `resolveWait`).
2. [`gridWorld.dispose()`](../src/scenes/gridWorld.ts) и
   [`gridSceneRuntime.removeCube()`](../src/scenes/gridSceneRuntime.ts) тоже **резолвят** все
   висящие переходы (`gridTransition?.resolve()`, `cube.opacityTransition?.resolve()`).
3. Значит, после teardown резолвятся и `await delay.wait(...)`, и `await runtime.moveCubeTo(...)`,
   и тело сценария продолжает исполняться с точки возобновления.
4. Если следующий оператор не прикрыт `if (cancelled)` / `while (!cancelled)`, он зовёт
   runtime, который уже разобран: `requireCube` бросает `Unknown cube id "..."`, а `addCube` —
   `Cannot add a cube to a disposed grid scene`.
5. [`startSceneAnimation`](../src/scenes/startSceneAnimation.ts) ловит это и печатает
   `[cube-illustrations] <Имя> animation stopped`.

Наблюдаемый симптом — не падение, а поток ошибок в консоли при размонтировании, HMR
и навигации; в dev-режиме React StrictMode монтирует дважды, так что это происходит штатно.
Корень в том, что корректность держится на дисциплине: 156 ручных проверок, каждая из которых
может быть забыта при правке хореографии.

SDK закрывает это структурно. [`runSceneScript`](../src/scenes/runSceneScript.ts) оборачивает
runtime в `Proxy` и подменяет `delay`, так что отмена бросает `SceneCancelledError` на **любом**
`await` — забыть проверку негде. Отмена при этом считается штатным teardown и не логируется.

### Что делать

Портировать сцены волнами, по одной за раз. Каноничные образцы:
`SignalRelayScene` — чистый скрипт; `HistorySplitScene` — скрипт с `presentation`
через `setup` → `state` → `onFrame`.

Шаблон переноса:

```
было                              стало
────────────────────────────────  ──────────────────────────────
const GRID_CELL_SIZE = …          view: { cubeSize, gridCellSize, … }
useSimpleCubeScene({ … })         (в defineScene)
CubeSceneViewport                 (в defineScene)
controllerRef + onSetup/teardown  setup: ({ runtime, props }) => state
let cancelled + if (cancelled)    (удаляется — даёт runSceneScript)
createCancellableDelay            timeline.wait
startSceneAnimation               (в defineScene)
while (!cancelled) { … }          timeline.loop(async () => { … })
Promise.all([move, fade])         cubes.get(id).moveAndFade(…)
fadeTo(0.28) + fadeTo(1)          cubes.get(id).pulse()
```

**Волна A — простые скрипты без `presentation` и `controllerRef` (13 сцен).**
Начинать здесь: минимум неожиданностей, быстро набивается рука.

| Сцена | строк | `await delay.wait` |
|---|---|---|
| [PhaseChangeScene](../src/components/PhaseChangeScene.tsx) | 152 | 5 |
| [TrailingShadowScene](../src/components/TrailingShadowScene.tsx) | 152 | 2 |
| [DominoRingScene](../src/components/DominoRingScene.tsx) | 155 | 0 |
| [ThinningClockScene](../src/components/ThinningClockScene.tsx) | 164 | 5 |
| [MemoryReplayScene](../src/components/MemoryReplayScene.tsx) | 167 | 4 |
| [ReunitingPairScene](../src/components/ReunitingPairScene.tsx) | 171 | 6 |
| [PreferenceChoiceScene](../src/components/PreferenceChoiceScene.tsx) | 175 | 5 |
| [MetronomePairScene](../src/components/MetronomePairScene.tsx) | 176 | 2 |
| [ContinuousQueueScene](../src/components/ContinuousQueueScene.tsx) | 179 | 3 |
| [BoundaryRepairScene](../src/components/BoundaryRepairScene.tsx) | 189 | 4 |
| [CorridorDanceScene](../src/components/CorridorDanceScene.tsx) | 189 | 7 |
| [DynamicBalanceScene](../src/components/DynamicBalanceScene.tsx) | 192 | 4 |
| [CollectiveCurrentScene](../src/components/CollectiveCurrentScene.tsx) | 196 | 4 |

**Волна B — крупные скрипты без `presentation` (6 сцен).**
Та же механика, больше хореографии: `PolarityScene` (148), `LearnedDetourScene` (213),
`CenteredCubeScene` (215), `SevenCubesScene` (290), `StructureMorphScene` (336),
`CrossingFlowsScene` (362).

**Волна C — сцены с `presentation` и `controllerRef` (11 сцен).**
Требуют паттерна `HistorySplitScene`: `setup` возвращает `{ presentation }`,
`onFrame` зовёт `state.presentation.update(delta, camera, runtime)`.
`MovingBridgeScene` (173), `GuardChangeScene` (199), `LearnedRhythmScene` (220),
`ValenceFieldScene` (236), `RecursiveFrameScene` (241), `RememberedThresholdScene` (241),
`BecomingSignScene` (260), `RecognizedPartnerScene` (275), `SharedLoadScene` (312),
`PredictedPathsScene` (324), `AnticipatoryReturnScene` (303).

Здесь же напрашивается расширение SDK: сделать `presentation` первоклассной опцией
`defineScene` (`presentation: { zoom, gridOpacity, … }` + `context.presentation` в скрипте),
чтобы убрать три повторяющиеся строки `setup`/`onFrame` из одиннадцати файлов.

**Волна D — нестандартные сцены, портировать в последнюю очередь и по отдельности.**
Они не являются линейными скриптами и могут потребовать новых возможностей SDK:

* [`ThreeCubesScene`](../src/components/ThreeCubesScene.tsx) (283) — экспортирует ещё и
  `CursorRepulsionScene`, завязана на hover-взаимодействие;
* [`ThreeCubeStatesScene`](../src/components/ThreeCubeStatesScene.tsx) (258);
* [`MovingGridScene`](../src/components/MovingGridScene.tsx),
  [`EncounterCubeScene`](../src/components/EncounterCubeScene.tsx),
  [`GridPathCubeScene`](../src/scenes/GridPathCubeScene.tsx) — построены на декларативном
  [`createGridSceneAnimation`](../src/scenes/gridSceneAnimation.ts), а не на скрипте;
* [`FaceFlipCubeScene`](../src/scenes/FaceFlipCubeScene.tsx) (241),
  [`InertiaCubeScene`](../src/scenes/InertiaCubeScene.tsx) (170),
  [`FlippingCubeScene`](../src/components/FlippingCubeScene.tsx) (24),
  [`NestedCubeScene`](../src/components/NestedCubeScene.tsx) (58),
  [`VllCubeScene`](../src/components/VllCubeScene.tsx) (71) — короткие, эффект от переноса мал.

Отдельный вопрос по итогам волны D: `createGridSceneAnimation` (440 строк) сам содержит
5 ручных `if (cancelled)` и свой `createCancellableDelay`. Либо переводить его на
`AbortSignal` из `runSceneScript`, либо оставить как отдельный декларативный слой —
решать после того, как станет видно, сколько сцен на нём реально держится (сейчас три).

### Как проверить

* `npm run check` (tsc + сборка) и `npm test` после каждой сцены;
* `npm run demo` — визуально сравнить сцену до и до после переноса: тайминги и амплитуды
  должны совпасть, это рефакторинг, а не редизайн;
* в консоли демо при перезагрузке/HMR не должно оставаться сообщений
  `[cube-illustrations] … animation stopped`.

### Риск

Средний, но хорошо контролируемый: изменения атомарны по одной сцене, каждая проверяется
глазами, откат — один коммит. Главный риск — незаметно поменять тайминг хореографии
при перекладывании на `timeline`; поэтому переносить строго механически, без «заодно улучшу».

---

## Этап 2. Единый источник каталога сцен

### Проблема

Список сцен ведётся вручную в трёх местах:

* [`src/index.ts`](../src/index.ts) — 39 ре-экспортов из `./components/`;
* [`src/sceneCatalog.ts`](../src/sceneCatalog.ts) — те же 39 импортов плюс `id`, `title`, `tags`,
  набранные руками;
* внутри самих SDK-сцен — те же `id`/`title`/`tags` в `metadata`.

Отсюда в каталоге живут два хелпера-близнеца: `scene(component, id, title, tags)` для legacy
и `definedScene(component)` для SDK-сцен, читающий `component.scene`. Добавление сцены сейчас —
правка трёх файлов, а метаданные SDK-сцены физически продублированы.

### Что делать

Выполнять **после** этапа 1, когда у всех сцен появится `component.scene`:

1. Убрать хелпер `scene()`, оставить только чтение `component.scene` — метаданные живут
   ровно в одном месте, рядом с хореографией.
2. `SCENE_CATALOG` сводится к упорядоченному массиву компонентов; порядок галереи остаётся
   явным и осмысленным — это единственное, что каталог должен задавать.
3. `src/index.ts` в части сцен генерируется из каталога, либо остаётся тонким
   `export { … } from './sceneCatalog'`.
4. Добавить тест: все `id` в каталоге уникальны, у каждой сцены непустые `title` и `tags`.

Заодно стоит пересмотреть публичную поверхность: сейчас `index.ts` делает `export *` из одиннадцати
внутренних модулей (`gridSceneRuntime`, `gridSceneAnimation`, `useSimpleCubeScene`,
`SceneRenderHost` и т.д.). Всё это — API пакета, которое нельзя менять без мажорной версии,
хотя часть модулей задумана как внутренняя. Разумно оставить в корневом входе только сцены
и `IllustrationsPage`, а низкоуровневое отдавать через уже существующий вход `./sdk`.

### Как проверить

`npm run check`, `npm run pack:check` (сверить состав `dist`), демо рендерит все 40 сцен
в прежнем порядке.

### Риск

Средний из-за возможного сужения публичного API — это ломающее изменение, планировать
на смену мажорной версии.

---

## Этап 3. Разрезать `useSimpleCubeScene`

### Проблема

[`src/scenes/useSimpleCubeScene.ts`](../src/scenes/useSimpleCubeScene.ts) — 405 строк, из них
один `useEffect` примерно на 250. Внутри перемешаны три несвязанные ответственности:

1. сборка three-сцены, камеры и runtime;
2. standalone-рендерер: `WebGPURenderer`, `ResizeObserver`, размер бэкбуфера;
3. регистрация в [`SceneRenderHost`](../src/scenes/SceneRenderHost.tsx) и цикл
   `IntersectionObserver` + `visibilitychange`.

Ресурсы разматываются вручную через восемь переменных вида
`let disconnectTimer: (() => void) | null`, причём раскрутка продублирована в трёх точках
(две ранние проверки `disposed` внутри `setup` и финальный cleanup). Это ровно тот случай,
когда добавление ресурса требует не забыть про три места.

### Что делать

1. Выделить `createSceneWorld({ THREE, camera params, grid params })` — построение сцены,
   камеры и runtime, без React.
2. Выделить `createStandaloneRenderer(canvas, camera)` — инициализация WebGPU,
   `ResizeObserver`, обработка `unsupported`.
3. Выделить `useSceneLoop({ hostMode, … })` — регистрация в хосте либо собственный
   `setAnimationLoop`, `IntersectionObserver`, `visibilitychange`.
4. Ручные `null`-переменные заменить стеком `const disposers: (() => void)[] = []`
   и единственной функцией раскрутки, вызываемой из всех трёх точек.

### Сопутствующие дефекты, которые чинятся здесь же

**`mainCubeFaceLabels` в массиве зависимостей эффекта**
([`useSimpleCubeScene.ts:390`](../src/scenes/useSimpleCubeScene.ts#L390)). Это объект.
Потребитель, который пишет `<Scene faceLabels={{ front: 'A' }} />`, на каждом рендере
даёт новую ссылку — и вся WebGPU-сцена сносится и пересобирается. То же значение стоит
в зависимостях `onSetup` внутри [`defineScene`](../src/sdk/defineScene.tsx), так что эффект
двойной. Варианты: сравнивать labels по значению (нормализовать в строковый ключ) либо
применять их через `runtime.setCubeFaceLabels` без пересоздания сцены. Второе правильнее.

**Мёртвая ветка** [`useSimpleCubeScene.ts:305`](../src/scenes/useSimpleCubeScene.ts#L305):
`if (standaloneSyncLoopState === null) return` — проверка на `null` сразу после присваивания
функции. Условие никогда не истинно; убрать.

### Как проверить

`npm run check`, `npm test`, демо: сцены стартуют при скролле, гаснут при уходе вкладки
в фон, не текут при размонтировании. Отдельно — проверить сцену с `faceLabels`,
переданными литералом: пересборки сцены быть не должно.

### Риск

Средний. Это самый нагруженный тонкостями файл (WebGPU init, shared device, host/standalone
режимы). Резать по одному выделению за коммит, каждый раз проверяя оба режима рендеринга.

---

## Этап 4. Токены движения и пресеты сетки

### Проблема

Магические числа рассыпаны по сценам:

* 180 литералов `duration:`;
* 169 литералов `easing:` — 89 `'easeInOutCubic'`, 65 `'easeOutCubic'`, 15 `'linear'`;
* `const GRID_CELL_SIZE` объявлен 39 раз с 19 различными значениями, из них
  7 сцен используют `0.05`, 4 — `0.045`, по 3 — `0.1`, `0.06`, `0.055`, `0.04`.

Общая правка ритма галереи сейчас невозможна: «сделать все переходы чуть быстрее» —
это 180 точечных правок.

### Что делать

Завести `src/scenes/motion.ts` с готовыми `GridSceneTransitionOptions`:

```ts
export const MOTION = {
    pulseDown: { duration: 0.12, easing: 'easeOutCubic' },
    pulseUp:   { duration: 0.16, easing: 'easeOutCubic' },
    step:      { duration: 0.34, easing: 'easeInOutCubic' },
    travel:    { duration: 0.72, easing: 'easeInOutCubic' },
    enter:     { duration: 0.46, easing: 'easeOutCubic' },
    exit:      { duration: 1.10, easing: 'easeInOutCubic' },
} as const satisfies Record<string, GridSceneTransitionOptions>
```

и `src/scenes/gridPresets.ts` с типовыми размерами (`GRID_TIGHT = 0.04`, `GRID_DEFAULT = 0.05`,
`GRID_WIDE = 0.1`). Сцене остаётся сослаться на пресет, а уникальные значения оставить
локальными — цель не в том, чтобы схлопнуть все 19 значений в три, а в том, чтобы совпадающие
перестали быть случайными совпадениями.

Делать **после** этапа 1: в перенесённых сценах хореография уже собрана компактно,
и замена литералов становится механической.

### Как проверить

Визуальное сравнение демо до и после; значения токенов подобрать так, чтобы существующие
тайминги не поехали.

### Риск

Низкий по механике, средний по вкусу: легко незаметно изменить характер анимаций.
Заменять только точные совпадения, приблизительные оставлять как есть.

---

## Этап 5. Мелкие чистки

### 5.1 `scenePresentation.update`

[`src/scenes/scenePresentation.ts`](../src/scenes/scenePresentation.ts) — `update()` вручную
повторяет вызов `smoothTowards` для каждого из четырёх полей. Итерация по ключам
`ScenePresentationValues` короче и не забудет пятое поле, когда оно появится.

### 5.2 Документация

2 286 строк в шести файлах — пять в `docs/` плюс корневой `README.md`, —
с явными пересечениями:

| Файл | строк |
|---|---|
| [SCENES.md](SCENES.md) | 445 |
| [render.v2.md](render.v2.md) | 417 |
| [render.md](render.md) | 377 |
| [SCENE-FEATURES.md](SCENE-FEATURES.md) | 366 |
| [CUBE.md](CUBE.md) | 360 |
| [README.md](../README.md) | 321 |

`render.md` и `render.v2.md` — очевидные версии одного документа; `SCENES.md`,
`SCENE-FEATURES.md` и `CUBE.md` перекрываются по содержанию. Предложение: свести
`render*.md` в один (историю хранит git), а перечни сцен в документации генерировать
скриптом из `SCENE_CATALOG` — тогда они перестанут расходиться с кодом.

### 5.3 Прочее

* `createCancellableDelay` после завершения этапа 1 останется без потребителей
  (кроме `gridSceneAnimation`) — удалить или переписать на `AbortSignal`.
* Проверить, не осталось ли `export *` на модули, ставшие внутренними после этапа 2.

---

## Чего сознательно не делаем

* Не меняем визуал и тайминги сцен — все пять этапов задуманы как поведенчески нейтральные,
  кроме явно описанных исправлений отмены.
* Не переписываем `gridWorld` / `gridSceneRuntime`: они покрыты тестами и имеют внятные
  границы; трогать их без нужды нет причин.
* Не вводим менеджер состояния, DI и прочую инфраструктуру — задача решается сужением
  дублирования, а не добавлением слоёв.

## Признаки, что рефакторинг удался

1. Новая сцена добавляется правкой **одного** файла.
2. В `src/` нет ни одного ручного `if (cancelled)` (сейчас 156).
3. Ни одного `[cube-illustrations] … animation stopped` в консоли при HMR и навигации.
4. `src/components/` сокращается примерно на 2 000–2 500 строк без потери сцен.
5. Изменение тайминга галереи — правка одного файла `motion.ts`.
