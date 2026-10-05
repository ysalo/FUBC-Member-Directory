#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { memberCsvColumns, parseMemberCsv } from '../supabase/functions/_shared/member-csv.ts';
const [source, destination]=process.argv.slice(2);
if(!source||!destination)throw new Error('Usage: node scripts/prepare-member-import.mjs <source.csv> <new-output.csv>');
if(resolve(source)===resolve(destination))throw new Error('Choose a new output file to preserve the source.');
const rows=parseMemberCsv(await readFile(source,'utf8'));
const encode=value=>'"'+String(value??'').replaceAll('"','""')+'"';
const csv='\uFEFF'+[memberCsvColumns.join(','),...rows.map(row=>memberCsvColumns.map(key=>encode(row[key])).join(','))].join('\r\n')+'\r\n';
await writeFile(destination,csv,{encoding:'utf8',flag:'wx'});
console.log(JSON.stringify({records:rows.length,male:rows.filter(r=>r.gender==='male').length,female:rows.filter(r=>r.gender==='female').length,output:resolve(destination)}));
