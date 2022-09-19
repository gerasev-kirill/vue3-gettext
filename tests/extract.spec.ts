import * as path from 'path'
import { readFileSync } from "fs";
import Pofile from 'pofile'

import extractFromFiles from '../scripts/extract'
import { po2json } from "../scripts/compile";



const BASE_DIR = __dirname;


function isMessagesEquals(a: any, b: any){
  return a.msgid === b.msgid && a.msgid_plural === b.msgid_plural && a.msgctxt === b.msgctxt;
}


describe("extract", () => {
  it("should extract strings from vue file", async () => {
    const PO_ITEMS = [
      { msgid: 'Other text!', msgctxt: null, msgid_plural: null },
      { msgid: 'Tag attribute', msgctxt: null, msgid_plural: null },
      { msgid: 'Tag inner', msgctxt: null, msgid_plural: null },
      { msgid: 'Text from setup', msgctxt: null, msgid_plural: null },
      {
        msgid: 'Tag attribute with context',
        msgctxt: 'with context',
        msgid_plural: null
      }
    ];
    
    let potFilePath = path.join(BASE_DIR, "tmp", "pug.pot");
  
    let result = await extractFromFiles([
        path.join(BASE_DIR, 'vue', 'Test.vue')
    ], potFilePath);
    
    const catalog = Pofile.parse(readFileSync(potFilePath, 'utf-8'));

    expect(catalog.items.length).toBe(PO_ITEMS.length)

    catalog.items.forEach((item)=>{
      let hasInPo = PO_ITEMS.some((p)=> isMessagesEquals(p, item));
      expect(hasInPo).toBeTruthy();
    });
  });


  it("should extract strings from vue file and ignore from strings from excludePot", async () => {
    const PO_ITEMS = [{
      msgid: "Cancel",
      msgctxt: "some context",
      msgid_plural: null
    },{
      msgid: "Cache for google maps",
      msgctxt: null,
      msgid_plural: null
    },{
      msgid: "day",
      msgctxt: "medium duration text 2",
      msgid_plural: "days"
    },{
      msgid: "Tag attribute",
      msgctxt: null,
      msgid_plural: null
    },{
      msgid: "Tag attribute with context",
      msgctxt: "with context",
      msgid_plural: null
    }]
    let potFilePath = path.join(BASE_DIR, "tmp", "pug.pot");

    let result = await extractFromFiles([
        path.join(BASE_DIR, 'vue', 'Test2.vue')
    ], potFilePath, [
      path.join(BASE_DIR, "gettext/banned.pot")
    ]);
    
    const catalog = Pofile.parse(readFileSync(potFilePath, 'utf-8'));

    expect(catalog.items.length).toBe(PO_ITEMS.length)

    catalog.items.forEach((item)=>{
      let hasInPo = PO_ITEMS.some((p)=> isMessagesEquals(p, item));
      expect(hasInPo).toBeTruthy();
    });

  });


});