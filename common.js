/* Fungsi bersama untuk index.html dan admin.html */
(function(){
'use strict';
var cfg=window.BILIK_CONFIG||{};
var BF=window.BF={cfg:cfg,sb:null,configured:false};

BF.configured=!!(cfg.SUPABASE_URL&&cfg.SUPABASE_ANON_KEY&&String(cfg.SUPABASE_URL).indexOf('ISI-')<0&&String(cfg.SUPABASE_ANON_KEY).indexOf('ISI-')<0);

BF.$=function(s){return document.querySelector(s)};
BF.esc=function(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})};
BF.sleep=function(ms){return new Promise(function(r){setTimeout(r,ms)})};
BF.fmtTime=function(t){return new Date(t).toLocaleString('id-ID',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})};
BF.fmtDur=function(s){s=Math.max(0,Math.round(s||0));return Math.floor(s/60)+':'+String(s%60).padStart(2,'0')};

var ICON={
  mic:'<rect x="9" y="3" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
  play:'<path d="M8 5v14l11-7z" fill="currentColor" stroke="none"/>',
  pause:'<path d="M7 5h4v14H7zM13 5h4v14h-4z" fill="currentColor" stroke="none"/>',
  stop:'<rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" stroke="none"/>',
  camera:'<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
  image:'<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-8 9"/>',
  trash:'<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  x:'<path d="M6 6l12 12M18 6L6 18"/>',
  download:'<path d="M12 4v11M7 11l5 5 5-5M5 20h14"/>',
  flip:'<path d="M4 9a8 8 0 0 1 14-3l2 2M20 15a8 8 0 0 1-14 3l-2-2M18 3v5h-5M6 21v-5h5"/>',
  upload:'<path d="M12 16V5M7 9l5-5 5 5M5 20h14"/>'
};
BF.ic=function(n,cls){return '<svg class="ic'+(cls?' '+cls:'')+'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+ICON[n]+'</svg>'};

/* Klien Supabase. opts.session=true menyimpan login (untuk admin). */
BF.init=function(opts){
  opts=opts||{};
  if(BF.configured&&window.supabase&&window.supabase.createClient){
    BF.sb=window.supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_ANON_KEY,
      {auth:{persistSession:!!opts.session,autoRefreshToken:!!opts.session,detectSessionInUrl:false}});
  }
  return BF.sb;
};
BF.url=function(path){
  if(!BF.sb||!path)return '';
  return BF.sb.storage.from(cfg.BUCKET).getPublicUrl(path).data.publicUrl;
};
BF.fetchEntries=function(limit){
  return BF.sb.from('kenangan').select('*').order('created_at',{ascending:false}).range(0,Math.max(1,limit)-1);
};

/* toast */
var tt=null;
BF.toast=function(s){var t=BF.$('#toast');if(!t)return;t.textContent=s;t.classList.add('show');clearTimeout(tt);tt=setTimeout(function(){t.classList.remove('show')},3800)};

/* pemutar suara: satu suara pada satu waktu */
var A=new Audio(),cur=null;
BF.stopAudio=function(){A.pause();if(cur){cur.btn.dataset.state='idle';if(cur.bar)cur.bar.style.width='0';cur=null}};
BF.isPlayingNode=function(){return cur?cur.btn:null};
BF.playToggle=function(key,btn,src,bar){
  if(cur&&cur.key===key){cur.btn=btn;if(A.paused)A.play().catch(function(){});else A.pause();return}
  BF.stopAudio();cur={key:key,btn:btn,bar:bar};btn.dataset.state='loading';
  var mine=cur;A.src=src;
  A.play().catch(function(){if(cur===mine){btn.dataset.state='idle';cur=null}BF.toast('Voice note tidak bisa diputar di perangkat ini.')});
};
A.onplay=function(){if(cur)cur.btn.dataset.state='playing'};
A.onpause=function(){if(cur&&!A.ended)cur.btn.dataset.state='paused'};
A.onended=function(){if(cur){cur.btn.dataset.state='idle';if(cur.bar)cur.bar.style.width='0';cur=null}};
A.ontimeupdate=function(){if(cur&&cur.bar&&A.duration>0&&isFinite(A.duration))cur.bar.style.width=Math.min(100,A.currentTime/A.duration*100)+'%'};

/* kartu galeri */
BF.vbtn=function(id){
  return '<button type="button" class="vp" data-play="'+BF.esc(id)+'" data-state="idle" aria-label="Putar voice note">'+BF.ic('play','i-play')+BF.ic('pause','i-pause')+'<span>Voice note</span><i class="eq"><b></b><b></b><b></b></i></button>';
};
BF.card=function(it,opt){
  opt=opt||{};
  var thumb=BF.url(it.thumb_path||it.photo_path);
  return '<article class="gc'+(opt.picked?' picked':'')+'" data-id="'+BF.esc(it.id)+'">'+
    (opt.select?'<label class="sel"><input type="checkbox" data-sel="'+BF.esc(it.id)+'"'+(opt.picked?' checked':'')+' aria-label="Pilih foto ini"></label>':'')+
    '<button type="button" class="gp" data-open="'+BF.esc(it.id)+'" aria-label="Lihat foto"><img src="'+BF.esc(thumb)+'" alt="Foto '+BF.esc(it.author||'tamu')+'" loading="lazy"></button>'+
    '<div class="gm"><div class="gt"><b>'+BF.esc(it.author||'Tanpa nama')+'</b><time>'+BF.esc(BF.fmtTime(it.created_at))+'</time></div>'+
    (it.caption?'<p class="gcap">'+BF.esc(it.caption)+'</p>':'')+
    (it.voice_path?BF.vbtn(it.id):'')+(opt.extra||'')+'</div></article>';
};

/* unduh foto (fetch lalu simpan; jika gagal buka di tab baru) */
BF.download=async function(url,name){
  try{
    var r=await fetch(url);if(!r.ok)throw new Error('http');
    var b=await r.blob(),a=document.createElement('a');
    a.href=URL.createObjectURL(b);a.download=name;document.body.appendChild(a);a.click();a.remove();
    setTimeout(function(){URL.revokeObjectURL(a.href)},4000);
  }catch(e){window.open(url,'_blank')}
};
})();
