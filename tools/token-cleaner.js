const { mkdir, readFile, writeFile } = require('node:fs/promises');
const path = require('node:path');

const removedNames = ['$themes', '$metadata'];

const sourcePath = path.resolve(__dirname, '../tokens/figma-tokens.json');
const jsonTokensDirectoryPath = path.resolve(__dirname, '../tokens/json-tokens');
const cleanDirectoryPath = path.join(jsonTokensDirectoryPath, 'clean-figma-tokens');
const cleanPath = path.join(cleanDirectoryPath, path.basename(sourcePath));

function removeObjectsByName(value, namesToRemove) {
    if (Array.isArray(value)) {
        return value.map((item) => removeObjectsByName(item, namesToRemove));
    }

    if (value && typeof value === 'object') {
        return Object.fromEntries(
            Object.entries(value)
                .filter(([key]) => !namesToRemove.includes(key))
                .map(([key, item]) => [key, removeObjectsByName(item, namesToRemove)]),
        );
    }

    return value;
}

async function cleanFigmaTokens(namesToRemove = removedNames) {
    const figmaTokens = JSON.parse(await readFile(sourcePath, 'utf8'));
    const cleanFigmaTokens = removeObjectsByName(figmaTokens, namesToRemove);

    await mkdir(jsonTokensDirectoryPath, { recursive: true });
    await mkdir(cleanDirectoryPath, { recursive: true });
    await writeFile(cleanPath, `${JSON.stringify(cleanFigmaTokens, null, 2)}\n`);

    console.log(`Cleaned Figma tokens to ${cleanPath}`);

    return cleanPath;
}

if (require.main === module) {
    cleanFigmaTokens(removedNames).catch((error) => {
        console.error(error.message);
        process.exitCode = 1;
    });
}

module.exports = {
    cleanFigmaTokens,
    removedNames,
};
