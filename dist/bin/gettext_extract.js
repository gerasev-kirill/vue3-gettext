#!/usr/bin/env node
'use strict';

var tslib = require('tslib');
var chalk = require('chalk');
var commandLineArgs = require('command-line-args');
var fs = require('fs');
var glob = require('glob');
var path = require('path');
var cosmiconfig = require('cosmiconfig');
var compilerSfc = require('@vue/compiler-sfc');
var ts = require('typescript');
var pofile = require('pofile');
var gettextExtractor = require('gettext-extractor');
var validate = require('gettext-extractor/dist/utils/validate');
var selector = require('gettext-extractor/dist/html/selector');
var content = require('gettext-extractor/dist/utils/content');
var parse5 = require('parse5');
var treeAdapter = require('parse5-htmlparser2-tree-adapter');
var utils = require('gettext-extractor/dist/js/utils');
var child_process = require('child_process');

function _interopDefaultLegacy (e) { return e && typeof e === 'object' && 'default' in e ? e : { 'default': e }; }

var chalk__default = /*#__PURE__*/_interopDefaultLegacy(chalk);
var commandLineArgs__default = /*#__PURE__*/_interopDefaultLegacy(commandLineArgs);
var fs__default = /*#__PURE__*/_interopDefaultLegacy(fs);
var glob__default = /*#__PURE__*/_interopDefaultLegacy(glob);
var path__default = /*#__PURE__*/_interopDefaultLegacy(path);
var ts__default = /*#__PURE__*/_interopDefaultLegacy(ts);
var pofile__default = /*#__PURE__*/_interopDefaultLegacy(pofile);
var treeAdapter__default = /*#__PURE__*/_interopDefaultLegacy(treeAdapter);

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

function attributeEmbeddedJsExtractor(selector, jsParser) {
    validate.Validate.required.nonEmptyString({ selector });
    validate.Validate.required.argument({ jsParser });
    return (node, fileName) => {
        if (typeof node.tagName !== "string") {
            return;
        }
        const element = node;
        element.attrs.forEach((attr) => {
            var _a, _b;
            jsParser.parseString(attr.value, fileName, {
                lineNumberStart: (_b = (_a = element.sourceCodeLocation) === null || _a === void 0 ? void 0 : _a.attrs[attr.name]) === null || _b === void 0 ? void 0 : _b.startLine,
            });
        });
    };
}

const getElementContent = (element, options) => {
    let content$1 = parse5.serialize(element, {});
    // text nodes within template tags don't get serialized properly, this is a hack
    if (element.tagName === "template") {
        const docFragment = treeAdapter__default["default"].createDocumentFragment();
        element.content.childNodes.forEach((childNode) => {
            treeAdapter__default["default"].appendChild(docFragment, childNode);
        });
        content$1 = parse5.serialize(docFragment, {});
    }
    // Un-escape characters that get escaped by parse5
    content$1 = content$1.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
    return content.normalizeContent(content$1, options);
};
function embeddedJsExtractor(selector$1, jsParser) {
    validate.Validate.required.nonEmptyString({ selector: selector$1 });
    validate.Validate.required.argument({ jsParser });
    const selectors = new selector.ElementSelectorSet(selector$1);
    return (node, fileName) => {
        if (typeof node.tagName !== "string") {
            return;
        }
        const element = node;
        if (selectors.anyMatch(element)) {
            const source = getElementContent(element, {
                trimWhiteSpace: false,
                preserveIndentation: true,
                replaceNewLines: false,
            });
            jsParser.parseString(source, fileName, {
                scriptKind: ts.ScriptKind.Deferred,
                lineNumberStart: (element.sourceCodeLocation && element.sourceCodeLocation.startLine) || 0,
            });
        }
    };
}

utils.JsUtils.segmentsMatchPropertyExpression = (segments, propertyAccessExpression) => {
    segments = segments.slice();
    if (!(segments.pop() === propertyAccessExpression.name.text)) {
        return false;
    }
    let segment;
    switch (propertyAccessExpression.expression.kind) {
        case ts__default["default"].SyntaxKind.Identifier:
            return true;
        case ts__default["default"].SyntaxKind.ThisKeyword:
            segment = segments.pop();
            return segments.length === 0 && (segment === 'this' || segment === '[this]');
        case ts__default["default"].SyntaxKind.PropertyAccessExpression:
            return utils.JsUtils.segmentsMatchPropertyExpression(segments, propertyAccessExpression.expression);
    }
    return false;
};
class GettextExtractor extends gettextExtractor.GettextExtractor {
    constructor(options) {
        super();
        this.banned = [];
        this.disablePoLineNumbers = false;
        this.disablePoLineNumbers = !!(options === null || options === void 0 ? void 0 : options.disablePoLineNumbers);
    }
    loadBannedPotAsync(potPaths) {
        return tslib.__awaiter(this, void 0, void 0, function* () {
            this.banned = [];
            return yield Promise.allSettled(potPaths.map((fpath) => {
                return new Promise((resolve, reject) => {
                    pofile__default["default"].load(fpath, (err, po) => {
                        if (err) {
                            reject(err);
                            return;
                        }
                        po.items.forEach((item) => {
                            this.banned.push({
                                text: item.msgid,
                                textPlural: item.msgid_plural,
                                context: item.msgctxt,
                                references: [],
                                comments: []
                            });
                        });
                        resolve(undefined);
                    });
                });
            }));
        });
    }
    getMessages() {
        let messages = super.getMessages();
        return messages.filter((m) => {
            if (this.disablePoLineNumbers) {
                m.references = m.references.map((r) => {
                    if (!r.includes(':'))
                        return r;
                    return r.split(':')[0] + ':1';
                });
            }
            for (const b of this.banned) {
                if (b.text === m.text && b.textPlural == m.textPlural && b.context === m.context) {
                    return false;
                }
            }
            return true;
        });
    }
}
const extractFromFiles = (filePaths, potPath, excludePotPaths, disablePoLineNumbers) => tslib.__awaiter(void 0, void 0, void 0, function* () {
    const extr = new GettextExtractor({ disablePoLineNumbers });
    yield extr.loadBannedPotAsync(excludePotPaths || []);
    const jsParser = extr.createJsParser([
        gettextExtractor.JsExtractors.callExpression(["$gettext", "[this].$gettext"], {
            content: {
                replaceNewLines: "\n",
            },
            arguments: {
                text: 0,
            },
        }),
        gettextExtractor.JsExtractors.callExpression(["$ngettext", "[this].$ngettext"], {
            content: {
                replaceNewLines: "\n",
            },
            arguments: {
                text: 0,
                textPlural: 1,
            },
        }),
        gettextExtractor.JsExtractors.callExpression(["$pgettext", "[this].$pgettext"], {
            content: {
                replaceNewLines: "\n",
            },
            arguments: {
                context: 0,
                text: 1,
            },
        }),
        gettextExtractor.JsExtractors.callExpression(["$npgettext", "[this].$npgettext"], {
            content: {
                replaceNewLines: "\n",
            },
            arguments: {
                context: 0,
                text: 1,
                textPlural: 2,
            },
        }),
    ]);
    const htmlParser = extr.createHtmlParser([
        gettextExtractor.HtmlExtractors.elementContent("translate, [v-translate]", {
            content: {
                trimWhiteSpace: true,
                // TODO: figure out newlines for component
                replaceNewLines: " ",
            },
            attributes: {
                textPlural: "translate-plural",
                context: "translate-context",
                comment: "translate-comment",
            },
        }),
        attributeEmbeddedJsExtractor("[*=*]", jsParser),
        embeddedJsExtractor("*", jsParser),
    ]);
    yield Promise.all(filePaths.map((fp) => tslib.__awaiter(void 0, void 0, void 0, function* () {
        const buffer = yield new Promise((res, rej) => fs__default["default"].readFile(fp, "utf-8", (err, data) => {
            if (err) {
                rej(err);
            }
            res(data);
        }));
        // TODO: make file extensions and parsers configurable
        if (fp.endsWith(".vue")) {
            const { descriptor, errors } = compilerSfc.parse(buffer, {
                filename: fp,
                sourceRoot: process.cwd(),
            });
            if (errors.length > 0) {
                errors.forEach((e) => console.error(e));
            }
            if (descriptor.template && (descriptor.template.lang || 'html') !== 'html') {
                // convert template to js
                const vueTemplate = compilerSfc.compileTemplate({
                    id: '0',
                    source: descriptor.template.content,
                    filename: descriptor.filename,
                    preprocessLang: descriptor.template.lang
                });
                jsParser.parseString(vueTemplate.code, descriptor.filename, {
                    lineNumberStart: 0,
                });
            }
            else if (descriptor.template) {
                htmlParser.parseString(descriptor.template.content, descriptor.filename, {
                    lineNumberStart: descriptor.template.loc.start.line,
                });
            }
            if (descriptor.script) {
                jsParser.parseString(descriptor.script.content, descriptor.filename, {
                    lineNumberStart: descriptor.script.loc.start.line,
                });
            }
            if (descriptor.scriptSetup) {
                jsParser.parseString(descriptor.scriptSetup.content, descriptor.filename, {
                    lineNumberStart: descriptor.scriptSetup.loc.start.line,
                });
            }
        }
        else if (fp.endsWith(".html")) {
            htmlParser.parseString(buffer, fp);
        }
        else if (fp.endsWith(".js") || fp.endsWith(".ts") || fp.endsWith(".cjs") || fp.endsWith(".mjs")) {
            jsParser.parseString(buffer, fp);
        }
    })));
    extr.savePotFile(potPath);
    console.info(`${chalk__default["default"].green("Extraction successful")}, ${chalk__default["default"].blueBright(potPath)} created.`);
    extr.printStats();
});

function execShellCommand(cmd) {
    return new Promise((resolve) => {
        child_process.exec(cmd, (error, stdout, stderr) => {
            if (error) {
                console.warn(error);
            }
            resolve(stdout ? stdout : stderr);
        });
    });
}

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
const globPromise = (pattern) => new Promise((resolve, reject) => {
    try {
        glob__default["default"](pattern, {}, (er, res) => {
            resolve(res);
        });
    }
    catch (e) {
        reject(e);
    }
});
var getFiles = () => tslib.__awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const allFiles = yield Promise.all((_a = config.input) === null || _a === void 0 ? void 0 : _a.include.map((pattern) => {
        const searchPath = path__default["default"].join(config.input.path, pattern);
        console.info(`Searching: ${chalk__default["default"].blueBright(searchPath)}`);
        return globPromise(searchPath);
    }));
    const excludeFiles = yield Promise.all(config.input.exclude.map((pattern) => {
        const searchPath = path__default["default"].join(config.input.path, pattern);
        console.info(`Excluding: ${chalk__default["default"].blueBright(searchPath)}`);
        return globPromise(searchPath);
    }));
    const filesFlat = allFiles.reduce((prev, curr) => [...prev, ...curr], []);
    const excludeFlat = excludeFiles.reduce((prev, curr) => [...prev, ...curr], []);
    excludeFlat.forEach((file) => {
        const index = filesFlat.indexOf(file);
        if (index !== -1) {
            filesFlat.splice(index, 1);
        }
    });
    return filesFlat;
});
console.info(`Input directory: ${chalk__default["default"].blueBright(config.input.path)}`);
console.info(`Output directory: ${chalk__default["default"].blueBright(config.output.path)}`);
console.info(`Output POT file: ${chalk__default["default"].blueBright(config.output.potPath)}`);
console.info(`Locales: ${chalk__default["default"].blueBright(config.output.locales)}`);
console.info();
(() => tslib.__awaiter(void 0, void 0, void 0, function* () {
    const files = yield getFiles();
    console.info();
    files.forEach((f) => console.info(chalk__default["default"].grey(f)));
    console.info();
    yield extractFromFiles(files, config.output.potPath, config.input.excludePot, config.output.disablePoLineNumbers);
    for (const loc of config.output.locales) {
        const poDir = config.output.flat ? config.output.path : path__default["default"].join(config.output.path, loc);
        const poFile = config.output.flat ? path__default["default"].join(poDir, `${loc}.po`) : path__default["default"].join(poDir, `app.po`);
        fs__default["default"].mkdirSync(poDir, { recursive: true });
        const isFile = fs__default["default"].existsSync(poFile) && fs__default["default"].lstatSync(poFile).isFile();
        if (isFile) {
            yield execShellCommand(`msgmerge --lang=${loc} --update ${poFile} ${config.output.potPath} --backup=off`);
            console.info(`${chalk__default["default"].green("Merged")}: ${chalk__default["default"].blueBright(poFile)}`);
        }
        else {
            yield execShellCommand(`msginit --no-translator --locale=${loc} --input=${config.output.potPath} --output-file=${poFile}`);
            fs__default["default"].chmodSync(poFile, 0o666);
            yield execShellCommand(`msgattrib --no-wrap --no-obsolete -o ${poFile} ${poFile}`);
            console.info(`${chalk__default["default"].green("Created")}: ${chalk__default["default"].blueBright(poFile)}`);
        }
    }
    if (config.output.linguas === true) {
        const linguasPath = path__default["default"].join(config.output.path, "LINGUAS");
        fs__default["default"].writeFileSync(linguasPath, config.output.locales.join(" "));
        console.info();
        console.info(`${chalk__default["default"].green("Created")}: ${chalk__default["default"].blueBright(linguasPath)}`);
    }
}))();
