/* Halaman admin Bilik Foto: masuk, lihat semua foto, hapus foto dan voice note */
(function(){
'use strict';
var BF=window.BF,$=BF.$,esc=BF.esc,ic=BF.ic,toast=BF.toast,cfg=BF.cfg;
var S={items:[],limit:60,q:'',ev:'all',picked:{},loaded:false};
var armed=null,armTimer=null;

function showLogin(msg){
  $('#login').hidden=false;$('#panel').hidden=true;$('#who').hidden=true;$('#bulk').hidden=true;
  $('#err').textContent=msg||'';
}
function showPanel(user){
  $('#login').hidden=true;$('#panel').hidden=false;$('#who').hidden=false;
  $('#whoMail').textContent=user.email||'';
  load();
}
async function enter(user){
  var r=await BF.sb.from('admins').select('user_id').eq('user_id',user.id).maybeSingle();
  if(r.error||!r.data){await BF.sb.auth.signOut();showLogin('Akun ini bukan admin.');return}
  showPanel(user);
}

/* ---------- data ---------- */
async function load(){
  var r=await BF.fetchEntries(S.limit);
  if(r.error){toast('Gagal memuat data.');console.error(r.error);return}
  S.items=r.data||[];S.loaded=true;
  var ids={};S.items.forEach(function(x){ids[x.id]=1});
  Object.keys(S.picked).forEach(function(k){if(!ids[k])delete S.picked[k]});
  render();
}
function filtered(){
  var q=S.q.trim().toLowerCase();
  return S.items.filter(function(it){
    if(S.ev!=='all'&&it.event_name!==S.ev)return false;
    if(q&&((it.author||'')+' '+(it.caption||'')).toLowerCase().indexOf(q)<0)return false;
    return true;
  });
}
function render(){
  stopIfDetached();
  var evs=[],seen={};
  S.items.forEach(function(it){if(it.event_name&&!seen[it.event_name]){seen[it.event_name]=1;evs.push(it.event_name)}});
  if(S.ev!=='all'&&!seen[S.ev])S.ev='all';
  $('#ev').innerHTML='<option value="all">Semua kegiatan</option>'+evs.map(function(n){return '<option value="'+esc(n)+'"'+(n===S.ev?' selected':'')+'>'+esc(n)+'</option>'}).join('');
  var withVoice=S.items.filter(function(x){return x.voice_path}).length;
  $('#stats').innerHTML='<span><b>'+S.items.length+'</b> foto dimuat</span><span><b>'+withVoice+'</b> dengan voice note</span>';
  var list=filtered(),body='';
  if(!list.length){
    body='<div class="empty"><p>'+(S.items.length?'Tidak ada foto yang cocok dengan pencarian.':'Belum ada foto di galeri.')+'</p></div>';
  }else{
    body='<div class="grid">'+list.map(function(it){
      var extra='<div class="ga">'+
        (it.voice_path?'<button type="button" class="chip danger" data-a="delvoice" data-id="'+esc(it.id)+'">'+ic('mic')+'Hapus voice note</button>':'')+
        '<button type="button" class="chip danger" data-a="delall" data-id="'+esc(it.id)+'">'+ic('trash')+'Hapus foto</button></div>';
      return BF.card(it,{select:true,picked:!!S.picked[it.id],extra:extra});
    }).join('')+'</div>';
    if(S.items.length>=S.limit)body+='<button type="button" class="chip more" data-a="more">Muat lebih banyak</button>';
  }
  $('#gbody').innerHTML=body;
  updateBulk();
}
function stopIfDetached(){var n=BF.isPlayingNode();if(n&&!document.body.contains(n))BF.stopAudio()}
function updateBulk(){
  var n=Object.keys(S.picked).length;
  $('#bulk').hidden=!n;$('#bulkN').textContent=n+' dipilih';
}

/* ---------- penghapusan ---------- */
async function removeFiles(paths){
  for(var i=0;i<paths.length;i+=100){
    var part=paths.slice(i,i+100);
    var r=await BF.sb.storage.from(cfg.BUCKET).remove(part);
    if(r.error)throw r.error;
    if((r.data||[]).length<part.length)throw new Error('Sebagian file tidak terhapus. Periksa aturan Storage di supabase-setup.sql.');
  }
}
async function deleteEntries(list){
  var paths=[],ids=list.map(function(x){return x.id});
  list.forEach(function(it){[it.photo_path,it.thumb_path,it.voice_path].forEach(function(p){if(p)paths.push(p)})});
  await removeFiles(paths);
  var r=await BF.sb.from('kenangan').delete().in('id',ids).select('id');
  if(r.error)throw r.error;
  if((r.data||[]).length<ids.length)throw new Error('Sebagian data tidak terhapus. Periksa aturan tabel di supabase-setup.sql.');
}
async function deleteVoice(it){
  await removeFiles([it.voice_path]);
  var r=await BF.sb.from('kenangan').update({voice_path:null,voice_type:null}).eq('id',it.id).select('id');
  if(r.error)throw r.error;
  if(!(r.data||[]).length)throw new Error('Data tidak berubah. Periksa aturan tabel di supabase-setup.sql.');
}
function byId(id){return S.items.filter(function(x){return x.id===id})[0]}
async function run(fn,okMsg){
  BF.stopAudio();
  try{await fn();toast(okMsg)}catch(e){console.error(e);toast(e&&e.message?e.message:'Gagal menghapus. Coba lagi.')}
  await load();
}

/* konfirmasi dua langkah di tombol itu sendiri */
function disarm(t){
  if(!t||!t.isConnected)return;
  delete t.dataset.arm;t.classList.remove('arm');if(t.dataset.html)t.innerHTML=t.dataset.html;
}
function arm(t,go){
  if(t.dataset.arm){clearTimeout(armTimer);armed=null;go();return}
  if(armed&&armed!==t)disarm(armed);
  clearTimeout(armTimer);
  t.dataset.arm='1';t.classList.add('arm');t.dataset.html=t.innerHTML;t.innerHTML=ic('trash')+'Yakin hapus?';
  armed=t;armTimer=setTimeout(function(){disarm(t);armed=null},3500);
}

/* ---------- lightbox ---------- */
function openLb(id){
  var it=byId(id);if(!it)return;var lb=$('#lb');
  lb.innerHTML='<div class="lbc"><button type="button" class="lbx" data-a="closelb" aria-label="Tutup">'+ic('x')+'</button>'+
    '<img src="'+esc(BF.url(it.photo_path))+'" alt="Foto dari '+esc(it.author||'tamu')+'">'+
    '<div class="lbb"><div class="gt"><b>'+esc(it.author||'Tanpa nama')+'</b><time>'+esc(BF.fmtTime(it.created_at))+'</time></div>'+
    (it.caption?'<p class="gcap">'+esc(it.caption)+'</p>':'')+(it.voice_path?BF.vbtn(it.id):'')+'</div></div>';
  lb.hidden=false;lb.querySelector('.lbx').focus();
}
function closeLb(){var lb=$('#lb');lb.hidden=true;lb.innerHTML='';BF.stopAudio()}

/* ---------- peristiwa ---------- */
document.addEventListener('click',function(ev){
  var t=ev.target.closest('[data-a],[data-open],[data-play]');if(!t)return;
  if(t.dataset.open){openLb(t.dataset.open);return}
  if(t.dataset.play){var it=byId(t.dataset.play);if(it&&it.voice_path)BF.playToggle(it.id,t,BF.url(it.voice_path));return}
  var a=t.dataset.a;
  if(a==='logout'){BF.sb.auth.signOut().then(function(){S.items=[];S.picked={};showLogin('')});return}
  if(a==='reload'){load();return}
  if(a==='more'){S.limit+=60;load();return}
  if(a==='closelb'){closeLb();return}
  if(a==='selall'){filtered().forEach(function(x){S.picked[x.id]=1});render();return}
  if(a==='selnone'){S.picked={};render();return}
  if(a==='delall'){var it1=byId(t.dataset.id);if(it1)arm(t,function(){run(function(){return deleteEntries([it1])},'Foto dan voice note dihapus.')});return}
  if(a==='delvoice'){var it2=byId(t.dataset.id);if(it2)arm(t,function(){run(function(){return deleteVoice(it2)},'Voice note dihapus.')});return}
  if(a==='delbulk'){
    var list=Object.keys(S.picked).map(byId).filter(Boolean);if(!list.length)return;
    arm(t,function(){S.picked={};run(function(){return deleteEntries(list)},list.length+' foto beserta voice note dihapus.')});return}
});
document.addEventListener('change',function(ev){
  var c=ev.target.closest('[data-sel]');if(!c)return;
  var id=c.dataset.sel;if(c.checked)S.picked[id]=1;else delete S.picked[id];
  var card=c.closest('.gc');if(card)card.classList.toggle('picked',c.checked);
  updateBulk();
});
$('#q').addEventListener('input',function(e){S.q=e.target.value;render()});
$('#ev').addEventListener('change',function(e){S.ev=e.target.value;render()});
$('#lb').addEventListener('click',function(ev){if(ev.target===ev.currentTarget)closeLb()});
document.addEventListener('keydown',function(ev){if(ev.key==='Escape'&&!$('#lb').hidden)closeLb()});

$('#login').addEventListener('submit',async function(e){
  e.preventDefault();
  var em=$('#email').value.trim(),pw=$('#pass').value,btn=$('#loginBtn');
  if(!em||!pw){$('#err').textContent='Isi email dan kata sandi.';return}
  btn.disabled=true;$('#err').textContent='';
  try{
    var r=await BF.sb.auth.signInWithPassword({email:em,password:pw});
    if(r.error)$('#err').textContent='Email atau kata sandi salah.';
    else await enter(r.data.user);
  }catch(x){$('#err').textContent='Tidak bisa menghubungi server. Coba lagi.'}
  $('#pass').value='';btn.disabled=false;
});

async function init(){
  BF.init({session:true});
  if(!BF.configured||!BF.sb){
    showLogin(BF.configured?'Pustaka Supabase gagal dimuat. Periksa koneksi internet.':'Isi SUPABASE_URL dan SUPABASE_ANON_KEY di config.js dulu.');
    $('#loginBtn').disabled=true;return;
  }
  try{
    var s=await BF.sb.auth.getSession();
    var user=s.data&&s.data.session&&s.data.session.user;
    if(user)await enter(user);else showLogin('');
  }catch(x){showLogin('')}
}
init();
})();
