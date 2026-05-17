const { mkdir, readFile, writeFile } = require('node:fs/promises');
const path = require('node:path');

const jsonTokensDirectoryPath = path.resolve(__dirname, '../tokens/json-tokens');
const cleanDirectoryPath = path.join(jsonTokensDirectoryPath, 'clean-figma-tokens');
const sourcePath = path.join(cleanDirectoryPath, 'figma-tokens.json');
const outputGroups = [
    {
        prefix: 'core-',
        directoryPath: path.join(jsonTokensDirectoryPath, 'core-tokens'),
    },
    {
        prefix: 'decision-',
        directoryPath: path.join(jsonTokensDirectoryPath, 'decision-tokens'),
    },
];

function getOutputGroup(tokenSetName) {
    return outputGroups.find(({ prefix }) => tokenSetName.startsWith(prefix));
}

function getOutputFileName(tokenSetName, prefix) {
    return `${tokenSetName.slice(prefix.length)}.json`;
}

async function splitFigmaTokens() {
    await mkdir(jsonTokensDirectoryPath, { recursive: true });
    await mkdir(cleanDirectoryPath, { recursive: true });

    for (const { directoryPath } of outputGroups) {
        await mkdir(directoryPath, { recursive: true });
    }

    const figmaTokens = JSON.parse(await readFile(sourcePath, 'utf8'));
    const writtenPaths = [];

    for (const [tokenSetName, tokenSet] of Object.entries(figmaTokens)) {
        const outputGroup = getOutputGroup(tokenSetName);

        if (!outputGroup) {
            continue;
        }

        const outputPath = path.join(
            outputGroup.directoryPath,
            getOutputFileName(tokenSetName, outputGroup.prefix),
        );

        await writeFile(outputPath, `${JSON.stringify(tokenSet, null, 2)}\n`);
        writtenPaths.push(outputPath);
    }

    console.log(`Split ${writtenPaths.length} Figma token files.`);

    return writtenPaths;
}

if (require.main === module) {
    splitFigmaTokens().catch((error) => {
        console.error(error.message);
        process.exitCode = 1;
    });
}

module.exports = {
    splitFigmaTokens,
};
