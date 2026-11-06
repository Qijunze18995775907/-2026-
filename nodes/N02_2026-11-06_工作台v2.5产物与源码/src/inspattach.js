/* ===== 质量检查单附件：整改通知单附件 / 整改回复单附件 =====
   设计要点（v2.4，经设计确认）：
   1) 独立数组 DB().inspAttachments，字段 inspId 关联检查单、kind 区分两类附件，
      不写进 inspections 的任何业务字段 → 不触发 beforeSave，不改整改状态机，
      原有整改回复流程与已有数据完全不受影响。
   2) 二进制复用文件中心同一 IndexedDB 库（key 加 ia_ 前缀），≤20MB 存浏览器、
      >20MB 或文件库不可用时降级为路径索引；文件中心自身仍保持 5MB 阈值。
   3) 权限沿用 schema.readonly（只读台账只可下载）；另按检查单提供「归档锁定」，
      锁定后禁止该单增删附件、仍可下载，状态存 DB.ui 随 JSON 备份。
   4) 上传结果、下载异常均给出明确 toast，不静默失败；
      同类同名附件二次确认后替换旧版（连旧二进制一起删）。
   5) 检查单被删后附件保留，但总览标出「孤儿附件」并提供整批清理。
   6) 不按整改状态硬拦截上传，只给软提示。 */
(function(){
"use strict";
var A=window.APP, $=A.$, $$=A.$$, esc=A.esc;
function DB(){return A.db;}
function toast(m,t){ if(window.toast) window.toast(m,t); else console.log(m); }

var KINDS=[
  {k:"notice",l:"整改通知单附件",d:"检查下发形成的通知单、检查记录表扫描件"},
  {k:"reply", l:"整改回复单附件",d:"项目部报送的整改回复单及整改佐证材料"}
];
var ATT_LIMIT=20*1024*1024;                 /* 附件单独放宽；文件中心仍为 5MB */
function validKind(k){ return k==="notice"||k==="reply"; }
function fmtSize(n){ return window.fileFmtSize?window.fileFmtSize(n):((n||0)+" B"); }
function extOf(n){ return window.fileExtOf?window.fileExtOf(n):"FILE"; }
function limit(){ return ATT_LIMIT; }
function limitText(){ return "20MB"; }

/* 懒初始化：不改 SEED、不动已有数据，旧库首次打开自动得到空数组 */
function all(){
  if(!DB().inspAttachments) DB().inspAttachments=[];
  return DB().inspAttachments;
}
function list(inspId,kind){
  return all().filter(function(a){ return a.inspId===inspId && (!kind||a.kind===kind); });
}
function count(inspId){ return list(inspId).length; }
function sheetOf(id){
  return (DB().inspections||[]).filter(function(r){return r.id===id;})[0]||null;
}
function orphans(){ return all().filter(function(a){ return !sheetOf(a.inspId); }); }

/* ---------- 权限 ---------- */
function lockMap(){
  if(!DB().ui) DB().ui={};
  if(!DB().ui.inspAttachLock) DB().ui.inspAttachLock={};
  return DB().ui.inspAttachLock;
}
function globalWritable(){
  var def=window.SCHEMA&&window.SCHEMA.inspections;
  return !(def&&def.readonly);
}
function isLocked(inspId){ return inspId?!!lockMap()[inspId]:false; }
function canWrite(inspId){
  if(!globalWritable()) return false;
  if(inspId&&isLocked(inspId)) return false;
  return true;
}
function setLock(inspId,on){
  if(!globalWritable()){ toast("当前台账为只读，不能修改归档锁定","err"); return false; }
  if(on) lockMap()[inspId]=true; else delete lockMap()[inspId];
  if(A.save()){ toast(on?"已归档锁定：该单禁止增删附件，仍可下载":"已解除归档锁定","ok"); return true; }
  toast("锁定状态保存失败：本地存储写入异常","err");
  return false;
}
function dropRec(rec){
  DB().inspAttachments=all().filter(function(a){return a.id!==rec.id;});
  if(rec.mode==="idb"&&window.fileBlobDel) window.fileBlobDel(rec.key).catch(function(){});
}

/* ---------- 上传 ---------- */
function upload(inspId,kind,files,onDone){
  if(!sheetOf(inspId)){ toast("上传失败：所属质量检查单不存在或已被删除","err"); if(onDone) onDone(0,0); return; }
  if(!validKind(kind)){ toast("上传失败：附件分类无效","err"); if(onDone) onDone(0,0); return; }
  if(!globalWritable()){ toast("当前台账为只读，不能上传附件","err"); if(onDone) onDone(0,0); return; }
  if(isLocked(inspId)){ toast("该检查单已归档锁定，不能上传附件；请先解除锁定","err"); if(onDone) onDone(0,0); return; }
  var arr=Array.prototype.slice.call(files||[]);
  if(!arr.length){ if(onDone) onDone(0,0); return; }
  var added=[];
  var tasks=arr.map(function(f){
    if(!f||!f.name){ toast("已跳过 1 个无名文件","err"); return Promise.resolve(false); }
    if(!f.size){ toast("「"+f.name+"」为 0 字节空文件，已跳过","err"); return Promise.resolve(false); }
    /* 同类同名：二次确认后替换旧版；取消则放弃本次上传，不产生两份 */
    var dup=list(inspId,kind).filter(function(a){return a.name===f.name;})[0];
    if(dup){
      if(!window.confirm("该类别下已存在同名附件「"+f.name+"」。\n点「确定」替换旧版，点「取消」放弃本次上传。")){
        toast("已取消上传："+f.name+"（存在同名附件）","err");
        return Promise.resolve(false);
      }
      dropRec(dup);
      toast("已替换同名旧版附件："+f.name,"ok");
    }
    var rec={
      id:A.uid("ia"), inspId:inspId, kind:kind,
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
    rec.key="ia_"+rec.id;
    var put;
    try{ put=window.fileBlobPut?window.fileBlobPut(rec.key,f):Promise.reject(new Error("文件库未加载")); }
    catch(e){ put=Promise.reject(e); }
    return put.then(function(){
      all().push(rec); added.push(rec);
      toast("已上传："+f.name+"（"+fmtSize(f.size)+"）","ok");
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
      DB().inspAttachments=all().filter(function(r){return !ids[r.id];});
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
  if(!sheetOf(rec.inspId)){ toast("下载失败：所属质量检查单已删除，附件无法定位","err"); return; }
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

/* ---------- 删除 ---------- */
function remove(id,onDone){
  var rec=all().filter(function(a){return a.id===id;})[0];
  if(!rec){ toast("删除失败：附件记录不存在","err"); return; }
  if(!globalWritable()){ toast("当前台账为只读，不能删除附件","err"); return; }
  if(isLocked(rec.inspId)){ toast("该检查单已归档锁定，不能删除附件；请先解除锁定","err"); return; }
  if(!window.confirm("确定删除附件「"+rec.name+"」？此操作不可撤销。")) return;
  var p=(rec.mode==="idb"&&window.fileBlobDel)?window.fileBlobDel(rec.key).catch(function(){}):Promise.resolve();
  p.then(function(){
    DB().inspAttachments=all().filter(function(a){return a.id!==id;});
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
    return (i+1)+". "+a.name+"（"+(a.kind==="reply"?"回复单":"通知单")+"）";
  }).join("\n");
  if(!window.confirm("以下 "+os.length+" 个附件的所属质量检查单已删除，确定清理？\n\n"+names+
      "\n\n将同时删除浏览器中的文件原件，不可撤销。")) return;
  var ids={}; os.forEach(function(a){ids[a.id]=1;});
  var tasks=os.map(function(a){
    return (a.mode==="idb"&&window.fileBlobDel)?window.fileBlobDel(a.key).catch(function(){}):Promise.resolve();
  });
  Promise.all(tasks).then(function(){
    DB().inspAttachments=all().filter(function(a){return !ids[a.id];});
    if(A.save()) toast("已清理 "+os.length+" 个孤儿附件","ok");
    else toast("清理失败：本地存储写入异常","err");
    if(onDone) onDone();
  });
}

/* ---------- 弹窗 UI：两类附件分栏管理 ---------- */
function statusTip(st){
  if(st==="已闭环") return "该单已闭环，新增附件请确认属补录归档材料。";
  if(st==="已回复待复核") return "该单已报送回复单待复核，上传回复单附件后请核对报送版本。";
  if(st==="复核退回") return "该单复核退回，重新报送后请更新回复单附件。";
  if(st==="待整改"||st==="整改中") return "该单尚在整改阶段，回复单附件可在报送后补传。";
  return "";
}
function listHTML(inspId,kind){
  var rows=list(inspId,kind).slice().sort(function(a,b){return String(b.date||"").localeCompare(String(a.date||""));});
  if(!rows.length) return '<div class="empty" style="padding:22px 10px">暂无'+
    (kind==="notice"?"整改通知单":"整改回复单")+'附件</div>';
  var w=canWrite(inspId);
  return rows.map(function(r){
    var isPath=r.mode==="path";
    return '<div class="file-item">'+
      '<div class="file-ic" style="'+(isPath?"background:var(--amber-soft);color:var(--amber)":"")+'">'+esc(extOf(r.name))+'</div>'+
      '<div class="file-main">'+
        '<div style="font-size:13px;font-weight:600;word-break:break-all">'+esc(r.name)+'</div>'+
        '<div style="font-size:11.5px;color:var(--muted);margin-top:2px">'+
          esc(fmtSize(r.size))+' · '+esc(r.date||"—")+
          (isPath?' · <span style="color:var(--amber)">路径索引</span>':' · <span style="color:var(--green)">已存入浏览器</span>')+
        '</div>'+
        (isPath&&r.path?'<div style="font-size:11px;color:var(--muted);margin-top:3px;word-break:break-all">'+esc(r.path)+'</div>':'')+
      '</div>'+
      '<div class="row-actions">'+
        '<button class="btn sm" data-ia-dl="'+esc(r.id)+'">'+(isPath?"复制路径":"下载")+'</button>'+
        (w?'<button class="btn sm ghost" style="color:#c0392b" data-ia-rm="'+esc(r.id)+'">删</button>':'')+
      '</div></div>';
  }).join("");
}

function paint(mask,inspId){
  KINDS.forEach(function(k){
    var box=$("[data-ia-list='"+k.k+"']",mask);
    if(box) box.innerHTML=listHTML(inspId,k.k);
    var cnt=$("[data-ia-count='"+k.k+"']",mask);
    if(cnt) cnt.textContent="（"+list(inspId,k.k).length+"）";
  });
  /* 权限状态同步：readonly 与归档锁定切换时，上传入口/删除按钮随之隐藏，下载始终保留 */
  var w=canWrite(inspId), gw=globalWritable();
  $$("[data-ia-up]",mask).forEach(function(b){ b.style.display=w?"":"none"; });
  $$(".ia-drop",mask).forEach(function(d){ d.style.display=w?"":"none"; });
  var lk=$("[data-ia-lock]",mask);
  if(lk){ lk.checked=isLocked(inspId); lk.disabled=!gw; }
  var lkTip=$("[data-ia-locktip]",mask);
  if(lkTip) lkTip.textContent=isLocked(inspId)?"已归档锁定：仅可下载，禁止上传/删除":"";
  $$("[data-ia-dl]",mask).forEach(function(b){
    b.onclick=function(){ download(this.getAttribute("data-ia-dl")); };
  });
  $$("[data-ia-rm]",mask).forEach(function(b){
    b.onclick=function(){ remove(this.getAttribute("data-ia-rm"),function(){ paint(mask,inspId); }); };
  });
}

function open(inspId){
  var s=sheetOf(inspId);
  if(!s){ toast("所属质量检查单不存在或已被删除","err"); return; }
  var w=canWrite(inspId), gw=globalWritable(), tip=statusTip(s.fixStatus);
  var head='<div class="qd-info" style="margin-bottom:10px">'+
    '<div class="qd-info-r"><span>检查编号</span><b>'+esc(s.no||"—")+'</b></div>'+
    '<div class="qd-info-r"><span>检查日期</span><b>'+esc(s.date||"—")+'</b></div>'+
    '<div class="qd-info-r"><span>整改状态</span><b>'+esc(s.fixStatus||"—")+'</b></div>'+
    '</div>'+
    (tip?'<div class="hint" style="margin-bottom:8px;color:#b9770e">'+esc(tip)+'</div>':'')+
    '<div class="hint" style="margin-bottom:10px;line-height:1.7">两类附件分别管理，仅关联本检查单；'+
    '上传附件<b>不会改变整改状态</b>，也不影响原有整改回复流程。'+
    '≤'+limitText()+' 存入浏览器可离线下载，&gt;'+limitText()+' 只登记路径索引（只能复制路径）。'+
    (gw?'':'<br><b style="color:#c0392b">当前台账为只读，仅可下载附件。</b>')+'</div>'+
    (gw?'<label style="display:inline-flex;align-items:center;gap:6px;font-size:12px;cursor:pointer;margin-bottom:10px">'+
        '<input type="checkbox" data-ia-lock="1"> 归档锁定（禁止上传/删除附件，仅可下载）'+
        '</label> <span data-ia-locktip="" style="font-size:11.5px;color:#c0392b"></span>':'');
  var cards='<div class="ia-grid">'+KINDS.map(function(k){
    return '<div class="card" style="margin:0">'+
      '<div class="card-h"><h3>'+esc(k.l)+'<span data-ia-count="'+k.k+'"></span></h3>'+
        '<div class="spacer"></div>'+
        (w?'<button class="btn sm primary" data-ia-up="'+k.k+'">+ 上传</button>'+
           '<input type="file" data-ia-file="'+k.k+'" multiple style="display:none" '+
           'accept=".doc,.docx,.pdf,.xls,.xlsx,.jpg,.jpeg,.png,.zip">':'')+
      '</div>'+
      '<div class="card-b" style="padding:12px 0 0">'+
        (w?'<div class="drop ia-drop" data-ia-drop="'+k.k+'" style="margin:0 12px;padding:14px">'+
           '<div style="font-size:12px;font-weight:600;color:var(--ink-2)">拖拽文件到此，或点击上传</div>'+
           '<div style="font-size:11px;margin-top:4px">'+esc(k.d)+'</div></div>':'')+
        '<div data-ia-list="'+k.k+'" style="margin-top:10px"></div>'+
      '</div></div>';
  }).join("")+'</div>';

  var mask=window.openModal({
    title:"检查单附件 · "+(s.no||""),
    body:head+cards,
    okText:"关闭", noCancel:true,
    afterRender:function(mask){
      paint(mask,inspId);
      var lk=$("[data-ia-lock]",mask);
      if(lk) lk.onchange=function(){
        if(setLock(inspId,this.checked)) paint(mask,inspId);
        else this.checked=isLocked(inspId);
      };
      $$("[data-ia-up]",mask).forEach(function(b){
        b.onclick=function(){ $("[data-ia-file='"+b.getAttribute("data-ia-up")+"']",mask).click(); };
      });
      $$("[data-ia-file]",mask).forEach(function(inp){
        inp.onchange=function(){
          var kind=this.getAttribute("data-ia-file"), fs=this.files;
          this.value="";
          upload(inspId,kind,fs,function(){ paint(mask,inspId); });
        };
      });
      $$("[data-ia-drop]",mask).forEach(function(dz){
        var kind=dz.getAttribute("data-ia-drop");
        dz.onclick=function(){ $("[data-ia-file='"+kind+"']",mask).click(); };
        dz.addEventListener("dragover",function(e){ e.preventDefault(); dz.classList.add("over"); });
        dz.addEventListener("dragleave",function(){ dz.classList.remove("over"); });
        dz.addEventListener("drop",function(e){
          e.preventDefault(); dz.classList.remove("over");
          upload(inspId,kind,e.dataTransfer.files,function(){ paint(mask,inspId); });
        });
      });
    }
  });
  /* 两栏并排需要更宽的画布；只作用于本弹窗，其他弹窗仍为 640px。
     窄屏下 width:100% + 视口约束会自动退回单栏，不影响移动端。 */
  var box=mask.querySelector(".modal");
  if(box) box.style.maxWidth="920px";
}

/* ---------- 总览：按检查单分组 + 孤儿附件标记与清理 ---------- */
function allHTML(){
  var sheets=(DB().inspections||[]).slice().sort(function(a,b){return String(b.date||"").localeCompare(String(a.date||""));});
  var orph=orphans(), total=all().length;
  var h='<div class="hint" style="margin-bottom:10px;line-height:1.7">共 '+sheets.length+
    ' 张检查单、'+total+' 个附件。两张单据分别归到各自的检查单下；'+
    '选择一张检查单，即可分别上传、下载「整改通知单附件」与「整改回复单附件」。</div>';
  if(orph.length){
    h+='<div class="card" style="margin:0 0 12px;border-left:3px solid #c0392b">'+
      '<div class="card-h"><h3 style="color:#c0392b">孤儿附件（'+orph.length+'）</h3><div class="spacer"></div>'+
      (globalWritable()?'<button class="btn sm" data-ia-prune="1">清理孤儿附件</button>':'')+'</div>'+
      '<div class="card-b" style="padding:8px 14px;font-size:12px;line-height:1.9;color:var(--muted)">'+
      '所属质量检查单已删除，附件仍保留但无法下载；确认后可整批清理（含浏览器中的文件原件）。<br>'+
      orph.map(function(a){
        return '· '+esc(a.name)+'（'+(a.kind==="reply"?"回复单":"通知单")+'，'+esc(fmtSize(a.size))+'）';
      }).join("<br>")+'</div></div>';
  }
  h+='<div class="card" style="margin:0"><div class="card-b" style="padding:0">'+
    (sheets.length? sheets.map(function(s){
      var a=list(s.id,"notice").length, b=list(s.id,"reply").length;
      return '<div class="file-item">'+
        '<div class="file-main">'+
          '<div style="font-size:13px;font-weight:600">'+esc(s.no||"—")+
            '　<span style="font-size:11.5px;font-weight:400;color:var(--muted)">'+esc(s.date||"—")+
            ' · '+esc(s.fixStatus||"—")+'</span>'+
            (isLocked(s.id)?' <span class="tag t-gray">已归档锁定</span>':'')+'</div>'+
          '<div style="font-size:11.5px;color:var(--muted);margin-top:2px">'+
            '整改通知单附件 '+a+' 个 · 整改回复单附件 '+b+' 个</div>'+
        '</div>'+
        '<div class="row-actions"><button class="btn sm" data-ia-go="'+esc(s.id)+'">管理附件</button></div>'+
      '</div>';
    }).join("") : '<div class="empty" style="padding:22px 10px">暂无质量检查单</div>')+
    '</div></div>';
  return h;
}
function openAll(){
  window.openModal({
    title:"检查单附件总览",
    body:'<div data-ia-all="1"></div>',
    okText:"关闭", noCancel:true,
    afterRender:function(mask){
      function repaint(){
        var box=$("[data-ia-all]",mask);
        if(box) box.innerHTML=allHTML();
        $$("[data-ia-go]",mask).forEach(function(b){
          b.onclick=function(){
            var id=this.getAttribute("data-ia-go");
            var cb=mask.querySelector("[data-close]"); if(cb) cb.click();
            open(id);
          };
        });
        var pb=$("[data-ia-prune]",mask);
        if(pb) pb.onclick=function(){ prune(repaint); };
      }
      repaint();
    }
  });
}

window.InspAttach={
  open:open, openAll:openAll, upload:upload, download:download, remove:remove, prune:prune,
  list:list, count:count, all:all, orphans:orphans, kinds:KINDS,
  canWrite:canWrite, isLocked:isLocked, setLock:setLock, lockMap:lockMap, limit:limit
};
})();
