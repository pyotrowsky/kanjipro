// Stateless storage record conversions. Preserve v1 IndexedDB and backup formats.
export function learningRowsFromObject(obj){return Object.entries(obj||{}).filter(([,v])=>v&&typeof v==='object'&&!Array.isArray(v)).map(([id,v])=>({id,...v}))}
export function mistakeRowsFromObject(obj){return Object.entries(obj||{}).filter(([,v])=>v&&typeof v==='object'&&!Array.isArray(v)).map(([id,v])=>({...v,id}))}
export function objectFromRows(rows){const out={};for(const row of rows||[]){if(!row?.id)continue;const {id,...rest}=row;out[id]=rest}return out}
export function mistakeObjectFromRows(rows){const out={};for(const row of rows||[]){if(!row?.id)continue;out[row.id]={...row}}return out}
export function cleanRecordObject(value){if(!value||typeof value!=='object'||Array.isArray(value))return{};const out={};for(const [k,v] of Object.entries(value))if(v&&typeof v==='object'&&!Array.isArray(v))out[k]=v;return out}
