const { copyFile, mkdir } = require('node:fs/promises');
const path = require('node:path');

const sourcePath = path.resolve(__dirname, '../tokens/figma-tokens.json');
const archiveDirectoryPath = path.resolve(__dirname, '../tokens/converted/archived-figma-tokens');
const archivePath = path.join(archiveDirectoryPath, path.basename(sourcePath));

async function archiveFigmaToken() {
    await mkdir(archiveDirectoryPath, { recursive: true });
    await copyFile(sourcePath, archivePath);

    console.log(`Archived Figma tokens to ${archivePath}`);

    return archivePath;
}

if (require.main === module) {
    archiveFigmaToken().catch((error) => {
        console.error(error.message);
        process.exitCode = 1;
    });
}

module.exports = {
    archiveFigmaToken,
};
