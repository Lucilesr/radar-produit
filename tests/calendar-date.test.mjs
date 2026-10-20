import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
const code=ts.transpileModule(readFileSync(new URL('../lib/calendar-date.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext}}).outputText;
const {readCalendarDate,calendarDateValue}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
test('calendrier : conserve le jour civil sans décalage UTC, y compris les jours bissextiles',()=>{
 for(const value of ['2028-02-29','2026-10-20','2026-03-29','2026-10-25'])assert.equal(calendarDateValue(readCalendarDate(value)),value);
});
test('calendrier : rejette les dates impossibles et les dates-heures',()=>{
 for(const value of ['', '2026-02-29','2026-04-31','2026-13-01','2026-10-20T12:00','2026-1-2'])assert.equal(readCalendarDate(value),undefined);
});
