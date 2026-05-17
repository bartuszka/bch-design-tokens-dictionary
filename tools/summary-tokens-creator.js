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

function getSassNamespace(sourceFileName) {
    return path
        .basename(sourceFileName, '.scss')
        .replace(/^_/, '');
}

function formatSummaryScss(scssFilePaths) {
    const imports = scssFilePaths
        .map((scssFilePath) => `@use "${getImportPath(scssFilePath, destinationDirectoryPath)}";`)
        .join('\n');
    const includes = scssFilePaths
        .map((scssFilePath) => `  @include ${getSassNamespace(path.basename(scssFilePath))}.tokens;`)
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
        const webDirectoryPath = path.join(sourceFolderPath, 'web');

        if (!await pathExists(webDirectoryPath)) {
            continue;
        }

        const directScssFileNames = await getScssFiles(webDirectoryPath);

        if (directScssFileNames.length > 0) {
            fileGroups.push({
                fileName: `${sourceFolderName}.scss`,
                scssFilePaths: directScssFileNames.map((scssFileName) => path.join(webDirectoryPath, scssFileName)),
            });
        }

        const subfolderNames = await getDirectories(webDirectoryPath);

        for (const subfolderName of subfolderNames) {
            const subfolderPath = path.join(webDirectoryPath, subfolderName);
            const scssFileNames = await getScssFiles(subfolderPath);

            if (scssFileNames.length === 0) {
                continue;
            }

            fileGroups.push({
                fileName: `${sourceFolderName}-${subfolderName}.scss`,
                scssFilePaths: scssFileNames.map((scssFileName) => path.join(subfolderPath, scssFileName)),
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

        await writeFile(destinationFilePath, formatSummaryScss(scssFilePaths));
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
    summaryTokensCreator,
    'summary-tokens-creator': summaryTokensCreator,
};
