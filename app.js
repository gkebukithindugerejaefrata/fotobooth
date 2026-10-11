/* Halaman pengguna Bilik Foto */
(function(){
'use strict';
var BF=window.BF,$=BF.$,esc=BF.esc,ic=BF.ic,toast=BF.toast,cfg=BF.cfg;
var W=720,H=960;
var MAX_VOICE=3*1024*1024;            // batas file suara (byte)
var MAX_REC=Math.max(5,+cfg.MAX_RECORD_SECONDS||30);
var CAN_LIVE=!!(navigator.mediaDevices&&navigator.mediaDevices.getUserMedia);
var CAN_REC=CAN_LIVE&&!!window.MediaRecorder;

var S={view:'booth',frame:0,photo:null,live:null,count:0,facing:'user',vstate:'idle',voice:null,rec:null,
  items:[],limit:24,filter:'all',busy:false,loaded:false,galErr:false};

/* ---------- bingkai PNG ---------- */
var FR=(cfg.FRAMES&&cfg.FRAMES.length?cfg.FRAMES:[{id:'polos',name:'Tanpa bingkai',src:''}]).map(function(f){
  return {id:String(f.id),name:f.name||f.id,src:f.src||'',win:f.window||null,img:null,failed:false};
});
function loadFrames(){
  FR.forEach(function(f){
    if(!f.src)return;
    var im=new Image();
    im.onload=function(){f.img=im;redraw()};
    im.onerror=function(){f.failed=true;console.warn('Bingkai tidak ditemukan: '+f.src)};
    im.src=f.src;
  });
}
function curFrame(){return FR[S.frame]||FR[0]}

/* ---------- menggambar ---------- */
function cover(c,src,x,y,w,h,big,k){
  c.save();c.beginPath();c.rect(x,y,w,h);c.clip();
  if(src){
    var s=Math.max(w/src.w,h/src.h),dw=src.w*s,dh=src.h*s,dx=x+(w-dw)/2,dy=y+(h-dh)/2;
    if(src.mirror){c.translate(2*x+w,0);c.scale(-1,1)}
    c.drawImage(src.el,dx,dy,dw,dh);
  }else{
    var g=c.createLinearGradient(x,y,x,y+h);g.addColorStop(0,'#6B1F36');g.addColorStop(1,'#220A14');
    c.fillStyle=g;c.fillRect(x,y,w,h);
    c.fillStyle='rgba(243,230,210,.2)';
    c.beginPath();c.arc(x+w/2,y+h*.42,w*.14,0,6.2832);c.fill();
    c.beginPath();c.ellipse(x+w/2,y+h*.86,w*.3,h*.21,0,0,6.2832);c.fill();
    if(big){c.fillStyle='rgba(243,230,210,.88)';c.font='italic 500 '+Math.round(36*k)+'px "Bodoni Moda", Georgia, serif';c.textAlign='center';
      c.fillText('Foto kamu tampil di sini',x+w/2,y+h*.14)}
  }
  c.restore();
}
function compose(c,cw,ch,src,f,big){
  var k=cw/W,win=f.win||[0,0,W,H];
  c.fillStyle='#FFFFFF';c.fillRect(0,0,cw,ch);
  cover(c,src,win[0]*k,win[1]*k,win[2]*k,win[3]*k,big,k);
  if(f.img)c.drawImage(f.img,0,0,cw,ch);
}
var stage=$('#stage'),cam=$('#cam'),fName=$('#fName'),fCap=$('#fCap');
function curSrc(){
  if(S.live&&cam.videoWidth)return {el:cam,w:cam.videoWidth,h:cam.videoHeight,mirror:S.live.mirror};
  return S.photo;
}
function drawStage(){
  var c=stage.getContext('2d');
  compose(c,W,H,curSrc(),curFrame(),true);
  if(S.count){
    c.save();c.fillStyle='rgba(34,10,20,.6)';c.beginPath();c.arc(360,430,150,0,6.2832);c.fill();c.strokeStyle='#D9B873';c.lineWidth=2;c.stroke();
    c.fillStyle='#E8CF9A';c.font='italic 700 170px "Bodoni Moda", Georgia, serif';c.textAlign='center';c.fillText(String(S.count),360,492);c.restore();
  }
}
function drawThumbs(){
  document.querySelectorAll('#frames .fr').forEach(function(b,i){
    var cv=b.querySelector('canvas');compose(cv.getContext('2d'),cv.width,cv.height,S.photo,FR[i],false);
  });
}
function markFrames(){document.querySelectorAll('#frames .fr').forEach(function(b,i){b.setAttribute('aria-checked',String(i===S.frame))})}
var pending=false;
function redraw(){
  if(S.live||pending)return;pending=true;
  requestAnimationFrame(function(){pending=false;drawStage();drawThumbs()});
}
function buildFrames(){
  var box=$('#frames');box.innerHTML='';
  FR.forEach(function(f,i){
    var b=document.createElement('button');b.type='button';b.className='fr';b.dataset.i=String(i);b.setAttribute('role','radio');
    b.innerHTML='<canvas width="120" height="160"></canvas><span>'+esc(f.name)+'</span>';box.appendChild(b);
  });
  markFrames();
}
function flash(){var s=$('#shutter');s.classList.remove('go');void s.offsetWidth;s.classList.add('go')}

/* ---------- foto ---------- */
function setPhoto(cv){S.photo={el:cv,w:cv.width,h:cv.height,mirror:false};redraw();syncUI()}
async function loadFile(f){
  if(!f)return;
  try{
    var bmp,w,h;
    try{bmp=await createImageBitmap(f,{imageOrientation:'from-image'})}
    catch(e){bmp=await new Promise(function(res,rej){var i=new Image(),u=URL.createObjectURL(f);i.onload=function(){URL.revokeObjectURL(u);res(i)};i.onerror=rej;i.src=u})}
    w=bmp.width||bmp.naturalWidth;h=bmp.height||bmp.naturalHeight;
    var k=Math.min(1,1600/Math.max(w,h));
    var cv=document.createElement('canvas');cv.width=Math.round(w*k);cv.height=Math.round(h*k);
    cv.getContext('2d').drawImage(bmp,0,0,cv.width,cv.height);
    if(bmp.close)bmp.close();
    stopLive();setPhoto(cv);
  }catch(e){toast('Foto tidak bisa dibuka. Coba foto lain.')}
}
async function startLive(){
  stopLive();
  try{
    var stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:S.facing,width:{ideal:1280},height:{ideal:1280}},audio:false});
    cam.srcObject=stream;await cam.play();
    S.live={stream:stream,mirror:S.facing==='user'};loop();syncUI();
  }catch(e){S.live=null;toast('Kamera tidak bisa dibuka. Izinkan akses kamera, atau pilih foto dari galeri HP.');syncUI()}
}
function stopLive(){
  if(!S.live)return;
  S.live.stream.getTracks().forEach(function(t){t.stop()});S.live=null;cam.srcObject=null;S.count=0;redraw();syncUI();
}
function loop(){if(!S.live)return;drawStage();requestAnimationFrame(loop)}
async function snap(){
  if(!S.live||S.count)return;
  for(var n=3;n>0;n--){if(!S.live){S.count=0;return}S.count=n;syncUI();await BF.sleep(1000)}
  S.count=0;if(!S.live)return;
  var w=cam.videoWidth,h=cam.videoHeight,k=Math.min(1,1600/Math.max(w,h));
  var cv=document.createElement('canvas');cv.width=Math.round(w*k);cv.height=Math.round(h*k);
  var c=cv.getContext('2d');if(S.live.mirror){c.translate(cv.width,0);c.scale(-1,1)}
  c.drawImage(cam,0,0,cv.width,cv.height);
  flash();stopLive();setPhoto(cv);
}

/* ---------- tombol aksi ---------- */
function syncUI(){
  var a=$('#actions'),h='',flip='<button type="button" class="chip" data-a="flip">'+ic('flip')+'Kamera '+(S.facing==='user'?'depan':'belakang')+'</button>';
  if(S.live){
    h+='<button type="button" class="btn snap wide" data-a="snap"'+(S.count?' disabled':'')+'>'+ic('camera')+(S.count?'Bersiap… '+S.count:'Jepret (hitung 3 detik)')+'</button>';
    h+='<div class="row">'+flip+'<button type="button" class="chip" data-a="cancel">'+ic('x')+'Batal</button></div>';
  }else{
    if(CAN_LIVE){
      h+='<button type="button" class="btn wide" data-a="live">'+ic('camera')+(S.photo?'Foto ulang':'Buka kamera')+'</button>';
    }else{
      h+='<button type="button" class="btn wide" data-a="cam">'+ic('camera')+(S.photo?'Ambil foto lagi':'Ambil foto')+'</button>';
    }
    var row='<button type="button" class="chip" data-a="pick">'+ic('image')+'Pilih dari galeri HP</button>'+flip;
    if(S.photo)row+='<button type="button" class="chip" data-a="clear">'+ic('trash')+'Hapus foto</button>';
    h+='<div class="row">'+row+'</div>';
  }
  a.innerHTML=h;
  $('#fileCam').setAttribute('capture',S.facing==='user'?'user':'environment');
  var sv=$('#save');sv.disabled=S.busy||!S.photo||!!S.live||!BF.sb;sv.textContent=S.busy?'Mengunggah…':'Simpan ke galeri';
  $('#saveHint').textContent=S.photo?(S.vstate==='ready'?'Foto dan voice note akan masuk ke galeri.':'Voice note boleh ditambahkan di bawah foto.'):'Ambil foto dulu untuk menyimpan.';
  $('#tab-booth').innerHTML=ic('camera')+'Bilik';
  $('#tab-gallery').innerHTML=ic('image')+'Galeri';
}

/* ---------- voice note ---------- */
function guessType(f){
  if(f.type)return f.type.split(';')[0];
  var e=((f.name||'').toLowerCase().split('.').pop());
  var m={m4a:'audio/mp4',mp4:'audio/mp4',aac:'audio/aac',mp3:'audio/mpeg',wav:'audio/wav',ogg:'audio/ogg',oga:'audio/ogg',webm:'audio/webm','3gp':'audio/3gpp',amr:'audio/amr'};
  return m[e]||'audio/mp4';
}
function extFor(t){
  return ({'audio/webm':'webm','audio/ogg':'ogg','audio/mp4':'m4a','audio/x-m4a':'m4a','audio/mpeg':'mp3','audio/aac':'aac','audio/wav':'wav','audio/x-wav':'wav','audio/3gpp':'3gp','audio/amr':'amr'})[t]||'m4a';
}
function audioDuration(url){return new Promise(function(res){
  var a=new Audio();a.preload='metadata';var done=function(v){res(isFinite(v)&&v>0?v:0)};
  a.onloadedmetadata=function(){done(a.duration)};a.onerror=function(){done(0)};setTimeout(function(){done(0)},2500);a.src=url})}
function clearVoice(){
  var n=BF.isPlayingNode();if(n&&n.dataset.draft)BF.stopAudio();
  if(S.voice)URL.revokeObjectURL(S.voice.url);
  S.voice=null;S.vstate='idle';
}
async function setVoice(file,hint){
  if(file.size>MAX_VOICE){toast('File suara terlalu besar. Maksimal 3 MB.');return}
  clearVoice();
  var blob=new Blob([file],{type:guessType(file)}),url=URL.createObjectURL(blob);
  var dur=hint||await audioDuration(url);
  S.voice={blob:blob,url:url,dur:dur,size:blob.size};S.vstate='ready';renderVoice();syncUI();
}
async function startRec(){
  try{
    var stream=await navigator.mediaDevices.getUserMedia({audio:true});
    var mime=['audio/webm;codecs=opus','audio/mp4','audio/webm'].filter(function(t){return MediaRecorder.isTypeSupported(t)})[0];
    var opt={audioBitsPerSecond:32000};if(mime)opt.mimeType=mime;
    var rec=new MediaRecorder(stream,opt),chunks=[];
    rec.ondataavailable=function(e){if(e.data&&e.data.size)chunks.push(e.data)};
    rec.onstop=function(){
      stream.getTracks().forEach(function(t){t.stop()});
      var r=S.rec;clearInterval(r.timer);var el=(Date.now()-r.t0)/1000;S.rec=null;
      setVoice(new Blob(chunks,{type:(rec.mimeType||mime||'audio/webm')}),el);
    };
    BF.stopAudio();clearVoice();
    S.rec={rec:rec,t0:Date.now(),timer:setInterval(function(){
      var el=(Date.now()-S.rec.t0)/1000,t=$('#recT');if(t)t.textContent=BF.fmtDur(el)+' / '+BF.fmtDur(MAX_REC);
      if(el>=MAX_REC)stopRec();
    },250)};
    rec.start();S.vstate='recording';renderVoice();
  }catch(e){toast('Mikrofon tidak bisa dibuka. Izinkan akses mikrofon, atau pilih file suara.')}
}
function stopRec(){if(S.rec&&S.rec.rec.state!=='inactive')S.rec.rec.stop()}
function renderVoice(){
  var v=$('#voice'),h='',recAct=CAN_REC?'rec':'recfile';
  if(S.vstate==='recording'){
    h='<button type="button" class="rb rec" data-a="stoprec" aria-label="Berhenti merekam">'+ic('stop')+'</button>'+
      '<div class="vt"><strong>Merekam…</strong><span id="recT">0:00 / '+BF.fmtDur(MAX_REC)+'</span></div>';
  }else if(S.vstate==='ready'&&S.voice){
    h='<button type="button" class="rb" data-a="play" data-draft="1" data-state="idle" aria-label="Putar voice note">'+ic('play','i-play')+ic('pause','i-pause')+'</button>'+
      '<div class="vt"><strong>Voice note</strong><span>'+(S.voice.dur?BF.fmtDur(S.voice.dur)+' · ':'')+Math.max(1,Math.round(S.voice.size/1024))+' KB</span><div class="bar"><i id="vbar"></i></div></div>'+
      '<div class="va"><button type="button" class="chip" data-a="'+recAct+'">'+ic('mic')+'Rekam ulang</button><button type="button" class="chip" data-a="delvoice">'+ic('trash')+'Hapus</button></div>';
  }else{
    h='<button type="button" class="rb" data-a="'+recAct+'" aria-label="Rekam voice note">'+ic('mic')+'</button>'+
      '<div class="vt"><strong>Voice note</strong><span>Rekam sapaan atau pesan, maksimal '+MAX_REC+' detik.</span></div>'+
      '<div class="va"><button type="button" class="chip" data-a="'+recAct+'">'+ic('mic')+(CAN_REC?'Rekam suara':'Rekam dengan HP')+'</button><button type="button" class="chip" data-a="pickvoice">'+ic('upload')+'Pilih file suara</button></div>';
  }
  v.innerHTML=h;
}

/* ---------- simpan ke Supabase ---------- */
function uuid(){
  if(window.crypto&&crypto.randomUUID)return crypto.randomUUID();
  var b=new Uint8Array(16);crypto.getRandomValues(b);b[6]=b[6]&15|64;b[8]=b[8]&63|128;
  var h=Array.prototype.map.call(b,function(x){return x.toString(16).padStart(2,'0')}).join('');
  return h.slice(0,8)+'-'+h.slice(8,12)+'-'+h.slice(12,16)+'-'+h.slice(16,20)+'-'+h.slice(20);
}
function renderJpeg(cw,quals,maxBytes){
  var cv=document.createElement('canvas');cv.width=cw;cv.height=Math.round(cw*4/3);
  compose(cv.getContext('2d'),cv.width,cv.height,S.photo,curFrame(),false);
  return (async function(){
    var last=null;
    for(var i=0;i<quals.length;i++){
      var b=await new Promise(function(r){cv.toBlob(r,'image/jpeg',quals[i])});
      if(!b)continue;last=b;if(b.size<=maxBytes)return b;
    }
    return last;
  })();
}
function friendly(err){
  var m=(err&&err.message)||'';
  if(!navigator.onLine)return 'Tidak ada koneksi internet.';
  if(/mime|type/i.test(m))return 'Format file ditolak oleh server.';
  if(/size|exceed|large/i.test(m))return 'File terlalu besar untuk diunggah.';
  if(/row-level|policy|permission|not authorized/i.test(m))return 'Server menolak unggahan. Periksa pengaturan Supabase.';
  return 'Gagal mengunggah. Coba lagi sebentar lagi.';
}
async function save(){
  if(S.busy||!BF.sb)return;
  if(S.live){toast('Jepret fotonya dulu.');return}
  if(!S.photo){toast('Ambil foto dulu.');return}
  S.busy=true;syncUI();BF.stopAudio();
  var sb=BF.sb,bucket=cfg.BUCKET,id=uuid(),f=curFrame();
  var photoPath='photos/'+id+'.jpg',thumbPath='photos/'+id+'_t.jpg',voicePath=null,vtype=null;
  try{
    var full=await renderJpeg(1080,[0.86,0.78,0.7],1800*1024);
    var thumb=await renderJpeg(360,[0.78,0.68],80*1024);
    if(!full||!thumb)throw new Error('export');
    var up=function(path,blob,type){return sb.storage.from(bucket).upload(path,blob,{contentType:type,cacheControl:'31536000',upsert:false})};
    var r=await up(photoPath,full,'image/jpeg');if(r.error)throw r.error;
    r=await up(thumbPath,thumb,'image/jpeg');if(r.error)throw r.error;
    if(S.voice){
      vtype=S.voice.blob.type;voicePath='voices/'+id+'.'+extFor(vtype);
      r=await up(voicePath,S.voice.blob,vtype);if(r.error)throw r.error;
    }
    r=await sb.from('kenangan').insert({id:id,event_name:cfg.EVENT_NAME||'',author:fName.value.trim(),caption:fCap.value.trim(),
      frame:f.id,photo_path:photoPath,thumb_path:thumbPath,voice_path:voicePath,voice_type:vtype});
    if(r.error)throw r.error;
    var withVoice=!!voicePath;
    resetBooth();S.filter='all';go('gallery');toast(withVoice?'Foto dan voice note masuk ke galeri.':'Foto masuk ke galeri.');
  }catch(err){
    console.error(err);
    toast(err&&err.name==='SecurityError'?'Bingkai PNG harus berasal dari alamat situs yang sama.':friendly(err));
  }
  S.busy=false;syncUI();
}
function resetBooth(){stopLive();S.photo=null;fCap.value='';clearVoice();renderVoice();redraw();syncUI()}

/* ---------- galeri ---------- */
async function loadGallery(){
  if(!BF.sb)return;
  var r=await BF.fetchEntries(S.limit);
  if(r.error){S.galErr=true;console.error(r.error);renderGallery();return}
  var data=r.data||[],sig=data.map(function(x){return x.id+'|'+(x.voice_path||'')}).join(',');
  S.galErr=false;
  if(S.loaded&&sig===S.sig){S.items=data;return}      // tidak ada perubahan: jangan gambar ulang (suara tetap jalan)
  S.sig=sig;S.items=data;S.loaded=true;
  renderGallery();
}
function renderGallery(){
  if(S.view!=='gallery')return;
  var evs=[],seen={};
  S.items.forEach(function(it){if(it.event_name&&!seen[it.event_name]){seen[it.event_name]=1;evs.push(it.event_name)}});
  if(S.filter!=='all'&&!seen[S.filter])S.filter='all';
  var ch='';
  if(evs.length>1){
    ch='<button type="button" class="chip" data-f="all" aria-pressed="'+(S.filter==='all')+'">Semua kegiatan</button>';
    evs.forEach(function(n,i){ch+='<button type="button" class="chip" data-f="'+i+'" aria-pressed="'+(S.filter===n)+'">'+esc(n)+'</button>'});
  }
  $('#chips').innerHTML=ch;$('#chips').dataset.evs=JSON.stringify(evs);
  var list=S.items.filter(function(it){return S.filter==='all'||it.event_name===S.filter});
  var body='';
  if(S.galErr&&!S.items.length){
    body='<div class="empty"><p>Galeri belum bisa dimuat. Periksa koneksi internet, lalu coba lagi.</p><button type="button" class="btn" data-a="reload">Muat ulang</button></div>';
  }else if(!S.loaded){
    body='<div class="empty"><p>Memuat galeri…</p></div>';
  }else if(!list.length){
    body='<div class="empty"><p>Belum ada foto di galeri. Ambil foto pertama di bilik, tambahkan voice note, lalu simpan.</p><button type="button" class="btn" data-go="booth">'+ic('camera')+'Ke bilik foto</button></div>';
  }else{
    body='<div class="grid">'+list.map(function(it){return BF.card(it)}).join('')+'</div>';
    if(S.items.length>=S.limit)body+='<button type="button" class="chip more" data-a="more">Tampilkan lebih banyak</button>';
  }
  $('#gbody').innerHTML=body;
  var n=BF.isPlayingNode();if(n&&!n.dataset.draft&&!document.body.contains(n))BF.stopAudio();
}
function openLb(id){
  var it=S.items.filter(function(x){return x.id===id})[0];if(!it)return;
  var lb=$('#lb');
  lb.innerHTML='<div class="lbc"><button type="button" class="lbx" data-a="closelb" aria-label="Tutup">'+ic('x')+'</button>'+
    '<img src="'+esc(BF.url(it.photo_path))+'" alt="Foto kegiatan '+esc(it.event_name)+'">'+
    '<div class="lbb"><div class="gt"><b>'+esc(it.author||'Tanpa nama')+'</b><time>'+esc(BF.fmtTime(it.created_at))+'</time></div>'+
    (it.caption?'<p class="gcap">'+esc(it.caption)+'</p>':'')+
    (it.voice_path?BF.vbtn(it.id):'')+
    '<div class="row"><button type="button" class="chip" data-a="savepic" data-id="'+esc(it.id)+'">'+ic('download')+'Simpan foto</button></div></div></div>';
  lb.hidden=false;lb.querySelector('.lbx').focus();
}
function closeLb(){var lb=$('#lb');lb.hidden=true;lb.innerHTML='';var n=BF.isPlayingNode();if(n&&!n.dataset.draft)BF.stopAudio()}

/* ---------- tab ---------- */
function go(v){
  S.view=v;
  $('#view-booth').hidden=v!=='booth';$('#view-gallery').hidden=v!=='gallery';
  $('#tab-booth').setAttribute('aria-selected',String(v==='booth'));$('#tab-gallery').setAttribute('aria-selected',String(v==='gallery'));
  if(v==='gallery'){stopLive();renderGallery();loadGallery()}else{BF.stopAudio();redraw();syncUI()}
  window.scrollTo(0,0);
}

/* ---------- peristiwa ---------- */
document.addEventListener('click',function(ev){
  var t=ev.target.closest('[data-a],[data-go],[data-f],[data-open],[data-play],.fr');if(!t)return;
  if(t.dataset.go){go(t.dataset.go);return}
  if(t.classList.contains('fr')){S.frame=+t.dataset.i;markFrames();if(!S.live)redraw();return}
  if(t.dataset.f!==undefined){
    var evs=[];try{evs=JSON.parse($('#chips').dataset.evs||'[]')}catch(e){}
    S.filter=t.dataset.f==='all'?'all':evs[+t.dataset.f];renderGallery();return}
  if(t.dataset.open){openLb(t.dataset.open);return}
  if(t.dataset.play){
    var it=S.items.filter(function(x){return x.id===t.dataset.play})[0];if(!it||!it.voice_path)return;
    BF.playToggle(it.id,t,BF.url(it.voice_path));return}
  var a=t.dataset.a;
  if(a==='live')startLive();
  else if(a==='snap')snap();
  else if(a==='cancel')stopLive();
  else if(a==='cam')$('#fileCam').click();
  else if(a==='pick')$('#filePick').click();
  else if(a==='flip'){S.facing=S.facing==='user'?'environment':'user';if(S.live)startLive();else syncUI()}
  else if(a==='clear'){S.photo=null;redraw();syncUI()}
  else if(a==='rec')startRec();
  else if(a==='recfile')$('#voiceCam').click();
  else if(a==='pickvoice')$('#voicePick').click();
  else if(a==='stoprec')stopRec();
  else if(a==='delvoice'){clearVoice();renderVoice();syncUI()}
  else if(a==='play'){if(S.voice)BF.playToggle('draft',t,S.voice.url,$('#vbar'))}
  else if(a==='more'){S.limit+=24;loadGallery()}
  else if(a==='reload')loadGallery();
  else if(a==='closelb')closeLb();
  else if(a==='savepic'){
    var p=S.items.filter(function(x){return x.id===t.dataset.id})[0];
    if(p)BF.download(BF.url(p.photo_path),'bilik-foto-'+p.id.slice(0,8)+'.jpg');
  }
});
$('#lb').addEventListener('click',function(ev){if(ev.target===ev.currentTarget)closeLb()});
document.addEventListener('keydown',function(ev){if(ev.key==='Escape'&&!$('#lb').hidden)closeLb()});
$('#save').addEventListener('click',save);
['#fileCam','#filePick'].forEach(function(s){$(s).addEventListener('change',function(ev){var f=ev.target.files&&ev.target.files[0];ev.target.value='';loadFile(f)})});
['#voiceCam','#voicePick'].forEach(function(s){$(s).addEventListener('change',function(ev){var f=ev.target.files&&ev.target.files[0];ev.target.value='';if(f)setVoice(f,0)})});
function persist(){try{localStorage.setItem('bf_name',fName.value)}catch(e){}}
fName.addEventListener('input',persist);
[fName,fCap].forEach(function(el){el.addEventListener('input',function(){if(!S.live)redraw()})});

/* ---------- mulai ---------- */
function init(){
  document.title=cfg.TITLE||'Bilik Foto';$('#logo').textContent=cfg.TITLE||'Bilik Foto';
  try{var n=localStorage.getItem('bf_name');if(n)fName.value=n}catch(x){}
  BF.init({session:false});
  var bn=$('#banner');
  if(!BF.configured){bn.hidden=false;bn.textContent='Bilik Foto belum tersambung ke Supabase. Isi SUPABASE_URL dan SUPABASE_ANON_KEY di config.js.'}
  else if(!BF.sb){bn.hidden=false;bn.textContent='Pustaka Supabase gagal dimuat. Periksa koneksi internet.'}
  buildFrames();loadFrames();renderVoice();syncUI();redraw();
  try{Promise.all([document.fonts.load('italic 500 36px "Bodoni Moda"'),document.fonts.load('italic 700 100px "Bodoni Moda"')]).catch(function(){}).then(function(){redraw()})}catch(x){}
  if(BF.sb)loadGallery();
  setInterval(function(){if(S.view==='gallery'&&!document.hidden&&$('#lb').hidden)loadGallery()},30000);
}
init();
})();
