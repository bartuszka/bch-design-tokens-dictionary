const { mkdir, readdir, writeFile } = require('node:fs/promises');
const path = require('node:path');

const convertedDirectoryPath = path.resolve(__dirname, '../tokens/converted');
const allTokensFileName = 'all.scss';

async function getScssSourceFiles(directoryPath) {
    const entries = await readdir(directoryPath, { withFileTypes: true });

    return entries
        .filter((entry) => entry.isFile())
        .map((entry) => entry.name)
        .filter((fileName) => path.extname(fileName) === '.scss' && fileName !== allTokensFileName)
        .sort((left, right) => left.localeCompare(right));
}

function getTokenName(fileName) {
    return path.basename(fileName, '.scss').replace(/^_/, '');
}

function getTokenComment(fileName) {
    return `${getTokenName(fileName).replaceAll('-', ' ')} tokens`;
}

function formatAllTokensScss(scssSourceFiles) {
    const imports = scssSourceFiles
        .map((fileName) => `@use "${getTokenName(fileName)}";`)
        .join('\n');
    const includes = scssSourceFiles
        .map((fileName) => `    // ${getTokenComment(fileName)}\n    @include ${getTokenName(fileName)}.tokens;`)
        .join('\n\n');

    return `${imports}

@mixin bch-design-language {
  :root {
${includes}
  }
}
`;
}

async function allTokensCreator() {
    await mkdir(convertedDirectoryPath, { recursive: true });

    const scssSourceFiles = await getScssSourceFiles(convertedDirectoryPath);
    const allTokensFilePath = path.join(convertedDirectoryPath, allTokensFileName);

    await writeFile(allTokensFilePath, formatAllTokensScss(scssSourceFiles));

    console.log(`Created ${allTokensFilePath}.`);

    return allTokensFilePath;
}

if (require.main === module) {
    allTokensCreator().catch((error) => {
        console.error(error.message);
        process.exitCode = 1;
    });
}

module.exports = {
    allTokensCreator,
    formatAllTokensScss,
    getScssSourceFiles,
    'all-tokens-creator': allTokensCreator,
};
