const { mkdir, readdir, readFile, writeFile } = require('node:fs/promises');
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

function getDestinationFileName(sourceFileName) {
    const baseName = path
        .basename(sourceFileName, '.scss')
        .replace(/^_core-/, '')
        .replace(/^core-/, '');

    return `${baseName}-core.scss`;
}

function getTokenBaseName(sourceFileName) {
    return path
        .basename(sourceFileName, '.scss')
        .replace(/^_core-/, '')
        .replace(/^core-/, '');
}

function getRemainingVariableParts(tokenBaseName, variableName) {
    const tokenParts = tokenBaseName.split('-');
    const variableParts = variableName.replace(/^\$/, '').split('-');
    const remainingParts = [...variableParts];

    for (const tokenPart of tokenParts) {
        const index = remainingParts.indexOf(tokenPart);

        if (index !== -1) {
            remainingParts.splice(index, 1);
        }
    }

    return remainingParts;
}

function getCustomPropertyName(sourceFileName, variableName) {
    const tokenBaseName = getTokenBaseName(sourceFileName);
    const remainingParts = getRemainingVariableParts(tokenBaseName, variableName);
    const suffix = remainingParts.length > 0 ? `-${remainingParts.join('-')}` : '';

    return `--bch-${tokenBaseName}${suffix}`;
}

function collectScssVariables(scss) {
    const lines = scss.split(/\r?\n/);
    const variables = [];
    let pendingComment = [];

    for (let index = 0; index < lines.length; index += 1) {
        const trimmedLine = lines[index].trim();

        if (trimmedLine.startsWith('/**')) {
            pendingComment = [lines[index]];

            while (!lines[index].trim().endsWith('*/') && index < lines.length - 1) {
                index += 1;
                pendingComment.push(lines[index]);
            }

            continue;
        }

        if (trimmedLine.startsWith('$')) {
            const [name] = trimmedLine.split(':');

            variables.push({
                name,
                comment: pendingComment.join('\n'),
            });
            pendingComment = [];
            continue;
        }

        if (trimmedLine !== '') {
            pendingComment = [];
        }
    }

    return variables;
}

function formatCoreLibraryScss(sourceFileName, variables) {
    return `${variables
        .map(({ name, comment }) => {
            const declaration = `${name}: var(${getCustomPropertyName(sourceFileName, name)});`;

            return comment ? `${comment}\n${declaration}` : declaration;
        })
        .join('\n\n')}
`;
}

async function createCoreLibraryTokenFile(sourceFileName, rawDirectoryPath, destinationFolderPath) {
    const sourceFilePath = path.join(rawDirectoryPath, sourceFileName);
    const destinationFileName = getDestinationFileName(sourceFileName);
    const destinationFilePath = path.join(destinationFolderPath, destinationFileName);
    const scss = await readFile(sourceFilePath, 'utf8');
    const variables = collectScssVariables(scss);

    await mkdir(destinationFolderPath, { recursive: true });
    await writeFile(
        destinationFilePath,
        formatCoreLibraryScss(sourceFileName, variables),
    );

    return destinationFilePath;
}

async function coreLibraryTokensCreator() {
    const tokenFolderNames = await getDirectories(sourceDirectoryPath);
    const writtenPaths = [];

    for (const tokenFolderName of tokenFolderNames) {
        const tokenFolderPath = path.join(sourceDirectoryPath, tokenFolderName);
        const rawDirectoryPath = path.join(tokenFolderPath, 'raw');
        const destinationFolderPath = path.join(destinationDirectoryPath, tokenFolderName);

        if (!await pathExists(rawDirectoryPath)) {
            continue;
        }

        const coreScssFileNames = await getCoreScssFiles(rawDirectoryPath);

        for (const scssFileName of coreScssFileNames) {
            writtenPaths.push(await createCoreLibraryTokenFile(
                scssFileName,
                rawDirectoryPath,
                destinationFolderPath,
            ));
        }
    }

    console.log(`Created ${writtenPaths.length} core library token files.`);

    return writtenPaths;
}

if (require.main === module) {
    coreLibraryTokensCreator().catch((error) => {
        console.error(error.message);
        process.exitCode = 1;
    });
}

module.exports = {
    collectScssVariables,
    coreLibraryTokensCreator,
    formatCoreLibraryScss,
    'core-library-tokens-creator': coreLibraryTokensCreator,
};
