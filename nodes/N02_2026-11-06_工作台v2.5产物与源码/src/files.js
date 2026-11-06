/* ===== 文件中心：IndexedDB 真存 + 路径索引双轨 ===== */
(function(){
"use strict";
var A=window.APP, $=A.$, $$=A.$$, esc=A.esc;
function DB(){return A.db;}

var DB_NAME="ZLGL_FILES", STORE="blobs";
var idbPromise=null, idbOK=false, idbErr="";

function openIDB(){
  if(idbPromise) return idbPromise;
  idbPromise=new Promise(function(resolve,reject){
    if(!window.indexedDB){ reject(new Error("当前浏览器不支持 IndexedDB")); return; }
    var rq;
    try{ rq=indexedDB.open(DB_NAME,1); }catch(e){ reject(e); return; }
    rq.onupgradeneeded=function(e){
      var d=e.target.result;
      if(!d.objectStoreNames.contains(STORE)) d.createObjectStore(STORE);
    };
    rq.onsuccess=function(e){ idbOK=true; resolve(e.target.result); };
    rq.onerror=function(e){ idbErr=(e.target.error&&e.target.error.message)||"无法打开文件库"; reject(e.target.error||new Error(idbErr)); };
    rq.onblocked=function(){ reject(new Error("文件库被其他标签页占用")); };
  });
  return idbPromise;
}
function idbPut(key,blob){
  return openIDB().then(function(db){
    return new Promise(function(res,rej){
      var tx=db.transaction(STORE,"readwrite");
      tx.objectStore(STORE).put(blob,key);
      tx.oncomplete=function(){res(true);};
      tx.onerror=function(e){rej(e.target.error);};
    });
  });
}
function idbGet(key){
  return openIDB().then(function(db){
    return new Promise(function(res,rej){
      var tx=db.transaction(STORE,"readonly");
      var rq=tx.objectStore(STORE).get(key);
      rq.onsuccess=function(){res(rq.result);};
      rq.onerror=function(e){rej(e.target.error);};
    });
  });
}
function idbDel(key){
  return openIDB().then(function(db){
    return new Promise(function(res,rej){
      var tx=db.transaction(STORE,"readwrite");
      tx.objectStore(STORE).delete(key);
      tx.oncomplete=function(){res(true);};
      tx.onerror=function(e){rej(e.target.error);};
    });
  });
}
function fmtSize(n){
  if(!n) return "—";
  if(n<1024) return n+" B";
  if(n<1048576) return (n/1024).toFixed(1)+" KB";
  return (n/1048576).toFixed(2)+" MB";
}
function extOf(name){
  var m=/\.([a-z0-9]+)$/i.exec(name||"");
  return m?m[1].toUpperCase():"FILE";
}

var MODULES=["综合","计划看板","质量会议","质量培训","质量活动统计","在建项目","QC 活动","质量检查","方案内审","技术交底","风险识别","质量管理机构","作业指导书","办法制度"];

/* 页面级筛选：跨 window.render("files") 保留，避免上传后筛选被重置 */
var UI={mod:"",status:"",proj:""};
function projOptions(cur,blank){
  var h='<option value="">'+esc(blank||"全部项目")+'</option>';
  (DB().projects||[]).forEach(function(p){
    var nm=String(p.name||"");
    h+='<option value="'+esc(p.id)+'"'+(cur===p.id?" selected":"")+' title="'+esc(nm)+'">'+
       esc(nm.length>16?nm.slice(0,16)+"…":nm)+'</option>';
  });
  return h;
}

/* ---------- 上传 ---------- */
function addFiles(files,pickedModule,projectId){
  var arr=Array.prototype.slice.call(files||[]);
  if(!arr.length) return;
  var mod=pickedModule||"综合";
  var tasks=arr.map(function(f){
    var rec={
      id:A.uid("f"), name:f.name, size:f.size, type:f.type||"",
      module:mod, projectId:projectId||"", date:A.todayStr(), note:"",
      mode:f.size>5*1024*1024?"path":"idb", path:"", key:"",
      status:"pending", statusAt:window.fileNowStr?window.fileNowStr():""
    };
    if(rec.mode==="path"){
      var p=prompt("「"+f.name+"」超过 5MB（"+fmtSize(f.size)+"），将只登记路径索引。\n请填写该文件在电脑上的完整路径：","E:\\workbuddy 缓存\\workbuddy\\总工作台\\raw\\a资源\\2026公司质量管理台账\\");
      if(p===null) return Promise.resolve(false);
      rec.path=p.trim();
      DB().files.push(rec);
      return Promise.resolve(true);
    }
    rec.key=rec.id;
    return idbPut(rec.id,f).then(function(){
      DB().files.push(rec);
      return true;
    }).catch(function(e){
      // IndexedDB 不可用 → 降级为路径索引
      rec.mode="path";
      var p=prompt("本地文件库不可用（"+(e.message||idbErr||"未知原因")+"）。\n「"+f.name+"」将改为登记路径索引，请填写完整路径：","E:\\workbuddy 缓存\\workbuddy\\总工作台\\raw\\a资源\\2026公司质量管理台账\\");
      rec.path=(p||"").trim();
      DB().files.push(rec);
      return true;
    });
  });
  Promise.all(tasks).then(function(rs){
    var n=rs.filter(Boolean).length;
    A.save();
    toast("已加入 "+n+" 个文件","ok");
    window.render("files");
    /* v1.9：上传即排队解析，解析结果可自动落库或进差异预览 */
    if(window.IMPORT&&window.IMPORT.enqueue){
      var ids=DB().files.slice(-arr.length).map(function(f){ return f.id; });
      setTimeout(function(){ try{ window.IMPORT.enqueue(ids); }catch(e){} },300);
    }
  });
}

function downloadFile(id){
  var f=DB().files.filter(function(x){return x.id===id;})[0]; if(!f) return;
  if(f.mode==="path"){
    if(window.copyText) window.copyText(f.path); else toast(f.path||"（空）","ok");
    return;
  }
  idbGet(f.key).then(function(blob){
    if(!blob){ toast("浏览器中找不到该文件，可能已被清理","err"); return; }
    var url=URL.createObjectURL(blob);
    var a=document.createElement("a");
    a.href=url; a.download=f.name;
    document.body.appendChild(a); a.click();
    setTimeout(function(){ URL.revokeObjectURL(url); a.remove(); },500);
  }).catch(function(e){ toast("读取失败："+e.message,"err"); });
}
window.fileDownload=downloadFile;

/* ---------- 共用文件行与状态按钮（文件中心 / 模块卡片 / 项目详情） ---------- */
function fileRowHTML(f,o){
  o=o||{};
  var pen=(window.fileStatus?window.fileStatus(f):"confirmed")==="pending";
  var acts="";
  if(o.open!==false){
    acts+='<button class="btn sm" data-fopen="'+esc(f.id)+'">'+(f.mode==="idb"?"下载":"复制路径")+'</button>';
  }
  if(o.toggle!==false){
    acts+= pen
      ? '<button class="btn sm primary" data-fok="'+esc(f.id)+'">确认</button>'
      : '<button class="btn sm ghost" data-frev="'+esc(f.id)+'">撤回</button>';
  }
  return '<div class="file-item">'+
    '<div class="file-ic">'+esc(extOf(f.name))+'</div>'+
    '<div class="file-main">'+
      '<div style="font-size:13px;font-weight:600;word-break:break-all">'+esc(f.name)+'</div>'+
      '<div style="font-size:11.5px;color:var(--muted);margin-top:2px">'+
        fmtSize(f.size)+' · '+esc(f.date||"")+
        (o.showModule===false?'':' · '+esc(f.module||""))+
        ' · '+(window.fileTag?window.fileTag(f):"")+
        (o.projTag&&!f.projectId?' <span class="tag t-gray">未关联项目</span>':'')+
      '</div>'+
      '<div style="font-size:11px;color:var(--muted);margin-top:2px;word-break:break-all">'+esc(f.rel||f.path||"")+'</div>'+
    '</div>'+
    '<div class="row-actions">'+acts+'</div></div>';
}
/* 统一绑定：确认 / 撤回 / 打开。onChange 由调用方决定"怎么重绘"，本函数不猜 */
function fileBind(scope,onChange){
  $$("[data-fok]",scope).forEach(function(b){
    b.onclick=function(){
      if(window.fileSetStatus(this.getAttribute("data-fok"),"confirmed")){
        toast("已确认","ok"); if(onChange) onChange();
      }
    };
  });
  $$("[data-frev]",scope).forEach(function(b){
    b.onclick=function(){
      if(window.fileSetStatus(this.getAttribute("data-frev"),"pending")){
        toast("已撤回，转为待确认","ok"); if(onChange) onChange();
      }
    };
  });
  $$("[data-fopen]",scope).forEach(function(b){
    b.onclick=function(){ downloadFile(this.getAttribute("data-fopen")); };
  });
}
window.fileRowHTML=fileRowHTML;
window.fileBind=fileBind;
window.fileAdd=addFiles;
/* 供「检查单附件」复用同一 IndexedDB 库（key 加 ia_ 前缀，互不冲突）；
   只导出底层能力，不改变文件中心任何既有行为。 */
window.fileBlobPut=idbPut;
window.fileBlobGet=idbGet;
window.fileBlobDel=idbDel;
window.fileFmtSize=fmtSize;
window.fileExtOf=extOf;
window.FILE_SIZE_LIMIT=5*1024*1024;

/* ---------- 图片预览 ---------- */
function blobOf(id){
  var f=DB().files.filter(function(x){return x.id===id;})[0];
  if(!f) return Promise.reject(new Error("NO_REC"));
  if(f.mode==="path") return Promise.reject(new Error("NO_ROUTE"));
  return idbGet(f.key).then(function(b){
    if(!b) throw new Error("NO_BLOB");
    return b;
  });
}
window.fileBlob=blobOf;

function showFileRec(f){
  if(!f) return;
  var cur=(f.projectId||"");
  window.openModal({
    title:"文件详情",
    okText:"关闭",
    noCancel:true,
    body:'<div class="qd-info">'+
      '<div class="qd-info-r"><span>文件名</span><b>'+esc(f.name)+'</b></div>'+
      '<div class="qd-info-r"><span>所属模块</span><b>'+esc(f.module||"—")+'</b></div>'+
      '<div class="qd-info-r"><span>状态</span><b>'+(window.fileTag?window.fileTag(f):"—")+'</b></div>'+
      (f.statusAt?'<div class="qd-info-r"><span>状态变更</span><b>'+esc(f.statusAt)+'</b></div>':'')+
      '<div class="qd-info-r"><span>关联项目</span><b>'+esc(cur?(function(){
        var p=(DB().projects||[]).filter(function(x){return x.id===cur;})[0]; return p?p.name:"（已删除的项目）";
      })():"未关联")+'</b></div>'+
      '<div class="qd-info-r"><span>登记日期</span><b>'+esc(f.date||"—")+'</b></div>'+
      '<div class="qd-info-r"><span>大小</span><b>'+fmtSize(f.size)+'</b></div>'+
      '<div class="qd-info-r"><span>存放方式</span><b>'+(f.mode==="idb"?"已存入浏览器":"路径索引")+'</b></div>'+
      (f.path?'<div class="qd-info-r"><span>完整路径</span><b style="word-break:break-all">'+esc(f.path)+'</b></div>':'')+
      (f.rel?'<div class="qd-info-r"><span>相对路径</span><b style="word-break:break-all">'+esc(f.rel)+'</b></div>':'')+
      '</div>'+
      '<div class="field" style="margin-top:12px"><label>关联项目</label>'+
        '<select id="fdProj">'+projOptions(cur,"不关联项目")+'</select></div>'+
      '<div style="margin-top:8px;font-size:11.5px;color:var(--muted)">选择后立即保存，用于「在建项目 → 本项目文件」的归集。</div>',
    afterRender:function(mask){
      var sel=$("#fdProj",mask);
      if(!sel) return;
      sel.onchange=function(){
        var rec=(DB().files||[]).filter(function(x){return x.id===f.id;})[0];
        if(!rec) return;
        rec.projectId=this.value;
        if(A.save()){ toast("已更新关联项目","ok"); if(window.mfRefresh) window.mfRefresh(); }
      };
    }
  });
}

function previewFile(id){
  var f=DB().files.filter(function(x){return x.id===id;})[0]; if(!f) return;
  if(!window.ImgView){ toast("预览模块未加载，请重新构建页面","err"); return; }
  var hit=null, hitDone=false;
  window.ImgView.open({
    name:f.name, size:f.size, path:f.path||"",
    getBlob:function(escalate){
      if(f.mode!=="path") return blobOf(f.id);
      var q=(hitDone?Promise.resolve(hit):window.QD.routeByPath(f.path));
      return q.then(function(h){
        hit=h; hitDone=true;
        if(!h) throw new Error("NO_ROUTE");
        if(h.perm==="granted") return h;
        if(!escalate) throw new Error("NEED_PERM");
        return window.QD.ensurePerm(h.route,"read").then(function(){
          h.perm="granted"; return h;
        });
      }).then(function(h){ return window.QD.readBlob(h.route,h.rel); });
    },
    onDetail:function(){ showFileRec(f); }
  });
}
window.filePreview=previewFile;

function delFile(id){  var f=DB().files.filter(function(x){return x.id===id;})[0]; if(!f) return;
  if(!confirm("确定删除「"+f.name+"」？本地文件将一并移除。")) return;
  var p = f.mode==="idb" ? idbDel(f.key).catch(function(){}) : Promise.resolve();
  p.then(function(){
    DB().files=DB().files.filter(function(x){return x.id!==id;});
    A.save(); toast("已删除","ok"); window.render("files");
  });
}

/* ---------- 页面 ---------- */
window.regPage("files",{
  sub:"≤5MB 存入浏览器可直接下载；>5MB 只登记路径索引",
  render:function(host){
    function listAll(){
      return (DB().files||[]).slice().sort(function(a,b){return String(b.date||"").localeCompare(String(a.date||""));});
    }
    function kpiHTML(list){
      var storeSize=list.reduce(function(s,f){return s+(f.mode==="idb"?(f.size||0):0);},0);
      var idbN=list.filter(function(f){return f.mode==="idb";}).length;
      var pathN=list.filter(function(f){return f.mode==="path";}).length;
      var penN=list.filter(function(f){return window.fileIsPending(f);}).length;
      return '<div class="card kpi"><div class="k">文件总数</div><div class="v">'+list.length+'<small>个</small></div>'+
          '<div class="d">浏览器 '+idbN+' 个 · '+fmtSize(storeSize)+'</div></div>'+
        '<div class="card kpi" data-kpi="pending" style="cursor:pointer" title="点击筛选待确认文件">'+
          '<div class="k">待确认</div><div class="v"'+(penN?' style="color:#b9770e"':'')+'>'+penN+'<small>个</small></div>'+
          '<div class="d">'+(penN?'点击逐条确认归属':'全部已确认')+'</div></div>'+
        '<div class="card kpi"><div class="k">路径索引</div><div class="v">'+pathN+'<small>个</small></div><div class="d">指向 E 盘原件</div></div>'+
        '<div class="card kpi"><div class="k">数据备份</div><div class="v" style="font-size:15px">JSON</div><div class="d">建议每周导出一次</div></div>';
    }
    function paintKpi(){
      var k=$("#fileKpi",host); if(!k) return;
      k.innerHTML=kpiHTML(listAll());
      var pc=$("[data-kpi=pending]",k);
      if(pc) pc.onclick=function(){
        UI.status="pending";
        var fs=$("#fltStatus",host); if(fs) fs.value="pending";
        paint();
      };
    }

    host.innerHTML='<div class="grid g4" id="fileKpi" style="margin-bottom:14px">'+kpiHTML(listAll())+'</div>'+

    '<div class="card" style="margin-bottom:14px"><div class="card-h"><h3>上传文件</h3>'+
      '<span class="hint">支持 docx / xlsx / pdf / 图片，可批量拖入</span><div class="spacer"></div>'+
      '<select id="upProject" style="padding:6px 10px;max-width:190px">'+projOptions("","不关联项目")+'</select>'+
      '<select id="upModule" style="padding:6px 10px">'+MODULES.map(function(m){return '<option>'+esc(m)+'</option>';}).join("")+'</select></div>'+
      '<div class="card-b"><div class="drop" id="dropZone">'+
        '<div style="font-size:26px;margin-bottom:6px">⬒</div>'+
        '<div style="font-weight:600;color:var(--ink-2)">拖拽文件到此，或点击选择</div>'+
        '<div style="font-size:11.5px;margin-top:5px">≤5MB 存入浏览器可离线下载；&gt;5MB 转为路径索引 · 上传后为「待确认」</div>'+
      '</div><input type="file" id="fileInput" multiple style="display:none"></div></div>'+

    '<div class="card" style="margin-bottom:14px"><div class="card-h"><h3>文件清单</h3><div class="spacer"></div>'+
      '<select id="fltModule"><option value="">全部模块</option>'+MODULES.map(function(m){return '<option value="'+esc(m)+'"'+(UI.mod===m?" selected":"")+'>'+esc(m)+'</option>';}).join("")+'</select>'+
      '<select id="fltStatus">'+
        ['','pending','confirmed'].map(function(v){
          var t=v===""?"全部状态":v==="pending"?"仅待确认":"仅已确认";
          return '<option value="'+v+'"'+(UI.status===v?" selected":"")+'>'+t+'</option>';
        }).join("")+'</select>'+
      '<button class="btn" id="btnAudit" title="检查文件与台账是否一致">数据对账</button>'+
      '<button class="btn" id="btnBackup">导出备份</button>'+
      '<button class="btn" id="btnRestore">从备份恢复</button></div>'+
      '<div id="fileList"></div></div>'+

    '<div class="card"><div class="card-h"><h3>说明</h3></div><div class="card-b" style="font-size:12.5px;line-height:2;color:var(--ink-2)">'+
      '<div>· <b>待确认</b>：上传或归档后先进入待确认，在「在建项目」或本页逐条确认归属；确认后仍可撤回。</div>'+
      '<div>· <b>双轨存储</b>：小文件以二进制存入浏览器数据库，换电脑后需重新上传；大文件只登记路径，原件始终在 E 盘。</div>'+
      '<div>· <b>数据备份</b>：任务、项目、检查等结构化数据存于 localStorage，可一键导出 JSON；换设备时用「从备份恢复」导入。</div>'+
      '<div>· <b>打印归档</b>：各台账页的「打印」按钮生成 A4 版式，浏览器中直接打印或另存为 PDF，可盖章归档。</div>'+
      '<div>· <b>容量上限</b>：localStorage 约 5MB（仅存数据，不含文件），IndexedDB 通常可用数百 MB。</div>'+
    '</div></div>';

    function paint(){
      var box=$("#fileList",host);
      var mod=UI.mod, st=UI.status;
      var list=listAll().filter(function(f){
        if(mod&&f.module!==mod) return false;
        if(st&&window.fileStatus(f)!==st) return false;
        return true;
      });
      if(!list.length){
        var why=st==="pending"?"没有待确认的文件。":
                st==="confirmed"?"没有已确认的文件。":
                mod?"该模块暂无文件。":"暂无文件。可拖入公司台账原件，或在各模块录入时登记路径。";
        box.innerHTML='<div class="empty">'+why+
          ((st||mod)?'　<button class="btn sm" id="fltClear">清除筛选</button>':'')+'</div>';
        var cb=$("#fltClear",box);
        if(cb) cb.onclick=function(){
          UI.mod=""; UI.status="";
          var fm=$("#fltModule",host), fs=$("#fltStatus",host);
          if(fm) fm.value=""; if(fs) fs.value="";
          paint();
        };
        return;
      }
      box.innerHTML=list.map(function(f){
        var isPath=f.mode==="path";
        var isImg=(window.QD&&window.QD.isImg)?window.QD.isImg(f.name):false;
        var imgAttr=isImg?' data-img="'+esc(f.id)+'"':'';
        var pen=window.fileIsPending(f);
        return '<div class="file-item">'+
          '<div class="file-ic"'+imgAttr+' title="'+(isImg?"点击预览":"")+'" style="'+(isPath?"background:var(--amber-soft);color:var(--amber)":"")+(isImg?";cursor:pointer":"")+'">'+esc(extOf(f.name))+'</div>'+
          '<div class="file-main">'+
            '<div'+imgAttr+' style="font-size:13px;font-weight:600;word-break:break-all'+(isImg?";cursor:pointer":"")+'">'+esc(f.name)+'</div>'+
            '<div style="font-size:11.5px;color:var(--muted);margin-top:2px">'+
              fmtSize(f.size)+' · '+esc(f.module)+' · '+esc(f.date)+
              ' · '+window.fileTag(f)+
              (window.IMPORT&&window.IMPORT.badge?' · '+window.IMPORT.badge(f):'')+
              (f.projectId?'':' · <span class="tag t-gray">未关联项目</span>')+
              (isPath?' · <span style="color:var(--amber)">路径索引</span>':' · <span style="color:var(--green)">已存入浏览器</span>')+
              (f.src==="ws"?' · <span style="color:var(--brand-2)">工作空间站</span>'
                :f.src==="folder"?' · <span style="color:var(--brand-2)">本地文件夹</span>'
                :' · 手动上传')+
            '</div>'+
            (isPath&&f.path?'<div style="font-size:11px;color:var(--muted);margin-top:3px;word-break:break-all">'+esc(f.path)+'</div>':'')+
            (!isPath&&f.rel?'<div style="font-size:11px;color:var(--muted);margin-top:3px;word-break:break-all">'+esc(f.rel)+'</div>':'')+
          '</div>'+
          '<div class="row-actions">'+
            (f.parse&&f.parse.state==="preview"?'<button class="btn sm primary" data-imp="'+esc(f.id)+'">采纳</button>':'')+
            (isImg?'<button class="btn sm" data-pv="'+esc(f.id)+'">预览</button>':'')+
            '<button class="btn sm" data-dl="'+esc(f.id)+'">'+(isPath?"复制路径":"下载")+'</button>'+
            '<button class="btn sm'+(pen?' primary':' ghost')+'" data-'+(pen?"fok":"frev")+'="'+esc(f.id)+'">'+(pen?"确认":"撤回")+'</button>'+
            '<button class="btn sm ghost" style="color:#c0392b" data-rm="'+esc(f.id)+'">删</button>'+
          '</div></div>';
      }).join("");
      $$("[data-pv]",box).forEach(function(b){ b.onclick=function(){ previewFile(this.getAttribute("data-pv")); }; });
      $$("[data-img]",box).forEach(function(el){ el.onclick=function(){ previewFile(this.getAttribute("data-img")); }; });
      $$("[data-dl]",box).forEach(function(b){ b.onclick=function(){ downloadFile(this.getAttribute("data-dl")); }; });
      $$("[data-rm]",box).forEach(function(b){ b.onclick=function(){ delFile(this.getAttribute("data-rm")); }; });
      $$("[data-imp]",box).forEach(function(b){
        b.onclick=function(){ if(window.IMPORT) window.IMPORT.preview(this.getAttribute("data-imp")); };
      });
      window.fileBind(box,function(){ paint(); paintKpi(); if(window.refreshNav) window.refreshNav(); });
    }
    paint(); paintKpi();
    window.__filesRepaint=function(){ try{ paint(); paintKpi(); }catch(e){} };

    var dz=$("#dropZone",host), fi=$("#fileInput",host);
    dz.onclick=function(){ fi.click(); };
    function upNow(files){
      var m=$("#upModule",host).value, pj=$("#upProject",host).value;
      UI.mod=m; UI.status="";
      var fm=$("#fltModule",host), fs=$("#fltStatus",host);
      if(fm) fm.value=m; if(fs) fs.value="";
      addFiles(files,m,pj);
    }
    fi.onchange=function(){ upNow(this.files); this.value=""; };
    dz.addEventListener("dragover",function(e){ e.preventDefault(); dz.classList.add("over"); });
    dz.addEventListener("dragleave",function(){ dz.classList.remove("over"); });
    dz.addEventListener("drop",function(e){
      e.preventDefault(); dz.classList.remove("over");
      upNow(e.dataTransfer.files);
    });
    $("#fltModule",host).onchange=function(){ UI.mod=this.value; paint(); };
    $("#fltStatus",host).onchange=function(){ UI.status=this.value; paint(); };
    $("#btnAudit",host).onclick=function(){
      if(!window.IMPORT){ toast("同步引擎未加载","err"); return; }
      var r=window.IMPORT.auditText();
      window.openModal({
        title:"数据对账 · 文件 ↔ 台账",
        okText:"关闭", noCancel:true,
        body:'<div class="imp-log">'+esc(r.text)+'</div>'+
          '<div style="margin-top:12px;font-size:12.5px" class="'+(r.pass?"imp-pass":"imp-fail")+'">'+
          (r.pass?"判定：通过（孤儿文件 / 孤儿行 / 失联行 / 重复行 均为 0）":"判定：不通过，请处理上述差异")+'</div>'
      });
    };
    $("#btnBackup",host).onclick=function(){ window.backupJSON(); };
    $("#btnRestore",host).onclick=function(){ window.restoreJSON(); };

    // 预检文件库可用性
    openIDB().catch(function(e){
      var el=$("#dropZone",host);
      if(el){
        el.style.borderColor="#c0392b";
        el.innerHTML='<div style="font-size:14px;font-weight:600;color:#c0392b;margin-bottom:4px">本地文件库不可用</div>'+
          '<div style="font-size:12px">原因：'+esc(e.message||idbErr)+'。上传时将自动转为路径索引，不影响台账数据。</div>'+
          '<div style="font-size:11.5px;margin-top:6px;color:var(--muted)">建议用 Chrome / Edge 打开，或将本文件放在 http 服务下访问。</div>';
      }
    });
  }
});
})();
