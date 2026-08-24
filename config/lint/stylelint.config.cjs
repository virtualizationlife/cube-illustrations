const path = require('node:path')

const repoRoot = path.resolve(__dirname, '../..')

module.exports = {
    extends: ['stylelint-config-standard'],
    ignoreFiles: [`${repoRoot}/dist/**/*`, `${repoRoot}/node_modules/**/*`],
    rules: {
        'selector-class-pattern': [
            '^[a-z][a-z0-9]*(_[a-z0-9]+)*$',
            { message: 'Use snake_case for class names (e.g. app_shell, reading_column).' },
        ],
        'custom-property-pattern': [
            '^[a-z][a-z0-9]*(_[a-z0-9]+)*$',
            { message: 'Use snake_case for custom properties (e.g. --space_md, --font_sans).' },
        ],
        'no-descending-specificity': true,
        'no-duplicate-selectors': true,
        'declaration-no-important': true,
        'selector-max-id': null,
        'max-nesting-depth': 3,
        'color-named': 'never',
        'color-hex-length': null,
        'property-no-deprecated': null,
        'property-no-unknown': [true, { ignoreProperties: ['text-wrap'] }],
    },
}
