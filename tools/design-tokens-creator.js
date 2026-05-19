const { archiveFigmaToken } = require('./token-archivist');
const { cleanFigmaTokens } = require('./token-cleaner');
const { splitFigmaTokens } = require('./token-splitter');
const { coreStylesCreator } = require('./core-styles-creator');
const { coreWebTokensCreator } = require('./core-web-tokens-creator');
const { decisionTokensCreator } = require('./decision-tokens-creator');
const { webTokensCreator } = require('./web-tokens-creator');
const {libraryTokensCreator} = require("./library-tokens-creator");
const { summaryTokensCreator } = require('./summary-tokens-creator');
const { allTokensCreator } = require("./all-tokens-creator");

async function designTokensCreator() {
    const archivedTokenPath = await archiveFigmaToken();
    const cleanTokenPath = await cleanFigmaTokens();
    const splitTokenPaths = await splitFigmaTokens();
    const coreStylePaths = await coreStylesCreator();
    const decisionStylePaths = await decisionTokensCreator();
    const coreWebTokensPaths = await coreWebTokensCreator();
    const webTokensPaths = await webTokensCreator();
    const libraryTokensPaths = await libraryTokensCreator();
    const summaryTokensPaths = await summaryTokensCreator();
    const allTokensPaths = await allTokensCreator();

    return {
        archivedTokenPath,
        cleanTokenPath,
        splitTokenPaths,
        coreStylePaths,
        decisionStylePaths,
        coreWebTokensPaths,
        webTokensPaths,
        libraryTokensPaths,
        summaryTokensPaths,
        allTokensPaths,
    };
}

if (require.main === module) {
    designTokensCreator().catch((error) => {
        console.error(error.message);
        process.exitCode = 1;
    });
}

module.exports = {
    designTokensCreator,
    'design-tokens-creator': designTokensCreator,
};
