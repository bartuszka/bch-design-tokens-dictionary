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

async function getScssFiles(directoryPath) {
    const entries = await readdir(directoryPath, { withFileTypes: true });

    return entries
        .filter((entry) => entry.isFile() && path.extname(entry.name) === '.scss')
        .map((entry) => entry.name)
        .sort((left, right) => left.localeCompare(right));
}

function getDestinationFileName(sourceFileName) {
    return sourceFileName
        .replace(/^_decision-/, '')
        .replace(/^decision-/, '');
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

function getTokenBaseName(sourceFileName) {
    return path
        .basename(sourceFileName, '.scss')
        .replace(/^_/, '')
        // .replace(/^_decision-/, '')
        // .replace(/^decision-/, '');
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
    console.log('variableName', variableName)
    // const suffix = remainingParts.length > 0 ? `-${remainingParts.join('-')}` : '';
    const suffix = remainingParts.length > 0 ? `-${variableName.split('$')[1]}` : '';

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

function indentComment(comment) {
    if (!comment) {
        return '';
    }

    return `${comment
        .split('\n')
        .map((line) => `  ${line}`)
        .join('\n')}\n`;
}

function formatWebScss(sourceFileName, sourceFilePath, destinationDirectoryPath, variables) {
    const importPath = getImportPath(sourceFilePath, destinationDirectoryPath);
    const namespace = getSassNamespace(sourceFileName);
    const customProperties = variables
        .map(({ name, comment }) => {
            const customPropertyName = getCustomPropertyName(sourceFileName, name);

            return `${indentComment(comment)}  ${customPropertyName}: #{${namespace}.${name}};`;
        })
        .join('\n\n');

    return `@use "${importPath}";

@mixin tokens {
${customProperties}
}
`;
}

async function collectModeFolderPairs(decisionTokenStyleFolderPath) {
    const rawDirectoryPath = path.join(decisionTokenStyleFolderPath, 'raw');
    const decisionDirectoryPath = path.join(rawDirectoryPath, 'decision');
    const webDirectoryPath = path.join(decisionTokenStyleFolderPath, 'web');

    if (!await pathExists(decisionDirectoryPath)) {
        return [];
    }

    const modeSourceFolderNames = await getDirectories(decisionDirectoryPath);

    if (modeSourceFolderNames.length === 0) {
        return [{
            sourceDirectoryPath: decisionDirectoryPath,
            destinationDirectoryPath: webDirectoryPath,
        }];
    }

    const pairs = [];

    for (const modeSourceFolderName of modeSourceFolderNames) {
        const sourceModeDirectoryPath = path.join(decisionDirectoryPath, modeSourceFolderName);
        const destinationModeDirectoryPath = path.join(webDirectoryPath, modeSourceFolderName);

        await mkdir(destinationModeDirectoryPath, { recursive: true });
        pairs.push({
            sourceDirectoryPath: sourceModeDirectoryPath,
            destinationDirectoryPath: destinationModeDirectoryPath,
        });
    }

    return pairs;
}

async function createWebTokenFile(sourceFileName, sourceModeDirectoryPath, destinationModeDirectoryPath) {
    const sourceFilePath = path.join(sourceModeDirectoryPath, sourceFileName);
    const destinationFileName = getDestinationFileName(sourceFileName);
    const destinationFilePath = path.join(destinationModeDirectoryPath, destinationFileName);
    const scss = await readFile(sourceFilePath, 'utf8');
    const variables = collectScssVariables(scss);

    await mkdir(destinationModeDirectoryPath, { recursive: true });
    await writeFile(
        destinationFilePath,
        formatWebScss(sourceFileName, sourceFilePath, destinationModeDirectoryPath, variables),
    );

    return destinationFilePath;
}

async function webTokensCreator() {
    const decisionTokenStyleFolderNames = await getDirectories(sourceDirectoryPath);
    const writtenPaths = [];

    for (const decisionTokenStyleFolderName of decisionTokenStyleFolderNames) {
        const decisionTokenStyleFolderPath = path.join(sourceDirectoryPath, decisionTokenStyleFolderName);
        const modeFolderPairs = await collectModeFolderPairs(decisionTokenStyleFolderPath);

        for (const { sourceDirectoryPath: sourceModeDirectoryPath, destinationDirectoryPath } of modeFolderPairs) {
            const scssFileNames = await getScssFiles(sourceModeDirectoryPath);

            for (const scssFileName of scssFileNames) {
                writtenPaths.push(await createWebTokenFile(
                    scssFileName,
                    sourceModeDirectoryPath,
                    destinationDirectoryPath,
                ));
            }
        }
    }

    console.log(`Created ${writtenPaths.length} web token files.`);

    return writtenPaths;
}

if (require.main === module) {
    webTokensCreator().catch((error) => {
        console.error(error.message);
        process.exitCode = 1;
    });
}

module.exports = {
    collectScssVariables,
    webTokensCreator,
    'web-tokens-creator': webTokensCreator,
};
