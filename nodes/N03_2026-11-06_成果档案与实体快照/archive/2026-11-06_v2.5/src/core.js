/* ===== 核心：存储 / 工具 / 路由 / 通用台账引擎 ===== */
(function(){
"use strict";

var DB_KEY = "ZLGL_DB_V1";
var DB = null;

/* ---------- 工具 ---------- */
function $(s,r){return (r||document).querySelector(s);}
function $$(s,r){return Array.prototype.slice.call((r||document).querySelectorAll(s));}
function esc(s){
  if(s===null||s===undefined) return "";
  return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}
function uid(p){return (p||"x")+Date.now().toString(36)+Math.random().toString(36).slice(2,6);}
function clone(o){return JSON.parse(JSON.stringify(o));}
function pad(n){return n<10?"0"+n:""+n;}
function todayStr(){var d=new Date();return d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate());}
function parseD(s){if(!s) return null; var a=String(s).slice(0,10).split("-"); if(a.length<3) return null; var d=new Date(+a[0],+a[1]-1,+a[2]); return isNaN(d.getTime())?null:d;}
function fmtD(s){if(!s) return "—"; return String(s).slice(0,10);}
function diffDays(a,b){var x=parseD(a),y=parseD(b);if(!x||!y) return 0;return Math.round((y-x)/86400000);}
function addDays(s,n){var d=parseD(s)||new Date();d.setDate(d.getDate()+n);return d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate());}
function weekKey(dstr){
  var d=parseD(dstr)||new Date();
  var t=new Date(d.getFullYear(),d.getMonth(),d.getDate());
  var day=(t.getDay()+6)%7; t.setDate(t.getDate()-day+3);
  var first=new Date(t.getFullYear(),0,4);
  var fday=(first.getDay()+6)%7; first.setDate(first.getDate()-fday+3);
  var wk=1+Math.round((t-first)/604800000);
  return t.getFullYear()+"-W"+(wk<10?"0"+wk:""+wk);
}
function weekRange(wk){
  var m=/(\d{4})-W(\d{2})/.exec(wk); if(!m) return [todayStr(),todayStr()];
  var y=+m[1],w=+m[2];
  var jan4=new Date(y,0,4);
  var fday=(jan4.getDay()+6)%7;
  var w1=new Date(y,0,4-fday);
  var s=new Date(w1.getTime()+(w-1)*604800000);
  var e=new Date(s.getTime()+6*86400000);
  return [s.getFullYear()+"-"+pad(s.getMonth()+1)+"-"+pad(s.getDate()),
          e.getFullYear()+"-"+pad(e.getMonth()+1)+"-"+pad(e.getDate())];
}
function periodEnd(p){
  if(!p) return "";
  if(/^\d{4}$/.test(p)) return p+"-12-31";
  if(/^\d{4}-\d{2}$/.test(p)){var y=+p.slice(0,4),m=+p.slice(5,7);var d=new Date(y,m,0);return y+"-"+pad(m)+"-"+pad(d.getDate());}
  if(/-W\d{2}$/.test(p)) return weekRange(p)[1];
  return p;
}
function periodStart(p){
  if(!p) return "";
  if(/^\d{4}$/.test(p)) return p+"-01-01";
  if(/^\d{4}-\d{2}$/.test(p)) return p+"-01";
  if(/-W\d{2}$/.test(p)) return weekRange(p)[0];
  return p;
}
function pct(a,b){ if(!b) return 0; return Math.round(a/b*1000)/10; }
function nf(n){ if(n===null||n===undefined||n==="") return "—"; var v=+n; if(isNaN(v)) return "—"; return v.toLocaleString("zh-CN",{maximumFractionDigits:2}); }

/* ---------- 存储 ---------- */
function load(){
  try{
    var raw=localStorage.getItem(DB_KEY);
    if(!raw) return clone(window.SEED);
    var d=JSON.parse(raw);
    if(!d||!d.tasks) return clone(window.SEED);
    return d;
  }catch(e){ console.warn("读取本地数据失败",e); return clone(window.SEED); }
}
function save(){
  try{
    DB.meta.updatedAt=new Date().toISOString();
    localStorage.setItem(DB_KEY,JSON.stringify(DB));
    return true;
  }catch(e){
    toast("本地存储已满，请先在文件中心清理已上传文件","err");
    return false;
  }
}
/* 立即初始化，保证后续脚本加载时 DB 已就绪 */
DB = load();
if(!DB.meta) DB.meta={company:"",year:2026};

/* ---------- 单据核定数据并入（v2.3）----------
   只并入 window.INSPECT_DOC 中来自三份已上传单据的 3 张检查单 + 18 条问题；
   同时清退旧版 seed 里编造的演示行（仅限「未被人动过」的 i1-i6 / w1-w14，
   有来源、被编辑过、被标脏的一律保留）。用版本号保证幂等：
   并入后写库并落 _docVer，之后不再重复执行，用户删掉的行也不会复活。 */
var DOC_VER="2026-11-05";
var DEMO_SHEET={"i1":1,"i2":1,"i3":1,"i4":1,"i5":1,"i6":1};
var DEMO_ISSUE={"w1":1,"w2":1,"w3":1,"w4":1,"w5":1,"w6":1,"w7":1,"w8":1,
  "w9":1,"w10":1,"w11":1,"w12":1,"w13":1,"w14":1};
function untouched(r){ return !r.srcFileId && !r.srcRel && !r._df && !r.manualAt && !r.dirty; }
function mergeInspectDoc(){
  var doc=window.INSPECT_DOC;
  if(!doc || DB._docVer===DOC_VER) return false;
  var changed=false;
  var keepS=(DB.inspections||[]).filter(function(r){ return !(DEMO_SHEET[r.id]&&untouched(r)); });
  if(keepS.length!==(DB.inspections||[]).length){ DB.inspections=keepS; changed=true; }
  var keepI=(DB.issues||[]).filter(function(r){ return !(DEMO_ISSUE[r.id]&&untouched(r)); });
  if(keepI.length!==(DB.issues||[]).length){ DB.issues=keepI; changed=true; }
  DB.inspections=DB.inspections||[]; DB.issues=DB.issues||[];
  var sn={}, isn={};
  DB.inspections.forEach(function(r){ sn[r.no]=1; });
  DB.issues.forEach(function(r){ isn[r.no]=1; });
  (doc.sheets||[]).forEach(function(r){
    if(sn[r.no]) return; DB.inspections.push(clone(r)); sn[r.no]=1; changed=true;
  });
  (doc.rows||[]).forEach(function(r){
    if(isn[r.no]) return; DB.issues.push(clone(r)); isn[r.no]=1; changed=true;
  });
  DB._docVer=DOC_VER;
  return true;
}
try{ if(mergeInspectDoc()) save(); }catch(e){ console.warn("单据数据并入失败",e); }

window.APP = {
  get db(){return DB;},
  save:save,
  $:$, $$:$$, esc:esc, uid:uid, todayStr:todayStr, parseD:parseD, fmtD:fmtD,
  diffDays:diffDays, addDays:addDays, weekKey:weekKey, weekRange:weekRange,
  periodEnd:periodEnd, periodStart:periodStart, pct:pct, nf:nf, clone:clone
};

/* ---------- 质量检查整改状态机（v2.1）----------
   依据《质量问题整改通知单》《质量整改回复单》的实际流转确定：
       待整改 → 整改中 → 已回复待复核 → 已闭环
                                  ↘ 复核退回 → 整改中
   兼容：v2.0 及更早只写 待整改 / 整改中 / 已闭环 三个值，
   三者在状态集合内仍然合法，历史行无需迁移即可读取与统计。 */
var INSP_STATUS = ["待整改","整改中","已回复待复核","已闭环","复核退回"];
var INSP_FLOW = {
  "待整改":["整改中"],
  "整改中":["已回复待复核"],
  "已回复待复核":["已闭环","复核退回"],
  "复核退回":["整改中"],
  "已闭环":[]
};
var INSP_LEGACY = {"待整改":1,"整改中":1,"已闭环":1};
function inspIsClosed(v){ return v==="已闭环"; }
function inspIsVerifying(v){ return v==="已回复待复核"; }
function inspIsOpen(v){ return !inspIsClosed(v); }
function inspIsLegacy(v){ return !!INSP_LEGACY[v]; }
function inspNext(v){ return (INSP_FLOW[v]||[]).slice(); }
/* 是否允许从 from 流转到 to；from 为空（新增）一律放行 */
function inspCanGo(from,to){
  if(!from||from===to) return true;
  return (INSP_FLOW[from]||[]).indexOf(to)>=0;
}
window.INSP = {
  STATUS:INSP_STATUS, FLOW:INSP_FLOW, LEGACY:INSP_LEGACY,
  isClosed:inspIsClosed, isVerifying:inspIsVerifying, isOpen:inspIsOpen,
  isLegacy:inspIsLegacy, next:inspNext, canGo:inspCanGo
};
window.APP.insp = window.INSP;

/* ---------- 文件状态（v1.7）：待确认 / 已确认 ---------- */
function fileNowStr(){
  var d=new Date();
  return d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate())+" "+
         pad(d.getHours())+":"+pad(d.getMinutes());
}
/* v1.6 遗留记录没有 status 字段，一律视为已确认（当时的归档/上传本身就是人工确认） */
function fileStatus(f){ return (f&&f.status==="pending")?"pending":"confirmed"; }
function fileIsPending(f){ return fileStatus(f)==="pending"; }
/* 唯一写入口：落库失败时回滚内存值，避免"界面已确认、刷新后回退" */
function fileSetStatus(id,st){
  var list=DB.files||[], f=null, i;
  for(i=0;i<list.length;i++){ if(list[i].id===id){ f=list[i]; break; } }
  if(!f) return false;
  if(f.status===st) return true;
  var oS=f.status, oA=f.statusAt;
  f.status=st; f.statusAt=fileNowStr();
  if(!save()){ f.status=oS; f.statusAt=oA; return false; }
  return true;
}
function fileTag(f){
  var p=fileIsPending(f);
  return '<span class="tag '+(p?"t-amber":"t-green")+'">'+(p?"待确认":"已确认")+'</span>';
}
window.APP.fileStatus=fileStatus;
window.APP.fileIsPending=fileIsPending;
window.APP.fileSetStatus=fileSetStatus;
window.APP.fileTag=fileTag;
window.APP.fileNowStr=fileNowStr;
window.fileStatus=fileStatus;
window.fileIsPending=fileIsPending;
window.fileSetStatus=fileSetStatus;
window.fileTag=fileTag;
window.fileNowStr=fileNowStr;

/* ---------- 提示 ---------- */
function toast(msg,type){
  var w=$("#toastWrap"); if(!w){w=document.createElement("div");w.id="toastWrap";w.className="toast-wrap";document.body.appendChild(w);}
  var t=document.createElement("div");
  t.className="toast "+(type||"");
  t.textContent=msg;
  w.appendChild(t);
  setTimeout(function(){ t.style.transition="opacity .25s"; t.style.opacity="0"; setTimeout(function(){t.remove();},260); },2400);
}
window.toast=toast;

/* ---------- 模态框 ---------- */
var modalStack=[];
function openModal(opt){
  var mask=document.createElement("div");
  mask.className="modal-mask";
  mask.innerHTML=
    '<div class="modal" role="dialog" aria-modal="true">'+
      '<div class="modal-h"><h3>'+esc(opt.title)+'</h3>'+
        '<button class="close-x" data-close="1" aria-label="关闭">×</button></div>'+
      '<div class="modal-b">'+opt.body+'</div>'+
      '<div class="modal-f">'+
        (opt.noCancel?'':'<button class="btn" data-close="1">取消</button>')+
        '<button class="btn primary" data-ok="1">'+esc(opt.okText||"保存")+'</button>'+
      '</div>'+
    '</div>';
  document.body.appendChild(mask);
  modalStack.push(mask);
  function close(){ mask.remove(); modalStack.pop(); if(opt.onClose) opt.onClose(); }
  $$("[data-close]",mask).forEach(function(b){b.onclick=close;});
  mask.addEventListener("click",function(e){ if(e.target===mask) close(); });
  var okBtn=$("[data-ok]",mask);
  if(opt.noOk) okBtn.style.display="none";
  okBtn.onclick=function(){
    var r=opt.onOk?opt.onOk(mask):true;
    if(r===false) return;
    close();
  };
  if(opt.afterRender) opt.afterRender(mask);
  var f=$("input,select,textarea",mask); if(f) setTimeout(function(){f.focus();},60);
  return mask;
}
window.openModal=openModal;
document.addEventListener("keydown",function(e){
  if(e.key==="Escape"&&modalStack.length){ var m=modalStack.pop(); m.remove(); }
});

/* ---------- 表单构造 ---------- */
var SELECT_DICTS={
  level:[["year","年度目标"],["month","月度目标"],["week","周任务"],["day","日待办"]],
  status:[["todo","未开始"],["doing","进行中"],["done","已完成"]],
  priority:[["P0","P0"],["P1","P1"],["P2","P2"]],
  taskStatus:[["todo","未开始"],["doing","进行中"],["done","已完成"]]
};
function fieldHTML(f,val,ctx){
  var v = val===undefined||val===null ? (f.def!==undefined?f.def:"") : val;
  var attrs='name="'+f.k+'" id="f_'+f.k+'"';
  var html="";
  if(f.t==="textarea"){
    html='<textarea '+attrs+' placeholder="'+esc(f.ph||"")+'">'+esc(v)+'</textarea>';
  }else if(f.t==="select"){
    var opts=typeof f.opts==="function"?f.opts():(f.opts||[]);
    html='<select '+attrs+'>';
    if(!f.req) html+='<option value="">—</option>';
    opts.forEach(function(o){
      var ov=Array.isArray(o)?o[0]:o, ol=Array.isArray(o)?o[1]:o;
      html+='<option value="'+esc(ov)+'"'+(String(v)===String(ov)?" selected":"")+'>'+esc(ol)+'</option>';
    });
    html+='</select>';
  }else if(f.t==="date"){
    html='<input type="date" '+attrs+' value="'+esc(v)+'">';
  }else if(f.t==="number"){
    html='<input type="number" step="'+(f.step||"any")+'" '+attrs+' value="'+esc(v)+'" placeholder="'+esc(f.ph||"")+'">';
  }else if(f.t==="checkbox"){
    html='<label style="display:flex;align-items:center;gap:8px;padding-top:22px">'+
      '<input type="checkbox" '+attrs+' '+(v?"checked":"")+' style="width:16px;height:16px"> '+
      '<span style="font-size:13px">'+esc(f.l)+'</span></label>';
    return '<div class="field">'+html+'</div>';
  }else if(f.t==="datalist"){
    var id="dl_"+f.k;
    html='<input type="text" '+attrs+' list="'+id+'" value="'+esc(v)+'" placeholder="'+esc(f.ph||"")+'">'+
      '<datalist id="'+id+'">'+(f.opts||[]).map(function(o){return '<option value="'+esc(o)+'">';}).join("")+'</datalist>';
  }else{
    html='<input type="text" '+attrs+' value="'+esc(v)+'" placeholder="'+esc(f.ph||"")+'">';
  }
  return '<div class="field'+(f.full?" full":"")+'"><label for="f_'+f.k+'">'+esc(f.l)+(f.req?' <span style="color:#c0392b">*</span>':'')+'</label>'+html+'</div>';
}
function readForm(scope,fields){
  var o={};
  fields.forEach(function(f){
    var el=$("#f_"+f.k,scope); if(!el) return;
    if(f.t==="checkbox") o[f.k]=el.checked;
    else if(f.t==="number"){ o[f.k]= el.value===""?null:+el.value; }
    else o[f.k]=el.value;
  });
  return o;
}
function formHTML(fields,row){
  row=row||{};
  return '<div class="form-grid">'+fields.map(function(f){return fieldHTML(f,row[f.k]);}).join("")+'</div>';
}
window.formHTML=formHTML; window.readForm=readForm; window.fieldHTML=fieldHTML;

/* ---------- 通用台账引擎 ---------- */
/* schema: {key,title,prefix,cols:[{k,l,w,fmt}],fields:[...],filters:[{k,l,opts}],searchKeys:[],sortBy,defaultNew} */
var SCHEMA={};
function regSchema(k,def){ SCHEMA[k]=def; }
window.regSchema=regSchema; window.SCHEMA=SCHEMA;
window.APP.regSchema=regSchema;

var uiState={}; // 每个模块的搜索/筛选状态

/* ---------- 表格行顺序（手工调序）----------
   存储：DB().ui.tableOrder[模块key] = [行id, ...]
   语义：只决定显示次序，不写任何业务字段；不在顺序表里的行（如新导入的）
         按原 sortBy 排在末尾，绝不插队打乱已排好的部分 */
function tableUi(){ var d=DB; d.ui=d.ui||{}; d.ui.tableOrder=d.ui.tableOrder||{}; return d.ui; }
function tableOrder(key){ return tableUi().tableOrder[key]||null; }
function setTableOrder(key,ids){
  var u=tableUi();
  if(ids&&ids.length) u.tableOrder[key]=ids.slice();
  else delete u.tableOrder[key];
}
/* 把 rows 按给定 id 序列重排：表内有的按序，表外的保持原相对次序追加末尾 */
function applyOrder(rows,ids){
  if(!ids||!ids.length) return rows;
  var ix={}, i;
  for(i=0;i<ids.length;i++) ix[ids[i]]=i;
  var inList=[], rest=[];
  rows.forEach(function(r){ (ix[r.id]===undefined?rest:inList).push(r); });
  inList.sort(function(a,b){ return ix[a.id]-ix[b.id]; });
  return inList.concat(rest);
}

function getRows(key){ return DB[key]||[]; }

function renderCell(col,row){
  var v=row[col.k];
  if(col.fmt) return col.fmt(v,row);
  if(v===null||v===undefined||v==="") return '<span style="color:#b6c0cc">—</span>';
  return esc(v);
}

function renderTable(key,host){
  var def=SCHEMA[key], rows=getRows(key).slice();
  var st=uiState[key]||(uiState[key]={q:"",f:{}});

  if(st.q){
    var q=st.q.toLowerCase();
    rows=rows.filter(function(r){
      return (def.searchKeys||def.cols.map(function(c){return c.k;})).some(function(k){
        return String(r[k]||"").toLowerCase().indexOf(q)>=0;
      });
    });
  }
  (def.filters||[]).forEach(function(f){
    var v=st.f[f.k]; if(!v) return;
    rows=rows.filter(function(r){ return String(r[f.k])===String(v); });
  });
  /* 搜索/筛选生效时不允许调序：只能看到子集，拖动会打乱没显示的行 */
  var filtered=!!st.q||(def.filters||[]).some(function(f){ return !!st.f[f.k]; });
  if(st.ord&&filtered){ st.ord=null; }   /* 中途加了筛选就退出调序模式 */

  if(def.sortFn) rows.sort(def.sortFn);
  else if(def.sortBy) rows.sort(function(a,b){ var x=a[def.sortBy]||"",y=b[def.sortBy]||""; return x<y?1:x>y?-1:0; });

  /* 手工顺序优先于默认 sortBy */
  var ordering=!!st.ord;
  if(ordering) rows=applyOrder(rows,st.ord.work);
  else rows=applyOrder(rows,tableOrder(key));

  var bar;
  if(ordering){
    /* 排序模式：工具栏只留调序动作，避免误触搜索/新增 */
    bar='<div class="toolbar ord-bar">'+
      '<span class="ord-tip">'+
        '<b>调整顺序</b>　拖动行首手柄可跨行移动，或用 ↑ ↓ 逐行移动（首尾循环）；'+
        '数据不变，调序时已收起详情列；点「完成」保存，取消则还原'+
      '</span><div class="spacer"></div>'+
      '<button class="btn" data-act="ordReset">恢复默认顺序</button>'+
      '<button class="btn" data-act="ordCancel">取消</button>'+
      '<button class="btn primary" data-act="ordDone">完成</button>'+
    '</div>';
  }else{
    var canOrd=getRows(key).length>1;
    bar='<div class="toolbar">'+
      '<div class="search"><input type="search" placeholder="搜索'+esc(def.title)+'…" value="'+esc(st.q)+'" data-q="1"></div>'+
      (def.filters||[]).map(function(f){
        return '<select data-f="'+f.k+'"><option value="">全部'+esc(f.l)+'</option>'+
          f.opts.map(function(o){var ov=Array.isArray(o)?o[0]:o,ol=Array.isArray(o)?o[1]:o;
            return '<option value="'+esc(ov)+'"'+(String(st.f[f.k]||"")===String(ov)?" selected":"")+'>'+esc(ol)+'</option>';}).join("")+
          '</select>';
      }).join("")+
      '<div class="spacer"></div>'+
      (def.extraButtons?def.extraButtons():'')+
      (canOrd?(filtered
        ? '<button class="btn" disabled title="搜索或筛选生效时不可调序，请先清空条件">调整顺序</button>'
        : '<button class="btn" data-act="ordOn" title="拖拽或上下移动，改变行的显示次序">调整顺序</button>'):'')+
      (tableOrder(key)?'<button class="btn" data-act="ordReset" title="清除手工顺序，回到默认排序">恢复默认</button>':'')+
      '<button class="btn" data-act="csv">导出 CSV</button>'+
      '<button class="btn" data-act="print">打印</button>'+
      (def.readonly?'':'<button class="btn primary" data-act="add">+ 新增</button>')+
    '</div>';
  }

  var GRIP='<svg width="10" height="14" viewBox="0 0 10 14" aria-hidden="true"><g fill="currentColor">'+
    '<circle cx="3" cy="3" r="1.2"/><circle cx="7" cy="3" r="1.2"/>'+
    '<circle cx="3" cy="7" r="1.2"/><circle cx="7" cy="7" r="1.2"/>'+
    '<circle cx="3" cy="11" r="1.2"/><circle cx="7" cy="11" r="1.2"/></g></svg>';
  var ARROW_UP='<svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M6 2.2 10.4 8.4H1.6z" fill="currentColor"/></svg>';
  var ARROW_DN='<svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M6 9.8 1.6 3.6h8.8z" fill="currentColor"/></svg>';

  /* 排序模式下收起「详情类」列：调序时只需看清是哪一行，避免新增两列后横向溢出 */
  var ORD_HIDE={level:1,photo:1,owner:1,note:1,requirement:1,measure:1,conclusion:1,checker:1,_pr:1};
  var dCols=ordering?def.cols.filter(function(c){ return !ORD_HIDE[c.k]; }):def.cols;

  var table='<div class="table-wrap"><table class="tb'+(ordering?' is-ord':'')+'"><thead><tr>'+
    (ordering?'<th style="width:66px">顺序</th>':'')+
    dCols.map(function(c){return '<th'+(c.w?' style="min-width:'+c.w+'px"':'')+'>'+esc(c.l)+'</th>';}).join("")+
    (ordering?'<th style="width:90px">移动</th>':(def.readonly?'':'<th style="width:88px">操作</th>'))+
    '</tr></thead><tbody>';
  if(!rows.length){
    table+='<tr><td colspan="'+(dCols.length+(ordering?2:1))+'"><div class="empty">没有符合条件的记录'+
      (def.readonly?'':'，点击右上角「+ 新增」开始录入')+'</div></td></tr>';
  }else{
    rows.forEach(function(r,i){
      var chip=(window.IMPORT&&window.IMPORT.srcChip)?window.IMPORT.srcChip(r):"";
      table+='<tr data-id="'+esc(r.id)+'"'+(ordering?' class="ord-row" draggable="true"':'')+'>';
      if(ordering){
        var edge=i===0?"已在首位，上移会转到末位":(i===rows.length-1?"已在末位，下移会转到首位":"");
        table+='<td class="ord-cell"'+(edge?' title="'+esc(edge)+'"':'')+'>'+
          '<span class="ord-no">'+(i+1)+'</span>'+
          '<span class="ord-grip" title="按住拖动可跨行移动">'+GRIP+'</span></td>';
      }
      table+=dCols.map(function(c,ci){
          return '<td'+(c.num?' class="num"':'')+'>'+(ci===0?chip:'')+renderCell(c,r)+'</td>';
        }).join("");
      if(ordering){
        table+='<td class="ord-acts">'+
          '<button class="btn sm ghost ord-btn" data-up="'+esc(r.id)+'" title="上移；已在首位则转到末位">'+ARROW_UP+'</button>'+
          '<button class="btn sm ghost ord-btn" data-down="'+esc(r.id)+'" title="下移；已在末位则转到首位">'+ARROW_DN+'</button>'+
        '</td>';
      }else if(!def.readonly){
        table+='<td><div class="row-actions">'+
          '<button class="btn sm ghost" data-edit="'+esc(r.id)+'">编辑</button>'+
          '<button class="btn sm ghost" data-del="'+esc(r.id)+'" style="color:#c0392b">删</button>'+
        '</div></td>';
      }
      table+='</tr>';
    });
  }
  table+='</tbody></table></div>';

  host.innerHTML = bar + table +
    '<div style="margin-top:10px;font-size:12px;color:var(--muted)">共 '+rows.length+' 条'+
      (rows.length!==getRows(key).length?'（已筛选，总计 '+getRows(key).length+' 条）':'')+'</div>';

  var qi=$("[data-q]",host);
  if(qi) qi.oninput=function(){ st.q=this.value; var pos=this.selectionStart; renderTable(key,host);
    var n=$("[data-q]",host); if(n){n.focus(); try{n.setSelectionRange(pos,pos);}catch(e){}} };
  $$("[data-f]",host).forEach(function(s){ s.onchange=function(){ st.f[this.getAttribute("data-f")]=this.value; renderTable(key,host); }; });
  $$("[data-edit]",host).forEach(function(b){ b.onclick=function(){ editRow(key,this.getAttribute("data-edit")); }; });
  $$("[data-del]",host).forEach(function(b){ b.onclick=function(){ delRow(key,this.getAttribute("data-del")); }; });
  $$("[data-src]",host).forEach(function(b){ b.onclick=function(e){
    e.stopPropagation();
    if(window.IMPORT&&window.IMPORT.showSource) window.IMPORT.showSource(b.getAttribute("data-src"));
  }; });
  var add=$("[data-act=add]",host); if(add) add.onclick=function(){ editRow(key,null); };
  var csv=$("[data-act=csv]",host); if(csv) csv.onclick=function(){ exportCSV(key,def,rows); };
  var pr=$("[data-act=print]",host); if(pr) pr.onclick=function(){ printTable(key,def,rows); };

  /* ---------- 行顺序调整 ---------- */
  var on=$("[data-act=ordOn]",host);
  if(on) on.onclick=function(){
    st.ord={work:rows.map(function(r){return r.id;})};   /* 以当前显示顺序为基准 */
    renderTable(key,host);
  };
  var od=$("[data-act=ordDone]",host);
  if(od) od.onclick=function(){
    setTableOrder(key,st.ord.work); st.ord=null; save();
    toast("已保存行顺序","ok"); renderTable(key,host);
  };
  var oc=$("[data-act=ordCancel]",host);
  if(oc) oc.onclick=function(){ st.ord=null; renderTable(key,host); };
  var orr=$("[data-act=ordReset]",host);
  if(orr) orr.onclick=function(){
    setTableOrder(key,null); st.ord=null; save();
    toast("已恢复默认顺序","ok"); renderTable(key,host);
  };
  function moveBy(id,dir){
    var w=st.ord.work, i=w.indexOf(id); if(i<0) return;
    var j=i+dir;
    if(j<0) j=w.length-1; else if(j>=w.length) j=0;   /* 首尾循环 */
    w.splice(i,1); w.splice(j,0,id);
    renderTable(key,host);
  }
  $$("[data-up]",host).forEach(function(b){ b.onclick=function(){ moveBy(this.getAttribute("data-up"),-1); }; });
  $$("[data-down]",host).forEach(function(b){ b.onclick=function(){ moveBy(this.getAttribute("data-down"),1); }; });

  /* 拖拽：落点在目标行上半部=插到它前面，下半部=插到它后面（跨行一次到位） */
  if(ordering){
    var tbody=$("tbody",host), dragId=null;
    $$("tr.ord-row",tbody).forEach(function(tr){
      tr.ondragstart=function(e){
        dragId=this.getAttribute("data-id");
        this.classList.add("is-dragging");
        try{ e.dataTransfer.effectAllowed="move"; e.dataTransfer.setData("text/plain",dragId); }catch(_e){}
      };
      tr.ondragend=function(){
        this.classList.remove("is-dragging"); dragId=null;
        $$("tr.ord-row",tbody).forEach(function(x){ x.classList.remove("drop-before","drop-after"); });
      };
      tr.ondragover=function(e){
        if(!dragId||dragId===this.getAttribute("data-id")) return;
        e.preventDefault();
        var rc=this.getBoundingClientRect(), after=(e.clientY-rc.top)>rc.height/2;
        this.classList.toggle("drop-after",after);
        this.classList.toggle("drop-before",!after);
      };
      tr.ondragleave=function(){ this.classList.remove("drop-before","drop-after"); };
      tr.ondrop=function(e){
        e.preventDefault();
        var tgt=this.getAttribute("data-id");
        if(!dragId||dragId===tgt) return;
        var rc=this.getBoundingClientRect(), after=(e.clientY-rc.top)>rc.height/2;
        var w=st.ord.work, from=w.indexOf(dragId);
        if(from<0) return;
        w.splice(from,1);
        var to=w.indexOf(tgt);
        if(to<0) to=w.length;
        else if(after) to=to+1;
        w.splice(to,0,dragId);
        renderTable(key,host);
      };
    });
  }

  if(def.afterRender) def.afterRender(host,rows);
}
window.renderTable=renderTable;
window.APP.renderTable=renderTable;

function editRow(key,id){
  var def=SCHEMA[key];
  var row = id ? (getRows(key).filter(function(r){return r.id===id;})[0]) : clone(def.defaultNew||{});
  if(!row) return;
  var body=formHTML(def.fields,row);
  if(def.formNote) body='<div style="margin-bottom:12px;font-size:12.5px;color:var(--muted);background:var(--panel-2);padding:9px 12px;border-radius:7px">'+def.formNote+'</div>'+body;
  openModal({
    title:(id?"编辑 · ":"新增 · ")+def.title,
    body:body,
    onOk:function(scope){
      var data=readForm(scope,def.fields);
      for(var i=0;i<def.fields.length;i++){
        var f=def.fields[i];
        if(f.req && (data[f.k]===""||data[f.k]===null)){ toast("请填写「"+f.l+"」","err"); $("#f_"+f.k,scope).focus(); return false; }
      }
      /* 校验先于落库：beforeSave 返回 false 时整条不写入，弹窗保持让用户继续改 */
      if(def.beforeSave && def.beforeSave(data,id)===false){ return false; }
      if(id){
        var idx=getRows(key).findIndex(function(r){return r.id===id;});
        if(idx>=0){
          var old=DB[key][idx];
          /* 字段级人工编辑留痕：只有真正被改过的字段才进入冲突保护，
             避免"改了一个字段、整行都不让文件更新" */
          var df={}, chg=false;
          for(var k in data){
            if(!Object.prototype.hasOwnProperty.call(data,k)) continue;
            if(String(old[k]===undefined?"":old[k])!==String(data[k]===undefined?"":data[k])){ df[k]=1; chg=true; }
          }
          DB[key][idx]=Object.assign({},old,data);
          if(chg){
            var r=DB[key][idx];
            r.dirty=true;
            r._df=Object.assign({},r._df||{},df);
            r.manualAt=new Date().toISOString().slice(0,10);
          }
        }
      }else{
        data.id=uid(def.prefix||"r");
        DB[key].push(data);
      }
      save(); toast(id?"已更新":"已新增","ok"); render(currentRoute);
    }
  });
}
window.editRow=editRow;

function delRow(key,id){
  var def=SCHEMA[key];
  var row=getRows(key).filter(function(r){return r.id===id;})[0]; if(!row) return;
  var name=row[def.cols[0].k]||"该记录";
  openModal({
    title:"确认删除",
    body:'<p style="margin:0 0 10px">确定删除「<b>'+esc(name)+'</b>」？</p><p style="margin:0;font-size:12.5px;color:var(--muted)">删除后可在「数据备份」中通过导出文件找回，但无法撤销。</p>',
    okText:"删除",
    onOk:function(){
      var target=getRows(key).filter(function(r){return r.id===id;})[0];
      /* 派生行被人工删除：登记忽略，否则下次扫描文件会把它原样补回来 */
      var muted="";
      if(target&&target.srcFileId){
        var f=(DB.files||[]).filter(function(x){return x.id===target.srcFileId;})[0];
        if(f){
          f.ignore=f.ignore||{};
          var ik=key+"|"+(target.srcKey||"");
          f.ignore[ik]=1;
          muted=(f.name||"文件");
        }
      }
      DB[key]=getRows(key).filter(function(r){return r.id!==id;});
      /* 同步清掉手工顺序里的这一行，避免顺序表越积越长 */
      var ord=tableUi().tableOrder[key];
      if(ord){
        var oi=ord.indexOf(id);
        if(oi>=0){ ord.splice(oi,1); if(!ord.length) delete tableUi().tableOrder[key]; }
      }
      if(def.onDelete) def.onDelete(id);
      save();
      toast(muted?("已删除，并忽略来自「"+muted+"」的同名记录（重新解析可恢复）"):"已删除","ok");
      render(currentRoute);
    }
  });
}
window.delRow=delRow;

/* ---------- 路由与导航 ---------- */
var NAV=[
 {g:"待办中心",items:[
   {id:"inbox",l:"待处理事项",ic:"◐"}
 ]},
 {g:"工作台",items:[
   {id:"dash",l:"总览仪表盘",ic:"◎"},
   {id:"plan",l:"计划表与进度看板",ic:"▤"}
 ]},
 {g:"工作空间",items:[
   {id:"folder",l:"本地文件夹",ic:"⌸"},
   {id:"space",l:"工作空间站",ic:"⬓"},
   {id:"files",l:"文件中心",ic:"⬒"}
 ]},
 {g:"项目与质量",items:[
   {id:"projects",l:"在建项目业务清单",ic:"▣"},
   {id:"inspect",l:"质量检查整改回复",ic:"✓"},
   {id:"review",l:"施工方案内审记录",ic:"✎"},
   {id:"brief",l:"技术交底及风险识别",ic:"⚑"}
 ]},
 {g:"活动与人员",items:[
   {id:"meeting",l:"每月质量会议",ic:"▤"},
   {id:"training",l:"质量培训",ic:"◈"},
   {id:"stats",l:"质量活动统计",ic:"▦"},
   {id:"qc",l:"QC 质量活动",ic:"◇"},
   {id:"org",l:"质量管理机构",ic:"◉"}
 ]},
 {g:"标准与档案",items:[
   {id:"guide",l:"作业指导书",ic:"▤"},
   {id:"policy",l:"质量管理办法及制度",ic:"▤"}
 ]}
];
window.NAV=NAV;

var currentRoute="dash";
window.getRoute=function(){return currentRoute;};

function renderNav(){
  var h="";
  NAV.forEach(function(g){
    h+='<div class="nav-group">'+esc(g.g)+'</div>';
    g.items.forEach(function(it){
      var cnt="";
      if(it.id==="inbox"){ var ni=window.inboxCount?window.inboxCount():0; if(ni) cnt='<span class="badge">'+ni+'</span>'; }
      if(it.id==="plan"){ var od=DB.tasks.filter(function(t){return t.status!=="done"&&((t.due&&t.due<todayStr())||(t.carried||0)>0);}).length; if(od) cnt='<span class="badge" style="background:#c0392b">'+od+'</span>'; }
      if(it.id==="inspect"){ var op=DB.issues.filter(function(i){return i.status!=="已闭环";}).length; if(op) cnt='<span class="badge">'+op+'</span>'; }
      if(it.id==="folder"&&window.QD){ try{ var qt=QD.totals(); var qp=qt.nw+qt.chg; if(qp) cnt='<span class="badge" style="background:#b9770e">'+qp+'</span>'; }catch(e){} }
      if(it.id==="files"){ var fp=(DB.files||[]).filter(fileIsPending).length; if(fp) cnt='<span class="badge" style="background:#b9770e">'+fp+'</span>'; }
      h+='<button class="nav-item'+(currentRoute===it.id?" active":"")+'" data-nav="'+it.id+'">'+
         '<span class="ic">'+it.ic+'</span><span>'+esc(it.l)+'</span>'+(cnt||'<span class="badge" style="display:none"></span>')+'</button>';
    });
  });
  var n=$("#nav"); if(n) n.innerHTML=h;
  $$("[data-nav]").forEach(function(b){ b.onclick=function(){ location.hash="#/"+this.getAttribute("data-nav"); closeNav(); }; });
}
function closeNav(){ var s=$("#sidebar"); if(s) s.classList.remove("open"); var sc=$("#scrim"); if(sc) sc.classList.remove("show"); }
window.refreshNav=renderNav;

/* ---------- 页面注册 ---------- */
var PAGES={};
function regPage(id,def){ PAGES[id]=def; }
window.regPage=regPage;
window.APP.regPage=regPage;

function pageMeta(id){
  for(var i=0;i<NAV.length;i++){ for(var j=0;j<NAV[i].items.length;j++){ if(NAV[i].items[j].id===id) return NAV[i].items[j]; } }
  return {l:id,ic:""};
}

function render(id,keepScroll){
  if(!PAGES[id]) id="dash";
  var sy=keepScroll?window.scrollY:0;
  currentRoute=id;
  renderNav();
  var meta=pageMeta(id);
  var h2=$("#pageTitle"), sub=$("#pageSub");
  if(h2) h2.textContent=meta.l;
  var host=$("#content");
  host.innerHTML="";
  var def=PAGES[id];
  var wrap=document.createElement("div");
  host.appendChild(wrap);
  try{ def.render(wrap, sub); }catch(e){ console.error(e); wrap.innerHTML='<div class="card"><div class="card-b empty">页面渲染出错：'+esc(e.message)+'</div></div>'; }
  if(sub) sub.textContent=def.sub||"";
  if(keepScroll) window.scrollTo(0,sy); else window.scrollTo(0,0);
}
window.render=render;

function routeFromHash(){
  var h=(location.hash||"").replace(/^#\/?/,"")||"dash";
  return h.split("?")[0]||"dash";
}
/* 读取 hash 上的查询参数：#/plan?v=month */
function getParam(k){
  var h=location.hash||"", i=h.indexOf("?");
  if(i<0) return "";
  var q=h.slice(i+1).split("&");
  for(var j=0;j<q.length;j++){
    var p=q[j].split("=");
    if(decodeURIComponent(p[0]||"")===k) return decodeURIComponent(p[1]||"");
  }
  return "";
}
window.getParam=getParam; window.APP.getParam=getParam;
/* 跳转到指定模块，可带参数 */
function go(id,q){ location.hash="#/"+id+(q?"?"+q:""); }
window.go=go;
function boot(){
  if(!DB) DB=load();
  if(DB.meta) DB.meta.year=DB.meta.year||2026;
  if(window.onBoot) window.onBoot();
  renderNav();
  render(routeFromHash());
  window.addEventListener("hashchange",function(){ render(routeFromHash()); });
  var mb=$("#menuBtn"); if(mb) mb.onclick=function(){ $("#sidebar").classList.add("open"); $("#scrim").classList.add("show"); };
  var sc=$("#scrim"); if(sc) sc.onclick=closeNav;
  window.addEventListener("resize",function(){ if(window.innerWidth>860) closeNav(); });
}
document.addEventListener("DOMContentLoaded",boot);
})();
