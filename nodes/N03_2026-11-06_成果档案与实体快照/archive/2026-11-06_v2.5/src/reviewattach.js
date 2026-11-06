/* ===== 施工方案内审记录附件：施工方案 / 审查记录 =====
   设计要点（v2.5，经设计确认）：
   1) 独立数组 DB().reviewAttachments，字段 reviewId 关联内审方案、kind 区分两类附件。
      **按 id 绑定**（不按方案名称）→ 方案改名不失联、新增方案自动覆盖。
      不写进 reviews 的任何业务字段 → 不触发 beforeSave，不改 KPI/CSV/导入器，
      原有内审记录功能与已有 6 条方案数据完全不受影响。
   2) 二进制复用文件中心同一 IndexedDB 库（key 加 ra_ 前缀），≤20MB 存浏览器、
      >20MB 或文件库不可用时降级为路径索引；文件中心自身仍保持 5MB 阈值。
   3) 「查看」= 页内即时完成：图片/PDF 用浏览器原生预览，doc/docx/pdf/xls/xlsx/
      txt/md 用工作台自带零依赖 Parse.parse 抽正文在弹窗内阅读；无文本层（扫描件、
      图片型 PDF）明确提示，可用 tools/review_attach_md.py（markitdown）转 .md 后
      作为普通附件重新上传（不新增第三类、不新增数据字段，.md 已在 Parse 白名单）。
   4) 权限沿用 schema.readonly；另按方案提供「归档锁定」，锁定后禁增删、仍可查看/下载。
   5) 上传逐条 + 汇总提示；查看/下载/删除对记录不存在、方案已删、路径索引、
      原件丢失、解析失败等均给明确提示，不静默失败。
   6) 同类同名附件二次确认后替换旧版（连旧二进制一起删）；方案被删后附件保留，
      总览标出「孤儿附件」并提供整批清理。
   7) 不按修改闭环状态硬拦截上传，只给软提示。 */
(function(){
"use strict";
var A=window.APP, $=A.$, $$=A.$$, esc=A.esc;
function DB(){return A.db;}
function toast(m,t){ if(window.toast) window.toast(m,t); else console.log(m); }

var KINDS=[
  {k:"plan",  l:"施工方案", tag:"t-p2",    d:"经审批的施工组织设计、专项施工方案正文及报审版扫描件"},
  {k:"record",l:"审查记录", tag:"t-amber", d:"内审意见表、审查记录、意见回复与修改闭环佐证材料"}
];
var ATT_LIMIT=20*1024*1024;                 /* 附件单独放宽；文件中心仍为 5MB */
function validKind(k){ return k==="plan"||k==="record"; }
function kindOf(k){ return KINDS.filter(function(x){return x.k===k;})[0]||KINDS[0]; }
function kindLabel(k){ return kindOf(k).l; }
function fmtSize(n){ return window.fileFmtSize?window.fileFmtSize(n):((n||0)+" B"); }
function extOf(n){ return window.fileExtOf?window.fileExtOf(n):"FILE"; }
function ext(n){ var m=/\.([a-z0-9]+)$/i.exec(String(n||"")); return m?m[1].toLowerCase():""; }
function isExcerpt(n){ return /^(md|markdown)$/.test(ext(n)); }
function limit(){ return ATT_LIMIT; }
function limitText(){ return "20MB"; }

/* 懒初始化：不改 SEED、不动已有数据，旧库首次打开自动得到空数组 */
function all(){
  if(!DB().reviewAttachments) DB().reviewAttachments=[];
  return DB().reviewAttachments;
}
function list(reviewId,kind){
  return all().filter(function(a){ return a.reviewId===reviewId && (!kind||a.kind===kind); });
}
function count(reviewId){ return list(reviewId).length; }
function planOf(id){
  return (DB().reviews||[]).filter(function(r){return r.id===id;})[0]||null;
}
function orphans(){ return all().filter(function(a){ return !planOf(a.reviewId); }); }

/* ---------- 权限 ---------- */
function lockMap(){
  if(!DB().ui) DB().ui={};
  if(!DB().ui.reviewAttachLock) DB().ui.reviewAttachLock={};
  return DB().ui.reviewAttachLock;
}
function globalWritable(){
  var def=window.SCHEMA&&window.SCHEMA.reviews;
  return !(def&&def.readonly);
}
function isLocked(reviewId){ return reviewId?!!lockMap()[reviewId]:false; }
function canWrite(reviewId){
  if(!globalWritable()) return false;
  if(reviewId&&isLocked(reviewId)) return false;
  return true;
}
function setLock(reviewId,on){
  if(!globalWritable()){ toast("当前台账为只读，不能修改归档锁定","err"); return false; }
  if(on) lockMap()[reviewId]=true; else delete lockMap()[reviewId];
  if(A.save()){ toast(on?"已归档锁定：该方案禁止增删附件，仍可查看与下载":"已解除归档锁定","ok"); return true; }
  toast("锁定状态保存失败：本地存储写入异常","err");
  return false;
}
function dropRec(rec){
  DB().reviewAttachments=all().filter(function(a){return a.id!==rec.id;});
  if(rec.mode==="idb"&&window.fileBlobDel) window.fileBlobDel(rec.key).catch(function(){});
}

/* ---------- 上传 ---------- */
function upload(reviewId,kind,files,onDone){
  if(!planOf(reviewId)){ toast("上传失败：所属内审方案不存在或已被删除","err"); if(onDone) onDone(0,0); return; }
  if(!validKind(kind)){ toast("上传失败：附件分类无效","err"); if(onDone) onDone(0,0); return; }
  if(!globalWritable()){ toast("当前台账为只读，不能上传附件","err"); if(onDone) onDone(0,0); return; }
  if(isLocked(reviewId)){ toast("该方案已归档锁定，不能上传附件；请先解除锁定","err"); if(onDone) onDone(0,0); return; }
  var arr=Array.prototype.slice.call(files||[]);
  if(!arr.length){ if(onDone) onDone(0,0); return; }
  var added=[];
  var tasks=arr.map(function(f){
    if(!f||!f.name){ toast("已跳过 1 个无名文件","err"); return Promise.resolve(false); }
    if(!f.size){ toast("「"+f.name+"」为 0 字节空文件，已跳过","err"); return Promise.resolve(false); }
    /* 同类同名：二次确认后替换旧版；取消则放弃本次上传，不产生两份 */
    var dup=list(reviewId,kind).filter(function(a){return a.name===f.name;})[0];
    if(dup){
      if(!window.confirm("「"+kindLabel(kind)+"」下已存在同名附件「"+f.name+"」。\n点「确定」替换旧版，点「取消」放弃本次上传。")){
        toast("已取消上传："+f.name+"（存在同名附件）","err");
        return Promise.resolve(false);
      }
      dropRec(dup);
      toast("已替换同名旧版附件："+f.name,"ok");
    }
    var rec={
      id:A.uid("ra"), reviewId:reviewId, kind:kind,
      name:f.name, size:f.size, type:f.type||"", date:A.todayStr(),
      mode:f.size>limit()?"path":"idb", key:"", path:""
    };
    /* 超大文件：沿用双轨规则降级为路径索引 */
    if(rec.mode==="path"){
      var p=window.prompt("「"+f.name+"」超过 "+limitText()+"（"+fmtSize(f.size)+"），将只登记路径索引。\n请填写该附件在电脑上的完整路径：","");
      if(p===null){ toast("已取消上传："+f.name,"err"); return Promise.resolve(false); }
      rec.path=(p||"").trim();
      if(!rec.path){ toast("「"+f.name+"」未填写路径，已跳过","err"); return Promise.resolve(false); }
      all().push(rec); added.push(rec);
      toast("已登记路径索引："+f.name,"ok");
      return Promise.resolve(true);
    }
    rec.key="ra_"+rec.id;
    var put;
    try{ put=window.fileBlobPut?window.fileBlobPut(rec.key,f):Promise.reject(new Error("文件库未加载")); }
    catch(e){ put=Promise.reject(e); }
    return put.then(function(){
      all().push(rec); added.push(rec);
      toast("已上传："+f.name+"（"+kindLabel(kind)+"，"+fmtSize(f.size)+"）","ok");
      return true;
    }).catch(function(e){
      /* 权限/容量异常 → 与文件中心一致，降级为路径索引并明确告知 */
      var p2=window.prompt("本地文件库不可用（"+((e&&e.message)||"未知原因")+"）。\n「"+f.name+"」改为登记路径索引，请填写完整路径：","");
      if(p2===null){ toast("上传失败："+f.name+" 未保存","err"); return false; }
      rec.mode="path"; rec.key=""; rec.path=(p2||"").trim();
      all().push(rec); added.push(rec);
      toast("文件库不可用，「"+f.name+"」已改为路径索引（不能直接下载）","err");
      return true;
    });
  });
  Promise.all(tasks).then(function(rs){
    var okN=rs.filter(Boolean).length, badN=rs.length-okN;
    if(added.length&&!A.save()){
      /* 落库失败：回滚本次新增记录与已写入的二进制，避免产生孤儿文件 */
      var ids={}; added.forEach(function(r){ids[r.id]=1;});
      DB().reviewAttachments=all().filter(function(r){return !ids[r.id];});
      added.forEach(function(r){
        if(r.mode==="idb"&&window.fileBlobDel) window.fileBlobDel(r.key).catch(function(){});
      });
      toast("上传已撤销：本地存储写入失败，请先在文件中心清理空间","err");
      okN=0; badN=rs.length;
    }
    toast("上传完成：成功 "+okN+" 个"+(badN?"，失败/取消 "+badN+" 个":""),okN?"ok":"err");
    if(onDone) onDone(okN,badN);
  }).catch(function(e){
    toast("上传异常："+((e&&e.message)||"未知错误"),"err");
    if(onDone) onDone(0,arr.length);
  });
}

/* ---------- 下载 ---------- */
function download(id){
  var rec=all().filter(function(a){return a.id===id;})[0];
  if(!rec){ toast("下载失败：附件记录不存在或已被删除","err"); return; }
  if(!planOf(rec.reviewId)){ toast("下载失败：所属内审方案已删除，附件无法定位","err"); return; }
  if(rec.mode==="path"){
    if(window.copyText) window.copyText(rec.path||"");
    toast("该附件为路径索引，浏览器内不存原件，无法直接下载；已复制路径","err");
    return;
  }
  if(!window.fileBlobGet){ toast("下载失败：文件库未加载，请重新构建页面","err"); return; }
  window.fileBlobGet(rec.key).then(function(blob){
    if(!blob) throw new Error("浏览器中找不到该文件原件（可能已清理浏览器数据或更换设备）");
    var url;
    try{ url=URL.createObjectURL(blob); }
    catch(e){ throw new Error("无法生成下载链接："+((e&&e.message)||"浏览器不支持")); }
    var a=document.createElement("a");
    a.href=url; a.download=rec.name||"附件";
    document.body.appendChild(a); a.click();
    setTimeout(function(){ try{URL.revokeObjectURL(url);}catch(_e){} a.remove(); },500);
    toast("已开始下载："+(rec.name||"附件"),"ok");
  }).catch(function(e){
    toast("下载失败："+((e&&e.message)||"文件库读取异常"),"err");
  });
}

/* ---------- 查看（页内即时，零外部依赖） ---------- */
function toBuf(blob){
  if(blob.arrayBuffer) return blob.arrayBuffer().then(function(ab){return new Uint8Array(ab);});
  return new Promise(function(res,rej){
    var fr=new FileReader();
    fr.onload=function(){ res(new Uint8Array(fr.result)); };
    fr.onerror=function(){ rej(new Error("文件读取失败")); };
    fr.readAsArrayBuffer(blob);
  });
}
function viewHead(rec){
  var p=planOf(rec.reviewId);
  return '<div class="qd-info" style="margin-bottom:10px">'+
    '<div class="qd-info-r"><span>附件名称</span><b style="word-break:break-all">'+esc(rec.name||"—")+'</b></div>'+
    '<div class="qd-info-r"><span>附件类别</span><b>'+esc(kindLabel(rec.kind))+
      (isExcerpt(rec.name)?' · 文本摘录':'')+'</b></div>'+
    '<div class="qd-info-r"><span>所属方案</span><b style="word-break:break-all">'+esc(p&&p.title?p.title:"—")+'</b></div>'+
    '<div class="qd-info-r"><span>大小 / 上传</span><b>'+esc(fmtSize(rec.size))+' · '+esc(rec.date||"—")+'</b></div>'+
    '</div>';
}
function bindViewerDl(mask,rec){
  $$("[data-ra-vdl]",mask).forEach(function(b){
    b.onclick=function(){ download(rec.id); };
  });
}
function wide(mask){
  var box=mask&&mask.querySelector?mask.querySelector(".modal"):null;
  if(box) box.style.maxWidth="920px";
}
function openViewer(rec,blob){
  var e=ext(rec.name);
  var isImg=/^(jpg|jpeg|png|gif|bmp|webp|svg|ico|avif)$/.test(e);
  var head=viewHead(rec);
  var foot='<div class="hint" style="margin-top:8px;line-height:1.7">'+
    '查看不改变任何内审记录数据。'+
    (isExcerpt(rec.name)?'该附件为文本摘录（.md），正文直接显示在下方。':'')+
    '<button class="btn sm" data-ra-vdl="1" style="margin-left:8px">下载原件</button></div>';

  if(isImg||e==="pdf"){
    var url;
    try{ url=URL.createObjectURL(blob); }
    catch(err){ toast("查看失败：无法生成预览链接（"+((err&&err.message)||"浏览器不支持")+"）","err"); return; }
    var inner=isImg
      ? '<img src="'+url+'" alt="'+esc(rec.name)+'" style="display:block;max-width:100%;max-height:56vh;margin:0 auto;border-radius:6px">'
      : '<iframe src="'+url+'" style="width:100%;height:56vh;border:1px solid var(--line);border-radius:6px;background:#fff"></iframe>';
    var m=window.openModal({
      title:"查看附件 · "+(rec.name||""),
      body:head+'<div class="ra-view" style="padding:8px;background:var(--bg-2,#f6f8fa);border-radius:8px">'+inner+'</div>'+foot,
      okText:"关闭", noCancel:true,
      onClose:function(){ try{URL.revokeObjectURL(url);}catch(_e){} },
      afterRender:function(mask){ bindViewerDl(mask,rec); }
    });
    wide(m);
    toast("已打开「"+rec.name+"」的"+(isImg?"图片预览":"PDF 预览"),"ok");
    return;
  }

  toBuf(blob).then(function(u8){
    var res=window.Parse?window.Parse.parse(rec.name,u8):{type:"other",text:"",err:"解析器未加载"};
    var txt=res&&res.text?String(res.text):"";
    var tip="";
    if(!window.Parse) tip="解析器未加载，请重新构建页面。";
    else if(res.type==="err") tip="解析失败："+(res.err||"未知原因")+"，原件可能损坏或不是可解析的文档。";
    else if(!txt.trim()) tip="该附件没有可提取的文字内容（常见于扫描件、图片型 PDF 或压缩包）。"+
      "可用 tools/review_attach_md.py 转成 .md 后作为普通附件重新上传，即可在此查看正文；也可直接下载原件。";
    else if(res.type==="other") tip="该格式不支持在线解析正文，请下载后用对应软件打开。";
    var shown=txt.length>30000?txt.slice(0,30000)+"\n\n…（内容过长，仅显示前 30000 字，完整内容请下载原件）":txt;
    var body=head+
      (tip?'<div class="hint" style="margin-bottom:8px;color:#b9770e;line-height:1.7">'+esc(tip)+'</div>':'')+
      (txt.trim()?'<div class="ra-view" style="padding:12px 14px;background:var(--bg-2,#f6f8fa);border-radius:8px;'+
        'max-height:52vh;overflow:auto;white-space:pre-wrap;word-break:break-word;font-size:12.5px;line-height:1.8">'+esc(shown)+'</div>'
        :'<div class="empty" style="padding:22px 10px">暂无可显示的正文内容</div>')+
      foot;
    var m=window.openModal({
      title:"查看附件 · "+(rec.name||""),
      body:body, okText:"关闭", noCancel:true,
      afterRender:function(mask){ bindViewerDl(mask,rec); }
    });
    wide(m);
    toast("已打开「"+rec.name+"」的正文"+(txt.trim()?"（"+txt.length+" 字）":"（无文本层）"),txt.trim()?"ok":"err");
  }).catch(function(err){
    toast("查看失败："+((err&&err.message)||"文件读取异常"),"err");
  });
}
function view(id){
  var rec=all().filter(function(a){return a.id===id;})[0];
  if(!rec){ toast("查看失败：附件记录不存在或已被删除","err"); return; }
  if(!planOf(rec.reviewId)){ toast("查看失败：所属内审方案已删除，附件无法定位","err"); return; }
  if(rec.mode==="path"){
    if(window.copyText) window.copyText(rec.path||"");
    toast("该附件为路径索引，浏览器内不存原件，无法在线查看；已复制路径，请在电脑中打开","err");
    return;
  }
  if(!window.fileBlobGet){ toast("查看失败：文件库未加载，请重新构建页面","err"); return; }
  window.fileBlobGet(rec.key).then(function(blob){
    if(!blob) throw new Error("浏览器中找不到该文件原件（可能已清理浏览器数据或更换设备）");
    openViewer(rec,blob);
  }).catch(function(e){
    toast("查看失败："+((e&&e.message)||"文件库读取异常"),"err");
  });
}

/* ---------- 删除 ---------- */
function remove(id,onDone){
  var rec=all().filter(function(a){return a.id===id;})[0];
  if(!rec){ toast("删除失败：附件记录不存在","err"); return; }
  if(!globalWritable()){ toast("当前台账为只读，不能删除附件","err"); return; }
  if(isLocked(rec.reviewId)){ toast("该方案已归档锁定，不能删除附件；请先解除锁定","err"); return; }
  if(!window.confirm("确定删除「"+kindLabel(rec.kind)+"」附件「"+rec.name+"」？此操作不可撤销。")) return;
  var p=(rec.mode==="idb"&&window.fileBlobDel)?window.fileBlobDel(rec.key).catch(function(){}):Promise.resolve();
  p.then(function(){
    DB().reviewAttachments=all().filter(function(a){return a.id!==id;});
    if(A.save()) toast("已删除附件："+rec.name,"ok");
    else toast("删除失败：本地存储写入异常","err");
    if(onDone) onDone();
  }).catch(function(e){
    toast("删除失败："+((e&&e.message)||"文件库异常"),"err");
  });
}

/* ---------- 孤儿附件整批清理 ---------- */
function prune(onDone){
  if(!globalWritable()){ toast("当前台账为只读，不能清理附件","err"); return; }
  var os=orphans();
  if(!os.length){ toast("没有需要清理的孤儿附件","ok"); return; }
  var names=os.map(function(a,i){
    return (i+1)+". "+a.name+"（"+kindLabel(a.kind)+"）";
  }).join("\n");
  if(!window.confirm("以下 "+os.length+" 个附件的所属内审方案已删除，确定清理？\n\n"+names+
      "\n\n将同时删除浏览器中的文件原件，不可撤销。")) return;
  var ids={}; os.forEach(function(a){ids[a.id]=1;});
  var tasks=os.map(function(a){
    return (a.mode==="idb"&&window.fileBlobDel)?window.fileBlobDel(a.key).catch(function(){}):Promise.resolve();
  });
  Promise.all(tasks).then(function(){
    DB().reviewAttachments=all().filter(function(a){return !ids[a.id];});
    if(A.save()) toast("已清理 "+os.length+" 个孤儿附件","ok");
    else toast("清理失败：本地存储写入异常","err");
    if(onDone) onDone();
  });
}

/* ---------- 弹窗 UI：两类附件分栏管理 ---------- */
function statusTip(st){
  if(st==="已闭环") return "该方案已闭环，新增附件请确认属补录归档材料。";
  if(st==="整改中") return "该方案正在整改闭环，上传审查记录后请核对意见回复版本。";
  if(st==="未开始") return "该方案尚未开始修改闭环，可先上传施工方案正文与审查记录。";
  return "";
}
function listHTML(reviewId,kind){
  var k=kindOf(kind);
  var rows=list(reviewId,kind).slice().sort(function(a,b){return String(b.date||"").localeCompare(String(a.date||""));});
  if(!rows.length) return '<div class="empty" style="padding:18px 10px;line-height:1.8">'+
    '<div>暂未上传「'+esc(k.l)+'」附件</div>'+
    '<div class="hint" style="margin-top:4px">'+esc(k.d)+'</div></div>';
  var w=canWrite(reviewId);
  return rows.map(function(r){
    var isPath=r.mode==="path";
    return '<div class="file-item">'+
      '<div class="file-ic" style="'+(isPath?"background:var(--amber-soft);color:var(--amber)":"")+'">'+esc(extOf(r.name))+'</div>'+
      '<div class="file-main">'+
        '<div style="font-size:13px;font-weight:600;word-break:break-all">'+esc(r.name)+'</div>'+
        '<div style="font-size:11.5px;color:var(--muted);margin-top:3px;display:flex;flex-wrap:wrap;align-items:center;gap:4px">'+
          '<span class="tag '+k.tag+'">'+esc(k.l)+'</span>'+
          (isExcerpt(r.name)?'<span class="tag t-gray">文本摘录</span>':'')+
          '<span>'+esc(fmtSize(r.size))+' · '+esc(r.date||"—")+
          (isPath?' · <span style="color:var(--amber)">路径索引</span>':' · <span style="color:var(--green)">已存入浏览器</span>')+'</span>'+
        '</div>'+
        (isPath&&r.path?'<div style="font-size:11px;color:var(--muted);margin-top:3px;word-break:break-all">'+esc(r.path)+'</div>':'')+
      '</div>'+
      '<div class="row-actions">'+
        '<button class="btn sm" data-ra-view="'+esc(r.id)+'">查看</button>'+
        '<button class="btn sm" data-ra-dl="'+esc(r.id)+'">'+(isPath?"复制路径":"下载")+'</button>'+
        (w?'<button class="btn sm ghost" style="color:#c0392b" data-ra-rm="'+esc(r.id)+'">删</button>':'')+
      '</div></div>';
  }).join("");
}

function paint(mask,reviewId){
  KINDS.forEach(function(k){
    var box=$("[data-ra-list='"+k.k+"']",mask);
    if(box) box.innerHTML=listHTML(reviewId,k.k);
    var cnt=$("[data-ra-count='"+k.k+"']",mask);
    if(cnt) cnt.textContent="（"+list(reviewId,k.k).length+"）";
  });
  var w=canWrite(reviewId), gw=globalWritable();
  $$("[data-ra-up]",mask).forEach(function(b){ b.style.display=w?"":"none"; });
  $$(".ra-drop",mask).forEach(function(d){ d.style.display=w?"":"none"; });
  var lk=$("[data-ra-lock]",mask);
  if(lk){ lk.checked=isLocked(reviewId); lk.disabled=!gw; }
  var lkTip=$("[data-ra-locktip]",mask);
  if(lkTip) lkTip.textContent=isLocked(reviewId)?"已归档锁定：仅可查看/下载，禁止上传/删除":"";
  $$("[data-ra-view]",mask).forEach(function(b){
    b.onclick=function(){ view(this.getAttribute("data-ra-view")); };
  });
  $$("[data-ra-dl]",mask).forEach(function(b){
    b.onclick=function(){ download(this.getAttribute("data-ra-dl")); };
  });
  $$("[data-ra-rm]",mask).forEach(function(b){
    b.onclick=function(){ remove(this.getAttribute("data-ra-rm"),function(){ paint(mask,reviewId); }); };
  });
}

function open(reviewId){
  var s=planOf(reviewId);
  if(!s){ toast("所属内审方案不存在或已被删除","err"); return; }
  var w=canWrite(reviewId), gw=globalWritable(), tip=statusTip(s.closure);
  var head='<div class="qd-info" style="margin-bottom:10px">'+
    '<div class="qd-info-r"><span>方案名称</span><b style="word-break:break-all">'+esc(s.title||"—")+'</b></div>'+
    '<div class="qd-info-r"><span>方案类型</span><b>'+esc(s.type||"—")+'</b></div>'+
    '<div class="qd-info-r"><span>内审时间</span><b>'+esc(s.date||"—")+'</b></div>'+
    '<div class="qd-info-r"><span>修改闭环</span><b>'+esc(s.closure||"—")+'</b></div>'+
    '</div>'+
    (tip?'<div class="hint" style="margin-bottom:8px;color:#b9770e">'+esc(tip)+'</div>':'')+
    '<div class="hint" style="margin-bottom:10px;line-height:1.7">两类附件<b>分别管理、仅关联本方案</b>；'+
    '上传附件<b>不会改变内审记录的任何字段</b>，也不影响原有内审流程。'+
    '「查看」在页面内即时完成（图片/PDF 原生预览，Word/Excel/文本抽取正文）；'+
    '≤'+limitText()+' 存入浏览器可离线查看与下载，&gt;'+limitText()+' 只登记路径索引（只能复制路径）。'+
    '扫描件可用 tools/review_attach_md.py 转 .md 后上传查看正文。'+
    (gw?'':'<br><b style="color:#c0392b">当前台账为只读，仅可查看与下载附件。</b>')+'</div>'+
    (gw?'<label style="display:inline-flex;align-items:center;gap:6px;font-size:12px;cursor:pointer;margin-bottom:10px">'+
        '<input type="checkbox" data-ra-lock="1"> 归档锁定（禁止上传/删除附件，仍可查看与下载）'+
        '</label> <span data-ra-locktip="" style="font-size:11.5px;color:#c0392b"></span>':'');
  var cards='<div class="ra-grid">'+KINDS.map(function(k){
    return '<div class="card" style="margin:0">'+
      '<div class="card-h"><h3>'+esc(k.l)+'附件<span data-ra-count="'+k.k+'"></span></h3>'+
        '<div class="spacer"></div>'+
        (w?'<button class="btn sm primary" data-ra-up="'+k.k+'">+ 上传</button>'+
           '<input type="file" data-ra-file="'+k.k+'" multiple style="display:none" '+
           'accept=".doc,.docx,.pdf,.xls,.xlsx,.md,.txt,.csv,.jpg,.jpeg,.png,.zip">':'')+
      '</div>'+
      '<div class="card-b" style="padding:12px 0 0">'+
        (w?'<div class="drop ra-drop" data-ra-drop="'+k.k+'" style="margin:0 12px;padding:14px">'+
           '<div style="font-size:12px;font-weight:600;color:var(--ink-2)">拖拽文件到此，或点击上传</div>'+
           '<div style="font-size:11px;margin-top:4px">'+esc(k.d)+'</div></div>':'')+
        '<div data-ra-list="'+k.k+'" style="margin-top:10px"></div>'+
      '</div></div>';
  }).join("")+'</div>';

  var mask=window.openModal({
    title:"方案附件 · "+(s.title&&s.title.length>22?s.title.slice(0,22)+"…":(s.title||"")),
    body:head+cards,
    okText:"关闭", noCancel:true,
    afterRender:function(mask){
      paint(mask,reviewId);
      var lk=$("[data-ra-lock]",mask);
      if(lk) lk.onchange=function(){
        if(setLock(reviewId,this.checked)) paint(mask,reviewId);
        else this.checked=isLocked(reviewId);
      };
      $$("[data-ra-up]",mask).forEach(function(b){
        b.onclick=function(){ $("[data-ra-file='"+b.getAttribute("data-ra-up")+"']",mask).click(); };
      });
      $$("[data-ra-file]",mask).forEach(function(inp){
        inp.onchange=function(){
          var kind=this.getAttribute("data-ra-file"), fs=this.files;
          this.value="";
          upload(reviewId,kind,fs,function(){ paint(mask,reviewId); });
        };
      });
      $$("[data-ra-drop]",mask).forEach(function(dz){
        var kind=dz.getAttribute("data-ra-drop");
        dz.onclick=function(){ $("[data-ra-file='"+kind+"']",mask).click(); };
        dz.addEventListener("dragover",function(e){ e.preventDefault(); dz.classList.add("over"); });
        dz.addEventListener("dragleave",function(){ dz.classList.remove("over"); });
        dz.addEventListener("drop",function(e){
          e.preventDefault(); dz.classList.remove("over");
          upload(reviewId,kind,e.dataTransfer.files,function(){ paint(mask,reviewId); });
        });
      });
    }
  });
  wide(mask);
}

/* ---------- 总览：按方案分组 + 孤儿附件标记与清理 ---------- */
function allHTML(){
  var plans=(DB().reviews||[]).slice().sort(function(a,b){return String(b.date||"").localeCompare(String(a.date||""));});
  var orph=orphans(), total=all().length;
  var h='<div class="hint" style="margin-bottom:10px;line-height:1.7">共 '+plans.length+
    ' 个内审方案、'+total+' 个附件。附件按「施工方案 / 审查记录」两类分别管理，'+
    '每个方案的附件相互独立；选择任一方案即可上传、查看、下载。</div>';
  if(orph.length){
    h+='<div class="card" style="margin:0 0 12px;border-left:3px solid #c0392b">'+
      '<div class="card-h"><h3 style="color:#c0392b">孤儿附件（'+orph.length+'）</h3><div class="spacer"></div>'+
      (globalWritable()?'<button class="btn sm" data-ra-prune="1">清理孤儿附件</button>':'')+'</div>'+
      '<div class="card-b" style="padding:8px 14px;font-size:12px;line-height:1.9;color:var(--muted)">'+
      '所属内审方案已删除，附件仍保留但无法查看与下载；确认后可整批清理（含浏览器中的文件原件）。<br>'+
      orph.map(function(a){
        return '· '+esc(a.name)+'（'+esc(kindLabel(a.kind))+'，'+esc(fmtSize(a.size))+'）';
      }).join("<br>")+'</div></div>';
  }
  h+='<div class="card" style="margin:0"><div class="card-b" style="padding:0">'+
    (plans.length? plans.map(function(s){
      var a=list(s.id,"plan").length, b=list(s.id,"record").length;
      return '<div class="file-item">'+
        '<div class="file-main">'+
          '<div style="font-size:13px;font-weight:600;word-break:break-all">'+esc(s.title||"—")+
            '　<span style="font-size:11.5px;font-weight:400;color:var(--muted)">'+esc(s.date||"—")+
            ' · '+esc(s.closure||"—")+'</span>'+
            (isLocked(s.id)?' <span class="tag t-gray">已归档锁定</span>':'')+'</div>'+
          '<div style="font-size:11.5px;color:var(--muted);margin-top:2px;display:flex;gap:6px;flex-wrap:wrap">'+
            '<span class="tag t-p2">施工方案 '+a+'</span>'+
            '<span class="tag t-amber">审查记录 '+b+'</span>'+
            (!a||!b?'<span style="color:#b9770e">缺件提示：'+([]).concat(!a?["施工方案"]:[],!b?["审查记录"]:[]).join("、")+' 尚未上传</span>':'')+
          '</div>'+
        '</div>'+
        '<div class="row-actions"><button class="btn sm" data-ra-go="'+esc(s.id)+'">管理附件</button></div>'+
      '</div>';
    }).join("") : '<div class="empty" style="padding:22px 10px">暂无内审方案</div>')+
    '</div></div>';
  return h;
}
function openAll(){
  window.openModal({
    title:"方案附件总览",
    body:'<div data-ra-all="1"></div>',
    okText:"关闭", noCancel:true,
    afterRender:function(mask){
      function repaint(){
        var box=$("[data-ra-all]",mask);
        if(box) box.innerHTML=allHTML();
        $$("[data-ra-go]",mask).forEach(function(b){
          b.onclick=function(){
            var id=this.getAttribute("data-ra-go");
            var cb=mask.querySelector("[data-close]"); if(cb) cb.click();
            open(id);
          };
        });
        var pb=$("[data-ra-prune]",mask);
        if(pb) pb.onclick=function(){ prune(repaint); };
      }
      repaint();
    }
  });
}

window.ReviewAttach={
  open:open, openAll:openAll, upload:upload, view:view, download:download,
  remove:remove, prune:prune, list:list, count:count, all:all, orphans:orphans,
  kinds:KINDS, canWrite:canWrite, isLocked:isLocked, setLock:setLock,
  lockMap:lockMap, limit:limit, kindLabel:kindLabel, isExcerpt:isExcerpt
};
})();
