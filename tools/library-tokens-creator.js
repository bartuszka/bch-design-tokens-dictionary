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

async function getScssFiles(directoryPath) {
    const entries = await readdir(directoryPath, { withFileTypes: true });

    return entries
        .filter((entry) => entry.isFile() && path.extname(entry.name) === '.scss')
        .map((entry) => entry.name)
        .sort((left, right) => left.localeCompare(right));
}

function getTokensMixinBody(scss) {
    const mixinMatch = scss.match(/@mixin\s+tokens\s*\{/);

    if (!mixinMatch) {
        return '';
    }

    const bodyStartIndex = mixinMatch.index + mixinMatch[0].length;
    let depth = 1;

    for (let index = bodyStartIndex; index < scss.length; index += 1) {
        if (scss[index] === '{') {
            depth += 1;
        }

        if (scss[index] === '}') {
            depth -= 1;

            if (depth === 0) {
                return scss.slice(bodyStartIndex, index);
            }
        }
    }

    return '';
}

function getLibraryVariableDeclaration(line) {
    const variableMatch = line.match(/^(\s*)(--[^:]+):\s*#\{([^}]+)\};(\s*)$/);

    if (!variableMatch) {
        return line;
    }

    const [, indentation, customPropertyName, sourceVariableReference, trailingWhitespace] = variableMatch;
    const sourceVariableName = sourceVariableReference.split('.').at(-1);

    return `${indentation}${sourceVariableName}: var(${customPropertyName});${trailingWhitespace}`;
}

function formatLibraryScss(scss) {
    const tokensMixinBody = getTokensMixinBody(scss);
    const lines = tokensMixinBody.split(/\r?\n/);

    if (lines[0] === '') {
        lines.shift();
    }

    if (lines.at(-1) === '') {
        lines.pop();
    }

    return `${lines
        .map(getLibraryVariableDeclaration)
        .join('\n')
        .replaceAll(/^ {2}/gm, '')}
`;
}

function mergeLibraryScss(existingScss, nextScss) {
    if (!existingScss) {
        return nextScss;
    }

    const existingDeclarations = new Set(
        existingScss
            .split(/\r?\n/)
            .filter((line) => line.trim().startsWith('$'))
            .map((line) => line.trim()),
    );
    const nextLines = nextScss.split(/\r?\n/);
    const linesToAppend = [];
    let pendingLines = [];

    for (const line of nextLines) {
        if (line.trim().startsWith('/**') || pendingLines.length > 0) {
            pendingLines.push(line);

            if (line.trim().endsWith('*/')) {
                continue;
            }
        }

        if (line.trim().startsWith('$')) {
            if (!existingDeclarations.has(line.trim())) {
                linesToAppend.push(...pendingLines, line);
                existingDeclarations.add(line.trim());
            }

            pendingLines = [];
            continue;
        }

        if (line.trim() === '' && pendingLines.length > 0) {
            pendingLines.push(line);
            continue;
        }

        pendingLines = [];
    }

    if (linesToAppend.length === 0) {
        return existingScss;
    }

    return `${existingScss.trimEnd()}\n\n${linesToAppend.join('\n').trimEnd()}\n`;
}

async function collectWebScssFilePaths(webDirectoryPath) {
    if (!await pathExists(webDirectoryPath)) {
        return [];
    }

    const scssFilePaths = [];
    const directScssFileNames = await getScssFiles(webDirectoryPath);

    for (const scssFileName of directScssFileNames) {
        scssFilePaths.push(path.join(webDirectoryPath, scssFileName));
    }

    const subfolderNames = await getDirectories(webDirectoryPath);

    for (const subfolderName of subfolderNames) {
        const subfolderPath = path.join(webDirectoryPath, subfolderName);
        const scssFileNames = await getScssFiles(subfolderPath);

        for (const scssFileName of scssFileNames) {
            scssFilePaths.push(path.join(subfolderPath, scssFileName));
        }
    }

    return scssFilePaths;
}

async function libraryTokensCreator() {
    const decisionTokenStyleFolderNames = await getDirectories(sourceDirectoryPath);
    const writtenPaths = [];

    for (const decisionTokenStyleFolderName of decisionTokenStyleFolderNames) {
        const sourceFolderPath = path.join(sourceDirectoryPath, decisionTokenStyleFolderName);
        const webDirectoryPath = path.join(sourceFolderPath, 'web');
        const destinationFolderPath = path.join(destinationDirectoryPath, decisionTokenStyleFolderName);
        const scssFilePaths = await collectWebScssFilePaths(webDirectoryPath);
        const filesByDestinationPath = new Map();

        await mkdir(destinationFolderPath, { recursive: true });

        for (const scssFilePath of scssFilePaths) {
            const destinationFilePath = path.join(destinationFolderPath, path.basename(scssFilePath));
            const scss = await readFile(scssFilePath, 'utf8');
            const libraryScss = formatLibraryScss(scss);
            const existingScss = filesByDestinationPath.get(destinationFilePath) || '';

            filesByDestinationPath.set(destinationFilePath, mergeLibraryScss(existingScss, libraryScss));
        }

        for (const [destinationFilePath, scss] of filesByDestinationPath) {
            await writeFile(destinationFilePath, scss);
            writtenPaths.push(destinationFilePath);
        }
    }

    console.log(`Created ${writtenPaths.length} library token files.`);

    return writtenPaths;
}

if (require.main === module) {
    libraryTokensCreator().catch((error) => {
        console.error(error.message);
        process.exitCode = 1;
    });
}

module.exports = {
    formatLibraryScss,
    libraryTokensCreator,
    'library-tokens-creator': libraryTokensCreator,
};
