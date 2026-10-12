const fs=require('node:fs'),path=require('node:path');
module.exports=function loadFrozenCore(dir){
  // Use an isolated browser root so a snapshot cannot pick up current global catalogs.
  const root={};
  for(const file of ['game-data.js','gear-catalog.js','event-data.js','event-system.js','player-economy.js','game-core.js']){
    if(!fs.existsSync(path.join(dir,file)))continue;
    const module={exports:{}};
    new Function('window','module','exports',fs.readFileSync(path.join(dir,file),'utf8'))(root,module,module.exports);
  }
  return root.SupFusionGameCore;
};
