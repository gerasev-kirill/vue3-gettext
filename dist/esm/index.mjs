import { inject, defineComponent, ref, onMounted, computed, getCurrentInstance, h, watch, reactive } from 'vue';

const EVALUATION_RE = /[[\].]{1,2}/g;
/* Interpolation RegExp.
 *
 * Because interpolation inside attributes are deprecated in Vue 2 we have to
 * use another set of delimiters to be able to use `translate-plural` etc.
 * We use %{ } delimiters.
 *
 * /
 *   %\{                => Starting delimiter: `%{`
 *     (                => Start capture
 *       (?:.|\n)       => Non-capturing group: any character or newline
 *       +?             => One or more times (ungreedy)
 *     )                => End capture
 *   \}                 => Ending delimiter: `}`
 * /g                   => Global: don't return after first match
 */
const INTERPOLATION_RE = /%\{((?:.|\n)+?)\}/g;
const MUSTACHE_SYNTAX_RE = /\{\{((?:.|\n)+?)\}\}/g;
/**
 * Evaluate a piece of template string containing %{ } placeholders.
 * E.g.: 'Hi %{ user.name }' => 'Hi Bob'
 *
 * This is a vm.$interpolate alternative for Vue 2.
 * https://vuejs.org/v2/guide/migration.html#vm-interpolate-removed
 *
 * @param {String} msgid - The translation key containing %{ } placeholders
 * @param {Object} context - An object whose elements are put in their corresponding placeholders
 *
 * @return {String} The interpolated string
 */
const interpolate = (plugin) => (msgid, context = {}, disableHtmlEscaping = false, parent) => {
    const silent = plugin.silent;
    if (!silent && MUSTACHE_SYNTAX_RE.test(msgid)) {
        console.warn(`Mustache syntax cannot be used with vue-gettext. Please use "%{}" instead of "{{}}" in: ${msgid}`);
    }
    const result = msgid.replace(INTERPOLATION_RE, (_match, token) => {
        const expression = token.trim();
        let evaluated;
        const escapeHtmlMap = {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#039;",
        };
        // Avoid eval() by splitting `expression` and looping through its different properties if any, see #55.
        function getProps(obj, expression) {
            const arr = expression.split(EVALUATION_RE).filter((x) => x);
            while (arr.length) {
                obj = obj[arr.shift()];
            }
            return obj;
        }
        function evalInContext(context, expression, parent) {
            try {
                evaluated = getProps(context, expression);
            }
            catch (e) {
                // Ignore errors, because this function may be called recursively later.
            }
            if (evaluated === undefined || evaluated === null) {
                if (parent) {
                    // Recursively climb the parent chain to allow evaluation inside nested components, see #23 and #24.
                    return evalInContext(parent.ctx, expression, parent.parent);
                }
                else {
                    console.warn(`Cannot evaluate expression: ${expression}`);
                    evaluated = expression;
                }
            }
            const result = evaluated.toString();
            if (disableHtmlEscaping) {
                // Do not escape HTML, see #78.
                return result;
            }
            // Escape HTML, see #78.
            return result.replace(/[&<>"']/g, (m) => escapeHtmlMap[m]);
        }
        return evalInContext(context, expression, parent);
    });
    return result;
};
// Store this values as function attributes for easy access elsewhere to bypass a Rollup
// weak point with `export`:
// https://github.com/rollup/rollup/blob/fca14d/src/utils/getExportMode.js#L27
interpolate.INTERPOLATION_RE = INTERPOLATION_RE;
interpolate.INTERPOLATION_PREFIX = "%{";

/**
 * Plural Forms
 *
 * This is a list of the plural forms, as used by Gettext PO, that are appropriate to each language.
 * http://docs.translatehouse.org/projects/localization-guide/en/latest/l10n/pluralforms.html
 *
 * This is a replica of angular-gettext's plural.js
 * https://github.com/rubenv/angular-gettext/blob/master/src/plural.js
 */
var plurals = {
    getTranslationIndex: function (languageCode, n) {
        n = Number(n);
        n = typeof n === "number" && isNaN(n) ? 1 : n; // Fallback to singular.
        // Extract the ISO 639 language code. The ISO 639 standard defines
        // two-letter codes for many languages, and three-letter codes for
        // more rarely used languages.
        // https://www.gnu.org/software/gettext/manual/html_node/Language-Codes.html#Language-Codes
        if (languageCode.length > 2 && languageCode !== "pt_BR") {
            languageCode = languageCode.split("_")[0];
        }
        switch (languageCode) {
            case "ay": // Aymará
            case "bo": // Tibetan
            case "cgg": // Chiga
            case "dz": // Dzongkha
            case "fa": // Persian
            case "id": // Indonesian
            case "ja": // Japanese
            case "jbo": // Lojban
            case "ka": // Georgian
            case "kk": // Kazakh
            case "km": // Khmer
            case "ko": // Korean
            case "ky": // Kyrgyz
            case "lo": // Lao
            case "ms": // Malay
            case "my": // Burmese
            case "sah": // Yakut
            case "su": // Sundanese
            case "th": // Thai
            case "tt": // Tatar
            case "ug": // Uyghur
            case "vi": // Vietnamese
            case "wo": // Wolof
            case "zh": // Chinese
                // 1 form
                return 0;
            case "is": // Icelandic
                // 2 forms
                return n % 10 !== 1 || n % 100 === 11 ? 1 : 0;
            case "jv": // Javanese
                // 2 forms
                return n !== 0 ? 1 : 0;
            case "mk": // Macedonian
                // 2 forms
                return n === 1 || n % 10 === 1 ? 0 : 1;
            case "ach": // Acholi
            case "ak": // Akan
            case "am": // Amharic
            case "arn": // Mapudungun
            case "br": // Breton
            case "fil": // Filipino
            case "fr": // French
            case "gun": // Gun
            case "ln": // Lingala
            case "mfe": // Mauritian Creole
            case "mg": // Malagasy
            case "mi": // Maori
            case "oc": // Occitan
            case "pt_BR": // Brazilian Portuguese
            case "tg": // Tajik
            case "ti": // Tigrinya
            case "tr": // Turkish
            case "uz": // Uzbek
            case "wa": // Walloon
                // 2 forms
                return n > 1 ? 1 : 0;
            case "lv": // Latvian
                // 3 forms
                return n % 10 === 1 && n % 100 !== 11 ? 0 : n !== 0 ? 1 : 2;
            case "lt": // Lithuanian
                // 3 forms
                return n % 10 === 1 && n % 100 !== 11 ? 0 : n % 10 >= 2 && (n % 100 < 10 || n % 100 >= 20) ? 1 : 2;
            case "be": // Belarusian
            case "bs": // Bosnian
            case "hr": // Croatian
            case "ru": // Russian
            case "sr": // Serbian
            case "uk": // Ukrainian
                // 3 forms
                return n % 10 === 1 && n % 100 !== 11
                    ? 0
                    : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20)
                        ? 1
                        : 2;
            case "mnk": // Mandinka
                // 3 forms
                return n === 0 ? 0 : n === 1 ? 1 : 2;
            case "ro": // Romanian
                // 3 forms
                return n === 1 ? 0 : n === 0 || (n % 100 > 0 && n % 100 < 20) ? 1 : 2;
            case "pl": // Polish
                // 3 forms
                return n === 1 ? 0 : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? 1 : 2;
            case "cs": // Czech
            case "sk": // Slovak
                // 3 forms
                return n === 1 ? 0 : n >= 2 && n <= 4 ? 1 : 2;
            case "csb": // Kashubian
                // 3 forms
                return n === 1 ? 0 : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? 1 : 2;
            case "sl": // Slovenian
                // 4 forms
                return n % 100 === 1 ? 0 : n % 100 === 2 ? 1 : n % 100 === 3 || n % 100 === 4 ? 2 : 3;
            case "mt": // Maltese
                // 4 forms
                return n === 1 ? 0 : n === 0 || (n % 100 > 1 && n % 100 < 11) ? 1 : n % 100 > 10 && n % 100 < 20 ? 2 : 3;
            case "gd": // Scottish Gaelic
                // 4 forms
                return n === 1 || n === 11 ? 0 : n === 2 || n === 12 ? 1 : n > 2 && n < 20 ? 2 : 3;
            case "cy": // Welsh
                // 4 forms
                return n === 1 ? 0 : n === 2 ? 1 : n !== 8 && n !== 11 ? 2 : 3;
            case "kw": // Cornish
                // 4 forms
                return n === 1 ? 0 : n === 2 ? 1 : n === 3 ? 2 : 3;
            case "ga": // Irish
                // 5 forms
                return n === 1 ? 0 : n === 2 ? 1 : n > 2 && n < 7 ? 2 : n > 6 && n < 11 ? 3 : 4;
            case "ar": // Arabic
                // 6 forms
                return n === 0 ? 0 : n === 1 ? 1 : n === 2 ? 2 : n % 100 >= 3 && n % 100 <= 10 ? 3 : n % 100 >= 11 ? 4 : 5;
            default:
                // Everything else
                return n !== 1 ? 1 : 0;
        }
    },
};

function cleanText(text) {
    if (!text)
        return text;
    return text.replace(/^[/\[\]\-\*\"\'\!\.\,\ :_=]+/g, '')
        .replace(/[/\[\]\-\*\"\'\!\.\,\ :_=]+$/, '');
}
const translate = (language) => ({
    /*
     * Get the translated string from the translation.json file generated by easygettext.
     *
     * @param {String} msgid - The translation key
     * @param {Number} n - The number to switch between singular and plural
     * @param {String} context - The translation key context
     * @param {String} defaultPlural - The default plural value (optional)
     * @param {String} language - The language ID (e.g. 'fr_FR' or 'en_US')
     *
     * @return {String} The translated string
     */
    getTranslation: function (msgid, n = 1, context = null, defaultPlural = null, languageKey, parameters, disableHtmlEscaping = false) {
        // spacing needs to be consistent even if a web template designer adds spaces between lines
        msgid = msgid === null || msgid === void 0 ? void 0 : msgid.trim();
        if (!msgid) {
            return ""; // Allow empty strings.
        }
        const cleanedMsgid = cleanText(msgid);
        const cleanedDefaultPlural = cleanText(defaultPlural);
        const translated = this.baseGetTranslation(cleanedMsgid, n, context, cleanedDefaultPlural, languageKey, parameters, disableHtmlEscaping);
        if (cleanedMsgid === msgid && cleanedDefaultPlural === defaultPlural) {
            return translated;
        }
        if (!defaultPlural) {
            return msgid.replace(cleanedMsgid, translated);
        }
        return msgid.replace(cleanedDefaultPlural || '', translated).replace(cleanedMsgid, translated);
    },
    baseGetTranslation: function (msgid, n = 1, context = null, defaultPlural = null, languageKey, parameters, disableHtmlEscaping = false) {
        if (languageKey === undefined) {
            languageKey = language.current;
        }
        const interp = (message, parameters) => parameters ? language.interpolate(message, parameters, disableHtmlEscaping) : message;
        const silent = languageKey ? language.silent || language.muted.indexOf(languageKey) !== -1 : false;
        // Default untranslated string, singular or plural.
        const untranslated = defaultPlural && plurals.getTranslationIndex(languageKey, n) > 0 ? defaultPlural : msgid;
        // `easygettext`'s `gettext-compile` generates a JSON version of a .po file based on its `Language` field.
        // But in this field, `ll_CC` combinations denoting a language’s main dialect are abbreviated as `ll`,
        // for example `de` is equivalent to `de_DE` (German as spoken in Germany).
        // See the `Language` section in https://www.gnu.org/software/gettext/manual/html_node/Header-Entry.html
        // So try `ll_CC` first, or the `ll` abbreviation which can be three-letter sometimes:
        // https://www.gnu.org/software/gettext/manual/html_node/Language-Codes.html#Language-Codes
        const pluginTranslations = language.translations;
        const translations = pluginTranslations[languageKey] || pluginTranslations[languageKey.split("_")[0]];
        if (!translations) {
            if (!silent) {
                console.warn(`No translations found for ${languageKey}`);
            }
            return interp(untranslated, parameters);
        }
        const getTranslationFromArray = (arr) => {
            let translationIndex = plurals.getTranslationIndex(languageKey, n);
            // Do not assume that the default value of n is 1 for the singular form of all languages. E.g. Arabic
            if (arr.length === 1 && n === 1) {
                translationIndex = 0;
            }
            if (!arr[translationIndex]) {
                throw new Error(msgid + " " + translationIndex + " " + language.current + " " + n);
            }
            return interp(arr[translationIndex], parameters);
        };
        const getUntranslatedMsg = () => {
            if (!silent) {
                let msg = `Untranslated ${languageKey} key found: ${msgid}`;
                if (context) {
                    msg += ` (with context: ${context})`;
                }
                console.warn(msg);
            }
            return interp(untranslated, parameters);
        };
        const translateMsg = (msg, context = null) => {
            if (msg instanceof Object) {
                if (Array.isArray(msg)) {
                    return getTranslationFromArray(msg);
                }
                const msgContext = context !== null && context !== void 0 ? context : "";
                const ctxVal = msg[msgContext];
                return translateMsg(ctxVal);
            }
            if (context) {
                return getUntranslatedMsg();
            }
            if (!msg) {
                return getUntranslatedMsg();
            }
            return interp(msg, parameters);
        };
        const translated = translations[msgid];
        return translateMsg(translated, context);
    },
    /*
     * Returns a string of the translation of the message.
     * Also makes the string discoverable by gettext-extract.
     *
     * @param {String} msgid - The translation key
     * @param {Object} parameters - The interpolation parameters
     * @param {Boolean} disableHtmlEscaping - Disable html escaping
     *
     * @return {String} The translated string
     */
    gettext: function (msgid, parameters, disableHtmlEscaping = false) {
        return this.getTranslation(msgid, undefined, undefined, undefined, undefined, parameters, disableHtmlEscaping);
    },
    /*
     * Returns a string of the translation for the given context.
     * Also makes the string discoverable by gettext-extract.
     *
     * @param {String} context - The context of the string to translate
     * @param {String} msgid - The translation key
     * @param {Object} parameters - The interpolation parameters
     * @param {Boolean} disableHtmlEscaping - Disable html escaping
     *
     * @return {String} The translated string
     */
    pgettext: function (context, msgid, parameters, disableHtmlEscaping = false) {
        return this.getTranslation(msgid, 1, context, undefined, undefined, parameters, disableHtmlEscaping);
    },
    /*
     * Returns a string of the translation of either the singular or plural,
     * based on the number.
     * Also makes the string discoverable by gettext-extract.
     *
     * @param {String} msgid - The translation key
     * @param {String} plural - The plural form of the translation key
     * @param {Number} n - The number to switch between singular and plural
     * @param {Object} parameters - The interpolation parameters
     * @param {Boolean} disableHtmlEscaping - Disable html escaping
     *
     * @return {String} The translated string
     */
    ngettext: function (msgid, plural, n, parameters, disableHtmlEscaping = false) {
        return this.getTranslation(msgid, n, null, plural, undefined, parameters, disableHtmlEscaping);
    },
    /*
     * Returns a string of the translation of either the singular or plural,
     * based on the number, for the given context.
     * Also makes the string discoverable by gettext-extract.
     *
     * @param {String} context - The context of the string to translate
     * @param {String} msgid - The translation key
     * @param {String} plural - The plural form of the translation key
     * @param {Number} n - The number to switch between singular and plural
     * @param {Object} parameters - The interpolation parameters
     * @param {Boolean} disableHtmlEscaping - Disable html escaping
     *
     * @return {String} The translated string
     */
    npgettext: function (context, msgid, plural, n, parameters, disableHtmlEscaping = false) {
        return this.getTranslation(msgid, n, context, plural, undefined, parameters, disableHtmlEscaping);
    },
});

const GetTextSymbol = Symbol("GETTEXT");

function normalizeTranslationKey(key) {
    return key
        .replace(/\r?\n|\r/, "")
        .replace(/\s\s+/g, " ")
        .trim();
}
function normalizeTranslations(translations) {
    const newTranslations = {};
    Object.keys(translations).forEach((lang) => {
        const langData = translations[lang];
        const newLangData = {};
        Object.keys(langData).forEach((key) => {
            newLangData[normalizeTranslationKey(key)] = langData[key];
        });
        newTranslations[lang] = newLangData;
    });
    return newTranslations;
}
const useGettext = () => {
    const gettext = inject(GetTextSymbol, null);
    if (!gettext) {
        throw new Error("Failed to inject gettext. Make sure vue3-gettext is set up properly.");
    }
    return gettext;
};

/**
 * Translate content according to the current language.
 * @deprecated
 */
const Component = defineComponent({
    // eslint-disable-next-line vue/multi-word-component-names, vue/component-definition-name-casing
    name: "translate",
    props: {
        tag: {
            type: String,
            default: "span",
        },
        // Always use v-bind for dynamically binding the `translateN` prop to data on the parent,
        // i.e.: `:translate-n`.
        translateN: {
            type: Number,
            default: null,
        },
        translatePlural: {
            type: String,
            default: null,
        },
        translateContext: {
            type: String,
            default: null,
        },
        translateParams: {
            type: Object,
            default: null,
        },
        translateComment: {
            type: String,
            default: null,
        },
    },
    setup(props, context) {
        var _a, _b, _c;
        const isPlural = props.translateN !== undefined && props.translatePlural !== undefined;
        if (!isPlural && (props.translateN || props.translatePlural)) {
            throw new Error(`\`translate-n\` and \`translate-plural\` attributes must be used together: ${(_c = (_b = (_a = context.slots).default) === null || _b === void 0 ? void 0 : _b.call(_a)[0]) === null || _c === void 0 ? void 0 : _c.children}.`);
        }
        const root = ref();
        const plugin = useGettext();
        const msgid = ref(null);
        onMounted(() => {
            if (!msgid.value && root.value) {
                msgid.value = root.value.innerHTML.trim();
            }
        });
        const translation = computed(() => {
            var _a;
            const translatedMsg = translate(plugin).getTranslation(msgid.value, props.translateN, props.translateContext, isPlural ? props.translatePlural : null, plugin.current);
            return interpolate(plugin)(translatedMsg, props.translateParams, undefined, (_a = getCurrentInstance()) === null || _a === void 0 ? void 0 : _a.parent);
        });
        // The text must be wraped inside a root HTML element, so we use a <span> by default.
        return () => {
            if (!msgid.value) {
                return h(props.tag, { ref: root }, context.slots.default ? context.slots.default() : "");
            }
            return h(props.tag, { ref: root, innerHTML: translation.value });
        };
    },
});

const updateTranslation = (language, el, binding, vnode) => {
    var _a;
    const attrs = vnode.props || {};
    const msgid = el.dataset.msgid;
    const translateContext = attrs["translate-context"];
    const translateN = attrs["translate-n"];
    const translatePlural = attrs["translate-plural"];
    const isPlural = translateN !== undefined && translatePlural !== undefined;
    const disableHtmlEscaping = attrs["render-html"] === "true";
    if (!isPlural && (translateN || translatePlural)) {
        throw new Error("`translate-n` and `translate-plural` attributes must be used together:" + msgid + ".");
    }
    if (!language.silent && attrs["translate-params"]) {
        console.warn(`\`translate-params\` is required as an expression for v-translate directive. Please change to \`v-translate='params'\`: ${msgid}`);
    }
    const translation = translate(language).getTranslation(msgid, translateN, translateContext, isPlural ? translatePlural : null, language.current);
    const context = Object.assign((_a = binding.instance) !== null && _a !== void 0 ? _a : {}, binding.value);
    const msg = interpolate(language)(translation, context, disableHtmlEscaping, null);
    el.innerHTML = msg;
};
/**
 * A directive to translate content according to the current language.
 *
 * Use this directive instead of the component if you need to translate HTML content.
 * It's too tricky to support HTML content within the component because we cannot get the raw HTML to use as `msgid`.
 *
 * This directive has a similar interface to the <translate> component, supporting
 * `translate-comment`, `translate-context`, `translate-plural`, `translate-n`.
 *
 * `<p v-translate translate-comment='Good stuff'>This is <strong class='txt-primary'>Sparta</strong>!</p>`
 *
 * If you need interpolation, you must add an expression that outputs binding value that changes with each of the
 * context variable:
 * `<p v-translate="fullName + location">I am %{ fullName } and from %{ location }</p>`
 * @deprecated
 */
function directive(language) {
    const update = (el, binding, vnode) => {
        // Store the current language in the element's dataset.
        el.dataset.currentLanguage = language.current;
        updateTranslation(language, el, binding, vnode);
    };
    return {
        beforeMount(el, binding, vnode) {
            // Get the raw HTML and store it in the element's dataset (as advised in Vue's official guide).
            if (!el.dataset.msgid) {
                el.dataset.msgid = el.innerHTML;
            }
            watch(language, () => {
                update(el, binding, vnode);
            });
            update(el, binding, vnode);
        },
        updated(el, binding, vnode) {
            update(el, binding, vnode);
        },
    };
}

const defaultOptions = {
    /** all the available languages of your application. Keys must match locale names */
    availableLanguages: { en: "English" },
    defaultLanguage: "en",
    mutedLanguages: [],
    silent: false,
    translations: {},
    setGlobalProperties: true,
    provideDirective: true,
    provideComponent: true,
};
function createGettext(options = {}) {
    Object.keys(options).forEach((key) => {
        if (Object.keys(defaultOptions).indexOf(key) === -1) {
            throw new Error(`${key} is an invalid option for the translate plugin.`);
        }
    });
    const mergedOptions = Object.assign(Object.assign({}, defaultOptions), options);
    const translations = ref(normalizeTranslations(mergedOptions.translations));
    const gettext = reactive({
        available: mergedOptions.availableLanguages,
        muted: mergedOptions.mutedLanguages,
        silent: mergedOptions.silent,
        translations: computed({
            get: () => {
                return translations.value;
            },
            set: (val) => {
                translations.value = normalizeTranslations(val);
            },
        }),
        current: mergedOptions.defaultLanguage,
        install(app) {
            // TODO: is this needed?
            app[GetTextSymbol] = gettext;
            app.provide(GetTextSymbol, gettext);
            if (mergedOptions.setGlobalProperties) {
                const globalProperties = app.config.globalProperties;
                globalProperties.$gettext = gettext.$gettext;
                globalProperties.$pgettext = gettext.$pgettext;
                globalProperties.$ngettext = gettext.$ngettext;
                globalProperties.$npgettext = gettext.$npgettext;
                globalProperties.$gettextInterpolate = gettext.interpolate;
                globalProperties.$language = gettext;
            }
            if (mergedOptions.provideDirective) {
                app.directive("translate", directive(gettext));
            }
            if (mergedOptions.provideComponent) {
                // eslint-disable-next-line vue/multi-word-component-names, vue/component-definition-name-casing
                app.component("translate", Component);
            }
        },
    });
    const translate$1 = translate(gettext);
    const interpolate$1 = interpolate(gettext);
    gettext.$gettext = translate$1.gettext.bind(translate$1);
    gettext.$pgettext = translate$1.pgettext.bind(translate$1);
    gettext.$ngettext = translate$1.ngettext.bind(translate$1);
    gettext.$npgettext = translate$1.npgettext.bind(translate$1);
    gettext.interpolate = interpolate$1.bind(interpolate$1);
    gettext.directive = directive(gettext);
    gettext.component = Component;
    return gettext;
}
const defineGettextConfig = (config) => {
    return config;
};

export { createGettext, defineGettextConfig, useGettext };
