#!/usr/bin/env node
'use strict';

var tslib = require('tslib');
var chalk = require('chalk');
var commandLineArgs = require('command-line-args');
var fsPromises = require('fs/promises');
var path = require('path');
var cosmiconfig = require('cosmiconfig');

function _interopDefaultLegacy (e) { return e && typeof e === 'object' && 'default' in e ? e : { 'default': e }; }

var chalk__default = /*#__PURE__*/_interopDefaultLegacy(chalk);
var commandLineArgs__default = /*#__PURE__*/_interopDefaultLegacy(commandLineArgs);
var fsPromises__default = /*#__PURE__*/_interopDefaultLegacy(fsPromises);
var path__default = /*#__PURE__*/_interopDefaultLegacy(path);

// Based on https://github.com/Polyconseil/easygettext/blob/master/src/compile.js
const Pofile = require("pofile");
/**
 * Returns a sanitized po data dictionary where:
 * - no fuzzy or obsolete strings are returned
 * - no empty translations are returned
 *
 * @param poItems items from the PO catalog
 * @returns jsonData: sanitized PO data
 */
const sanitizePoData = (poItems) => {
    const messages = {};
    for (let item of poItems) {
        const ctx = item.msgctxt || "";
        if (item.msgstr[0] && item.msgstr[0].length > 0 && !item.flags.fuzzy && !item.obsolete) {
            if (!messages[item.msgid]) {
                messages[item.msgid] = {};
            }
            // Add an array for plural, a single string for singular.
            messages[item.msgid][ctx] = item.msgstr.length === 1 ? item.msgstr[0] : item.msgstr;
        }
    }
    // Strip context from messages that have no context.
    for (let key in messages) {
        if (Object.keys(messages[key]).length === 1 && messages[key][""]) {
            messages[key] = messages[key][""];
        }
    }
    return messages;
};
const po2json = (poContent) => {
    const catalog = Pofile.parse(poContent);
    if (!catalog.headers.Language) {
        throw new Error("No Language headers found!");
    }
    return {
        headers: catalog.headers,
        messages: sanitizePoData(catalog.items),
    };
};
const compilePoFiles = (localesPaths) => tslib.__awaiter(void 0, void 0, void 0, function* () {
    const translations = {};
    yield Promise.all(localesPaths.map((lp) => tslib.__awaiter(void 0, void 0, void 0, function* () {
        const fileContent = yield fsPromises__default["default"].readFile(lp, { encoding: "utf-8" });
        const data = po2json(fileContent);
        const lang = data.headers.Language;
        if (lang && !translations[lang]) {
            translations[lang] = data.messages;
        }
        else {
            Object.assign(translations[data.headers.Language], data.messages);
        }
    })));
    return translations;
});

const loadConfig = (cliArgs) => {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o;
    const moduleName = "gettext";
    const explorer = cosmiconfig.cosmiconfigSync(moduleName, {
        searchPlaces: [`${moduleName}.config.js`, `${moduleName}.config.json`],
    });
    let configRes;
    if (cliArgs === null || cliArgs === void 0 ? void 0 : cliArgs.config) {
        configRes = explorer.load(cliArgs.config);
        if (!configRes) {
            throw new Error(`Config not found: ${cliArgs.config}`);
        }
    }
    else {
        configRes = explorer.search();
    }
    const config = configRes === null || configRes === void 0 ? void 0 : configRes.config;
    const languagePath = ((_a = config.output) === null || _a === void 0 ? void 0 : _a.path) || "./src/language";
    const joinPath = (inputPath) => path__default["default"].join(languagePath, inputPath);
    const joinPathIfRelative = (inputPath) => {
        if (!inputPath) {
            return undefined;
        }
        return path__default["default"].isAbsolute(inputPath) ? inputPath : path__default["default"].join(languagePath, inputPath);
    };
    return {
        input: {
            path: ((_b = config.input) === null || _b === void 0 ? void 0 : _b.path) || "./src",
            include: ((_c = config.input) === null || _c === void 0 ? void 0 : _c.include) || ["**/*.js", "**/*.ts", "**/*.vue"],
            exclude: ((_d = config.input) === null || _d === void 0 ? void 0 : _d.exclude) || [],
            excludePot: ((_e = config.input) === null || _e === void 0 ? void 0 : _e.excludePot) || []
        },
        output: {
            path: languagePath,
            potPath: joinPathIfRelative((_f = config.output) === null || _f === void 0 ? void 0 : _f.potPath) || joinPath("./messages.pot"),
            jsonPath: joinPathIfRelative((_g = config.output) === null || _g === void 0 ? void 0 : _g.jsonPath) ||
                (((_h = config.output) === null || _h === void 0 ? void 0 : _h.splitJson) ? joinPath("./") : joinPath("./translations.json")),
            locales: ((_j = config.output) === null || _j === void 0 ? void 0 : _j.locales) || ["en"],
            flat: ((_k = config.output) === null || _k === void 0 ? void 0 : _k.flat) === undefined ? false : config.output.flat,
            linguas: ((_l = config.output) === null || _l === void 0 ? void 0 : _l.linguas) === undefined ? true : config.output.linguas,
            splitJson: ((_m = config.output) === null || _m === void 0 ? void 0 : _m.splitJson) === undefined ? false : config.output.splitJson,
            disablePoLineNumbers: !!((_o = config.output) === null || _o === void 0 ? void 0 : _o.disablePoLineNumbers)
        },
    };
};

const optionDefinitions = [{ name: "config", alias: "c", type: String }];
let options;
try {
    options = commandLineArgs__default["default"](optionDefinitions);
}
catch (e) {
    console.error(e);
    process.exit(1);
}
const config = loadConfig(options);
console.info(`Language directory: ${chalk__default["default"].blueBright(config.output.path)}`);
console.info(`Locales: ${chalk__default["default"].blueBright(config.output.locales)}`);
console.info();
const localesPaths = config.output.locales.map((loc) => config.output.flat ? path__default["default"].join(config.output.path, `${loc}.po`) : path__default["default"].join(config.output.path, `${loc}/app.po`));
(() => tslib.__awaiter(void 0, void 0, void 0, function* () {
    yield fsPromises__default["default"].mkdir(config.output.path, { recursive: true });
    const jsonRes = yield compilePoFiles(localesPaths);
    console.info(`${chalk__default["default"].green("Compiled json")}: ${chalk__default["default"].grey(JSON.stringify(jsonRes))}`);
    console.info();
    if (config.output.splitJson) {
        yield Promise.all(config.output.locales.map((locale) => tslib.__awaiter(void 0, void 0, void 0, function* () {
            const outputPath = path__default["default"].join(config.output.jsonPath, `${locale}.json`);
            yield fsPromises__default["default"].writeFile(outputPath, JSON.stringify({
                [locale]: jsonRes[locale],
            }));
            console.info(`${chalk__default["default"].green("Created")}: ${chalk__default["default"].blueBright(outputPath)}`);
        })));
    }
    else {
        const outputPath = config.output.jsonPath;
        yield fsPromises__default["default"].writeFile(outputPath, JSON.stringify(jsonRes));
        console.info(`${chalk__default["default"].green("Created")}: ${chalk__default["default"].blueBright(outputPath)}`);
    }
}))();
