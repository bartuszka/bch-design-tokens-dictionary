const { mkdir, readdir, readFile, writeFile } = require('node:fs/promises');
const path = require('node:path');

const sourceDirectoryPath = path.resolve(__dirname, '../tokens/converted/src');

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

async function getCoreScssFiles(directoryPath) {
    const entries = await readdir(directoryPath, { withFileTypes: true });

    return entries
        .filter((entry) =>
            entry.isFile()
            && path.extname(entry.name) === '.scss'
            && path.basename(entry.name, '.scss').startsWith('_core'),
        )
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

function getSourceNamespace(sourceFileName) {
    return path
        .basename(sourceFileName, '.scss')
        .replace(/^_/, '');
}

function getDestinationBaseName(decisionTokenStyleFolderName) {
    return `core-${decisionTokenStyleFolderName}`;
}

function getDestinationFileName(decisionTokenStyleFolderName) {
    return `${getDestinationBaseName(decisionTokenStyleFolderName)}.scss`;
}

function collectScssVariables(scss) {
    return scss
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.startsWith('$'))
        .map((line) => line.split(':')[0]);
}

function formatCoreWebScss(sourceFileName, sourceFilePath, destinationFilePath, variables) {
    const destinationDirectoryPath = path.dirname(destinationFilePath);
    const destinationBaseName = path.basename(destinationFilePath, '.scss');
    const sourceNamespace = getSourceNamespace(sourceFileName);
    const customProperties = variables
        .map((variableName) =>
            `  --bch-${destinationBaseName}-${variableName.replace(/^\$/, '')}: #{${sourceNamespace}.${variableName}};`)
        .join('\n');

    return `@use "${getImportPath(sourceFilePath, destinationDirectoryPath)}";

@mixin tokens {
${customProperties}
}
`;
}

async function createCoreWebTokenFile(
    sourceFileName,
    decisionTokenStyleFolderName,
    decisionTokenStyleRawFolderPath,
    decisionTokenStyleWebFolderPath,
) {
    const sourceFilePath = path.join(decisionTokenStyleRawFolderPath, sourceFileName);
    const destinationFilePath = path.join(
        decisionTokenStyleWebFolderPath,
        getDestinationFileName(decisionTokenStyleFolderName),
    );
    const scss = await readFile(sourceFilePath, 'utf8');
    const variables = collectScssVariables(scss);

    await mkdir(decisionTokenStyleWebFolderPath, { recursive: true });
    await writeFile(
        destinationFilePath,
        formatCoreWebScss(sourceFileName, sourceFilePath, destinationFilePath, variables),
    );

    return destinationFilePath;
}

async function coreWebTokensCreator() {
    const decisionTokenStyleFolderNames = await getDirectories(sourceDirectoryPath);
    const writtenPaths = [];

    for (const decisionTokenStyleFolderName of decisionTokenStyleFolderNames) {
        const decisionTokenStyleFolderPath = path.join(sourceDirectoryPath, decisionTokenStyleFolderName);
        const decisionTokenStyleRawFolderPath = path.join(decisionTokenStyleFolderPath, 'raw');
        const decisionTokenStyleWebFolderPath = path.join(decisionTokenStyleFolderPath, 'web');

        if (!await pathExists(decisionTokenStyleRawFolderPath)) {
            continue;
        }

        const sourceScssFileNames = await getCoreScssFiles(decisionTokenStyleRawFolderPath);

        for (const sourceScssFileName of sourceScssFileNames) {
            writtenPaths.push(await createCoreWebTokenFile(
                sourceScssFileName,
                decisionTokenStyleFolderName,
                decisionTokenStyleRawFolderPath,
                decisionTokenStyleWebFolderPath,
            ));
        }
    }

    console.log(`Created ${writtenPaths.length} core web token files.`);

    return writtenPaths;
}

if (require.main === module) {
    coreWebTokensCreator().catch((error) => {
        console.error(error.message);
        process.exitCode = 1;
    });
}

module.exports = {
    collectScssVariables,
    coreWebTokensCreator,
    formatCoreWebScss,
    'core-web-tokens-creator': coreWebTokensCreator,
};
