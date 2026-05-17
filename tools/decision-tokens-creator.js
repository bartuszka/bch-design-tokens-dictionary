const { mkdir, readdir, readFile, writeFile } = require('node:fs/promises');
const path = require('node:path');

const sourceDirectoryPath = path.resolve(__dirname, '../tokens/json-tokens/decision-tokens');
const outputDirectoryPath = path.resolve(__dirname, '../tokens/converted/src');

const header = `/** Design Language Configuration
 * Do not use directly in project
 * \\@access private
 */`;

function isObject(value) {
    return value && typeof value === 'object' && !Array.isArray(value);
}

function formatDescription(description) {
    if (!description) {
        return '';
    }

    return `/**
 * ${description}
 */
`;
}

function getAssociatedCoreTokenName(fileName) {
    return path.basename(fileName, '.json').split('-')[0];
}

function getScssFileName(fileName) {
    return `_decision-${path.basename(fileName, '.json')}.scss`;
}

function getCoreVariableReference(value) {
    if (typeof value !== 'string') {
        return JSON.stringify(value);
    }

    const tokenReference = value.replace(/^\{|\}$/g, '');
    const [tokenGroup, tokenName] = tokenReference.split('.');

    if (!tokenGroup || !tokenName) {
        return value;
    }

    return `${tokenGroup}.$${tokenGroup.replace(/^core-/, '')}-${tokenName}`;
}

function collectModes(tokens) {
    const modes = new Set();

    for (const token of Object.values(tokens)) {
        if (isObject(token.$value)) {
            for (const key of Object.keys(token.$value)) {
                modes.add(key);
            }
        }
    }

    return [...modes].sort((left, right) => left.localeCompare(right));
}

function collectVariables(tokens, modeName = null) {
    return Object.entries(tokens)
        .filter(([, token]) => Object.hasOwn(token, '$value'))
        .flatMap(([name, token]) => {
            if (modeName) {
                if (!isObject(token.$value) || !Object.hasOwn(token.$value, modeName)) {
                    return [];
                }

                return [{
                    name,
                    value: getCoreVariableReference(token.$value[modeName]),
                    description: token.$description,
                }];
            }

            if (isObject(token.$value)) {
                return [];
            }

            return [{
                name,
                value: getCoreVariableReference(token.$value),
                description: token.$description,
            }];
        });
}

function formatScss(variables, importPath) {
    const lines = [
        header,
        '',
        `@use "${importPath}";`,
        '',
        variables
            .map(({ name, value, description }) => `${formatDescription(description)}$${name}: ${value};\n`)
            .join('\n'),
        '',
    ];

    return lines.join('\n').replaceAll(`\\@`, '@');
}

async function getDecisionTokenFiles(directoryPath) {
    const entries = await readdir(directoryPath, { withFileTypes: true });

    return entries
        .filter((entry) => entry.isFile() && path.extname(entry.name) === '.json')
        .map((entry) => entry.name)
        .sort((left, right) => left.localeCompare(right));
}

async function createDecisionStyleFile(fileName) {
    const coreTokenName = getAssociatedCoreTokenName(fileName);
    const tokenPath = path.join(sourceDirectoryPath, fileName);
    const rawDirectoryPath = path.join(outputDirectoryPath, coreTokenName, 'raw');
    const decisionDirectoryPath = path.join(rawDirectoryPath, 'decision');
    const scssFileName = getScssFileName(fileName);
    const tokens = JSON.parse(await readFile(tokenPath, 'utf8'));
    const modes = collectModes(tokens);
    const writtenPaths = [];

    await mkdir(decisionDirectoryPath, { recursive: true });

    if (modes.length > 0) {
        for (const modeName of modes) {
            const modeDirectoryPath = path.join(decisionDirectoryPath, modeName);
            const outputPath = path.join(modeDirectoryPath, scssFileName);
            const variables = collectVariables(tokens, modeName);

            await mkdir(modeDirectoryPath, { recursive: true });
            await writeFile(outputPath, formatScss(variables, '../../core-' + coreTokenName));
            writtenPaths.push(outputPath);
        }

        return writtenPaths;
    }

    const outputPath = path.join(decisionDirectoryPath, scssFileName);
    const variables = collectVariables(tokens);

    await writeFile(outputPath, formatScss(variables, '../core-' + coreTokenName));
    writtenPaths.push(outputPath);

    return writtenPaths;
}

async function decisionTokensCreator() {
    const decisionTokenFiles = await getDecisionTokenFiles(sourceDirectoryPath);
    const writtenPaths = [];

    for (const fileName of decisionTokenFiles) {
        writtenPaths.push(...await createDecisionStyleFile(fileName));
    }

    console.log(`Created ${writtenPaths.length} decision style files.`);

    return writtenPaths;
}

if (require.main === module) {
    decisionTokensCreator().catch((error) => {
        console.error(error.message);
        process.exitCode = 1;
    });
}

module.exports = {
    collectModes,
    collectVariables,
    decisionTokensCreator,
    'decision-tokens-creator': decisionTokensCreator,
};
