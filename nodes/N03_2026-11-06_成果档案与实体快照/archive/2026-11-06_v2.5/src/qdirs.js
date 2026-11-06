/* ===== 快速入口 ↔ 本地文件夹：绑定 / 授权 / 扫描 / 同步 / 读写 ===== */
(function(){
"use strict";
var A=window.APP, $=A.$, $$=A.$$, esc=A.esc;
function DB(){return A.db;}

/* ---------- 限制与类型 ---------- */
var LIM={maxFiles:3000,maxDepth:8,maxText:2*1024*1024};
var TEXT_EXT={txt:1,md:1,csv:1,json:1,log:1,ini:1,cfg:1,bat:1,js:1,css:1,html:1,htm:1,xml:1,yml:1,yaml:1,sql:1,py:1};
/* 图片只认浏览器原生能解码的 9 种；tif / heic 不在此列，仍走「详情」 */
var IMG_EXT={jpg:1,jpeg:1,png:1,gif:1,bmp:1,webp:1,svg:1,ico:1,avif:1};
var IMG_MIME={jpg:"image/jpeg",jpeg:"image/jpeg",png:"image/png",gif:"image/gif",
  bmp:"image/bmp",webp:"image/webp",svg:"image/svg+xml",ico:"image/x-icon",avif:"image/avif"};
var TEMP=/^(~\$|\.|thumbs\.db$|desktop\.ini$)/i;

/* ---------- 默认绑定（对应新台账目录的 15 个编号子目录，仅预填路径，需人工授权） ---------- */
var DEF_MAP={
  plan:"15、质量管理办法、制度",
  meeting:"1、质量会议（每月统计）",
  training:"2、质量培训",
  stats:"5、质量活动统计（每月统计）",
  qc:"6、QC质量活动小组",
  inspect:"7、质量检查、整改回复",
  review:"8、内审记录",
  brief:"11、技术交底、风险识别",
  projects:"16、在建项目业务清单",
  org:"12、质量管理人员配置",
  guide:"14、作业指导书",
  policy:"15、质量管理办法、制度",
  files:""
};
/* 台账根目录（唯一权威路径，其余一律由此拼接） */
var ROOT_PATH="E:\\workbuddy 缓存\\workbuddy\\总工作台\\raw\\a资源\\2026公司质量管理台账";
/* 台账目录普遍按月/按项目再分一层，默认递归，否则「一月/三月」这类子目录整批漏扫 */
var DEF_RECURSE={plan:true,meeting:true,training:true,stats:true,qc:true,inspect:true,review:true,
  brief:true,projects:true,org:true,guide:true,policy:true,files:false};

/* ---------- 历史路径迁移表（OLD_ROOT 已废弃，仅用于识别旧数据并改写，不再作为绑定路径） ---------- */
var OLD_ROOT="E:\\公司级质量台账\\2026年度";
var DIR_MAP={
  "质量目标管理责任书":"15、质量管理办法、制度",
  "2026年一月份质量会议":"1、质量会议（每月统计）",
  "活动方案":"15、质量管理办法、制度",
  "QC小组记录汇总":"6、QC质量活动小组",
  "整改回复单":"7、质量检查、整改回复",
  "内审记录文件":"8、内审记录",
  "公司级技术交底文件":"11、技术交底、风险识别",
  "每月项目业务清单":"5、质量活动统计（每月统计）",
  "质量管理人员配置表":"12、质量管理人员配置",
  "作业指导书":"14、作业指导书",
  "质量管理办法":"15、质量管理办法、制度",
  "分包管理":"10、分包管理",
  "项目质量台账":""
};
/* 新目录中已不存在的原件：路径清空并标记待补充，不指向不存在的文件 */
var FILE_GONE={
  "地质五大队质量工作管理办法--2026.docx":1,
  "湖北省地质局项目质量管理标准台账.docx":1,
  "湖北省地质局项目质量管理标准台账.pdf":1
};
/* 旧数据中记录过缩写文件名，迁移时还原成磁盘上的真实文件名 */
var FILE_FIX={
  "关于印发《...2026年度质量工作要点》的通知.docx":"关于印发《湖北省中大地质基础工程勘察有限公司2026年度质量工作要点》的通知.docx"
};
var LBL={
  plan:"计划表与进度看板", meeting:"每月质量会议", training:"质量培训", stats:"质量活动统计",
  qc:"QC 质量活动", inspect:"质量检查整改回复", review:"施工方案内审", brief:"技术交底及风险识别",
  projects:"在建项目业务清单", org:"质量管理机构", guide:"作业指导书", policy:"质量管理办法及制度",
  files:"文件中心"
};
/* 入口对应的台账路由（用于「切回台账」） */
var MOD_ROUTE={
  plan:"plan", meeting:"meeting", training:"training", stats:"stats", qc:"qc", inspect:"inspect",
  review:"review", brief:"brief", projects:"projects", org:"org", guide:"guide", policy:"policy", files:"files"
};
/* 入口 → 文件中心模块（与文件中心的 14 个模块口径一致；确认归档时按此定默认归属） */
var ROUTE_MOD={
  plan:["计划看板"], meeting:["质量会议"], training:["质量培训"], stats:["质量活动统计"],
  qc:["QC 活动"], inspect:["质量检查"], review:["方案内审"], brief:["技术交底","风险识别"],
  projects:["在建项目"], org:["质量管理机构"], guide:["作业指导书"], policy:["办法制度"]
};
function modOfRoute(route){
  var m=ROUTE_MOD[route];
  return (m&&m.length)?m[0]:"综合";
}

/* ---------- 小工具 ---------- */
function pad(n){ return n<10?"0"+n:""+n; }
function nowStr(){
  var d=new Date();
  return d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate())+" "+pad(d.getHours())+":"+pad(d.getMinutes());
}
function dateOf(ms){
  var d=ms?new Date(ms):new Date();
  if(isNaN(d.getTime())) d=new Date();
  return d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate());
}
function fmtSize(n){
  if(n===null||n===undefined||n==="") return "—";
  if(n<1024) return n+" B";
  if(n<1048576) return (n/1024).toFixed(1)+" KB";
  return (n/1048576).toFixed(2)+" MB";
}
function extOf(name){
  var m=/\.([a-z0-9]+)$/i.exec(name||"");
  return m?m[1].toLowerCase():"";
}
function isText(name){ return !!TEXT_EXT[extOf(name)]; }
function isImg(name){ return !!IMG_EXT[extOf(name)]; }
function nameOfPath(p){
  var s=String(p||"").replace(/[\\/]+$/,"");
  var i=Math.max(s.lastIndexOf("\\"),s.lastIndexOf("/"));
  return i>=0?s.slice(i+1):s;
}

/* ---------- 路径护栏 ---------- */
function guardPath(p){
  var s=String(p||"").trim();
  if(!s) return {ok:false,msg:"请先填写文件夹路径"};
  var unc=/^\\\\[^\\]+\\[^\\]+/.test(s);
  if(unc) return {ok:true,msg:"网络共享路径，若未连接会导致读取失败"};
  if(!/^[a-zA-Z]:[\\/]/.test(s)) return {ok:false,msg:"请填写完整路径，例如 "+ROOT_PATH};
  if(/^[a-zA-Z]:[\\/]?$/.test(s)) return {ok:false,msg:"不能绑定整个磁盘根目录，请指向具体文件夹"};
  if(/\\(windows|program files|program files \(x86\)|programdata|system32|syswow64)(\\|$)/i.test(s))
    return {ok:false,msg:"不能绑定系统目录，请选择业务文件夹"};
  if(/\\appdata(\\|$)/i.test(s)) return {ok:false,msg:"不能绑定 AppData 目录"};
  return {ok:true,msg:""};
}

/* ---------- IndexedDB：存目录句柄（句柄无法进 localStorage） ---------- */
var IDB_NAME="ZLGL_QDIR", IDB_STORE="h", idbDb=null;
function idbOpen(){
  if(idbDb) return Promise.resolve(idbDb);
  return new Promise(function(res,rej){
    if(!window.indexedDB){ rej(new Error("当前浏览器不支持 IndexedDB")); return; }
    var rq;
    try{ rq=indexedDB.open(IDB_NAME,1); }catch(e){ rej(e); return; }
    rq.onupgradeneeded=function(e){
      var d=e.target.result;
      if(!d.objectStoreNames.contains(IDB_STORE)) d.createObjectStore(IDB_STORE);
    };
    rq.onsuccess=function(){ idbDb=rq.result; res(idbDb); };
    rq.onerror=function(){ rej(rq.error||new Error("打开数据库失败")); };
  });
}
function hPut(route,handle){
  return idbOpen().then(function(d){
    return new Promise(function(res,rej){
      var tx=d.transaction(IDB_STORE,"readwrite");
      tx.objectStore(IDB_STORE).put(handle,route);
      tx.oncomplete=function(){ res(true); };
      tx.onerror=function(){ rej(tx.error); };
    });
  });
}
function hGet(route){
  return idbOpen().then(function(d){
    return new Promise(function(res,rej){
      var tx=d.transaction(IDB_STORE,"readonly");
      var rq=tx.objectStore(IDB_STORE).get(route);
      rq.onsuccess=function(){ res(rq.result||null); };
      rq.onerror=function(){ rej(rq.error); };
    });
  });
}
function hDel(route){
  return idbOpen().then(function(d){
    return new Promise(function(res){
      var tx=d.transaction(IDB_STORE,"readwrite");
      tx.objectStore(IDB_STORE).delete(route);
      tx.oncomplete=function(){ res(true); };
      tx.onerror=function(){ res(false); };
    });
  });
}

/* ---------- 配置 ---------- */
/* ---------- 旧路径改写：把任何指向旧台账目录的字符串换到新目录 ---------- */
function normSep(s){ return String(s||"").replace(/\//g,"\\"); }
function defPath(route){ var d=DEF_MAP.hasOwnProperty(route)?DEF_MAP[route]:""; return d?ROOT_PATH+"\\"+d:ROOT_PATH; }
function fixPath(p){
  if(typeof p!=="string"||!p) return p;
  var s=normSep(p), hit="";
  var roots=[normSep(OLD_ROOT),"E:\\公司级质量台账"];
  for(var i=0;i<roots.length;i++){
    if(s.toLowerCase().indexOf(roots[i].toLowerCase())===0){ hit=roots[i]; break; }
  }
  if(!hit) return p;
  var rest=s.slice(hit.length).replace(/^\\+/,"");
  if(!rest) return ROOT_PATH;
  var segs=rest.split("\\");
  var base=segs[segs.length-1];
  if(FILE_GONE[base]) return "";
  if(segs.length===1){
    /* 旧根目录下的散文件：只有确在新目录根部存在的才保留 */
    var keep={"2026年度科技工作统计表(中大 专利2个 见附表2 修改）.xls":1,"中大公司质量工作半年度报告.docx":1};
    return keep[base]?ROOT_PATH+"\\"+base:"";
  }
  var top=segs[0], nt=DIR_MAP.hasOwnProperty(top)?DIR_MAP[top]:undefined;
  if(FILE_FIX[base]){ base=FILE_FIX[base]; segs[segs.length-1]=base; }
  if(nt===undefined){
    for(var k in DIR_MAP){ if(top.indexOf(k)>=0){ nt=DIR_MAP[k]; break; } }
  }
  if(nt===undefined) return p;
  if(nt==="") return ROOT_PATH;
  segs[0]=nt;
  return ROOT_PATH+"\\"+segs.join("\\");
}
/* 一次性迁移：快速入口、工作空间站根目录、所有台账记录里的 path */
function migrate(){
  var db=DB(); if(!db) return 0;
  if(!db.settings) db.settings={};
  var n=0, gone=0;

  var q=db.settings.quickDirs;
  if(q&&typeof q==="object") Object.keys(q).forEach(function(r){
    var c=q[r]; if(!c||typeof c.path!=="string") return;
    /* 快速入口以 DEF_MAP 为权威，旧台账路径一律按新默认目录重置 */
    var np=DEF_MAP.hasOwnProperty(r)?defPath(r):fixPath(c.path);
    if(np!==c.path){
      /* 句柄仍指向旧目录，重置状态要求重新授权，避免误读旧文件 */
      c.path=np; c.status="unbound"; c.idx=[]; c.seen={}; c.ack=[]; c.counts={total:0,new:0,chg:0,gone:0};
      n++;
    }
  });

  /* v1.9：旧配置一律 recurse=false，导致按月/按项目分层的目录整批漏扫，这里一次性校正 */
  if(db.settings.dirCfgV!==2){
    var qq=db.settings.quickDirs;
    if(qq&&typeof qq==="object") Object.keys(qq).forEach(function(r){
      if(qq[r]&&typeof qq[r]==="object") qq[r].recurse=!!DEF_RECURSE[r];
    });
    db.settings.dirCfgV=2; n++;
  }

  var w=db.settings.ws;
  if(w&&typeof w.root==="string"&&/公司级质量台账/.test(w.root)){ w.root=ROOT_PATH; n++; }

  Object.keys(db).forEach(function(k){
    var arr=db[k];
    if(!Array.isArray(arr)) return;
    arr.forEach(function(o){
      if(!o||typeof o!=="object") return;
      if(typeof o.path==="string"&&/公司级质量台账/.test(o.path)){
        var np=fixPath(o.path);
        if(np!==o.path){
          o.path=np; n++;
          if(!np){ gone++; o.note=(o.note?o.note+"；":"")+"原件未随台账迁入新目录，待补充"; }
        }
      }
      if(typeof o.root==="string"&&/公司级质量台账/.test(o.root)){
        var nr=fixPath(o.root);
        if(nr!==o.root){ o.root=nr; n++; }
      }
    });
  });

  if(n){
    db.settings.pathFixAt=nowStr();
    db.settings.pathFixCount=n;
    try{ A.save(); }catch(e){ console.warn("路径迁移保存失败",e); }
    console.info("[路径迁移] 已更正 "+n+" 处引用，其中 "+gone+" 处原件缺失已清空");
  }
  return n;
}

function cfgAll(){
  var db=DB();
  if(!db.settings) db.settings={};
  var q=db.settings.quickDirs;
  if(!q||typeof q!=="object") q=db.settings.quickDirs={};
  Object.keys(DEF_MAP).forEach(function(r){
    var c=q[r];
    if(!c||typeof c!=="object"){
      c=q[r]={};
    }
    if(typeof c.path!=="string") c.path=defPath(r);
    if(typeof c.recurse!=="boolean") c.recurse=!!DEF_RECURSE[r];
    if(typeof c.rw!=="boolean") c.rw=true;
    if(typeof c.status!=="string"||!c.status) c.status="unbound";
    if(typeof c.boundAt!=="string") c.boundAt="";
    if(typeof c.lastScanAt!=="string") c.lastScanAt="";
    if(!Array.isArray(c.idx)) c.idx=[];
    if(!c.seen||typeof c.seen!=="object") c.seen={};
    if(!Array.isArray(c.ack)) c.ack=[];
    if(!c.counts||typeof c.counts!=="object") c.counts={total:0,new:0,chg:0,gone:0};
  });
  return q;
}
function cfgOf(route){
  var q=cfgAll();
  if(!q[route]){
    q[route]={path:"",recurse:false,rw:true,status:"unbound",boundAt:"",lastScanAt:"",
              idx:[],seen:{},ack:[],counts:{total:0,new:0,chg:0,gone:0}};
  }
  return q[route];
}
function isBound(route){ var c=cfgOf(route); return c.status!=="unbound"; }
function boundRoutes(){
  var q=cfgAll();
  return Object.keys(q).filter(function(r){ return q[r].status!=="unbound"; });
}
function listAll(){
  var q=cfgAll();
  return Object.keys(q).map(function(r){
    return {route:r,label:LBL[r]||r,cfg:q[r]};
  }).sort(function(a,b){
    var ia=Object.keys(DEF_MAP).indexOf(a.route), ib=Object.keys(DEF_MAP).indexOf(b.route);
    return (ia<0?99:ia)-(ib<0?99:ib);
  });
}

/* ---------- 句柄缓存与权限 ---------- */
var HC={};
function handleOf(route){
  if(HC[route]) return Promise.resolve(HC[route]);
  return hGet(route).then(function(h){ if(h) HC[route]=h; return h; });
}
function permOf(handle,mode){
  if(!handle||!handle.queryPermission) return Promise.resolve("denied");
  return handle.queryPermission({mode:mode||"read"}).catch(function(){ return "denied"; });
}
/* 在用户手势内调用：申请读写授权 */
function ensurePerm(route,mode){
  if(!mode) mode=cfgOf(route).rw?"readwrite":"read";
  return handleOf(route).then(function(h){
    if(!h) throw new Error("NO_HANDLE");
    return permOf(h,mode).then(function(p){
      if(p==="granted") return true;
      if(!h.requestPermission) throw new Error("NO_PERM_API");
      return h.requestPermission({mode:mode}).then(function(p2){
        if(p2==="granted"){ setStatus(route,"ok"); return true; }
        setStatus(route,"denied");
        throw new Error("DENIED");
      });
    });
  });
}
function setStatus(route,st){
  var c=cfgOf(route);
  if(c.status!==st){ c.status=st; A.save(); }
}

/* ---------- 绑定 / 解绑 ---------- */
function pickDir(mode){
  if(!window.showDirectoryPicker) return Promise.reject(new Error("NO_PICKER"));
  return window.showDirectoryPicker({mode:mode||"readwrite",id:"qd_"+Date.now()});
}
function bind(route,opt){
  opt=opt||{};
  var c=cfgOf(route);
  var mode=c.rw?"readwrite":"read";
  return pickDir(mode).then(function(handle){
    HC[route]=handle;
    return hPut(route,handle).then(function(){
      c.path=opt.path||c.path||"";
      c.status="ok";
      c.boundAt=nowStr();
      c.seen={}; c.ack=[]; c.idx=[]; c.counts={total:0,new:0,chg:0,gone:0};
      A.save();
      return handle;
    });
  });
}
function unbind(route){
  var c=cfgOf(route);
  c.status="unbound"; c.path=defPath(route);
  c.boundAt=""; c.lastScanAt=""; c.idx=[]; c.seen={}; c.ack=[];
  c.counts={total:0,new:0,chg:0,gone:0};
  delete HC[route];
  A.save();
  hDel(route);
  return true;
}

/* ---------- 目录遍历 ---------- */
function skipName(name){
  if(!name) return true;
  if(TEMP.test(name)) return true;
  if(name==="$RECYCLE.BIN"||name==="System Volume Information") return true;
  return false;
}
function walk(dir,prefix,out,opt){
  return new Promise(function(resolve){
    var it;
    try{ it=dir.entries(); }catch(e){ resolve(out); return; }
    function step(){
      var nx;
      try{ nx=it.next(); }catch(e){ resolve(out); return; }
      Promise.resolve(nx).then(function(res){
        if(!res||res.done){ resolve(out); return; }
        var name=res.value[0], h=res.value[1];
        if(skipName(name)){ step(); return; }
        if(h.kind==="file"){
          if(out.length>=opt.maxFiles){ step(); return; }
          h.getFile().then(function(f){
            out.push({rel:prefix+name,name:name,size:f.size,mt:f.lastModified,dir:prefix,ok:true});
            step();
          }).catch(function(){
            out.push({rel:prefix+name,name:name,size:0,mt:0,dir:prefix,ok:false});
            step();
          });
        }else{
          if(!opt.recurse || opt.depth>=LIM.maxDepth){ step(); return; }
          walk(h,prefix+name+"/",out,{recurse:opt.recurse,depth:opt.depth+1,maxFiles:opt.maxFiles})
            .then(step);
        }
      }).catch(function(){ resolve(out); });
    }
    step();
  });
}
function scanOne(route){
  var c=cfgOf(route);
  if(c.status==="unbound") return Promise.resolve({route:route,skip:true});
  return handleOf(route).then(function(h){
    if(!h){ setStatus(route,"stale"); return {route:route,err:"NO_HANDLE"}; }
    return permOf(h,"read").then(function(p){
      if(p!=="granted"){ setStatus(route,"needauth"); return {route:route,err:"NEEDAUTH"}; }
      return walk(h,"",[],{recurse:!!c.recurse,depth:0,maxFiles:LIM.maxFiles}).then(function(list){
        var prevIdx=(c.idx||[]).slice();
        c.idx=list;
        c.lastScanAt=nowStr();
        recount(c);
        c.status="ok";
        A.save();
        /* 落库后再比对改名/删除，避免中途失败留下半截状态 */
        if(window.IMPORT&&window.IMPORT.onIndexChange){
          setTimeout(function(){
            try{ window.IMPORT.onIndexChange(route,prevIdx,list); }catch(e){ console.warn("差异同步失败",e); }
          },0);
        }
        return {route:route,list:list};
      });
    });
  }).catch(function(e){
    setStatus(route,"stale");
    return {route:route,err:(e&&e.message)||"ERR"};
  });
}
function recount(c){
  var map={},nw=0,chg=0,gone=0;
  (c.idx||[]).forEach(function(e){
    map[e.rel]=1;
    var k=(e.size||0)+"|"+(e.mt||0);
    if(!c.seen[e.rel]) nw++;
    else if(c.seen[e.rel]!==k) chg++;
  });
  Object.keys(c.seen||{}).forEach(function(rel){ if(!map[rel]) gone++; });
  c.counts={total:(c.idx||[]).length,new:nw,chg:chg,gone:gone};
  return c.counts;
}
/* 只扫权限已 granted 的，不弹授权框（用于自动同步） */
function scanAuto(){
  var rs=boundRoutes().filter(function(r){ var s=cfgOf(r).status; return s==="ok"||s==="stale"; });
  if(!rs.length) return Promise.resolve({changed:0,total:0});
  var before=snapshotCounts();
  return seq(rs,function(r){ return scanOne(r); }).then(function(){
    var after=snapshotCounts();
    var changed=after.nw!==before.nw||after.chg!==before.chg||after.total!==before.total||after.gone!==before.gone;
    return {changed:changed?1:0,total:after.total,nw:after.nw,chg:after.chg};
  });
}
function seq(arr,fn){
  var i=0;
  function next(){
    if(i>=arr.length) return Promise.resolve();
    var x=arr[i++];
    return Promise.resolve(fn(x)).then(next,next);
  }
  return next();
}
function snapshotCounts(){
  var s={total:0,nw:0,chg:0,gone:0,bound:0};
  boundRoutes().forEach(function(r){
    var c=cfgOf(r), n=recount(c);
    s.total+=n.total; s.nw+=n.new; s.chg+=n.chg; s.gone+=n.gone; s.bound++;
  });
  return s;
}
function totals(){ return snapshotCounts(); }
function countOf(route){
  var c=cfgOf(route);
  if(!c.idx||!c.idx.length) return {total:0,new:0,chg:0};
  return recount(c);
}

/* ---------- 路径解析（相对路径 → 文件句柄） ---------- */
function resolve(route,rel){
  return handleOf(route).then(function(h){
    if(!h) throw new Error("NO_HANDLE");
    var parts=String(rel||"").split("/").filter(Boolean);
    if(!parts.length) throw new Error("BAD_PATH");
    var cur=Promise.resolve(h);
    parts.slice(0,-1).forEach(function(seg){
      cur=cur.then(function(d){ return d.getDirectoryHandle(seg); });
    });
    return cur.then(function(d){ return d.getFileHandle(parts[parts.length-1]); });
  });
}

/* ---------- 二进制读取：不设体积上限，交给 <img> 自行解码 ---------- */
function readBlob(route,rel){
  return resolve(route,rel).then(function(fh){ return fh.getFile(); });
}

/* ---------- 绝对路径 → 已绑定入口（最长前缀） ---------- */
function normPath(p){
  var s=String(p||"").replace(/\//g,"\\").replace(/\\{2,}/g,"\\");
  return s.replace(/\\+$/,"");
}
/* 返回 Promise<{route,rel,perm}> 或 null；不做授权申请，避免非手势调用 */
function routeByPath(path){
  var raw=normPath(path), p=raw.toLowerCase(), best=null, q=cfgAll();
  if(!p) return Promise.resolve(null);
  Object.keys(q).forEach(function(r){
    var base=normPath(q[r].path).toLowerCase();
    if(!base||/^[a-z]:\\?$/.test(base)) return;
    if(p.indexOf(base+"\\")!==0) return;
    if(best&&base.length<=best.len) return;
    best={route:r,len:base.length,rel:raw.slice(base.length+1).replace(/\\/g,"/")};
  });
  if(!best) return Promise.resolve(null);
  return handleOf(best.route).then(function(h){
    if(!h) return null;
    return permOf(h,"read").then(function(perm){
      return {route:best.route, rel:best.rel, perm:perm};
    });
  });
}

/* ---------- 文本读写（编码 / 换行 / BOM） ---------- */
function decodeBuf(buf){
  var b=new Uint8Array(buf), bom=false, enc="utf-8", text="";
  if(b.length>=3&&b[0]===0xEF&&b[1]===0xBB&&b[2]===0xBF){ bom=true; b=b.subarray(3); }
  else if(b.length>=2&&b[0]===0xFF&&b[1]===0xFE){
    try{ text=new TextDecoder("utf-16le").decode(b.subarray(2)); }catch(e){ text=""; }
    return {text:text,enc:"utf-16le",bom:false};
  }else if(b.length>=2&&b[0]===0xFE&&b[1]===0xFF){
    try{ text=new TextDecoder("utf-16be").decode(b.subarray(2)); }catch(e){ text=""; }
    return {text:text,enc:"utf-16be",bom:false};
  }
  try{
    text=new TextDecoder("utf-8",{fatal:true}).decode(b);
    enc="utf-8";
  }catch(e){
    try{ text=new TextDecoder("gbk").decode(b); enc="gbk"; }
    catch(e2){ text=new TextDecoder("utf-8").decode(b); enc="utf-8"; }
  }
  return {text:text,enc:enc,bom:bom};
}
function eolOf(t){
  if(t.indexOf("\r\n")>=0) return "\r\n";
  if(t.indexOf("\r")>=0) return "\r";
  return "\n";
}
function readText(route,rel){
  return resolve(route,rel).then(function(fh){
    return fh.getFile();
  }).then(function(f){
    if(f.size>LIM.maxText) throw new Error("TOO_BIG");
    return f.arrayBuffer();
  }).then(function(buf){
    var d=decodeBuf(buf);
    return {text:d.text,enc:d.enc,bom:d.bom,eol:eolOf(d.text),size:0};
  });
}
function writeText(route,rel,text,opt){
  opt=opt||{};
  var c=cfgOf(route);
  if(!c.rw) return Promise.reject(new Error("READONLY"));
  return ensurePerm(route,"readwrite").then(function(){
    return resolve(route,rel);
  }).then(function(fh){
    return fh.createWritable().then(function(w){
      var data=text;
      if(opt.eol&&opt.eol!=="\n") data=text.replace(/\r\n|\r|\n/g,opt.eol);
      /* 浏览器没有 UTF-16/GBK 编码器：统一按 UTF-8 写回，需要时保留 BOM */
      var body=new TextEncoder().encode(data);
      var arr=opt.bom?new Uint8Array(body.length+3):body;
      if(opt.bom){ arr[0]=0xEF; arr[1]=0xBB; arr[2]=0xBF; arr.set(body,3); }
      var blob=new Blob([arr],{type:"text/plain;charset=utf-8"});
      return w.write(blob).then(function(){ return w.close(); });
    });
  }).then(function(){
    return scanOne(route);
  }).then(function(){ return true; });
}
/* 整文件替换（docx/xlsx 等二进制） */
function replaceFile(route,rel,file){
  var c=cfgOf(route);
  if(!c.rw) return Promise.reject(new Error("READONLY"));
  return ensurePerm(route,"readwrite").then(function(){
    return resolve(route,rel);
  }).then(function(fh){
    return fh.createWritable().then(function(w){
      return w.write(file).then(function(){ return w.close(); });
    });
  }).then(function(){ return scanOne(route); }).then(function(){ return true; });
}
function createFile(route,rel,blob){
  var c=cfgOf(route);
  if(!c.rw) return Promise.reject(new Error("READONLY"));
  return ensurePerm(route,"readwrite").then(function(){
    return handleOf(route);
  }).then(function(h){
    if(!h) throw new Error("NO_HANDLE");
    return h.getFileHandle(rel,{create:true}).then(function(fh){
      return fh.createWritable().then(function(w){
        return w.write(blob||new Blob([""],{type:"text/plain"})).then(function(){ return w.close(); });
      });
    });
  }).then(function(){ return scanOne(route); }).then(function(){ return true; });
}
function removeEntry(route,rel){
  return ensurePerm(route,"readwrite").then(function(){
    return handleOf(route);
  }).then(function(h){
    if(!h) throw new Error("NO_HANDLE");
    return h.removeEntry(rel);
  }).then(function(){ return scanOne(route); }).then(function(){ return true; });
}

/* ---------- 待确认（新增/变更）与知悉 ---------- */
function pendingOf(route){
  var c=cfgOf(route);
  var out=[];
  (c.idx||[]).forEach(function(e){
    var k=(e.size||0)+"|"+(e.mt||0);
    if(!c.seen[e.rel]) out.push({rel:e.rel,name:e.name,kind:"new",size:e.size,mt:e.mt});
    else if(c.seen[e.rel]!==k) out.push({rel:e.rel,name:e.name,kind:"chg",size:e.size,mt:e.mt});
  });
  return out;
}
/* 只标记知悉（清待确认计数），不写文件中心；opt.silent 时不落库，由调用方合并保存 */
function ack(route,rels,opt){
  var c=cfgOf(route);
  if(!Array.isArray(c.ack)) c.ack=[];
  (c.idx||[]).forEach(function(e){
    if(rels&&rels.length&&rels.indexOf(e.rel)<0) return;
    c.seen[e.rel]=(e.size||0)+"|"+(e.mt||0);
  });
  rels&&rels.forEach(function(r){ if(c.ack.indexOf(r)<0) c.ack.push(r); });
  if(c.ack.length>800) c.ack=c.ack.slice(-800);
  recount(c);
  if(!(opt&&opt.silent)) A.save();
  return true;
}

/* ---------- 确认（= 知悉 + 归档进文件中心） ---------- */
function absOf(route,rel){
  var base=String(cfgOf(route).path||"").replace(/[\\/]+$/,"");
  var rest=String(rel||"").replace(/\//g,"\\");
  return base?(base+"\\"+rest):rest;
}
/* 返回 {ok,n,snap}；snap 供撤销用（记下新增的 id 与被更新记录的原状态） */
function confirmFiles(route,rels,opt){
  opt=opt||{};
  var c=cfgOf(route);
  var ps=pendingOf(route), pend={};
  ps.forEach(function(p){ pend[p.rel]=p; });
  var list=(rels&&rels.length)?rels.slice():ps.map(function(p){ return p.rel; });
  var files=DB().files||(DB().files=[]);
  var snap={route:route,items:[],prevSeen:{},n:0};
  list.forEach(function(rel){
    var p=pend[rel]; if(!p) return;                 /* 已确认过 / 索引里没有：跳过 */
    var mod=typeof opt.mod==="function"?opt.mod(rel):(opt.mod||modOfRoute(route));
    var abs=absOf(route,rel), low=normPath(abs).toLowerCase(), hit=null;
    for(var i=0;i<files.length;i++){
      if(files[i]&&files[i].path&&normPath(files[i].path).toLowerCase()===low){ hit=files[i]; break; }
    }
    if(hit){
      snap.items.push({id:hit.id,isNew:false,prevStatus:hit.status,
        prevStatusAt:hit.statusAt,prevSize:hit.size,prevDate:hit.date});
      hit.status="confirmed"; hit.statusAt=nowStr();
      hit.size=p.size||hit.size; hit.date=dateOf(p.mt)||hit.date;
      hit.route=route; hit.rel=rel;
    }else{
      var id=A.uid("f");
      files.push({
        id:id, name:p.name, size:p.size||0, type:"", module:mod, projectId:"", note:"",
        date:dateOf(p.mt)||A.todayStr(), mode:"path", path:abs, key:"",
        src:"folder", route:route, rel:rel, status:"confirmed", statusAt:nowStr()
      });
      snap.items.push({id:id,isNew:true});
    }
    snap.prevSeen[rel]=c.seen?c.seen[rel]:undefined;
    if(!c.seen) c.seen={};
    c.seen[rel]=(p.size||0)+"|"+(p.mt||0);
    if(!Array.isArray(c.ack)) c.ack=[];
    if(c.ack.indexOf(rel)<0) c.ack.push(rel);
    snap.n++;
  });
  if(!snap.n) return {ok:false,n:0,snap:null};
  if(c.ack.length>800) c.ack=c.ack.slice(-800);
  recount(c);
  if(!opt.silent) A.save();
  /* 确认即触发解析：路径与入口此时已确定，是最佳时机 */
  if(!opt.noImport&&window.IMPORT&&window.IMPORT.enqueue){
    var ids=snap.items.map(function(x){ return x.id; });
    setTimeout(function(){ try{ window.IMPORT.enqueue(ids); }catch(e){} },opt.silent?600:0);
  }
  return {ok:true,n:snap.n,snap:snap};
}
/* 撤销：删掉本次新增的文件记录、还原被更新记录、可选还原 seen 指纹 */
function undoConfirm(snaps,restoreSeen){
  if(!snaps) return 0;
  if(!Array.isArray(snaps)) snaps=[snaps];
  var n=0;
  snaps.forEach(function(s){
    if(!s) return;
    var files=DB().files||[], c=cfgOf(s.route);
    (s.items||[]).forEach(function(it){
      var idx=-1;
      for(var i=0;i<files.length;i++){ if(files[i]&&files[i].id===it.id){ idx=i; break; } }
      if(it.isNew){ if(idx>=0) files.splice(idx,1); }
      else if(idx>=0){
        var f=files[idx];
        if(it.prevStatus===undefined) delete f.status; else f.status=it.prevStatus;
        if(it.prevStatusAt===undefined) delete f.statusAt; else f.statusAt=it.prevStatusAt;
        if(it.prevSize!==undefined) f.size=it.prevSize;
        if(it.prevDate!==undefined) f.date=it.prevDate;
      }
      n++;
    });
    if(restoreSeen!==false&&s.prevSeen){
      if(!c.seen) c.seen={};
      Object.keys(s.prevSeen).forEach(function(rel){
        var v=s.prevSeen[rel];
        if(v===undefined) delete c.seen[rel]; else c.seen[rel]=v;
        if(Array.isArray(c.ack)){
          var j=c.ack.indexOf(rel); if(j>=0) c.ack.splice(j,1);
        }
      });
      recount(c);
    }
  });
  A.save();
  return n;
}
function inboxItems(){
  var out=[];
  boundRoutes().forEach(function(route){
    var c=cfgOf(route);
    var ps=pendingOf(route);
    ps.slice(0,20).forEach(function(p){
      out.push({
        key:"filedir:"+route+":"+p.rel,
        src:"filedir",
        title:(p.kind==="new"?"新文件：":"文件已变更：")+p.name,
        owner:"",
        due:"",
        prio:"P2",
        route:"folder",
        note:(LBL[route]||route)+" · "+p.rel.split("/").slice(0,-1).join("/")+" · "+fmtSize(p.size),
        raw:{route:route,rel:p.rel,name:p.name},
        rawId:route+":"+p.rel,
        act:{l:"确认",verb:"done"}
      });
    });
  });
  return out;
}

/* ---------- 自动同步 ---------- */
var TIMER=null, LAST=0, BUSY=false;
function refreshViews(){
  var r=(location.hash||"").replace(/^#\/?/,"").split("?")[0];
  if(r==="dash"||r==="folder"||r==="space"){
    if(window.render) window.render(r,true);
  }
}
function autoScan(opt){
  opt=opt||{};
  if(BUSY) return Promise.resolve({skip:true});
  if(document.visibilityState!=="visible"&&!opt.force) return Promise.resolve({skip:true});
  BUSY=true;
  var t0=Date.now();
  return scanAuto().then(function(res){
    BUSY=false; LAST=Date.now();
    /* 扫描后若状态从 needauth 变 ok，仍需一次重新渲染 */
    if(res.changed||opt.force) refreshViews();
    return res;
  }).catch(function(e){ BUSY=false; console.warn("文件夹同步失败",e); return {err:1}; });
}
function startWatch(){
  if(TIMER) clearInterval(TIMER);
  TIMER=setInterval(function(){
    if(document.visibilityState!=="visible") return;
    if(Date.now()-LAST<55000) return;
    autoScan({});
  },60000);
  document.addEventListener("visibilitychange",function(){
    if(document.visibilityState==="visible") autoScan({});
  });
  window.addEventListener("focus",function(){
    if(Date.now()-LAST>20000) autoScan({});
  });
}
/* 首次进入：恢复句柄并检查权限（不弹窗） */
function restore(){
  var rs=boundRoutes();
  if(!rs.length) return Promise.resolve();
  return seq(rs,function(route){
    var c=cfgOf(route);
    return handleOf(route).then(function(h){
      if(!h){ if(c.status==="ok") { c.status="stale"; A.save(); } return; }
      return permOf(h,"read").then(function(p){
        if(p==="granted") return scanOne(route);
        if(c.status!=="unbound"){ c.status="needauth"; A.save(); }
      });
    });
  });
}

/* ---------- 错误文案 ---------- */
function errText(e){
  var m=(e&&e.message)||String(e||"");
  if(m==="NO_HANDLE") return "尚未授权该文件夹，请先点「授权文件夹」";
  if(m==="NEEDAUTH") return "访问权限已失效，请点「重新授权」";
  if(m==="DENIED") return "授权被拒绝，无法读写该文件夹";
  if(m==="READONLY") return "该入口为只读绑定，不能写回。可在绑定设置中改为读写";
  if(m==="TOO_BIG") return "文件超过 2 MB，不提供站内编辑";
  if(m==="BAD_PATH") return "文件路径无效";
  if(m==="NO_PICKER") return "当前浏览器不支持目录授权，请用 Edge 或 Chrome 打开本文件";
  if(/AbortError/.test(m)) return "";
  if(/NotAllowedError|SecurityError/.test(m)) return "浏览器拒绝了该操作，请重新点击按钮（需要在页面内直接点击）";
  if(/NoModificationAllowedError|NotReadableError|InvalidStateError/.test(m))
    return "文件正被其他程序占用（如 Word 已打开），请先关闭再保存";
  if(/NotFoundError/.test(m)) return "文件或文件夹已不存在，可能已改名或删除";
  if(/QuotaExceededError/.test(m)) return "磁盘空间不足";
  if(/TypeMismatchError/.test(m)) return "目标不是文件（可能被同名文件夹占用）";
  return "操作失败："+(m||"未知错误");
}

/* ---------- 导出 ---------- */
window.QD={
  LIM:LIM, LBL:LBL, DEF_MAP:DEF_MAP, MOD_ROUTE:MOD_ROUTE, ROUTE_MOD:ROUTE_MOD, modOfRoute:modOfRoute,
  cfgAll:cfgAll, cfgOf:cfgOf, listAll:listAll, isBound:isBound, boundRoutes:boundRoutes,
  guardPath:guardPath, nameOfPath:nameOfPath, fmtSize:fmtSize, dateOf:dateOf, extOf:extOf, isText:isText,
  IMG_EXT:IMG_EXT, IMG_MIME:IMG_MIME, isImg:isImg, readBlob:readBlob, routeByPath:routeByPath, normPath:normPath,
  bind:bind, unbind:unbind, handleOf:handleOf, ensurePerm:ensurePerm, permOf:permOf,
  scanOne:scanOne, scanAuto:scanAuto, restore:restore, startWatch:startWatch, autoScan:autoScan,
  totals:totals, countOf:countOf, pendingOf:pendingOf, ack:ack, inboxItems:inboxItems,
  confirmFiles:confirmFiles, undoConfirm:undoConfirm, absOf:absOf,
  readText:readText, writeText:writeText, replaceFile:replaceFile, createFile:createFile,
  removeEntry:removeEntry, resolve:resolve, errText:errText, nowStr:nowStr,
  _decode:decodeBuf, migrate:migrate, fixPath:fixPath, ROOT:ROOT_PATH, DEF:DEF_MAP,
  _recount:recount,
  _setHandle:function(route,h){ HC[route]=h; }
};

/* ---------- 启动 ---------- */
(function(){
  var old=window.onBoot;
  window.onBoot=function(){
    if(old) old();
    try{
      migrate();
      cfgAll();
      restore().then(startWatch);
    }catch(e){ console.warn("快速入口文件夹初始化失败",e); }
  };
})();
})();
