const { mkdir, readdir, writeFile } = require('node:fs/promises');
const path = require('node:path');

const sourceDirectoryPath = path.resolve(__dirname, '../tokens/converted/src');
const destinationDirectoryPath = path.resolve(__dirname, '../tokens/converted');

async function pathExists(targetPath) {
    try {
        await readdir(targetPath);
        return true;
    } catch {
        return false;
    }
}

async function getDirectories(directoryPath) {
    const entries = await readdir(directoryPath, { withFileTypes: true });

    return entries
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .sort((left, right) => left.localeCompare(right));
}

async function getScssFiles(directoryPath) {
    const entries = await readdir(directoryPath, { withFileTypes: true });

    return entries
        .filter((entry) => entry.isFile() && path.extname(entry.name) === '.scss')
        .map((entry) => entry.name)
        .sort((left, right) => left.localeCompare(right));
}

function getImportPath(sourceFilePath, destinationDirectoryPath) {
    const relativePath = path
        .relative(destinationDirectoryPath, sourceFilePath)
        .replaceAll(path.sep, '/')
        .replace(/\.scss$/, '')
        .replace(/\/_([^/]+)$/, '/$1');

    return relativePath.startsWith('.') ? relativePath : `./${relativePath}`;
}

function getSassNamespace(sourceFilePath) {
    return path
        .basename(sourceFilePath, '.scss')
        .replace(/^_/, '');
}

function getGeneralStyleFileName(sourceFolderName, webSourceSubfolderName = '') {
    const fileBaseName = webSourceSubfolderName
        ? `${sourceFolderName}-${webSourceSubfolderName}`
        : sourceFolderName;

    return `${fileBaseName}.scss`;
}

function formatSummaryScss(scssFilePaths, destinationDirectoryPath) {
    const imports = scssFilePaths
        .map((scssFilePath) => `@use "${getImportPath(scssFilePath, destinationDirectoryPath)}";`)
        .join('\n');
    const includes = scssFilePaths
        .map((scssFilePath) => `  @include ${getSassNamespace(scssFilePath)}.tokens;`)
        .join('\n');

    return `${imports}

@mixin tokens {
${includes}
}
`;
}

async function collectSummaryTokenFileGroups() {
    const sourceFolderNames = await getDirectories(sourceDirectoryPath);
    const fileGroups = [];

    for (const sourceFolderName of sourceFolderNames) {
        const sourceFolderPath = path.join(sourceDirectoryPath, sourceFolderName);
        const webSourceFolderPath = path.join(sourceFolderPath, 'web');

        if (!await pathExists(webSourceFolderPath)) {
            continue;
        }

        const directScssFileNames = await getScssFiles(webSourceFolderPath);

        if (directScssFileNames.length > 0) {
            fileGroups.push({
                fileName: getGeneralStyleFileName(sourceFolderName),
                scssFilePaths: directScssFileNames.map((scssFileName) => path.join(webSourceFolderPath, scssFileName)),
            });
        }

        const webSourceSubfolderNames = await getDirectories(webSourceFolderPath);

        for (const webSourceSubfolderName of webSourceSubfolderNames) {
            const webSourceSubfolderPath = path.join(webSourceFolderPath, webSourceSubfolderName);
            const subfolderScssFileNames = await getScssFiles(webSourceSubfolderPath);

            if (subfolderScssFileNames.length === 0) {
                continue;
            }

            fileGroups.push({
                fileName: getGeneralStyleFileName(sourceFolderName, webSourceSubfolderName),
                scssFilePaths: subfolderScssFileNames
                    .map((scssFileName) => path.join(webSourceSubfolderPath, scssFileName)),
            });
        }
    }

    return fileGroups;
}

async function summaryTokensCreator() {
    const fileGroups = await collectSummaryTokenFileGroups();
    const writtenPaths = [];

    await mkdir(destinationDirectoryPath, { recursive: true });

    for (const { fileName, scssFilePaths } of fileGroups) {
        const destinationFilePath = path.join(destinationDirectoryPath, fileName);

        await writeFile(destinationFilePath, formatSummaryScss(scssFilePaths, destinationDirectoryPath));
        writtenPaths.push(destinationFilePath);
    }

    console.log(`Created ${writtenPaths.length} summary token files.`);

    return writtenPaths;
}

if (require.main === module) {
    summaryTokensCreator().catch((error) => {
        console.error(error.message);
        process.exitCode = 1;
    });
}

module.exports = {
    collectSummaryTokenFileGroups,
    formatSummaryScss,
    getGeneralStyleFileName,
    summaryTokensCreator,
    'summary-tokens-creator': summaryTokensCreator,
};
