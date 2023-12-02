import { parse, compileTemplate } from "@vue/compiler-sfc";
import chalk from "chalk";
import fs from "fs";
import ts from "typescript";
import pofile from "pofile";
import { GettextExtractor as BaseGettextExtractor, HtmlExtractors, JsExtractors } from "gettext-extractor";
import { attributeEmbeddedJsExtractor } from "./attributeEmbeddedJsExtractor";
import { embeddedJsExtractor } from "./embeddedJsExtractor";
import {JsUtils} from 'gettext-extractor/dist/js/utils'
import { IMessage } from "gettext-extractor/dist/builder";



JsUtils.segmentsMatchPropertyExpression = (segments: string[], propertyAccessExpression: any): boolean =>{
  segments = segments.slice();
  if (!(segments.pop() === propertyAccessExpression.name.text)) {
      return false;
  }
  let segment;
  switch (propertyAccessExpression.expression.kind) {
      case ts.SyntaxKind.Identifier:
          return true;
          return (segments.length === 0 || segments.length === 1 && segments[0] === '[this]')
              && segment === propertyAccessExpression.expression.text;
      case ts.SyntaxKind.ThisKeyword:
          segment = segments.pop();
          return segments.length === 0 && (segment === 'this' || segment === '[this]');
      case ts.SyntaxKind.PropertyAccessExpression:
          return JsUtils.segmentsMatchPropertyExpression(segments, propertyAccessExpression.expression);
  }
  return false;
}



class GettextExtractor extends BaseGettextExtractor{
  banned: Array<IMessage> = [];
  disablePoLineNumbers = false;

  constructor(options?: {disablePoLineNumbers?: boolean}){
    super();
    this.disablePoLineNumbers = !!options?.disablePoLineNumbers;
  }
  async loadBannedPotAsync(potPaths: Array<string>){
    this.banned = [];
    return await Promise.allSettled(potPaths.map((fpath)=>{
      return new Promise((resolve, reject)=>{
        pofile.load(fpath, (err, po)=>{
          if (err){
            reject(err)
            return;
          }
          po.items.forEach((item)=>{
            this.banned.push({
              text: item.msgid,
              textPlural: item.msgid_plural,
              context: item.msgctxt,
              references: [],
              comments: []
            })
          })
          resolve(undefined);
        })
      })
    }));
  }
  getMessages(): IMessage[] {
    let messages = super.getMessages();
    return messages.filter((m)=>{
      if (this.disablePoLineNumbers){
        m.references = m.references.map((r)=>{
          if (!r.includes(':')) return r;
          return r.split(':')[0] + ':1'
        });
      }
      for (const b of this.banned) {
        if (b.text === m.text && b.textPlural == m.textPlural && b.context === m.context){
          return false;
        }
      }
      return true
    })
  }
}


const extractFromFiles = async (filePaths: string[], potPath: string, excludePotPaths?: Array<string>, disablePoLineNumbers?: boolean) => {
  const extr = new GettextExtractor({disablePoLineNumbers});
  await extr.loadBannedPotAsync(excludePotPaths || [])

  const jsParser = extr.createJsParser([
    JsExtractors.callExpression(["$gettext", "[this].$gettext"], {
      content: {
        replaceNewLines: "\n",
      },
      arguments: {
        text: 0,
      },
    }),
    JsExtractors.callExpression(["$ngettext", "[this].$ngettext"], {
      content: {
        replaceNewLines: "\n",
      },
      arguments: {
        text: 0,
        textPlural: 1,
      },
    }),
    JsExtractors.callExpression(["$pgettext", "[this].$pgettext"], {
      content: {
        replaceNewLines: "\n",
      },
      arguments: {
        context: 0,
        text: 1,
      },
    }),
    JsExtractors.callExpression(["$npgettext", "[this].$npgettext"], {
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
    HtmlExtractors.elementContent("translate, [v-translate]", {
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

  await Promise.all(
    filePaths.map(async (fp) => {
      const buffer: string = await new Promise((res, rej) =>
        fs.readFile(fp, "utf-8", (err, data) => {
          if (err) {
            rej(err);
          }
          res(data);
        }),
      );
      // TODO: make file extensions and parsers configurable
      if (fp.endsWith(".vue")) {
        const { descriptor, errors } = parse(buffer, {
          filename: fp,
          sourceRoot: process.cwd(),
        }); 
        if (errors.length > 0) {
          errors.forEach((e) => console.error(e));
        }
        if (descriptor.template && (descriptor.template.lang || 'html') !== 'html') {
          // convert template to js
          const vueTemplate = compileTemplate({
            id: '0',
            source: descriptor.template.content,
            filename: descriptor.filename,
            preprocessLang: descriptor.template.lang
          });
          jsParser.parseString(vueTemplate.code, descriptor.filename, {
            lineNumberStart: 0,
          });
        } else if (descriptor.template){
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
      } else if (fp.endsWith(".html")) {
        htmlParser.parseString(buffer, fp);
      } else if (fp.endsWith(".js") || fp.endsWith(".ts") || fp.endsWith(".cjs") || fp.endsWith(".mjs")) {
        jsParser.parseString(buffer, fp);
      }
    }),
  );

  extr.savePotFile(potPath);
  console.info(`${chalk.green("Extraction successful")}, ${chalk.blueBright(potPath)} created.`);

  extr.printStats();
};
export default extractFromFiles;
