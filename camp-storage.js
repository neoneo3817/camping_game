const CAMP_LOCAL_SAVES_KEY = 'slowcampLocalSavesV1';
const CAMP_PENDING_RESTORE_KEY = 'slowcampPendingRestoreV1';
const CAMP_VISIT_BACKUP_KEY = 'slowcampVisitBackupV1';
let campStartupSnapshot = null;
let campVisitState = null;
let slowcampSupabaseClient = null;
let slowcampSupabaseLoading = null;

function campStorageEscape(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function campStorageToast(message) {
  let toast = document.getElementById('campStorageToast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'campStorageToast';
    toast.style.cssText = 'position:fixed;z-index:1800;left:50%;bottom:24px;transform:translateX(-50%);padding:12px 18px;border:1px solid #867552;border-radius:14px;background:#211d33;color:#fff3c7;font-weight:800;box-shadow:0 10px 35px #0008;max-width:min(90vw,520px);text-align:center';
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.style.display = 'block';
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => { toast.style.display = 'none'; }, 2800);
}

function campStorageModal(title, body) {
  const old = document.getElementById('campStorageModal');
  if (old) old.remove();
  const overlay = document.createElement('div');
  overlay.id = 'campStorageModal';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:1700;display:grid;place-items:center;padding:16px;background:#090814dc;backdrop-filter:blur(7px)';
  overlay.innerHTML = `<section style="width:min(620px,100%);max-height:86vh;overflow:auto;padding:22px;border:1px solid #786b8e;border-radius:20px;background:linear-gradient(145deg,#28243b,#171522);color:#f8f3e8;box-shadow:0 24px 80px #0009"><header style="display:flex;justify-content:space-between;align-items:center;gap:12px"><h2 style="margin:0;font-size:20px">${campStorageEscape(title)}</h2><button type="button" data-storage-close style="border:1px solid #665b78;border-radius:10px;padding:7px 11px;background:#28243a;color:#fff">닫기</button></header><div style="margin-top:16px">${body}</div></section>`;
  overlay.addEventListener('click', e => { if (e.target === overlay || e.target.closest('[data-storage-close]')) overlay.remove(); });
  document.body.appendChild(overlay);
  return overlay;
}

function captureCampSnapshot(name) {
  const currentCamera = camera;
  const currentControls = controls;
  return {
    version: 1,
    name: String(name || '나의 캠핑장').trim().slice(0, 40),
    savedAt: new Date().toISOString(),
    terrain: campStory.terrain,
    place: campStory.place,
    season: campStory.season,
    gear: (appdb.decorations || []).filter(x => x.kind === 'campingGear' && x.sceneTarget === 'world').map(x => ({...x})),
    nature: campDraftItems.map(x => ({...x})),
    characterFile: typeof campCharacterFile === 'string' ? campCharacterFile : 'Adventurer_boy.glb',
    innerCleared: !!campInnerCleared,
    camera: currentCamera && currentControls ? {
      position: currentCamera.position.toArray(),
      target: currentControls.target.toArray()
    } : null
  };
}

function readLocalCampSaves() {
  try {
    const value = JSON.parse(localStorage.getItem(CAMP_LOCAL_SAVES_KEY) || '[]');
    return Array.isArray(value) ? value : [];
  } catch { return []; }
}

function openLocalSaveDialog() {
  if (campVisitState) { campStorageToast('친구 캠핑장을 보고 있는 동안에는 기기 저장을 할 수 없어요.'); return; }
  const body = '<p style="margin:0 0 14px;color:#d6cfdf">현재 장소와 자연물, 배치한 캠핑 장비를 이 기기에 저장해요.</p><label for="campLocalSaveName" style="display:block;margin-bottom:6px;font-size:13px;font-weight:800">저장 이름</label><input id="campLocalSaveName" maxlength="40" placeholder="예: 가을 산 캠핑" style="width:100%;padding:12px;border:1px solid #716780;border-radius:11px;background:#11101c;color:white;font:inherit"><div style="display:flex;justify-content:flex-end;margin-top:14px"><button type="button" id="campLocalSaveConfirm" class="gold-btn">이 기기에 저장</button></div>';
  const modal = campStorageModal('캠핑장 저장하기', body);
  const input = modal.querySelector('#campLocalSaveName');
  modal.querySelector('#campLocalSaveConfirm').addEventListener('click', () => {
    const name = input.value.trim();
    if (!name) { input.focus(); return; }
    const saves = readLocalCampSaves();
    saves.unshift({...captureCampSnapshot(name), id: crypto.randomUUID?.() || `save-${Date.now()}-${Math.random().toString(36).slice(2,8)}`});
    try {
      localStorage.setItem(CAMP_LOCAL_SAVES_KEY, JSON.stringify(saves));
      modal.remove();
      campStorageToast(`“${name}” 캠핑장을 이 기기에 저장했어요.`);
    } catch (error) {
      campStorageToast('저장 공간이 부족해요. 오래된 캠핑 저장을 지운 뒤 다시 시도해 주세요.');
      console.error('Local campsite save failed:', error);
    }
  });
  input.focus();
}

function restoreCampSnapshot(snapshot, visit = null) {
  if (!snapshot || !Array.isArray(snapshot.gear) || !Array.isArray(snapshot.nature)) return;
  localStorage.setItem(CAMP_PENDING_RESTORE_KEY, JSON.stringify({snapshot, visit}));
  location.reload();
}

function deleteLocalCampSave(id) {
  const saves = readLocalCampSaves().filter(x => x.id !== id);
  localStorage.setItem(CAMP_LOCAL_SAVES_KEY, JSON.stringify(saves));
  openLocalLoadDialog();
}

function openLocalLoadDialog() {
  const saves = readLocalCampSaves();
  const body = saves.length ? '<p style="margin:0 0 12px;color:#d6cfdf">불러올 캠핑장을 선택하세요.</p><div style="display:grid;gap:9px">' + saves.map(s => `<article style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding:12px;border:1px solid #514864;border-radius:13px;background:#171522"><div style="min-width:0"><b>${campStorageEscape(s.name)}</b><small style="display:block;margin-top:4px;color:#b9afcc">${campStorageEscape(new Date(s.savedAt).toLocaleString())}</small></div><div style="display:flex;gap:6px"><button type="button" data-load-save="${campStorageEscape(s.id)}" class="gold-btn">불러오기</button><button type="button" data-delete-save="${campStorageEscape(s.id)}" style="border:1px solid #77525e;border-radius:9px;padding:8px;background:#33202b;color:#ffe8ed">삭제</button></div></article>`).join('') + '</div>' : '<p style="color:#d6cfdf">저장한 캠핑장이 아직 없어요.</p>';
  const modal = campStorageModal('저장한 캠핑장 불러오기', body);
  modal.querySelectorAll('[data-load-save]').forEach(button => button.addEventListener('click', () => {
    const selected = saves.find(x => x.id === button.dataset.loadSave);
    if (selected) restoreCampSnapshot(selected);
  }));
  modal.querySelectorAll('[data-delete-save]').forEach(button => button.addEventListener('click', () => deleteLocalCampSave(button.dataset.deleteSave)));
}

function campSupabaseConfig() {
  const config = window.SLOWCAMP_SUPABASE_CONFIG || {};
  return {url: String(config.url || '').trim(), key: String(config.publishableKey || '').trim()};
}

function loadSupabaseLibrary() {
  if (window.supabase?.createClient) return Promise.resolve();
  if (slowcampSupabaseLoading) return slowcampSupabaseLoading;
  slowcampSupabaseLoading = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js';
    script.onload = () => window.supabase?.createClient ? resolve() : reject(new Error('Supabase 라이브러리에서 createClient를 찾지 못했어요.'));
    script.onerror = () => reject(new Error('Supabase 라이브러리를 불러오지 못했어요. 인터넷 연결을 확인해 주세요.'));
    document.head.appendChild(script);
  });
  return slowcampSupabaseLoading;
}

async function getCampCloudSession() {
  const {url, key} = campSupabaseConfig();
  if (!url || !key) throw new Error('Supabase 프로젝트 URL과 publishable key 설정이 아직 비어 있어요.');
  await loadSupabaseLibrary();
  if (!slowcampSupabaseClient) slowcampSupabaseClient = window.supabase.createClient(url, key);
  let {data, error} = await slowcampSupabaseClient.auth.getSession();
  if (error) throw error;
  if (!data.session) {
    const result = await slowcampSupabaseClient.auth.signInAnonymously();
    if (result.error) throw result.error;
    data = {session: result.data.session};
  }
  return {client: slowcampSupabaseClient, user: data.session.user};
}

async function upsertCampProfile(displayName) {
  const {client, user} = await getCampCloudSession();
    const {error} = await client.from('camp_profiles').upsert({user_id: user.id, display_name: displayName, updated_at: new Date().toISOString()}, {onConflict: 'user_id'});
  if (error) throw error;
  return {client, user};
}

function showCampCloudSetup(error) {
  const message = campStorageEscape(error?.message || String(error));
  const body = `<p style="margin:0;color:#e8dfff">${message}</p><p style="margin:12px 0 0;color:#d6cfdf">연결하려면 <b>supabase-config.js</b>에 프로젝트 URL과 publishable key를 입력하고, Supabase SQL Editor에서 <b>supabase-schema.sql</b>을 한 번 실행해야 해요.</p>`;
  campStorageModal('서버 연결을 준비해 주세요', body);
}

async function loadOwnServerCamp(){try{campStorageToast('저장된 캠핑장을 불러오는 중이에요.');const {client,user}=await getCampCloudSession(),{data,error}=await client.from('camping_spaces').select('snapshot,saved_at').eq('user_id',user.id).maybeSingle();if(error)throw error;if(!data?.snapshot){campStorageToast('서버 저장본이 없어요. 새로운 캠핑장을 시작해 주세요.');return}restoreCampSnapshot(data.snapshot)}catch(error){console.error('Could not resume saved campsite:',error);showCampCloudSetup(error)}}
async function saveCampToServer() {
  if (campVisitState) {
    try { const displayName=(localStorage.getItem('slowcampUserNameV1')||'').trim(); if(!displayName){campStorageToast('먼저 이름을 입력해 주세요.');return;} const {client,user}=await upsertCampProfile(displayName); const gifts=(appdb.decorations||[]).filter(x=>x.guestAddedFor===campVisitState.userId&&x.guestAdded); if(!gifts.length){campStorageToast('친구에게 보탤 장비가 없어요. 먼저 장비를 배치해 주세요.');return;} const rows=gifts.map(item=>({owner_user_id:campVisitState.userId,contributor_user_id:user.id,contributor_name:displayName,source_item_id:item.id,item:{asset:item.asset,x:item.x,z:item.z,rot:item.rot},created_at:new Date().toISOString()})); const {error}=await client.from('camp_guest_items').upsert(rows,{onConflict:'owner_user_id,contributor_user_id,source_item_id'});if(error)throw error;campStorageToast('친구에게 장비를 전달했어요. 다음 접속 때 친구 캠핑장에 표시돼요.');}catch(error){console.error('Friend campsite contribution failed:',error);showCampCloudSetup(error)} return;
  }
  try {
    const displayName = (localStorage.getItem('slowcampUserNameV1') || '').trim();
    if (!displayName) { campStorageToast('먼저 이름을 입력해 주세요.'); showCampNamePrompt(); return; }
    const {client, user} = await upsertCampProfile(displayName);
    const snapshot = captureCampSnapshot(displayName);
    const {error} = await client.from('camping_spaces').upsert({user_id: user.id, snapshot, saved_at: new Date().toISOString()}, {onConflict: 'user_id'});
    if (error) throw error;
    campStorageToast('캠핑장을 Supabase 서버에 저장했어요.');
  } catch (error) {
    console.error('Supabase campsite save failed:', error);
    showCampCloudSetup(error);
  }
}

async function openFriendCampsites() {
  try {
    const {client, user} = await getCampCloudSession();
    const spacesResult = await client.from('camping_spaces').select('user_id,snapshot,saved_at').neq('user_id', user.id).order('saved_at', {ascending: false});
    if (spacesResult.error) throw spacesResult.error;
    const spacesByUser = new Map();
    for (const row of spacesResult.data || []) {
      if (row.user_id !== user.id && !spacesByUser.has(row.user_id)) spacesByUser.set(row.user_id, row);
    }
    const spaces = [...spacesByUser.values()];
    if (!spaces.length) { campStorageModal('친구 캠핑장 놀러가기', '<p style="color:#d6cfdf">아직 서버에 저장된 친구 캠핑장이 없어요.</p>'); return; }
    const ids = spaces.map(x => x.user_id);
    const profileResult = await client.from('camp_profiles').select('user_id,display_name').in('user_id', ids);
    if (profileResult.error) throw profileResult.error;
    const names = new Map((profileResult.data || []).map(x => [x.user_id, x.display_name]));
    const body = '<p style="margin:0 0 12px;color:#d6cfdf">각 사용자가 마지막으로 서버 저장한 캠핑장을 보여줘요.</p><div style="display:grid;gap:9px">' + spaces.map(s => `<article style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding:12px;border:1px solid #514864;border-radius:13px;background:#171522"><div><b>${campStorageEscape(names.get(s.user_id) || '캠핑 친구')}</b><small style="display:block;margin-top:4px;color:#b9afcc">저장 ${campStorageEscape(new Date(s.saved_at).toLocaleString())}</small></div><button type="button" class="gold-btn" data-visit-user="${campStorageEscape(s.user_id)}">놀러가기</button></article>`).join('') + '</div>';
    const modal = campStorageModal('친구 캠핑장 놀러가기', body);
    modal.querySelectorAll('[data-visit-user]').forEach(button => button.addEventListener('click', () => {
      const selected = spaces.find(x => x.user_id === button.dataset.visitUser);
      if (!selected?.snapshot) return;
      localStorage.setItem(CAMP_VISIT_BACKUP_KEY, JSON.stringify(captureCampSnapshot('내 캠핑장')));
      restoreCampSnapshot(selected.snapshot, {userId: selected.user_id, displayName: names.get(selected.user_id) || '캠핑 친구'});
    }));
  } catch (error) {
    console.error('Could not load friend campsites:', error);
    showCampCloudSetup(error);
  }
}

function returnFromFriendCampsite() {
  try {
    const backup = JSON.parse(localStorage.getItem(CAMP_VISIT_BACKUP_KEY) || 'null');
    if (!backup) { campStorageToast('돌아갈 캠핑장 저장본을 찾지 못했어요.'); return; }
    localStorage.removeItem(CAMP_VISIT_BACKUP_KEY);
    restoreCampSnapshot(backup);
  } catch (error) { campStorageToast('내 캠핑장 저장본을 읽지 못했어요.'); }
}

function initCampStorage() {
  try {
    const pending = JSON.parse(localStorage.getItem(CAMP_PENDING_RESTORE_KEY) || 'null');
    if (!pending?.snapshot) return;
    localStorage.removeItem(CAMP_PENDING_RESTORE_KEY);
    const snapshot = pending.snapshot;
    appdb.decorations = (appdb.decorations || []).filter(x => !(x.kind === 'campingGear' && x.sceneTarget === 'world')).concat(snapshot.gear || []);
    save();
    campDraftItems = snapshot.nature || [];
    localStorage.setItem('campingBackgroundDraftV3', JSON.stringify(campDraftItems));
    localStorage.setItem('slowcampNatureDraftExplicitEmptyV1', '1');
    campInnerCleared = !!snapshot.innerCleared;
    campStory.terrain = Number(snapshot.terrain) || 1;
    campStory.place = Number(snapshot.place) || 0;
    campStory.season = snapshot.season === 'winter' ? 'winter' : 'summer';
    campStory.step = 6;
    campStory.active = true;
    campStory.setupIndex = campSetup.length;
    campVisitState = pending.visit || null;
    if (campVisitState) { loadFriendReactions();
      const validCharacters = ['Adventurer_boy.glb', 'Adventurer_girl.glb', 'Soldier_boy.glb', 'Soldier_girl.glb'];
      window.slowcampFriendCharacter = {
        file: validCharacters.includes(snapshot.characterFile) ? snapshot.characterFile : 'Adventurer_boy.glb',
        name: campVisitState.displayName || '캠핑 친구'
      };
    } else {
      window.slowcampFriendCharacter = null;
      const validCharacters = ['Adventurer_boy.glb', 'Adventurer_girl.glb', 'Soldier_boy.glb', 'Soldier_girl.glb'];
      if (validCharacters.includes(snapshot.characterFile)) {
        localStorage.setItem('slowcampCharacterFileV1', snapshot.characterFile);
        campCharacterFile = snapshot.characterFile;
      }
    }
    window.slowcampStartupSnapshot = snapshot;
  } catch (error) { console.error('Could not restore campsite:', error); }
}

function applyStartupCampCamera() {
  const cameraState = window.slowcampStartupSnapshot?.camera;
  if (!cameraState || !camera || !controls) return;
  if (Array.isArray(cameraState.position)) camera.position.fromArray(cameraState.position);
  if (Array.isArray(cameraState.target)) controls.target.fromArray(cameraState.target);
  controls.update();
}

function loadFriendCampCharacter() {
  const friend = window.slowcampFriendCharacter;
  if (!friend || !window.THREE || !loader || !world) return;
  const loadPromise = new Promise(resolve => loader.load(encodeURI('./charactor/' + friend.file), gltf => {
    if (window.slowcampFriendCharacter !== friend || !world) { resolve(null); return; }
    const model = gltf.scene;
    const bounds = new THREE.Box3().setFromObject(model);
    const size = bounds.getSize(new THREE.Vector3());
    const center = bounds.getCenter(new THREE.Vector3());
    const scale = 2.05 / (size.y || 1);
    model.scale.setScalar(scale);
    model.position.set(-center.x * scale, -bounds.min.y * scale, -center.z * scale);
    model.traverse(node => {
      if (node.isMesh) {
        node.castShadow = true;
        node.receiveShadow = true;
        node.material = Array.isArray(node.material) ? node.material.map(fixMaterial) : fixMaterial(node.material);
      }
    });
    const group = new THREE.Group();
    group.add(model);
    const tent = (appdb.decorations || []).find(item => item.kind === 'campingGear' && campingGearCatalog.find(gear => gear.id === item.asset)?.category === '텐트');
    const x = tent ? Math.max(-8, Math.min(8, tent.x + 2.2)) : 2.2;
    const z = tent ? Math.max(-8, Math.min(8, tent.z + 1.8)) : 1.8;
    group.position.set(x, -.14, z);
    group.userData.campFriendCharacter = true;
    world.add(group);

    const canvas = document.createElement('canvas');
    canvas.width = 320; canvas.height = 110;
    const ctx = canvas.getContext('2d');
    ctx.beginPath();ctx.moveTo(40,10);ctx.lineTo(280,10);ctx.quadraticCurveTo(300,10,300,30);ctx.lineTo(300,62);ctx.quadraticCurveTo(300,82,280,82);ctx.lineTo(178,82);ctx.lineTo(160,103);ctx.lineTo(142,82);ctx.lineTo(40,82);ctx.quadraticCurveTo(20,82,20,62);ctx.lineTo(20,30);ctx.quadraticCurveTo(20,10,40,10);ctx.closePath();ctx.fillStyle='rgba(27,25,39,.68)';ctx.fill();ctx.lineWidth=3;ctx.strokeStyle='rgba(255,255,255,.5)';ctx.stroke();ctx.font='bold 25px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='rgba(255,255,255,.96)';ctx.fillText(String(friend.name).slice(0,12),160,47);
    const texture = new THREE.CanvasTexture(canvas);texture.encoding = THREE.sRGBEncoding;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({map:texture,transparent:true,depthTest:false,depthWrite:false}));
    sprite.position.set(0,2.3,0);sprite.scale.set(1.38,.48,1);group.add(sprite);
    resolve(group);
  }, undefined, error => { console.warn('친구 캐릭터를 불러오지 못했어요:', error); resolve(null); }));
  pendingAssets.push(loadPromise);
  return loadPromise;
}

async function saveFriendReaction(itemId,heart,message){if(!campVisitState)return false;try{const displayName=(localStorage.getItem('slowcampUserNameV1')||'캠핑 친구').trim(),{client,user}=await upsertCampProfile(displayName),old=(window.slowcampFriendReactions||[]).find(x=>x.item_id===itemId&&x.visitor_user_id===user.id)||{},row={owner_user_id:campVisitState.userId,visitor_user_id:user.id,item_id:itemId,heart:heart?true:!!old.heart,message:message===null?old.message:message,updated_at:new Date().toISOString()},{error}=await client.from('camp_item_reactions').upsert(row,{onConflict:'owner_user_id,visitor_user_id,item_id'});if(error)throw error;campStorageToast('친구에게 반응을 남겼어요.');await loadFriendReactions();return true}catch(error){console.error('Friend item reaction failed:',error);campStorageToast('반응을 저장하지 못했어요. 서버 설정을 확인해 주세요.');return false}}
async function loadFriendReactions(){if(!campVisitState)return;try{const {client}=await getCampCloudSession(),{data,error}=await client.from('camp_item_reactions').select('item_id,visitor_user_id,heart,message,updated_at').eq('owner_user_id',campVisitState.userId).order('updated_at',{ascending:true});if(error)throw error;window.slowcampFriendReactions=data||[];window.renderFriendReactionMarkers?.()}catch(error){console.warn('Friend reactions could not be loaded:',error)}}
async function loadOwnerFriendReactions(){if(campVisitState)return;try{const {client,user}=await getCampCloudSession(),{data,error}=await client.from('camp_item_reactions').select('item_id,visitor_user_id,heart,message,updated_at').eq('owner_user_id',user.id).order('updated_at',{ascending:true});if(error)throw error;window.slowcampFriendReactions=data||[];window.slowcampReactionOwnerView=true;window.renderFriendReactionMarkers?.()}catch(error){console.warn('Owner campsite reactions could not be loaded:',error)}}
async function checkIncomingGuestItems(){try{const name=(localStorage.getItem('slowcampUserNameV1')||'').trim();if(!name||campVisitState)return;const {client,user}=await upsertCampProfile(name),{data,error}=await client.from('camp_guest_items').select('id,item,contributor_name').eq('owner_user_id',user.id).is('accepted_at',null);if(error)throw error;if(!data?.length)return;const {data:space,error:spaceError}=await client.from('camping_spaces').select('snapshot').eq('user_id',user.id).maybeSingle();if(spaceError)throw spaceError;const snapshot=space?.snapshot&&Array.isArray(space.snapshot.gear)?space.snapshot:captureCampSnapshot(name),newItems=data.map(row=>({id:'guest-'+row.id,kind:'campingGear',sceneTarget:'world',...row.item,guestContributionId:row.id})),existing=new Set(snapshot.gear.map(x=>x.id));snapshot.gear.push(...newItems.filter(x=>!existing.has(x.id)));const {error:saveError}=await client.from('camping_spaces').upsert({user_id:user.id,snapshot,saved_at:new Date().toISOString()},{onConflict:'user_id'});if(saveError)throw saveError;const ids=data.map(x=>x.id),{error:updateError}=await client.from('camp_guest_items').update({accepted_at:new Date().toISOString()}).in('id',ids);if(updateError)throw updateError;const activeItems=newItems.filter(item=>!(appdb.decorations||[]).some(x=>x.id===item.id));appdb.decorations.push(...activeItems);save();for(const item of activeItems)if(world)loadGearProp(item,world,-.14);campStorageModal('친구가 배치한 아이템이 있어요','<p style="color:#e8dfff">친구가 내 캠핑장에 '+data.length+'개의 장비를 보탰어요. 서버에 저장했고, 다음에 가던 캠핑장으로 돌아가면 배치가 보여요.</p>')}catch(error){console.warn('Incoming friend items could not be loaded:',error);campStorageToast('친구가 둔 장비를 불러오지 못했어요. 서버 연결을 확인해 주세요.')}}
function initCampStorageButtons() {
  const button = document.getElementById('campVisitReturn');
  if (button) button.style.display = campVisitState ? 'inline-flex' : 'none';
}
