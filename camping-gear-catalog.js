(function(){
  const catalog=window.campingGearCatalog||(window.campingGearCatalog=[]);
  const categoryByNumber={1:'차량',2:'텐트',3:'의자',4:'테이블',5:'잠자리',6:'불멍',7:'조명',8:'기타',9:'기타',10:'기타',11:'기타',12:'기타',13:'크루',14:'기타',15:'기타'};
  const emojiByCategory={'차량':'🚐','텐트':'⛺','의자':'🪑','테이블':'🪵','잠자리':'🛏️','불멍':'🔥','조명':'🏮','크루':'🧍','기타':'🎒'};
  const oldIdsByFile={
    '1.cars/Caravan_B.glb':['1-cars-caravan-blue'],'1.cars/Caravan_Y.glb':['1-cars-caravan-yellow'],'1.cars/Jeep.glb':['1-cars-jeep-open'],'1.cars/Rangerover_J.glb':['1-cars-rangerover-jinoo'],'1.cars/Wrangler_O.glb':['1-cars-wrangler-orange'],'1.cars/Wrangler_Y.glb':['1-cars-wrangler-yellow'],
    '2.tent/1Pole.glb':['2-tent-1pole-tend'],'2.tent/Backpacking1.glb':['2-tent-1p-military-tend'],'2.tent/Backpacking2.glb':['2-tent-1p-tend-yellow','2-tent-1p-tent-red'],'2.tent/Dome.glb':['2-tent-dome-tent'],'2.tent/Military.glb':['2-tent-military-tent'],'2.tent/Tarp.glb':['2-tent-wood-tarp'],
    '3.chair/Beach1.glb':['3-chair-beach-chair'],'3.chair/Beach2.glb':['3-chair-beach-chair-wood'],'3.chair/Folding1.glb':['3-chair-folding-chair'],'3.chair/Folding2.glb':['3-chair-folding-chair-khaki'],'3.chair/Wood.glb':['3-chair-wood-chair'],
    '4.table/Cooking.glb':['4-table-cooking-table'],'4.table/Crosscloth.glb':['4-table-crosscloth-table'],'4.table/Large.glb':['4-table-large-table'],'4.table/Picnic.glb':['4-table-picnic-table'],'4.table/Small.glb':['4-table-small-table'],
    '5.bed/Bed_roll1.glb':['5-bed-bed-roll1'],'5.bed/Bed_roll2.glb':['5-bed-bed-roll2'],'5.bed/Hammock.glb':['5-bed-hammock'],'5.bed/Sleeping_cot1.glb':['5-bed-sleeping-cot-red'],'5.bed/Sleeping_cot2.glb':['5-bed-sleeping-cot-khaki'],'5.bed/Sleeping_cot3.glb':['5-bed-sleeping-cot-white'],'5.bed/Sleeping_mat.glb':['5-bed-sleeping-mat'],
    '6. campfire/Bonfire.glb':['6-campfire-bonfire'],'6. campfire/Campfire.glb':['6-campfire-campfire'],
    '7.lantern/Candle.glb':['7-lantern-candle'],'7.lantern/Fancy.glb':['7-lantern-lantern-fancy'],'7.lantern/Halogen.glb':['7-lantern-halogen-lantern'],'7.lantern/Handy.glb':['7-lantern-handy-lantern'],'7.lantern/Oil.glb':['7-lantern-oil-lantern'],'7.lantern/Stand.glb':['7-lantern-standing-lantern'],'7.lantern/Torch.glb':['7-lantern-torch'],
    '8.bag/Backpack.glb':['8-etc-backpack'],'8.bag/Gearpack.glb':['8-etc-gearpack'],'9.box/Toolbox_G.glb':['8-etc-toolbox-big-green'],'9.box/Toolbox_R.glb':['8-etc-toolbox-big-red'],'9.box/Wood.glb':['8-etc-wood-box'],
    '10.food/Icebox1.glb':['8-etc-ice-box-beige'],'10.food/Icebox2.glb':['8-etc-ice-box-khaki'],'10.food/Icebox3.glb':['8-etc-ice-box-white'],'10.food/Water.glb':['8-etc-water-bottle'],
    '11.tools/Propane.glb':['8-etc-propane-tank'],'11.tools/Radio.glb':['8-etc-radio'],'11.tools/Shovel.glb':['8-etc-shovel'],'11.tools/Wagon.glb':['8-etc-wagon']
  };
  const scaleMultipliersByFile = {
  '2.tent/military2.glb': 2.0,
  '14.tactical/aeroplane.glb': 4.0
};
  const slug=s=>s.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
  const makeItems=paths=>paths.filter(x=>/^camping_gear\/\d+\.[^/]+\/[^/]+\.glb$/i.test(x)).map(path=>{
    const parts=path.split('/'),folder=parts[1],file=parts[2],m=folder.match(/^(\d+)\./),number=m?Number(m[1]):99,category=categoryByNumber[number]||'기타',name=file.replace(/\.glb$/i,''),folderSlug=folder.replace(/^\d+\.\s*/,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,''),id=number+'-'+folderSlug+'-'+slug(name),size=({1:3.5,2:2.8,3:1.3,4:1.6,5:1.6,6:1.2,7:1,13:1.85}[number]||1.2),relative=path.split('/').map(encodeURIComponent).join('/');
    return {id,category,emoji:emojiByCategory[category]||'🎒',label:name,format:'glb',size,scaleMultiplier: scaleMultipliersByFile[`${folder}/${file}`.toLowerCase()] ?? 1,path:'./'+relative,legacyIds:oldIdsByFile[folder+'/'+file]||[],folderNumber:number,isCrew:number===13};
  }).sort((a,b)=>{const na=Number(a.id.split('-')[0]),nb=Number(b.id.split('-')[0]);return na-nb||a.label.localeCompare(b.label)});
  window.campingGearCatalogReady=(async()=>{
    try{
      let paths;
      if(location.hostname==='127.0.0.1'||location.hostname==='localhost'){
        const r=await fetch('./api/camping-gear-catalog',{cache:'no-store'});if(!r.ok)throw new Error('local catalog '+r.status);paths=await r.json();
      }else{
        const r=await fetch('https://api.github.com/repos/neoneo3817/camping_game/git/trees/main?recursive=1',{cache:'no-store',headers:{Accept:'application/vnd.github+json'}});if(!r.ok)throw new Error('GitHub catalog '+r.status);const tree=await r.json();if(tree.truncated)throw new Error('GitHub file list is truncated');paths=(tree.tree||[]).filter(x=>x.type==='blob'&&x.path.toLowerCase().startsWith('camping_gear/')&&x.path.toLowerCase().endsWith('.glb')).map(x=>x.path);
      }
      const items=makeItems(paths);if(!items.length)throw new Error('No GLB files found');
      catalog.splice(0,catalog.length,...items);return catalog;
    }catch(error){console.warn('Dynamic camping gear list failed; using bundled fallback catalog.',error);return catalog}
  })();
})();