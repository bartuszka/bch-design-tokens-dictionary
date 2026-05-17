const { mkdir, readdir, readFile, writeFile } = require('node:fs/promises');
const path = require('node:path');

const jsonTokensDirectoryPath = path.resolve(__dirname, '../tokens/json-tokens');
const sourceDirectoryPath = path.join(jsonTokensDirectoryPath, 'core-tokens');
const outputDirectoryPath = path.resolve(__dirname, '../tokens/converted/src');

function isToken(value) {
    return value && typeof value === 'object' && Object.hasOwn(value, '$value');
}

function formatScssValue(value) {
    if (typeof value === 'string') {
        return value;
    }

    return JSON.stringify(value);
}

function getVariableName(fileName, tokenPath) {
    return `$${[fileName, ...tokenPath].join('-')}`;
}

function collectScssVariables(value, fileName, tokenPath = []) {
    if (!value || typeof value !== 'object') {
        return [];
    }

    if (isToken(value)) {
        return [
            {
                name: getVariableName(fileName, tokenPath),
                value: formatScssValue(value.$value),
            },
        ];
    }

    return Object.entries(value).flatMap(([key, item]) =>
        collectScssVariables(item, fileName, [...tokenPath, key]),
    );
}

async function getCoreTokenFiles(directoryPath) {
    const entries = await readdir(directoryPath, { withFileTypes: true });

    return entries
        .filter((entry) => entry.isFile() && path.extname(entry.name) === '.json')
        .map((entry) => entry.name)
        .sort((left, right) => left.localeCompare(right));
}

async function createCoreStyleFile(fileName) {
    const tokenName = path.basename(fileName, '.json');
    const tokenPath = path.join(sourceDirectoryPath, fileName);
    const outputTokenDirectoryPath = path.join(outputDirectoryPath, tokenName);
    const rawDirectoryPath = path.join(outputTokenDirectoryPath, 'raw');
    const webDirectoryPath = path.join(outputTokenDirectoryPath, 'web');
    const rawOutputPath = path.join(rawDirectoryPath, `_core-${tokenName}.scss`);
    const tokens = JSON.parse(await readFile(tokenPath, 'utf8'));
    const variables = collectScssVariables(tokens, tokenName);
    const scss = `${variables.map(({ name, value }) => `${name}: ${value};`).join('\n')}\n`;

    await mkdir(rawDirectoryPath, { recursive: true });
    await mkdir(webDirectoryPath, { recursive: true });
    await writeFile(rawOutputPath, scss);

    return rawOutputPath;
}

async function coreStylesCreator() {
    await mkdir(jsonTokensDirectoryPath, { recursive: true });
    await mkdir(sourceDirectoryPath, { recursive: true });

    const coreTokenFiles = await getCoreTokenFiles(sourceDirectoryPath);
    const writtenPaths = [];

    for (const fileName of coreTokenFiles) {
        writtenPaths.push(await createCoreStyleFile(fileName));
    }

    console.log(`Created ${writtenPaths.length} core style files.`);

    return writtenPaths;
}

if (require.main === module) {
    coreStylesCreator().catch((error) => {
        console.error(error.message);
        process.exitCode = 1;
    });
}

module.exports = {
    collectScssVariables,
    coreStylesCreator,
    'core-styles-creator': coreStylesCreator,
};
