#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT_DIR = path.resolve(__dirname, '../..')
const ANSI_RED = '\x1b[31m'
const ANSI_YELLOW = '\x1b[33m'
const ANSI_RESET = '\x1b[0m'

const EXCLUDED_DIRS = new Set([
    '.git',
    '.next',
    '.turbo',
    '.yarn',
    '.cache',
    'coverage',
    'dist',
    'node_modules',
    'tmp',
])

const RULES = [
    {
        label: 'Client source root',
        target: 'src',
        minEntries: 2,
        warnEntries: 7,
        errorEntries: 10,
        warnFileLines: 500,
        errorFileLines: 1000,
    },
    {
        label: 'Test root',
        target: 'tests',
        minEntries: 1,
        warnEntries: 12,
        errorEntries: 20,
        warnFileLines: 500,
        errorFileLines: 1000,
    },
]

const parseArgs = (argv) => {
    const options = {
        strict: false,
        showAll: false,
        excludes: new Set(),
    }

    for (let index = 0; index < argv.length; index += 1) {
        const arg = argv[index]

        if (arg === '--strict') {
            options.strict = true
            continue
        }

        if (arg === '--show-all') {
            options.showAll = true
            continue
        }

        if (arg === '--exclude') {
            const value = argv[index + 1]
            if (typeof value === 'string' && value.length > 0) {
                options.excludes.add(value)
                index += 1
            }
            continue
        }

        if (arg.startsWith('--exclude=')) {
            const value = arg.slice('--exclude='.length)
            if (value.length > 0) {
                options.excludes.add(value)
            }
        }
    }

    return options
}

const getRelativePath = (absolutePath) => path.relative(ROOT_DIR, absolutePath) || '.'

const getLevel = (value, warnThreshold, errorThreshold) => {
    if (value > errorThreshold) return 'error'
    if (value > warnThreshold) return 'warn'
    return null
}

const collectFolderViolations = (absoluteTargetPath, rule, excludedDirectories) => {
    const violations = []
    const checks = []
    const stack = [absoluteTargetPath]

    while (stack.length > 0) {
        const currentPath = stack.pop()
        const directoryEntries = fs.readdirSync(currentPath, { withFileTypes: true })
        let entriesCount = 0

        for (const entry of directoryEntries) {
            if (excludedDirectories.has(entry.name)) {
                continue
            }

            if (!entry.isDirectory() && !entry.isFile()) {
                continue
            }

            entriesCount += 1

            if (entry.isDirectory()) {
                stack.push(path.join(currentPath, entry.name))
            }
        }

        const relativePath = getRelativePath(currentPath)
        const isBelowMin = entriesCount < rule.minEntries
        const level = isBelowMin
            ? 'error'
            : getLevel(entriesCount, rule.warnEntries, rule.errorEntries)
        checks.push({ relativePath, entriesCount, level })

        if (level != null) {
            violations.push({ relativePath, entriesCount, level })
        }
    }

    checks.sort((left, right) => left.relativePath.localeCompare(right.relativePath))
    violations.sort((left, right) => left.relativePath.localeCompare(right.relativePath))

    return { checks, violations }
}

const FILE_LINE_COUNT_EXTENSIONS = new Set(['.ts', '.tsx'])

const collectFileLengthViolations = (absoluteTargetPath, rule, excludedDirectories) => {
    const violations = []
    const stack = [absoluteTargetPath]

    while (stack.length > 0) {
        const currentPath = stack.pop()
        const directoryEntries = fs.readdirSync(currentPath, { withFileTypes: true })

        for (const entry of directoryEntries) {
            if (excludedDirectories.has(entry.name)) {
                continue
            }

            if (entry.isDirectory()) {
                stack.push(path.join(currentPath, entry.name))
                continue
            }

            if (!entry.isFile()) {
                continue
            }

            const ext = path.extname(entry.name)
            if (!FILE_LINE_COUNT_EXTENSIONS.has(ext)) {
                continue
            }

            const absoluteFilePath = path.join(currentPath, entry.name)
            const content = fs.readFileSync(absoluteFilePath, 'utf8')
            const lineCount = content.split('\n').length
            const level = getLevel(lineCount, rule.warnFileLines, rule.errorFileLines)

            if (level != null) {
                violations.push({
                    relativePath: getRelativePath(absoluteFilePath),
                    lineCount,
                    level,
                })
            }
        }
    }

    violations.sort((left, right) => right.lineCount - left.lineCount)
    return violations
}

const CSS_FILENAME_PATTERN = /^[a-z0-9]+(_[a-z0-9]+)*\.css$/

const collectCssFilenameViolations = (absoluteTargetPath, excludedDirectories) => {
    const violations = []
    const stack = [absoluteTargetPath]

    while (stack.length > 0) {
        const currentPath = stack.pop()
        const directoryEntries = fs.readdirSync(currentPath, { withFileTypes: true })

        for (const entry of directoryEntries) {
            if (excludedDirectories.has(entry.name)) {
                continue
            }

            if (entry.isDirectory()) {
                stack.push(path.join(currentPath, entry.name))
                continue
            }

            if (!entry.isFile() || !entry.name.endsWith('.css')) {
                continue
            }

            if (!CSS_FILENAME_PATTERN.test(entry.name)) {
                violations.push({
                    relativePath: getRelativePath(path.join(currentPath, entry.name)),
                    fileName: entry.name,
                })
            }
        }
    }

    violations.sort((left, right) => left.relativePath.localeCompare(right.relativePath))
    return violations
}

const formatLevel = (level) =>
    level === 'error' ? `${ANSI_RED}[ERROR]${ANSI_RESET}` : `${ANSI_YELLOW}[WARN]${ANSI_RESET}`

const run = () => {
    const options = parseArgs(process.argv.slice(2))
    const excludedDirectories = new Set([...EXCLUDED_DIRS, ...options.excludes])
    const errors = []
    const warnings = []
    const cssFailures = []
    const reports = []
    const structureLines = { error: [], warn: [] }

    console.log('[structure] Checking folder structure limits...')
    console.log(`[structure] Root: ${ROOT_DIR}`)
    console.log(`[structure] Mode: ${options.strict ? 'strict' : 'report-only'}`)
    console.log('[structure] Scope: recursive folder-by-folder')
    console.log(`[structure] Ignored directories: ${[...excludedDirectories].sort().join(', ')}`)
    console.log('')

    for (const rule of RULES) {
        const absoluteTargetPath = path.resolve(ROOT_DIR, rule.target)

        if (!fs.existsSync(absoluteTargetPath)) {
            errors.push(`${rule.label} (${rule.target}) does not exist and cannot be checked.`)
            continue
        }

        const result = collectFolderViolations(absoluteTargetPath, rule, excludedDirectories)

        if (options.showAll) {
            for (const check of result.checks) {
                const tag =
                    check.level === 'error' ? 'ERROR' : check.level === 'warn' ? 'WARN' : 'OK'
                reports.push({
                    level: check.level,
                    lines: [`[${tag}]`, `${check.relativePath}: ${check.entriesCount}`, ''],
                })
            }
        } else {
            for (const violation of result.violations) {
                structureLines[violation.level].push(
                    `${violation.relativePath}: ${violation.entriesCount}`
                )
            }
        }

        for (const violation of result.violations) {
            const message = `${violation.relativePath}: entries count ${violation.entriesCount} exceeds ${violation.level === 'error' ? rule.errorEntries : rule.warnEntries} (${violation.level}).`
            if (violation.level === 'error') {
                errors.push(message)
            } else {
                warnings.push(message)
            }
        }

        const fileLengthViolations = collectFileLengthViolations(
            absoluteTargetPath,
            rule,
            excludedDirectories
        )
        for (const violation of fileLengthViolations) {
            const limit = violation.level === 'error' ? rule.errorFileLines : rule.warnFileLines
            reports.push({
                level: violation.level,
                lines: [
                    `${formatLevel(violation.level)} ${violation.relativePath}`,
                    `  file length: ${violation.lineCount} lines (${violation.level} threshold: ${limit})`,
                    '',
                ],
            })
            const message = `${violation.relativePath}: file has ${violation.lineCount} lines, exceeds ${violation.level} limit of ${limit}.`
            if (violation.level === 'error') {
                errors.push(message)
            } else {
                warnings.push(message)
            }
        }

        const cssViolations = collectCssFilenameViolations(absoluteTargetPath, excludedDirectories)
        for (const violation of cssViolations) {
            reports.push({
                level: 'error',
                lines: [
                    `${formatLevel('error')} ${violation.relativePath}`,
                    `  css filename: ${violation.fileName} (expected snake_case like ui_panel.css)`,
                    '',
                ],
            })
            cssFailures.push(
                `${violation.relativePath}: css filename must be snake_case using underscores only.`
            )
        }
    }

    reports.sort((left, right) => left.lines[0].localeCompare(right.lines[0]))

    if (!options.showAll) {
        if (structureLines.error.length > 0) {
            structureLines.error.sort((left, right) => left.localeCompare(right))
            reports.unshift({
                level: 'error',
                lines: [`${formatLevel('error')} folder entries`, ...structureLines.error, ''],
            })
        }
        if (structureLines.warn.length > 0) {
            structureLines.warn.sort((left, right) => left.localeCompare(right))
            reports.unshift({
                level: 'warn',
                lines: [`${formatLevel('warn')} folder entries`, ...structureLines.warn, ''],
            })
        }
    }

    const entriesToPrint = options.showAll
        ? reports
        : reports.filter((entry) => entry.level === 'error' || entry.level === 'warn')

    for (const entry of entriesToPrint) {
        for (const line of entry.lines) {
            if (entry.level === 'error') {
                console.error(line)
            } else {
                console.warn(line)
            }
        }
    }

    if (entriesToPrint.length === 0) {
        console.log('[structure] No problems found.')
    }

    if (cssFailures.length > 0) {
        console.error('')
        console.error('[structure] CSS filename check failed:')
        for (const failure of cssFailures) {
            console.error(`  - ${failure}`)
        }
        process.exit(1)
    }

    if (warnings.length > 0) {
        console.warn('')
        console.warn(`[structure] ${warnings.length} warning(s) found.`)
    }

    if (errors.length > 0) {
        if (!options.strict) {
            console.log('')
            console.log(
                '[structure] Report-only mode: thresholds exceeded, but exit code stays 0. Use --strict to fail.'
            )
            process.exit(0)
        }

        console.error('')
        console.error('[structure] Check failed:')
        for (const error of errors) {
            console.error(`  - ${error}`)
        }
        process.exit(1)
    }

    console.log('[structure] All checks passed.')
    process.exit(0)
}

run()
