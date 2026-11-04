export function createQuizActionGuard({minIntervalMs=420,now=()=>performance.now()}={}){
  let last=-Infinity;
  return {accept(){const time=now();if(time-last<minIntervalMs)return false;last=time;return true},reset(){last=-Infinity}}
}
