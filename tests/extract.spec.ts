import * as path from 'path'
import { readFileSync } from "fs";
import Pofile from 'pofile'

import extractFromFiles from '../scripts/extract'
import { po2json } from "../scripts/compile";



const BASE_DIR = __dirname;

const PO_ITEMS = [
    "Tag inner",
    "Tag attribute",
    "Text from setup",
    "Tag attribute with context",
    "Other text!"
]


describe("extract", () => {
  it("should extract strings from vue file", async () => {
    let potFilePath = path.join(BASE_DIR, "tmp", "pug.pot");

    let result = await extractFromFiles([
        path.join(BASE_DIR, 'vue', 'Test.vue')
    ], potFilePath);
    
    const catalog = Pofile.parse(readFileSync(potFilePath, 'utf-8'));

    let foundItems = 0;
    PO_ITEMS.forEach((item)=>{
        if (catalog.items.find((value)=> value.msgid === item)){
            foundItems += 1
        }
    })
    
    expect(foundItems).toBe(PO_ITEMS.length);
  });



});