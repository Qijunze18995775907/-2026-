/* ===== 工作空间站：本地文件夹扫描 → 规则识别 → 确认归档 ===== */
(function(){
"use strict";
var A=window.APP, $=A.$, $$=A.$$, esc=A.esc;
function DB(){return A.db;}

/* 与文件中心保持一致的模块口径 */
var MODULES=["综合","计划看板","质量会议","质量培训","质量活动统计","在建项目","QC 活动","质量检查",
             "方案内审","技术交底","风险识别","质量管理机构","作业指导书","办法制度"];
var MOD_ROUTE={
  "综合":"files","计划看板":"plan","质量会议":"meeting","质量培训":"training","质量活动统计":"stats",
  "在建项目":"projects","QC 活动":"qc","质量检查":"inspect","方案内审":"review","技术交底":"brief",
  "风险识别":"brief","质量管理机构":"org","作业指导书":"guide","办法制度":"policy"
};
var ROUTE_MOD={
  meeting:["质量会议"], training:["质量培训"], stats:["质量活动统计"], qc:["QC 活动"], review:["方案内审"],
  org:["质量管理机构"], guide:["作业指导书"], policy:["办法制度"], projects:["在建项目"],
  inspect:["质量检查"], brief:["技术交底","风险识别"], plan:["计划看板"]
};

/* ---------- 内置规则（贴合新台账目录 15 个编号子目录） ---------- */
var DEFAULT_DIR=[
  /* 新台账的 15 个编号目录：具体规则前置，先命中先赢 */
  ["三位一体","办法制度"],["信用中国","质量活动统计"],["质量月","质量活动统计"],
  ["分包","在建项目"],["满意度","在建项目"],["开竣工验收","在建项目"],["竣工验收","在建项目"],
  ["质量管理人员配置","质量管理机构"],
  ["质量会议","质量会议"],["会议纪要","质量会议"],["会议","质量会议"],["纪要","质量会议"],
  ["质量培训","质量培训"],["培训","质量培训"],["学习","质量培训"],
  ["质量检查","质量检查"],["检查","质量检查"],["巡查","质量检查"],["整改","质量检查"],
  ["方案内审","方案内审"],["方案","方案内审"],["内审","方案内审"],
  ["技术交底","技术交底"],["交底","技术交底"],
  ["风险","风险识别"],["危险源","风险识别"],["隐患","风险识别"],
  ["QC","QC 活动"],["qc","QC 活动"],["课题","QC 活动"],
  ["作业指导书","作业指导书"],["指导书","作业指导书"],
  ["管理办法","办法制度"],["制度","办法制度"],["办法","办法制度"],["体系文件","办法制度"],
  ["质量管理机构","质量管理机构"],["机构","质量管理机构"],["人员","质量管理机构"],
  ["在建项目","在建项目"],["项目","在建项目"],["合同","在建项目"],
  ["质量活动统计","质量活动统计"],["统计","质量活动统计"],["月报","质量活动统计"],["报表","质量活动统计"],
  ["计划","计划看板"],["要点","计划看板"],["目标","计划看板"]
];
var DEFAULT_KW=[
  ["会议纪要","质量会议",1],["纪要","质量会议",1],["签到表","质量培训",1],["培训记录","质量培训",1],
  ["整改回复","质量检查",1],["整改通知","质量检查",1],["检查记录","质量检查",1],["检查表","质量检查",2],
  ["内审意见","方案内审",1],["审查意见","方案内审",1],["内审","方案内审",2],["专项方案","方案内审",3],
  ["交底记录","技术交底",1],["交底","技术交底",2],
  ["危险源","风险识别",1],["风险识别","风险识别",1],["隐患排查","风险识别",2],
  ["QC","QC 活动",1],["PDCA","QC 活动",2],["课题","QC 活动",2],
  ["作业指导书","作业指导书",1],["管理办法","办法制度",1],["管理制度","办法制度",1],["实施细则","办法制度",2],
  ["组织机构","质量管理机构",2],["岗位职责","质量管理机构",2],
  ["监理月报","质量活动统计",1],["统计表","质量活动统计",1],["月报","质量活动统计",2],
  ["年度计划","计划看板",2],["工作要点","计划看板",2]
];
function newId(p){ return A.uid(p||"r"); }
function defDir(){ return DEFAULT_DIR.map(function(x){return {id:newId("d"),dir:x[0],module:x[1]};}); }
function defKw(){ return DEFAULT_KW.map(function(x){return {id:newId("k"),kw:x[0],module:x[1],prio:x[2]};}); }

function wsCfg(){
  var db=DB();
  if(!db.settings) db.settings={};
  var w=db.settings.ws;
  if(!w||typeof w!=="object") w=db.settings.ws={};
  if(typeof w.root!=="string"||!w.root) w.root="E:\\workbuddy 缓存\\workbuddy\\总工作台\\raw\\a资源\\2026公司质量管理台账";
  if(!Array.isArray(w.dirRules)||!w.dirRules.length) w.dirRules=defDir();
  if(!Array.isArray(w.kwRules)||!w.kwRules.length) w.kwRules=defKw();
  if(!w.lastScan||typeof w.lastScan!=="object") w.lastScan={at:"",count:0,snap:{}};
  if(!w.lastScan.snap||typeof w.lastScan.snap!=="object") w.lastScan.snap={};
  if(!Array.isArray(db.wsBatches)) db.wsBatches=[];
  return w;
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
  if(!n&&n!==0) return "—";
  if(n<1024) return n+" B";
  if(n<1048576) return (n/1024).toFixed(1)+" KB";
  return (n/1048576).toFixed(2)+" MB";
}
function extOf(name){
  var m=/\.([a-z0-9]+)$/i.exec(name||"");
  return m?m[1].toUpperCase():"FILE";
}
function joinPath(root,rel){
  var r=String(root||"").replace(/[\\/]+$/,"");
  var p=String(rel||"").replace(/\//g,"\\");
  return r? r+"\\"+p : p;
}
function cleanName(s){ return String(s||"").toLowerCase().replace(/\s+/g,""); }

/* ---------- 项目别名（弱匹配，只作提示） ---------- */
var ADMIN=/湖北省|黄石市|鄂州市|恩施州|宜昌市|黄冈市|大冶市|阳新县|罗田县|建始县|铁山区|西塞山区|鄂城区|夷陵区|黄石港区|下陆区/g;
function projAliases(){
  var out=[];
  (DB().projects||[]).forEach(function(p){
    var base=String(p.name||"").replace(ADMIN,"").replace(/[（）()、，,。\s]/g,"");
    var segs=base.split(/[县市区镇村组路及和等]/);
    var al=[];
    segs.forEach(function(s){
      if(s.length>=2) al.push(s.slice(0,4));
      if(s.length>=4) al.push(s.slice(0,3));
    });
    al.push(base.slice(0,3),base.slice(0,4),base.slice(0,5));
    al=al.filter(function(s){ return s.length>=2; });
    out.push({id:p.id,name:p.name,aliases:al});
  });
  return out;
}
function guessProject(text,pool){
  var t=String(text||"");
  var best=null,bestLen=0;
  pool.forEach(function(p){
    p.aliases.forEach(function(a){
      if(a.length>bestLen && t.indexOf(a)>=0){ best=p.id; bestLen=a.length; }
    });
  });
  return best||"";
}
function periodNote(s){
  var y=/(20\d{2})/.exec(s), m=/(\d{1,2})\s*月/.exec(s), out="";
  if(y) out+=y[1]+"年";
  if(m) out+=(+m[1])+"月";
  return out;
}

/* ---------- 识别引擎 ---------- */
function recognize(item,pool,cfg){
  cfg=cfg||wsCfg();
  var name=item.name, rel=item.rel;
  var dirs=rel.split("/").slice(0,-1);
  var hit="", module="", conf="";

  /* 1 目录映射：由深到浅，先精确、后包含 */
  var dirRules=cfg.dirRules||[];
  var i,j;
  for(i=dirs.length-1;i>=0&&!module;i--){
    for(j=0;j<dirRules.length;j++){
      if(dirs[i]===dirRules[j].dir){ module=dirRules[j].module; hit="目录「"+dirs[i]+"」"; conf="high"; break; }
    }
  }
  if(!module){
    for(i=dirs.length-1;i>=0&&!module;i--){
      for(j=0;j<dirRules.length;j++){
        if(dirs[i].indexOf(dirRules[j].dir)>=0){ module=dirRules[j].module; hit="目录「"+dirs[i]+"」"; conf="high"; break; }
      }
    }
  }

  /* 2 关键词：优先级高的先命中 */
  if(!module){
    var kws=(cfg.kwRules||[]).slice().sort(function(a,b){return (a.prio||2)-(b.prio||2);});
    var low=String(name||"").toLowerCase();
    for(i=0;i<kws.length;i++){
      if(kws[i].kw && low.indexOf(String(kws[i].kw).toLowerCase())>=0){
        module=kws[i].module; hit="关键词「"+kws[i].kw+"」"; conf="mid"; break;
      }
    }
  }

  /* 3 项目 + 期间（与模块判定并行） */
  var projectId=guessProject(rel+" "+name,pool);
  var note=periodNote(rel+" "+name);

  return {module:module,conf:conf||"low",hit:hit||"未命中规则",projectId:projectId,note:note};
}

/* ---------- 扫描结果状态 ---------- */
var ST={rows:[],snap:{},scanned:false,f:"all",q:"",open:{},rootName:"",ignored:0,gone:0,last:null};

var TEMP=/^(~\$|\.|thumbs\.db$|desktop\.ini$)/i;
function isTemp(name){ return TEMP.test(name)||/\.tmp$/i.test(name); }

function buildRows(fileList){
  var pool=projAliases();
  var cfg=wsCfg();
  var prev=(cfg.lastScan&&cfg.lastScan.snap)||{};
  var exist=DB().files||[];
  var relSet={},nameSize={};
  exist.forEach(function(f){
    if(f.rel) relSet[f.rel]=1;
    nameSize[(f.name||"")+"|"+(f.size||0)]=1;
  });

  var rows=[],snap={},rootName="",ignored=0;
  var arr=Array.prototype.slice.call(fileList||[]);
  for(var i=0;i<arr.length;i++){
    var f=arr[i];
    var rel=String(f.webkitRelativePath||f.name||"").replace(/\\/g,"/");
    if(rel.indexOf("/")>=0){
      var seg=rel.split("/");
      rootName=rootName||seg[0];
      rel=seg.slice(1).join("/");
    }
    var base=rel.split("/").pop();
    if(!base||isTemp(base)){ ignored++; continue; }
    var size=f.size||0, mt=f.lastModified||0;
    var key=size+"|"+mt;
    snap[rel]=key;
    var it={rel:rel,name:base,size:size,mt:mt,ext:extOf(base)};
    var r=recognize(it,pool,cfg);
    var dup = !!relSet[rel] || !!nameSize[base+"|"+size];
    var state = !prev[rel] ? "new" : (prev[rel]!==key ? "changed" : "same");
    rows.push({
      id:"r"+i, rel:rel, name:base, size:size, mt:mt, ext:it.ext,
      module:r.module, projectId:r.projectId, conf:r.conf, hit:r.hit, note:r.note,
      dup:dup, state:state,
      sel:!dup && !!r.module
    });
  }
  var gone=Object.keys(prev).filter(function(k){ return !snap[k]; }).length;
  ST.rows=rows; ST.snap=snap; ST.rootName=rootName; ST.ignored=ignored; ST.gone=gone; ST.scanned=true;
  ST.f="all"; ST.q=""; ST.open={};
  ST.rows.forEach(function(r){ if(!ST.open[r.module||"?"]) ST.open[r.module||"?"]=true; });
  ST.open["?"]=false;
}

/* ---------- 扫描入口 ---------- */
function pickFolder(){
  var inp=$("#wsDirInput");
  if(!inp){ toast("页面未就绪，请稍后重试","err"); return; }
  inp.value="";
  inp.click();
}
/* 拖入文件夹：不依赖文件选择弹窗，走 DirectoryEntry 递归读取 */
function readEntry(entry,path,out,cb){
  if(!entry){ cb(); return; }
  if(entry.isFile){
    entry.file(function(f){
      out.push({name:f.name,size:f.size,lastModified:f.lastModified,
                webkitRelativePath:(path+entry.name)});
      cb();
    },function(){ cb(); });
    return;
  }
  if(entry.isDirectory){
    var reader=entry.createReader();
    (function batch(){
      reader.readEntries(function(list){
        if(!list||!list.length){ cb(); return; }
        var n=list.length,done=0;
        list.forEach(function(e){
          readEntry(e,path+entry.name+"/",out,function(){
            if(++done>=n) batch();
          });
        });
      },function(){ cb(); });
    })();
    return;
  }
  cb();
}
function handleDrop(e){
  var dt=e.dataTransfer;
  if(!dt) return;
  var entries=[],files=[];
  if(dt.items&&dt.items.length){
    for(var i=0;i<dt.items.length;i++){
      var it=dt.items[i];
      if(it.kind!=="file") continue;
      var en=it.webkitGetAsEntry?it.webkitGetAsEntry():null;
      if(en) entries.push(en); else if(it.getAsFile) files.push(it.getAsFile());
    }
  }
  if(!entries.length&&!files.length){
    if(dt.files&&dt.files.length) files=Array.prototype.slice.call(dt.files);
  }
  if(!entries.length){
    if(!files.length){ toast("没有识别到文件","err"); return; }
    handlePicked({files:files}); return;
  }
  toast("正在读取文件夹…","ok");
  var out=[],done=0;
  entries.forEach(function(en){
    readEntry(en,"",out,function(){
      if(++done>=entries.length){
        if(!out.length){ toast("文件夹里没有可读取的文件","err"); return; }
        if(out.length>1200){ toast("一次最多处理 1200 个文件，请拖入更小的子目录","err"); return; }
        buildRows(out);
        A.save();
        window.render("space");
        toast("已扫描 "+ST.rows.length+" 个文件","ok");
      }
    });
  });
}
function handlePicked(input){
  var files=input.files;
  if(!files||!files.length) return;
  if(files.length>1200){ toast("一次最多处理 1200 个文件，请选择更小的子目录","err"); return; }
  var cfg=wsCfg();
  if(files[0] && !files[0].webkitRelativePath){
    toast("未取得目录结构，已按文件名识别","err");
  }
  buildRows(files);
  cfg.lastRoot=ST.rootName||"";
  A.save();
  window.render("space");
  toast("已扫描 "+ST.rows.length+" 个文件","ok");
}

/* ---------- 页面 ---------- */
window.regPage("space",{
  sub:"链接本地文件夹，按规则识别后一键分配到各功能空间（原件不动）",
  render:function(host){
    var cfg=wsCfg();
    var last=cfg.lastScan||{};
    var ruleN=(cfg.dirRules||[]).length+(cfg.kwRules||[]).length;
    var batchN=(DB().wsBatches||[]).length;

    var h='';

    /* ① 站设置 */
    h+='<div class="card" style="margin-bottom:14px"><div class="card-h">'+
      '<h3>工作站设置</h3><span class="hint">选择文件夹后自动列出全部文件与子目录</span></div>'+
      '<div class="card-b">'+
      '<div class="ws-setup">'+
        '<div class="field" style="flex:1;min-width:220px"><label for="wsRoot">本地根目录（用于拼出完整路径）</label>'+
          '<input type="text" id="wsRoot" value="'+esc(cfg.root)+'" placeholder="E:\\workbuddy 缓存\\workbuddy\\总工作台\\raw\\a资源\\2026公司质量管理台账"></div>'+
        '<div class="ws-btns">'+
          '<button class="btn primary" id="wsPick">选择文件夹并扫描</button>'+
          '<button class="btn" id="wsRules">识别规则</button>'+
          '<button class="btn" id="wsBatches">归档批次</button>'+
        '</div>'+
      '</div>'+
      '<div class="ws-stat">'+
        '<span>上次扫描：<b>'+(last.at?esc(last.at):"尚未扫描")+'</b></span>'+
        '<span>已扫描文件：<b>'+(last.count||0)+'</b> 个</span>'+
        '<span>识别规则：<b>'+ruleN+'</b> 条</span>'+
        '<span>归档批次：<b>'+batchN+'</b> 批</span>'+
      '</div>'+
      '<div class="ws-tip">'+
        '浏览器只能读取你手动选中的文件夹，不会后台监听。每次点「选择文件夹并扫描」，系统会与上次快照对比，标出新增、变更与已消失的文件；'+
        '确认归档时只登记路径索引，<b>不回写、不移动、不删除</b> E 盘原件。'+
      '</div>'+
      '<div class="ws-drop" id="wsDrop">'+
        '<div class="ws-drop-t">也可以直接把「2026公司质量管理台账」文件夹拖到这里</div>'+
        '<div class="ws-drop-d">拖入后自动递归读取全部子目录，效果与点按钮相同</div>'+
      '</div>'+
      '<input type="file" id="wsDirInput" webkitdirectory directory multiple style="display:none">'+
      '</div></div>';

    /* ② 扫描结果 */
    if(ST.scanned){
      var stat=statOf();
      h+='<div class="card" style="margin-bottom:14px"><div class="card-h">'+
        '<h3>识别结果</h3><span class="hint">'+(ST.rootName?("来源文件夹："+esc(ST.rootName)):"")+'</span><div class="spacer"></div>'+
        '<button class="btn" id="wsCsv">导出识别清单</button>'+
        '<button class="btn" id="wsRescan">重新扫描</button>'+
        '</div>'+
        '<div class="card-b" style="padding:12px 16px 0">'+
          '<div class="ws-figs">'+
            '<div class="ws-fig"><b>'+stat.total+'</b><span>本次文件</span></div>'+
            '<div class="ws-fig"><b class="c-green">'+stat.newN+'</b><span>新增</span></div>'+
            '<div class="ws-fig"><b class="c-amber">'+stat.chg+'</b><span>变更</span></div>'+
            '<div class="ws-fig"><b class="c-muted">'+stat.same+'</b><span>无变化</span></div>'+
            '<div class="ws-fig"><b class="c-red">'+stat.dup+'</b><span>已归档过</span></div>'+
            '<div class="ws-fig"><b class="c-red">'+stat.none+'</b><span>未识别</span></div>'+
            (ST.gone?'<div class="ws-fig"><b class="c-muted">'+ST.gone+'</b><span>已消失</span></div>':'')+
            (ST.ignored?'<div class="ws-fig"><b class="c-muted">'+ST.ignored+'</b><span>已忽略</span></div>':'')+
          '</div>'+
          '<div class="ws-tool">'+
            '<div class="search"><input type="search" id="wsQ" placeholder="搜索文件名或路径…" value="'+esc(ST.q)+'"></div>'+
            '<select id="wsFilter">'+
              [["all","全部文件"],["new","仅新增"],["changed","仅变更"],["none","仅未识别"],["dup","仅已归档"]]
                .map(function(x){return '<option value="'+x[0]+'"'+(ST.f===x[0]?" selected":"")+'>'+x[1]+'</option>';}).join("")+
            '</select>'+
            '<div class="spacer"></div>'+
            '<button class="btn sm" id="wsSelAll">全选可归档</button>'+
            '<button class="btn sm" id="wsSelNone">清空选择</button>'+
          '</div>'+
        '</div>'+
        '<div id="wsList"></div>'+
        '<div class="ws-act">'+
          '<div class="ws-act-txt">已选 <b id="wsCount">0</b> 项 · 合计 <span id="wsSize">0</span>'+
            '<span class="ws-act-sub" id="wsHint"></span></div>'+
          '<label class="ws-chk"><input type="checkbox" id="wsSolid"> 把本次人工修改固化为规则</label>'+
          '<button class="btn" id="wsCancel">放弃本次</button>'+
          '<button class="btn primary" id="wsArchive">确认归档</button>'+
        '</div>'+
        '</div>';
    }else{
      h+='<div class="card" style="margin-bottom:14px"><div class="card-b">'+
        '<div class="ws-empty">'+
          '<div class="ws-empty-ic">⬓</div>'+
          '<div class="ws-empty-t">还没有扫描记录</div>'+
          '<div class="ws-empty-d">点上面「选择文件夹并扫描」，选中 <b>E:\\workbuddy 缓存\\workbuddy\\总工作台\\raw\\a资源\\2026公司质量管理台账</b>（或任意子目录），'+
          '系统会按目录与文件名自动判断每个文件该进哪个功能空间，确认后一键归档。</div>'+
          '<button class="btn primary" id="wsPick2" style="margin-top:12px">选择文件夹并扫描</button>'+
        '</div></div></div>';
    }

    /* ③ 流程说明 */
    h+='<div class="grid g3">'+
      '<div class="card"><div class="card-b ws-step"><div class="ws-num">1</div><div><b>链接文件夹</b>'+
        '<p>选中本地目录，读取文件名、子目录、大小与修改时间。文件内容不上传、不外发。</p></div></div></div>'+
      '<div class="card"><div class="card-b ws-step"><div class="ws-num">2</div><div><b>确认识别结果</b>'+
        '<p>按「目录 → 模块、关键词 → 模块」匹配，每行都写明命中理由，可逐条改派或跳过。</p></div></div></div>'+
      '<div class="card"><div class="card-b ws-step"><div class="ws-num">3</div><div><b>归档到功能空间</b>'+
        '<p>写入对应台账与文件中心，生成可撤销的批次；同一份文件不会重复归档。</p></div></div></div>'+
    '</div>';

    host.innerHTML=h;

    var rootEl=$("#wsRoot",host);
    rootEl.onchange=function(){
      wsCfg().root=this.value.trim();
      A.save();
      toast("根目录已保存","ok");
    };
    $("#wsPick",host)&&($("#wsPick",host).onclick=pickFolder);
    $("#wsPick2",host)&&($("#wsPick2",host).onclick=pickFolder);
    $("#wsRules",host).onclick=openRules;
    $("#wsBatches",host).onclick=openBatches;
    var inp=$("#wsDirInput",host);
    if(inp) inp.onchange=function(){ handlePicked(this); };
    var dz=$("#wsDrop",host);
    if(dz){
      dz.onclick=pickFolder;
      dz.addEventListener("dragover",function(e){ e.preventDefault(); dz.classList.add("over"); });
      dz.addEventListener("dragleave",function(){ dz.classList.remove("over"); });
      dz.addEventListener("drop",function(e){
        e.preventDefault(); dz.classList.remove("over"); handleDrop(e);
      });
    }

    /* 扫描结果区交互 */
    if(ST.scanned){
      $("#wsList",host)&&paintList(host);
      var q=$("#wsQ",host);
      if(q) q.oninput=function(){ ST.q=this.value; paintList(host); };
      var flt=$("#wsFilter",host);
      if(flt) flt.onchange=function(){ ST.f=this.value; paintList(host); };
      $("#wsSelAll",host).onclick=function(){
        ST.rows.forEach(function(r){ if(!r.dup&&r.module) r.sel=true; });
        paintList(host);
      };
      $("#wsSelNone",host).onclick=function(){ ST.rows.forEach(function(r){ r.sel=false; }); paintList(host); };
      $("#wsRescan",host).onclick=pickFolder;
      $("#wsCsv",host).onclick=exportScanCSV;
      $("#wsCancel",host).onclick=function(){
        ST.scanned=false; ST.rows=[]; window.render("space");
      };
      $("#wsArchive",host).onclick=archive;
    }
  }
});

/* ---------- 统计 ---------- */
function statOf(){
  var s={total:ST.rows.length,newN:0,chg:0,same:0,dup:0,none:0};
  ST.rows.forEach(function(r){
    if(r.state==="new") s.newN++;
    else if(r.state==="changed") s.chg++;
    else s.same++;
    if(r.dup) s.dup++;
    if(!r.module) s.none++;
  });
  return s;
}
function visibleRows(){
  var q=ST.q?cleanName(ST.q):"";
  return ST.rows.filter(function(r){
    if(ST.f==="new"&&r.state!=="new") return false;
    if(ST.f==="changed"&&r.state!=="changed") return false;
    if(ST.f==="none"&&r.module) return false;
    if(ST.f==="dup"&&!r.dup) return false;
    if(q && cleanName(r.name+r.rel).indexOf(q)<0) return false;
    return true;
  });
}

/* ---------- 结果列表 ---------- */
function paintList(host){
  var box=$("#wsList",host); if(!box) return;
  var rows=visibleRows();
  var scroll=$(".ws-scroll",host);

  if(!rows.length){
    box.innerHTML='<div class="empty">没有符合筛选条件的文件</div>';
    syncAct(host);
    return;
  }

  /* 分组：按模块顺序 + 待定 */
  var order=MODULES.concat(["?"]);
  var groups={};
  rows.forEach(function(r){ var k=r.module||"?"; (groups[k]=groups[k]||[]).push(r); });

  var h="";
  order.forEach(function(k){
    var arr=groups[k]; if(!arr||!arr.length) return;
    var open=ST.open[k]!==false;
    var selN=arr.filter(function(r){return r.sel;}).length;
    h+='<div class="ws-grp">'+
      '<div class="ws-grp-h" data-grp="'+esc(k)+'">'+
        '<span class="ws-caret">'+(open?"▾":"▸")+'</span>'+
        '<b>'+(k==="?"?"待定（未识别）":esc(k))+'</b>'+
        '<span class="n">'+arr.length+' 个'+(selN?" · 已选 "+selN:"")+'</span>'+
        '<span class="spacer"></span>'+
        '<span class="ws-grp-go">'+(MOD_ROUTE[k]?'<button class="btn sm ghost" data-go="'+MOD_ROUTE[k]+'">进入模块</button>':'')+'</span>'+
      '</div>';
    if(open){
      h+='<div class="ws-rows">'+arr.map(rowHTML).join("")+'</div>';
    }
    h+='</div>';
  });
  box.innerHTML='<div class="ws-scroll">'+h+'</div>';

  if(scroll){ var st=scroll.scrollTop; var n=$(".ws-scroll",host); if(n) n.scrollTop=st; }

  $$("[data-grp]",box).forEach(function(el){
    el.onclick=function(e){
      if(e.target.closest("[data-go]")) return;
      var k=this.getAttribute("data-grp");
      ST.open[k]=ST.open[k]===false;
      paintList(host);
    };
  });
  $$("[data-go]",box).forEach(function(b){ b.onclick=function(e){ e.stopPropagation(); location.hash="#/"+this.getAttribute("data-go"); }; });
  $$("[data-pick]",box).forEach(function(c){
    c.onchange=function(){
      var r=rowById(this.getAttribute("data-pick")); if(r) r.sel=this.checked;
      paintList(host);
    };
  });
  $$("[data-mod]",box).forEach(function(s){
    s.onchange=function(){
      var r=rowById(this.getAttribute("data-mod")); if(!r) return;
      r.module=this.value;
      r.sel=!!this.value && !r.dup;
      r.hit=this.value?"人工指定为「"+this.value+"」":"未指定";
      r.conf=this.value?"manual":"low";
      r.manual=true;
      if(!r.module) ST.open["?"]=true;
      paintList(host);
    };
  });
  $$("[data-proj]",box).forEach(function(s){
    s.onchange=function(){ var r=rowById(this.getAttribute("data-proj")); if(r) r.projectId=this.value; };
  });
  $$("[data-skip]",box).forEach(function(b){
    b.onclick=function(){ var r=rowById(this.getAttribute("data-skip")); if(r){ r.sel=false; r.skipped=true; paintList(host); } };
  });
  syncAct(host);
}

function rowById(id){ return ST.rows.filter(function(r){return r.id===id;})[0]; }

function rowHTML(r){
  var confTag = r.conf==="high"?'<span class="tag t-green">高</span>'
    : r.conf==="mid"?'<span class="tag t-amber">中</span>'
    : r.conf==="manual"?'<span class="tag t-p2">人工</span>'
    : '<span class="tag t-red">待定</span>';
  var stateTag = r.state==="new"?'<span class="tag t-p2">新增</span>'
    : r.state==="changed"?'<span class="tag t-amber">变更</span>'
    : '<span class="tag t-gray">无变化</span>';
  var dupTag = r.dup?'<span class="tag t-gray">已归档过</span>':'';

  return '<div class="ws-row'+(r.sel?" sel":"")+(r.dup?" dup":"")+'" data-row="'+esc(r.id)+'">'+
    '<input type="checkbox" class="ws-cb" data-pick="'+esc(r.id)+'"'+(r.sel?" checked":"")+'>'+
    '<div class="ws-ext">'+esc(r.ext.slice(0,4))+'</div>'+
    '<div class="ws-main">'+
      '<div class="ws-name" title="'+esc(r.rel)+'">'+esc(r.name)+'</div>'+
      '<div class="ws-meta">'+esc(r.rel)+' · '+fmtSize(r.size)+' · '+dateOf(r.mt)+
        (r.note?' · '+esc(r.note):'')+'</div>'+
      '<div class="ws-why">'+confTag+' <span>'+esc(r.hit)+'</span> '+stateTag+' '+dupTag+'</div>'+
    '</div>'+
    '<div class="ws-op">'+
      '<select data-mod="'+esc(r.id)+'">'+
        '<option value=""'+(r.module?"":" selected")+'>— 待定 —</option>'+
        MODULES.map(function(m){return '<option'+(r.module===m?" selected":"")+'>'+esc(m)+'</option>';}).join("")+
      '</select>'+
      '<select data-proj="'+esc(r.id)+'">'+
        '<option value="">— 不关联项目 —</option>'+
        (DB().projects||[]).map(function(p){return '<option value="'+esc(p.id)+'"'+(r.projectId===p.id?" selected":"")+'>'+esc(p.name.slice(0,16))+'</option>';}).join("")+
      '</select>'+
    '</div>'+
  '</div>';
}

function syncAct(host){
  var sel=ST.rows.filter(function(r){return r.sel&&r.module;});
  var size=sel.reduce(function(s,r){return s+(r.size||0);},0);
  var none=ST.rows.filter(function(r){return !r.module;}).length;
  var el=$("#wsCount",host); if(el) el.textContent=sel.length;
  el=$("#wsSize",host); if(el) el.textContent=fmtSize(size);
  el=$("#wsHint",host);
  if(el) el.textContent = none? ("另有 "+none+" 个未识别，可在行内指定模块后再勾选") : "";
  el=$("#wsArchive",host);
  if(el) el.disabled = sel.length===0;
}

/* ---------- 归档 ---------- */
function archive(){
  var sel=ST.rows.filter(function(r){return r.sel&&r.module;});
  if(!sel.length){ toast("请先勾选要归档的文件","err"); return; }
  var cfg=wsCfg();
  var root=String(cfg.root||"").trim();
  var byMod={};
  sel.forEach(function(r){ byMod[r.module]=(byMod[r.module]||0)+1; });
  var summary=Object.keys(byMod).map(function(k){
    return '<div style="display:flex;font-size:12.5px;padding:4px 0;border-bottom:1px dashed #eef1f5">'+
      '<span>'+esc(k)+'</span><span style="margin-left:auto;font-weight:700">'+byMod[k]+' 个</span></div>';
  }).join("");

  openModal({
    title:"确认归档 · "+sel.length+" 个文件",
    okText:"确认归档",
    body:'<p style="margin:0 0 10px;font-size:13px">以下文件将登记到对应模块，并写入文件中心：</p>'+
      '<div style="max-height:180px;overflow:auto;margin-bottom:12px">'+summary+'</div>'+
      '<div class="field"><label>路径前缀</label>'+
        '<input type="text" id="ckRoot" value="'+esc(root)+'" placeholder="E:\\workbuddy 缓存\\workbuddy\\总工作台\\raw\\a资源\\2026公司质量管理台账"></div>'+
      '<div style="margin-top:12px;font-size:12px;color:var(--muted);line-height:1.7">'+
        '· 归档后记录为<b style="color:#b9770e">待确认</b>状态，请在文件中心或项目页逐条确认归属；<br>'+
        '· 只登记路径索引，原件不会被移动、改名或删除；<br>'+
        '· 归档后可在「文件中心」按模块筛选，或在本页「归档批次」中整批撤销；<br>'+
        '· 未勾选「固化为规则」时，本次人工改派只对当前文件生效。</div>',
    onOk:function(scope){
      var useRoot=$("#ckRoot",scope).value.trim();
      execArchive(sel,useRoot,$("#wsSolid")&&$("#wsSolid").checked);
      return true;
    }
  });
}

function execArchive(sel,root,solidify){
  var cfg=wsCfg();
  if(root){ cfg.root=root; }
  var batchId=A.uid("b");
  var at=nowStr();
  var cnt=0;
  var noProj=0;
  var newIds=[];
  var manualDirs={};

  sel.forEach(function(r){
    var rec={
      id:A.uid("f"), name:r.name, size:r.size, type:"", module:r.module,
      projectId:r.projectId||"", date:dateOf(r.mt), note:r.note||"",
      mode:"path", path:joinPath(root,r.rel), key:"",
      src:"ws", rel:r.rel, batchId:batchId, mt:r.mt, hit:r.hit||"",
      status:"pending", statusAt:fileNowStr()
    };
    DB().files.push(rec);
    newIds.push(rec.id);
    cnt++;
    if(!rec.projectId) noProj++;
    if(solidify && r.manual && r.module){
      var d=r.rel.split("/").slice(0,-1).pop()||"";
      if(d) manualDirs[d]=r.module;
    }
  });

  if(solidify){
    Object.keys(manualDirs).forEach(function(d){
      var ex=(cfg.dirRules||[]).filter(function(x){return x.dir===d;})[0];
      if(ex) ex.module=manualDirs[d];
      else (cfg.dirRules=cfg.dirRules||[]).push({id:newId("d"),dir:d,module:manualDirs[d]});
    });
  }

  var skipped=ST.rows.length-sel.length;
  (DB().wsBatches=DB().wsBatches||[]).unshift({
    id:batchId, at:at, root:root, total:ST.rows.length,
    archived:cnt, skipped:skipped, undone:false, byMod:cnt, noProj:noProj
  });

  cfg.lastScan={at:at, count:ST.rows.length, snap:ST.snap};

  A.save();
  /* v1.9：归档后批量解析（串行、不阻塞归档结果） */
  if(window.IMPORT&&window.IMPORT.enqueue&&newIds.length){
    setTimeout(function(){ try{ window.IMPORT.enqueue(newIds.slice(0,40)); }catch(e){} },600);
  }
  ST.last={batchId:batchId,count:cnt};
  ST.scanned=false; ST.rows=[];
  toast("已归档 "+cnt+" 个文件","ok");
  window.render("space");

  /* 归档完成提示 */
  setTimeout(function(){
    openModal({
      title:"归档完成",
      okText:"进入文件中心",
      noCancel:true,
      body:'<p style="margin:0 0 8px;font-size:13.5px">本次共归档 <b>'+cnt+'</b> 个文件，跳过 '+skipped+' 个。</p>'+
        '<p style="margin:0 0 8px;font-size:13px;color:#b9770e">这些记录均为<b>待确认</b>状态，请在文件中心或项目页逐条确认归属。</p>'+
        (noProj?'<p style="margin:0 0 8px;font-size:12.5px;color:var(--muted)">其中 <b>'+noProj+'</b> 个未识别到项目，可在文件中心「详情」里补关联项目。</p>':'')+
        '<p style="margin:0;font-size:12.5px;color:var(--muted);line-height:1.7">文件已登记到对应模块，原件仍在 '+
        esc(root||"原目录")+'。<br>如需回退，可在「归档批次」中撤销该批。</p>',
      onOk:function(){ location.hash="#/files"; }
    });
  },260);
}

/* ---------- 识别清单 CSV ---------- */
function dl(name,text,mime){
  var blob=new Blob([text],{type:mime||"text/plain;charset=utf-8"});
  var url=URL.createObjectURL(blob);
  var a=document.createElement("a");
  a.href=url; a.download=name;
  document.body.appendChild(a); a.click();
  setTimeout(function(){ URL.revokeObjectURL(url); a.remove(); },400);
}
function cell(v){
  var s=v===null||v===undefined?"":String(v);
  s=s.replace(/"/g,'""');
  return /[",\n\r]/.test(s)?'"'+s+'"':s;
}
function exportScanCSV(){
  var head=["相对路径","文件名","大小","修改日期","识别模块","置信度","命中理由","关联项目","状态","是否已归档"];
  var lines=[head.join(",")];
  var confName={high:"高",mid:"中",manual:"人工",low:"待定"};
  ST.rows.forEach(function(r){
    var p=(DB().projects||[]).filter(function(x){return x.id===r.projectId;})[0];
    lines.push([r.rel,r.name,r.size,dateOf(r.mt),r.module||"待定",confName[r.conf]||"",r.hit,
      p?p.name:"",r.state==="new"?"新增":r.state==="changed"?"变更":"无变化",r.dup?"是":"否"].map(cell).join(","));
  });
  dl("工作空间站_识别清单_"+A.todayStr()+".csv","\ufeff"+lines.join("\r\n"),"text/csv;charset=utf-8");
  toast("已导出 "+ST.rows.length+" 条","ok");
}

/* ---------- 规则维护 ---------- */
function openRules(){
  var cfg=wsCfg();
  function dirRow(r){
    return '<div class="rule-row" data-kind="dir">'+
      '<input type="text" data-dir value="'+esc(r?r.dir:"")+'" placeholder="目录名，如：质量会议">'+
      '<select data-mod>'+MODULES.map(function(m){return '<option'+(r&&r.module===m?" selected":"")+'>'+esc(m)+'</option>';}).join("")+'</select>'+
      '<button class="btn sm ghost" data-del style="color:#c0392b">删</button></div>';
  }
  function kwRow(r){
    return '<div class="rule-row" data-kind="kw">'+
      '<input type="text" data-kw value="'+esc(r?r.kw:"")+'" placeholder="文件名关键词，如：整改回复">'+
      '<select data-mod>'+MODULES.map(function(m){return '<option'+(r&&r.module===m?" selected":"")+'>'+esc(m)+'</option>';}).join("")+'</select>'+
      '<select data-prio>'+[1,2,3].map(function(p){return '<option value="'+p+'"'+(r&&r.prio===p?" selected":"")+'>'+(p===1?"优先 1":p===2?"优先 2":"优先 3")+'</option>';}).join("")+'</select>'+
      '<button class="btn sm ghost" data-del style="color:#c0392b">删</button></div>';
  }
  var body=
    '<div style="font-size:12.5px;color:var(--muted);margin-bottom:10px;line-height:1.7">'+
      '识别顺序：先看<b>目录</b>（由深到浅匹配），再按<b>优先级</b>匹配文件名关键词，最后才落到「待定」。'+
      '目录命中记为「高」置信度，关键词命中记为「中」。</div>'+
    '<div class="ws-rule-h">目录 → 模块 <span class="hint">共 <b id="rcDir">'+cfg.dirRules.length+'</b> 条</span></div>'+
    '<div id="ruleDir" class="ws-rule-box">'+cfg.dirRules.map(dirRow).join("")+'</div>'+
    '<button class="btn sm" id="addDir" style="margin:6px 0 14px">+ 添加目录规则</button>'+
    '<div class="ws-rule-h">关键词 → 模块 <span class="hint">共 <b id="rcKw">'+cfg.kwRules.length+'</b> 条</span></div>'+
    '<div id="ruleKw" class="ws-rule-box">'+cfg.kwRules.map(kwRow).join("")+'</div>'+
    '<button class="btn sm" id="addKw" style="margin:6px 0 12px">+ 添加关键词规则</button>'+
    '<div style="display:flex;gap:8px;flex-wrap:wrap;border-top:1px solid var(--line);padding-top:12px">'+
      '<button class="btn sm" id="expRules">导出规则 JSON</button>'+
      '<button class="btn sm" id="impRules">导入规则 JSON</button>'+
      '<button class="btn sm" id="rstRules" style="color:#c0392b">恢复内置默认</button>'+
      '<input type="file" id="ruleFile" accept=".json,application/json" style="display:none">'+
    '</div>';

  var mask=openModal({
    title:"识别规则维护", body:body, okText:"保存规则",
    onOk:function(scope){
      var dirs=[],kws=[];
      $$('#ruleDir [data-kind="dir"]',scope).forEach(function(row){
        var d=$("[data-dir]",row).value.trim();
        if(!d) return;
        dirs.push({id:newId("d"),dir:d,module:$("[data-mod]",row).value});
      });
      $$('#ruleKw [data-kind="kw"]',scope).forEach(function(row){
        var k=$("[data-kw]",row).value.trim();
        if(!k) return;
        kws.push({id:newId("k"),kw:k,module:$("[data-mod]",row).value,prio:+$("[data-prio]",row).value||2});
      });
      cfg.dirRules=dirs; cfg.kwRules=kws;
      A.save(); toast("规则已保存","ok");
      if(ST.scanned){ reclassify(); window.render("space"); }
      return true;
    }
  });

  function bindDel(){
    $$("[data-del]",mask).forEach(function(b){
      b.onclick=function(){ this.parentNode.remove(); };
    });
  }
  bindDel();
  $("#addDir",mask).onclick=function(){
    var d=document.createElement("div");
    d.innerHTML=dirRow(null);
    $("#ruleDir",mask).appendChild(d.firstChild);
    bindDel();
  };
  $("#addKw",mask).onclick=function(){
    var d=document.createElement("div");
    d.innerHTML=kwRow(null);
    $("#ruleKw",mask).appendChild(d.firstChild);
    bindDel();
  };
  $("#expRules",mask).onclick=function(){
    dl("工作空间站_识别规则_"+A.todayStr()+".json",
      JSON.stringify({dirRules:cfg.dirRules,kwRules:cfg.kwRules},null,2),"application/json");
    toast("已导出规则","ok");
  };
  $("#impRules",mask).onclick=function(){ $("#ruleFile",mask).click(); };
  $("#ruleFile",mask).onchange=function(){
    var f=this.files[0]; if(!f) return;
    var fr=new FileReader();
    fr.onload=function(){
      try{
        var o=JSON.parse(fr.result);
        if(!o||!Array.isArray(o.dirRules)) throw new Error("格式不正确");
        cfg.dirRules=o.dirRules.map(function(x){return {id:newId("d"),dir:x.dir,module:x.module};});
        cfg.kwRules=(o.kwRules||[]).map(function(x){return {id:newId("k"),kw:x.kw,module:x.module,prio:x.prio||2};});
        A.save(); toast("规则已导入，正在刷新","ok");
        mask.remove(); openRules();
      }catch(e){ toast("导入失败："+e.message,"err"); }
    };
    fr.readAsText(f,"utf-8");
  };
  $("#rstRules",mask).onclick=function(){
    if(!confirm("恢复内置默认规则？当前自定义规则将被覆盖。")) return;
    cfg.dirRules=defDir(); cfg.kwRules=defKw();
    A.save(); mask.remove(); openRules(); toast("已恢复默认规则","ok");
  };
}

/* 规则变更后对当前扫描结果重新识别（保留人工指定） */
function reclassify(){
  var pool=projAliases();
  var cfg=wsCfg();
  ST.rows.forEach(function(r){
    if(r.manual) return;
    var x=recognize({name:r.name,rel:r.rel},pool,cfg);
    r.module=x.module; r.conf=x.conf; r.hit=x.hit;
    if(!r.projectId) r.projectId=x.projectId;
    if(!r.dup) r.sel=!!r.module;
  });
}

/* ---------- 归档批次 ---------- */
function openBatches(){
  var list=(DB().wsBatches||[]);
  var body;
  if(!list.length){
    body='<div class="empty">还没有归档批次</div>';
  }else{
    body='<div class="ws-batch">'+list.map(function(b){
      var n=(DB().files||[]).filter(function(f){return f.batchId===b.id;}).length;
      return '<div class="ws-batch-row'+(b.undone?" undone":"")+'">'+
        '<div style="flex:1;min-width:0">'+
          '<div style="font-size:13px;font-weight:600">'+esc(b.at)+' · 归档 '+b.archived+' 个'+
            (b.undone?' <span class="tag t-gray">已撤销</span>':'')+'</div>'+
          '<div style="font-size:11.5px;color:var(--muted);margin-top:2px;word-break:break-all">'+esc(b.root||"—")+
            ' · 本次扫描 '+b.total+' 个 · 跳过 '+(b.skipped||0)+' 个</div>'+
        '</div>'+
        '<button class="btn sm" data-pb="'+esc(b.id)+'">打印</button>'+
        (b.undone?'':'<button class="btn sm ghost" style="color:#c0392b" data-ub="'+esc(b.id)+'">撤销</button>')+
      '</div>';
    }).join("")+'</div>';
  }
  var mask=openModal({title:"归档批次",body:body,okText:"关闭",noCancel:true});

  $$("[data-ub]",mask).forEach(function(btn){
    btn.onclick=function(){
      var id=this.getAttribute("data-ub");
      var b=(DB().wsBatches||[]).filter(function(x){return x.id===id;})[0]; if(!b) return;
      var inBatch=(DB().files||[]).filter(function(f){return f.batchId===id;});
      var cfm=inBatch.filter(function(f){return !fileIsPending(f);}).length;
      if(!confirm("撤销该批归档？将删除这批 "+inBatch.length+" 条登记记录"+
        (cfm?("（其中已确认 "+cfm+" 条）"):"")+"，E 盘原件不受影响。")) return;
      var n=DB().files.length;
      DB().files=DB().files.filter(function(f){return f.batchId!==id;});
      var removed=n-DB().files.length;
      b.undone=true; b.undoneAt=nowStr();
      A.save();
      toast("已撤销 "+removed+" 条记录","ok");
      mask.remove(); openBatches();
    };
  });
  $$("[data-pb]",mask).forEach(function(btn){
    btn.onclick=function(){ printBatch(this.getAttribute("data-pb")); };
  });
}

function printBatch(id){
  var b=(DB().wsBatches||[]).filter(function(x){return x.id===id;})[0]; if(!b) return;
  var files=(DB().files||[]).filter(function(f){return f.batchId===id;});
  var body='<table><thead><tr><th style="width:34px">序号</th><th>文件名称</th><th style="width:190px">所在目录</th>'+
    '<th style="width:70px">模块</th><th style="width:52px">大小</th><th style="width:70px">修改日期</th>'+
    '<th style="width:150px">完整路径</th></tr></thead><tbody>';
  if(!files.length) body+='<tr><td colspan="7" class="c">该批次已无可显示记录</td></tr>';
  files.forEach(function(f,i){
    var dir=String(f.rel||"").split("/").slice(0,-1).join("/")||"—";
    body+='<tr><td class="c">'+(i+1)+'</td><td>'+esc(f.name)+'</td><td>'+esc(dir)+'</td>'+
      '<td class="c">'+esc(f.module)+'</td><td class="c">'+fmtSize(f.size)+'</td>'+
      '<td class="c">'+esc(f.date)+'</td><td>'+esc(f.path)+'</td></tr>';
  });
  body+='</tbody></table>'+
    '<div class="note">本批共 '+files.length+' 条，归档时间 '+esc(b.at)+'，根目录 '+esc(b.root||"")+
    '。原件仍在本地，本表仅作登记与核对。</div>';
  if(window.printHTML) window.printHTML("资料归档清单",body,"工作空间站 · 归档批次 "+b.at);
  else toast("打印模块未加载","err");
}

/* ---------- 模块页「本模块文件」卡片 ---------- */
function projSelectHTML(cur){
  var opts='<option value="">全部项目</option>';
  (DB().projects||[]).forEach(function(p){
    var nm=String(p.name||"");
    opts+='<option value="'+esc(p.id)+'"'+(cur===p.id?" selected":"")+' title="'+esc(nm)+'">'+
      esc(nm.length>16?nm.slice(0,16)+"…":nm)+'</option>';
  });
  return '<select data-mf-proj style="padding:5px 8px;font-size:12px;max-width:190px">'+opts+'</select>';
}
function mfRow(f){
  if(window.fileRowHTML) return window.fileRowHTML(f,{open:true,toggle:true});
  /* files.js 尚未就绪时的兜底行（只在极端加载顺序下出现） */
  return '<div class="file-item">'+
    '<div class="file-ic">'+esc(extOf(f.name))+'</div>'+
    '<div style="flex:1;min-width:0">'+
      '<div style="font-size:13px;font-weight:600;word-break:break-all">'+esc(f.name)+'</div>'+
      '<div style="font-size:11.5px;color:var(--muted);margin-top:2px">'+fmtSize(f.size)+' · '+esc(f.date||"")+' · '+esc(f.module)+'</div>'+
    '</div>'+
    '<button class="btn sm" data-mf-path="'+esc(f.id)+'">'+(f.mode==="idb"?"下载":"复制路径")+'</button></div>';
}

window.moduleFilesCard=function(route,host,opt){
  host=host||document.getElementById("mfHost");
  if(!host) return;
  var mods=ROUTE_MOD[route]; if(!mods) return;
  opt=opt||{};
  opt.route=route;
  host.__mfOpt=opt;               /* 配置挂 DOM，重绘后仍记得项目筛选值 */
  var LIMIT=opt.limit||8;

  var all=(DB().files||[]).filter(function(f){ return mods.indexOf(f.module)>=0; });
  var filtering=!!(opt.projectId||opt.status);
  var storeHas=(DB().files||[]).length>0;
  /* opt 缺省 = v1.6 行为：无文件就整块隐藏，8 个 simplePage 页面零回归 */
  if(!all.length && !filtering && !(opt.always&&storeHas)){ host.innerHTML=""; return; }

  var list=all;
  if(opt.projectId) list=list.filter(function(f){return f.projectId===opt.projectId;});
  if(opt.status) list=list.filter(function(f){return fileStatus(f)===opt.status;});
  list=list.slice().sort(function(a,b){ return String(b.date||"").localeCompare(String(a.date||"")); });

  /* 两段式截断：待确认优先占额度，超出的用"另有 N 个"提示，不放大 DOM */
  var pend=list.filter(fileIsPending), conf=list.filter(function(f){return !fileIsPending(f);});
  var takeP=Math.min(pend.length,LIMIT);
  var top=pend.slice(0,takeP).concat(conf.slice(0,Math.max(0,LIMIT-takeP)));
  var moreP=pend.length-takeP;

  var h='<div class="card" style="margin-top:14px"><div class="card-h"><h3>本模块文件</h3>'+
    '<span class="hint">共 '+list.length+' 个 · '+
      (pend.length?'<b style="color:#b9770e">'+pend.length+' 个待确认</b>':'全部已确认')+'</span>'+
    '<div class="spacer"></div>'+
    (opt.projectFilter?projSelectHTML(opt.projectId):'')+
    '<button class="btn sm" data-mf-go="1">在文件中心查看</button></div>'+
    '<div class="card-b" style="padding:0">';

  if(!top.length){
    h+='<div class="empty">'+
      (opt.projectId?"该项目暂无登记文件":(opt.status?"该状态下暂无文件":"暂无文件"))+
      (opt.projectId?'　<button class="btn sm" data-mf-all="1">查看全部项目</button>':'')+'</div>';
  }else{
    h+=top.map(mfRow).join("");
  }
  if(moreP>0){
    h+='<div style="padding:9px 14px;font-size:12px;color:var(--muted)">另有 '+moreP+
      ' 个待确认文件未在此显示，<button class="btn sm ghost" data-mf-go="1">去文件中心处理</button></div>';
  }
  h+='</div></div>';
  host.innerHTML=h;

  function rerender(){ window.moduleFilesCard(route,host,opt); }
  $$("[data-mf-go]",host).forEach(function(b){ b.onclick=function(){ location.hash="#/files"; }; });
  $$("[data-mf-all]",host).forEach(function(b){ b.onclick=function(){ opt.projectId=""; rerender(); }; });
  var sel=$("[data-mf-proj]",host);
  if(sel) sel.onchange=function(){ opt.projectId=this.value; rerender(); };
  /* 兜底行（data-mf-path）仅在 fileRowHTML 缺失时存在 */
  $$("[data-mf-path]",host).forEach(function(b){
    b.onclick=function(){
      var id=this.getAttribute("data-mf-path");
      var f=(DB().files||[]).filter(function(x){return x.id===id;})[0]; if(!f) return;
      if(f.mode==="idb" && window.fileDownload) window.fileDownload(f.id);
      else if(window.copyText) window.copyText(f.path||"");
      else toast(f.path||"（无路径）","ok");
    };
  });
  if(window.fileBind){
    window.fileBind(host,function(){ rerender(); if(window.refreshNav) window.refreshNav(); });
  }
};
/* 供项目详情弹窗同步页面底部卡片 */
window.mfRefresh=function(host){
  host=host||document.getElementById("mfHost");
  if(host&&host.__mfOpt) window.moduleFilesCard(host.__mfOpt.route,host,host.__mfOpt);
};

/* ---------- 启动 ---------- */
window.onBoot=window.onBoot||function(){};
(function(){
  var old=window.onBoot;
  window.onBoot=function(){
    old();
    try{ wsCfg(); }catch(e){ console.warn("工作空间站初始化失败",e); }
  };
})();

/* 便于自测 */
window.WS={recognize:recognize,buildRows:buildRows,statOf:statOf,st:ST,cfg:wsCfg,reclassify:reclassify,
           execArchive:execArchive,printBatch:printBatch,openBatches:openBatches,openRules:openRules};
})();
