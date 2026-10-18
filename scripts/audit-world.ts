import { MAPS, tileNameFor } from '../src/world/maps';
import { TRAINERS } from '../src/world/trainers';
import { getSpecies } from '../src/data/creatures';

// Independent structural audit of the actual world graph, not a mirrored map snapshot.
const blocked = new Set(['tree','pine','bush','rock-small','wall','roof','roof-heal','roof-shop','roof-trial','window','fence','cave-wall','crystal-wall','ruin-wall','lava','empty']);
const findings: string[]=[];
for (const map of Object.values(MAPS)) {
  if(map.tiles.length!==map.height || map.tiles.some(r=>r.length!==map.width)) findings.push(`${map.id}: dimensions inconsistent`);
  for(const warp of map.warps) {
    const dest=MAPS[warp.to.mapId];
    if(!dest) {findings.push(`${map.id}: missing warp destination ${warp.to.mapId}`);continue;}
    const ch=dest.tiles[warp.to.y]?.[warp.to.x];
    if(!ch || blocked.has(tileNameFor(ch,dest.biome))) findings.push(`${map.id}: arrival ${dest.id} (${warp.to.x},${warp.to.y}) blocked by ${ch}`);
  }
  for(const npc of map.npcs) {
    if(npc.trainerId && !TRAINERS[npc.trainerId]) findings.push(`${map.id}: missing trainer ${npc.trainerId}`);
    if(npc.kind==='sign')continue;
    const neighbors=[[1,0],[-1,0],[0,1],[0,-1]].some(([dx,dy])=>{const ch=map.tiles[npc.y+dy]?.[npc.x+dx];return ch && !blocked.has(tileNameFor(ch,map.biome));});
    if(!neighbors)findings.push(`${map.id}: ${npc.id} has no interaction neighbor`);
  }
}
for(const t of Object.values(TRAINERS))for(const mon of t.party)try{getSpecies(mon.speciesId);}catch{findings.push(`invalid species ${t.id}/${mon.speciesId}`);}
console.log(JSON.stringify({mapCount:Object.keys(MAPS).length,findings},null,2));
