/* ===== 文件夹视图：快速入口 → 浏览 / 编辑 / 保存回本地 ===== */
(function(){
"use strict";
var A=window.APP, $=A.$, $$=A.$$, esc=A.esc;
function DB(){return A.db;}
function QD(){return window.QD;}

var VS={dir:"",q:"",sort:"name",filter:"all",open:{}};
var STATUS={
  unbound:{l:"未授权",cls:"t-gray"},
  ok:{l:"已授权",cls:"t-green"},
  needauth:{l:"需重新授权",cls:"t-amber"},
  denied:{l:"授权被拒",cls:"t-red"},
  stale:{l:"文件夹不可访问",cls:"t-red"}
};

function fileUrl(p){
  var s=String(p||"").replace(/\\/g,"/").replace(/^\/+/,"");
  return "file:///"+encodeURI(s).replace(/#/g,"%23");
}
function joinVar(a,b){
  var x=String(a||"").replace(/[\\/]+$/,"");
  if(!b) return x;
  return (x?x+"\\":"")+String(b).replace(/\//g,"\\");
}
function statusChip(st){
  var s=STATUS[st]||STATUS.unbound;
  return '<span class="tag '+s.cls+'">'+s.l+'</span>';
}
function sizeOf(r){
  var c=QD().countOf(r);
  return c;
}

/* ---------- 总览：全部入口的绑定情况 ---------- */
var PMOD={};   /* route|rel → 人工改过的归档模块 */
var PUNDO=null;/* {snaps:[],n} 最近一次确认，供撤销 */

function pendKey(route,rel){ return route+"|"+rel; }
function modFor(route,rel){ return PMOD[pendKey(route,rel)]||QD().modOfRoute(route); }
function pendGroups(){
  var out=[];
  QD().boundRoutes().forEach(function(r){
    var ps=QD().pendingOf(r);
    if(!ps.length) return;
    ps.sort(function(a,b){ return (b.mt||0)-(a.mt||0); });
    out.push({route:r,label:QD().LBL[r]||r,path:QD().cfgOf(r).path||"",items:ps});
  });
  /* 待确认多的排前面：一眼看出哪个文件夹突然多了很多 */
  out.sort(function(a,b){ return (b.items.length-a.items.length)||String(a.label).localeCompare(String(b.label),"zh-CN"); });
  return out;
}
function scanAll(host){
  var btn=$("#qdScanAll",host);
  var rs=QD().boundRoutes();
  if(!rs.length){ toast("还没有已授权的入口","err"); return; }
  if(btn){ btn.disabled=true; btn.textContent="扫描中…"; }
  var i=0;
  (function next(){
    if(i>=rs.length){
      if(btn){ btn.disabled=false; btn.textContent="全部重新扫描"; }
      window.render("folder",true); toast("已刷新 "+rs.length+" 个入口","ok"); return;
    }
    QD().scanOne(rs[i++]).then(next,next);
  })();
}
/* 确认 / 忽略 / 撤销：只重绘待确认卡与计数，不动整页，避免丢滚动位置 */
function syncBits(host){
  var t=QD().totals();
  var a=$("#qdFigNw",host), b=$("#qdFigChg",host);
  if(a) a.textContent=t.nw;
  if(b) b.textContent=t.chg;
  $$("[data-pendcell]",host).forEach(function(el){
    var r=el.getAttribute("data-pendcell"), c=QD().countOf(r), p=c.new+c.chg;
    el.innerHTML=p?('<span class="tag t-amber">'+p+'</span>'):'<span class="qd-muted">0</span>';
  });
}
function afterChange(host){
  syncBits(host);
  if(window.refreshNav) window.refreshNav();
  paintPending(host);
}
function doConfirm(host,pairs){
  var byRoute={};
  pairs.forEach(function(x){ (byRoute[x.route]=byRoute[x.route]||[]).push(x.rel); });
  var snaps=[], n=0;
  Object.keys(byRoute).forEach(function(r){
    var res=QD().confirmFiles(r,byRoute[r],{silent:true,mod:function(rel){ return modFor(r,rel); }});
    if(res&&res.ok){ snaps.push(res.snap); n+=res.n; }
  });
  if(!n){ toast("这些文件已被确认过","err"); paintPending(host); return; }
  A.save();
  PUNDO={snaps:snaps,n:n};
  afterChange(host);
  toast("已确认 "+n+" 项，并归档到文件中心","ok");
}
function doIgnore(host,pairs){
  var snap={route:"",items:[],prevSeen:{},n:0}, n=0;
  var byRoute={};
  pairs.forEach(function(x){ (byRoute[x.route]=byRoute[x.route]||[]).push(x.rel); });
  var snaps=[];
  Object.keys(byRoute).forEach(function(r){
    var c=QD().cfgOf(r), s={route:r,items:[],prevSeen:{},n:0};
    byRoute[r].forEach(function(rel){
      var p=(QD().pendingOf(r).filter(function(x){return x.rel===rel;})[0]);
      if(!p) return;
      s.prevSeen[rel]=c.seen?c.seen[rel]:undefined;
      QD().ack(r,[rel],{silent:true});
      s.n++; n++;
    });
    if(s.n) snaps.push(s);
  });
  if(!n){ toast("这些文件已被确认过","err"); paintPending(host); return; }
  A.save();
  PUNDO={snaps:snaps,n:n};
  afterChange(host);
  toast("已忽略 "+n+" 项（只清计数，未写入文件中心）","ok");
}
function doUndo(host){
  if(!PUNDO) return;
  var n=QD().undoConfirm(PUNDO.snaps,true);
  PUNDO=null;
  afterChange(host);
  toast("已撤销 "+n+" 项确认","ok");
}
function pickModule(host,key){
  var i=key.indexOf("|"), route=key.slice(0,i), rel=key.slice(i+1);
  var mods=["综合","计划看板","质量会议","质量培训","质量活动统计","在建项目","QC 活动","质量检查",
            "方案内审","技术交底","风险识别","质量管理机构","作业指导书","办法制度"];
  var cur=modFor(route,rel);
  openModal({
    title:"归档模块",
    okText:"确定",
    body:'<div class="field"><label>确认后归入哪个模块</label><select id="qdModSel">'+
      mods.map(function(m){ return '<option'+(m===cur?' selected':'')+'>'+esc(m)+'</option>'; }).join("")+
      '</select></div>'+
      '<p style="margin:10px 0 0;font-size:12px;color:var(--muted);line-height:1.8">'+
      '默认按入口推断（'+(QD().LBL[route]||route)+' → '+QD().modOfRoute(route)+'）。'+
      '这里改动只作用于这一个文件，同入口的其它文件仍按默认值。</p>',
    onOk:function(scope){
      var v=$("#qdModSel",scope).value;
      PMOD[key]=v;
      paintPending(host);
      toast("已改为「"+v+"」，确认时生效","ok");
    }
  });
}
function paintPending(host){
  var body=$("#qdPendBody",host), sum=$("#qdPendSum",host), allBtn=$("#qdPendAll",host);
  if(!body) return;
  var gs=pendGroups(), tot=0;
  gs.forEach(function(g){ tot+=g.items.length; });

  if(sum) sum.innerHTML=tot?('共 <b>'+tot+'</b> 项 · '+gs.length+' 个入口'):'';
  if(allBtn){
    allBtn.textContent=tot?("全部确认 · "+tot):"立即扫描";
    allBtn.className=tot?"btn sm primary":"btn sm";
    allBtn.disabled=false;
  }

  var h="";
  if(PUNDO){
    h+='<div class="undo-bar" style="margin:10px 14px 0"><span>已确认 <b>'+PUNDO.n+'</b> 项，已归档到文件中心</span>'+
      '<div class="spacer"></div><button class="btn sm" id="qdUndo">撤销</button>'+
      '<button class="btn sm ghost" id="qdUndoX">×</button></div>';
  }
  if(!tot){
    h+='<div class="qd-pend-empty">✓ 全部已确认<span>扫描到新文件或文件被修改时会自动出现在这里</span></div>';
  }else{
    gs.forEach(function(g){
      var shown=g.items.slice(0,10), more=g.items.length-shown.length;
      h+='<div class="qd-pgrp"><div class="qd-pgrp-h">'+
        '<b>'+esc(g.label)+'</b><span class="tag t-amber">'+g.items.length+' 项</span>'+
        '<span class="qd-pgrp-p" title="'+esc(g.path)+'">'+esc(g.path||"—")+'</span>'+
        '<div class="spacer"></div>'+
        '<button class="btn sm" data-pall="'+esc(g.route)+'">全部确认</button></div>';
      shown.forEach(function(p){
        var key=pendKey(g.route,p.rel);
        h+='<div class="qd-prow">'+
          '<div class="qd-pf"><div class="qd-pf-n">'+esc(p.name)+
            (p.kind==="new"?'<span class="tag t-p2">新增</span>':'<span class="tag t-amber">已变更</span>')+'</div>'+
            '<div class="qd-pf-p">'+esc(p.rel)+'</div></div>'+
          '<div class="qd-pf-m">'+QD().fmtSize(p.size)+' · '+QD().dateOf(p.mt)+'</div>'+
          '<button class="qd-mod" data-pmod="'+esc(key)+'" title="点击修改归档模块">→ '+esc(modFor(g.route,p.rel))+'</button>'+
          '<div class="qd-pf-a">'+
            '<button class="btn sm primary" data-pok="'+esc(key)+'">确认</button>'+
            '<button class="btn sm ghost" data-pig="'+esc(key)+'" title="只清待确认计数，不写入文件中心">忽略</button>'+
          '</div></div>';
      });
      if(more>0){
        h+='<div class="qd-pmore"><button class="qd-link" data-pmore="'+esc(g.route)+'">另有 '+more+' 项待确认，到该文件夹处理 ›</button></div>';
      }
      h+='</div>';
    });
  }
  body.innerHTML=h;

  if($("#qdUndo",body)) $("#qdUndo",body).onclick=function(){ doUndo(host); };
  if($("#qdUndoX",body)) $("#qdUndoX",body).onclick=function(){ PUNDO=null; paintPending(host); };
  $$("[data-pok]",body).forEach(function(b){
    b.onclick=function(){
      var key=this.getAttribute("data-pok"), i=key.indexOf("|");
      doConfirm(host,[{route:key.slice(0,i),rel:key.slice(i+1)}]);
    };
  });
  $$("[data-pig]",body).forEach(function(b){
    b.onclick=function(){
      var key=this.getAttribute("data-pig"), i=key.indexOf("|");
      doIgnore(host,[{route:key.slice(0,i),rel:key.slice(i+1)}]);
    };
  });
  $$("[data-pall]",body).forEach(function(b){
    b.onclick=function(){
      var r=this.getAttribute("data-pall");
      var g=pendGroups().filter(function(x){return x.route===r;})[0];
      if(!g) return;
      doConfirm(host,g.items.map(function(p){ return {route:r,rel:p.rel}; }));
    };
  });
  $$("[data-pmod]",body).forEach(function(b){
    b.onclick=function(){ pickModule(host,this.getAttribute("data-pmod")); };
  });
  $$("[data-pmore]",body).forEach(function(b){
    b.onclick=function(){
      VS.filter="pending"; VS.dir=""; VS.q="";
      location.hash="#/folder?r="+encodeURIComponent(this.getAttribute("data-pmore"));
    };
  });
}

function renderOverview(host){
  var list=QD().listAll();
  var t=QD().totals();
  var h="";

  h+='<div class="card" style="margin-bottom:14px"><div class="card-h">'+
    '<h3>文件夹总览</h3><span class="hint">每个快速入口最多绑定 1 个本地文件夹</span><div class="spacer"></div>'+
    '<button class="btn" id="qdScanAll">全部重新扫描</button></div>'+
    '<div class="card-b">'+
    '<div class="qd-figs">'+
      '<div class="qd-fig"><b>'+t.bound+'</b><span>已绑定入口</span></div>'+
      '<div class="qd-fig"><b>'+t.total+'</b><span>索引文件</span></div>'+
      '<div class="qd-fig qd-fig-link" data-jump="pend" role="button" tabindex="0" title="定位到待确认文件">'+
        '<b class="c-amber" id="qdFigNw">'+t.nw+'</b><span>未确认新增</span></div>'+
      '<div class="qd-fig qd-fig-link" data-jump="pend" role="button" tabindex="0" title="定位到待确认文件">'+
        '<b class="c-amber" id="qdFigChg">'+t.chg+'</b><span>未确认变更</span></div>'+
      '<div class="qd-fig"><b class="c-red">'+t.gone+'</b><span>已消失</span></div>'+
    '</div>'+
    '<div class="qd-tip">'+
      '<b>读取方式：</b>浏览器不允许按路径直接读取本地文件，因此绑定用的是「目录句柄」——点一次「授权文件夹」，选中实际目录，'+
      '浏览器记住的是你选中的那个目录，而不是上面显示的路径文字。路径文字只用于核对、复制与快速定位。<br>'+
      '<b>同步机制：</b>进入页面即扫、切回窗口即扫、页面可见时每 60 秒轮询、也可手动刷新；只在已授权且权限有效的入口上扫描，不会反复弹授权框。<br>'+
      '<b>写回范围：</b>txt / md / csv / json / log / ini 等纯文本可站内编辑并保存回原件；docx / xlsx / pdf 等只读，可整文件替换。<br>'+
      '<b>失效处理：</b>文件夹被删、改名或权限失效时，绑定不会自动清除，入口标为「不可访问」并保留索引快照，点击可重新授权。'+
    '</div></div></div>';

  /* ----- 待确认：常驻卡片，0 条也保留（按钮变「立即扫描」） ----- */
  h+='<div class="card qd-pend" id="qdPendCard" style="margin-bottom:14px">'+
    '<div class="card-h"><h3>待确认文件</h3>'+
      '<span class="hint">确认后清空计数，并归档一条记录到文件中心</span>'+
      '<div class="spacer"></div><span class="qd-pend-sum" id="qdPendSum"></span>'+
      '<button class="btn sm" id="qdPendAll">立即扫描</button></div>'+
    '<div class="card-b" style="padding:0" id="qdPendBody"></div></div>';

  h+='<div class="card"><div class="card-h"><h3>入口绑定</h3><span class="hint">点「打开」进入文件夹视图</span></div>'+
    '<div class="card-b" style="padding:0"><div class="qd-table">';
  list.forEach(function(it){
    var c=it.cfg, st=c.status||"unbound", cnt=QD().countOf(it.route);
    var pend=cnt.new+cnt.chg;
    h+='<div class="qd-tr">'+
      '<div class="qd-td-name"><b>'+esc(it.label)+'</b>'+
        '<span class="qd-path" title="'+esc(c.path)+'">'+esc(c.path||"—")+'</span></div>'+
      '<div class="qd-td-st">'+statusChip(st)+
        (c.recurse?'<span class="tag t-gray">含子目录</span>':'')+
        (!c.rw&&st!=="unbound"?'<span class="tag t-gray">只读</span>':'')+'</div>'+
      '<div class="qd-td-num">'+(st==="unbound"?'<span class="qd-muted">—</span>':cnt.total+' 个')+'</div>'+
      '<div class="qd-td-num" data-pendcell="'+esc(it.route)+'">'+
        (pend?'<span class="tag t-amber">'+pend+'</span>':'<span class="qd-muted">0</span>')+'</div>'+
      '<div class="qd-td-act">'+
        (st==="unbound"
          ? '<button class="btn sm primary" data-bind="'+esc(it.route)+'">授权</button>'
          : '<button class="btn sm" data-open="'+esc(it.route)+'">打开</button>'+
            '<button class="btn sm ghost" data-bind="'+esc(it.route)+'">换绑</button>'+
            '<button class="btn sm ghost" style="color:#c0392b" data-unbind="'+esc(it.route)+'">解绑</button>')+
      '</div></div>';
  });
  h+='</div></div></div>';

  host.innerHTML=h;
  paintPending(host);

  $("#qdScanAll",host).onclick=function(){ scanAll(host); };
  $("#qdPendAll",host).onclick=function(){
    if(!pendGroups().length){ scanAll(host); return; }
    var gs=pendGroups(), tot=0, rows=[];
    gs.forEach(function(g){ tot+=g.items.length; rows.push(g.label+" "+g.items.length+" 项"); });
    openModal({
      title:"全部确认并归档",
      okText:"确认 "+tot+" 项",
      body:'<p style="margin:0 0 8px">本次将确认 <b>'+tot+'</b> 项，并按入口归入对应模块：</p>'+
        '<p style="margin:0 0 10px;font-size:12.5px;line-height:1.9">'+esc(rows.join("、"))+'</p>'+
        '<p style="margin:0;font-size:12.5px;color:var(--muted);line-height:1.8">'+
        '确认后清空待确认计数，并在文件中心写入归档记录（指向本地原件，不复制文件）。'+
        '确认完可点「撤销」回退一次。</p>',
      onOk:function(){
        var pairs=[];
        gs.forEach(function(g){ g.items.forEach(function(p){ pairs.push({route:g.route,rel:p.rel}); }); });
        doConfirm(host,pairs);
      }
    });
  };
  $$("[data-jump]",host).forEach(function(el){
    var go=function(){
      var card=$("#qdPendCard",host);
      if(!card) return;
      card.scrollIntoView({behavior:"smooth",block:"center"});
      card.classList.add("flash");
      setTimeout(function(){ card.classList.remove("flash"); },1200);
    };
    el.onclick=go;
    el.onkeydown=function(ev){ if(ev.key==="Enter"||ev.key===" "){ ev.preventDefault(); go(); } };
  });
  $$("[data-open]",host).forEach(function(b){ b.onclick=function(){ location.hash="#/folder?r="+this.getAttribute("data-open"); }; });
  $$("[data-bind]",host).forEach(function(b){ b.onclick=function(){ openBind(this.getAttribute("data-bind")); }; });
  $$("[data-unbind]",host).forEach(function(b){
    b.onclick=function(){
      var r=this.getAttribute("data-unbind");
      if(!confirm("解除「"+(QD().LBL[r]||r)+"」的文件夹绑定？\n只删除绑定关系与索引，本地文件与台账数据都不受影响。")) return;
      QD().unbind(r); window.render("folder",true); toast("已解除绑定","ok");
    };
  });
}

/* ---------- 绑定 / 换绑弹窗 ---------- */
function openBind(route){
  var c=QD().cfgOf(route);
  var lbl=QD().LBL[route]||route;
  var body=
    '<div style="font-size:12.5px;color:var(--muted);line-height:1.75;margin-bottom:12px">'+
      '1) 先填写该文件夹在电脑上的完整路径（用于核对与复制）；<br>'+
      '2) 再点「选择文件夹并授权」，在弹窗里选中<b>同一个</b>文件夹；<br>'+
      '3) 浏览器只把「你选中的目录」记成句柄，路径文字本身不能用来读文件。'+
    '</div>'+
    '<div class="field"><label>文件夹路径</label>'+
      '<input type="text" id="qdPath" value="'+esc(c.path||"")+'" placeholder="E:\\workbuddy 缓存\\workbuddy\\总工作台\\raw\\a资源\\2026公司质量管理台账\\1、质量会议（每月统计）"></div>'+
    '<div class="qd-row2">'+
      '<label class="qd-chk"><input type="checkbox" id="qdRW"'+(c.rw?" checked":"")+'> 允许写回（关闭则只读）</label>'+
      '<label class="qd-chk"><input type="checkbox" id="qdRec"'+(c.recurse?" checked":"")+'> 包含子文件夹</label>'+
    '</div>'+
    '<div class="qd-hintbox" id="qdHint">'+
      '授权后系统会立即扫描一次，列出文件数量与待确认项。'+
    '</div>';

  openModal({
    title:"绑定文件夹 · "+lbl,
    okText:"选择文件夹并授权",
    body:body,
    onOk:function(scope){
      var p=$("#qdPath",scope).value.trim();
      var g=QD().guardPath(p);
      if(!g.ok){ toast(g.msg,"err"); return false; }
      var cc=QD().cfgOf(route);
      cc.path=p; cc.rw=$("#qdRW",scope).checked; cc.recurse=$("#qdRec",scope).checked;
      A.save();
      var btn=$("[data-ok]",scope);
      btn.disabled=true; btn.textContent="等待选择…";
      QD().bind(route,{path:p}).then(function(handle){
        /* 文件夹名与路径末段不一致时提示（浏览器只给名字） */
        var pn=QD().nameOfPath(p);
        var back=function(){
          window.render("folder",true); toast("已绑定「"+handle.name+"」","ok");
        };
        return QD().scanOne(route).then(function(){
          var cnt=QD().countOf(route);
          if(pn && pn!==handle.name){
            toast("注意：你选中的是「"+handle.name+"」，与填写的路径末段「"+pn+"」不一致","err");
          }
          return {cnt:cnt};
        }).then(back);
      }).catch(function(e){
        btn.disabled=false; btn.textContent="选择文件夹并授权";
        if(/AbortError/.test((e&&e.message)||"")){ toast("已取消选择","err"); return; }
        toast(QD().errText(e),"err");
      });
      return false;
    }
  });
}

/* ---------- 单个入口：文件夹视图 ---------- */
function renderDetail(host,route){
  var c=QD().cfgOf(route);
  var lbl=QD().LBL[route]||route;
  var st=c.status||"unbound";
  var h="";

  /* 未授权：引导 */
  if(st==="unbound"){
    host.innerHTML='<div class="card"><div class="card-b">'+
      '<div class="qd-empty">'+
        '<div class="qd-empty-ic">⌸</div>'+
        '<div class="qd-empty-t">「'+esc(lbl)+'」还没有绑定本地文件夹</div>'+
        '<div class="qd-empty-d">绑定后，点击仪表盘上的这个快速入口会直接进入该文件夹，'+
          '可以浏览、打开并编辑其中的文件，改动直接写回本地原件。</div>'+
        '<div class="qd-empty-p">预填路径：<b>'+esc(c.path||"—")+'</b></div>'+
        '<div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin-top:14px">'+
          '<button class="btn primary" id="qdBind">授权文件夹</button>'+
          '<button class="btn" id="qdBack">返回总览</button>'+
        '</div>'+
      '</div></div></div>';
    $("#qdBind",host).onclick=function(){ openBind(route); };
    $("#qdBack",host).onclick=function(){ location.hash="#/folder"; };
    return;
  }

  var cnt=QD().countOf(route);
  var tblBack=QD().MOD_ROUTE[route]?"#/"+QD().MOD_ROUTE[route]:"";

  h+='<div class="card qd-head" style="margin-bottom:14px"><div class="card-b">'+
    '<div class="qd-title">'+
      '<h3>'+esc(lbl)+'</h3>'+statusChip(st)+
      (c.recurse?'<span class="tag t-gray">含子目录</span>':'')+
      (c.rw?'<span class="tag t-p2">可写回</span>':'<span class="tag t-gray">只读</span>')+
      '<div class="spacer"></div>'+
      '<button class="btn sm" id="qdRefresh">刷新</button>'+
      '<button class="btn sm" id="qdOpenDir">打开文件夹</button>'+
      '<button class="btn sm" id="qdMore">绑定设置</button>'+
      (tblBack?'<button class="btn sm primary" id="qdToTable">切换台账</button>':'')+
    '</div>'+
    '<div class="qd-pathline" title="'+esc(c.path)+'">'+esc(c.path||"（未填写路径）")+'</div>'+
    '<div class="qd-stat">'+
      '<span>上次扫描：<b>'+(c.lastScanAt?esc(c.lastScanAt):"尚未扫描")+'</b></span>'+
      '<span>索引文件：<b>'+cnt.total+'</b> 个</span>'+
      '<span>新增待确认：<b class="c-amber">'+cnt.new+'</b></span>'+
      '<span>变更待确认：<b class="c-amber">'+cnt.chg+'</b></span>'+
      (cnt.gone?'<span>已消失：<b class="c-red">'+cnt.gone+'</b></span>':'')+
    '</div>';

  if(st!=="ok"){
    h+='<div class="qd-alert '+(st==="stale"?"warn":"info")+'">'+
      '<div><b>'+(st==="stale"?"文件夹当前不可访问":"需要重新授权")+'</b>'+
      '<div class="qd-alert-d">'+
        (st==="stale"
          ? "可能原因：目录被删除或改名、U 盘或网络盘未连接、权限被系统回收。下面显示的是上次扫描的索引快照，点「重新授权」选一次目录即可恢复。"
          : "浏览器在页面刷新后不会自动保留写入权限，需要你点一次授权（这是浏览器的安全要求）。")+
      '</div></div>'+
      '<div class="spacer"></div>'+
      '<button class="btn primary" id="qdReauth">重新授权</button>'+
      '<button class="btn" id="qdRebind">换绑其他文件夹</button>'+
    '</div>';
  }
  h+='</div></div>';

  /* 面包屑 */
  var segs=VS.dir?VS.dir.split("/"):[];
  var crumb='<div class="qd-crumb"><button class="qd-crumb-i" data-crumb="">根目录</button>';
  var acc="";
  segs.forEach(function(s){
    acc=acc?acc+"/"+s:s;
    crumb+='<span class="qd-sep">›</span><button class="qd-crumb-i" data-crumb="'+esc(acc)+'">'+esc(s)+'</button>';
  });
  crumb+='</div>';

  h+='<div class="card"><div class="card-h" style="flex-wrap:wrap;gap:8px">'+
      crumb+'<div class="spacer"></div>'+
      '<div class="search"><input type="search" id="qdQ" placeholder="搜索文件名…" value="'+esc(VS.q)+'"></div>'+
      '<select id="qdSort">'+
        [["name","按名称"],["mt","按修改时间"],["size","按大小"]].map(function(x){
          return '<option value="'+x[0]+'"'+(VS.sort===x[0]?" selected":"")+'>'+x[1]+'</option>';
        }).join("")+'</select>'+
      '<select id="qdFilter">'+
        [["all","全部"],["text","仅文本"],["pending","仅待确认"]].map(function(x){
          return '<option value="'+x[0]+'"'+(VS.filter===x[0]?" selected":"")+'>'+x[1]+'</option>';
        }).join("")+'</select>'+
      (c.rw?'<button class="btn sm" id="qdNew">+ 新建文本</button>':'')+
      '</div><div id="qdList"></div></div>';

  /* 机制说明 */
  h+='<div class="qd-note">'+
    '<b>同步：</b>进入本页、切回窗口、每 60 秒自动、以及点「刷新」时重新扫描，只比对文件名/大小/修改时间；'+
    '<b>编辑：</b>文本类可改并保存回原件（保存后自动重扫并更新仪表盘），docx/xlsx/pdf 只读；'+
    '<b>原件：</b>不移动、不改名、不批量删除，删除操作仅针对你逐个确认的单个文件。'+
    '</div>';

  host.innerHTML=h;

  if(st!=="ok"){
    $("#qdReauth",host).onclick=function(){
      var btn=this; btn.disabled=true;
      QD().ensurePerm(route,"readwrite").then(function(){
        return QD().scanOne(route);
      }).then(function(){
        window.render("folder",true); toast("已恢复访问","ok");
      }).catch(function(e){
        btn.disabled=false;
        toast(QD().errText(e),"err");
      });
    };
    $("#qdRebind",host).onclick=function(){ openBind(route); };
  }
  $("#qdRefresh",host).onclick=function(){
    var btn=this; btn.textContent="扫描中…"; btn.disabled=true;
    QD().scanOne(route).then(function(res){
      window.render("folder",true);
      if(res&&res.err) toast(QD().errText({message:res.err}),"err");
      else toast("已刷新","ok");
    },function(e){ toast(QD().errText(e),"err"); });
  };
  $("#qdOpenDir",host).onclick=function(){
    var p=c.path||"";
    if(!p){ toast("还没有填写路径","err"); return; }
    try{ window.open(fileUrl(p),"_blank"); }catch(e){}
    if(window.copyText) window.copyText(p);
    toast("已尝试打开文件夹，路径已复制","ok");
  };
  $("#qdMore",host).onclick=function(){ openBind(route); };
  if(tblBack){ $("#qdToTable",host).onclick=function(){ location.hash=tblBack; }; }
  if($("#qdNew",host)) $("#qdNew",host).onclick=function(){ newTextFile(route); };

  paintList(host,route);
}

/* ---------- 列表 ---------- */
function paintList(host,route){
  var box=$("#qdList",host); if(!box) return;
  var c=QD().cfgOf(route);
  var q=VS.q.toLowerCase();
  var pending={};
  QD().pendingOf(route).forEach(function(p){ pending[p.rel]=p.kind; });

  /* 子目录：从索引的相对路径里推导当前层 */
  var base=VS.dir?VS.dir+"/":"";
  var dirs={}, files=[];
  (c.idx||[]).forEach(function(e){
    if(VS.dir && e.rel.indexOf(base)!==0) return;
    var rest=VS.dir?e.rel.slice(base.length):e.rel;
    if(rest.indexOf("/")>=0){
      var d=rest.split("/")[0];
      dirs[d]=(dirs[d]||0)+1;
    }else{
      files.push(e);
    }
  });

  if(q) files=files.filter(function(e){ return e.name.toLowerCase().indexOf(q)>=0; });
  if(VS.filter==="text") files=files.filter(function(e){ return QD().isText(e.name); });
  if(VS.filter==="pending") files=files.filter(function(e){ return !!pending[e.rel]; });

  if(VS.sort==="mt") files.sort(function(a,b){ return (b.mt||0)-(a.mt||0); });
  else if(VS.sort==="size") files.sort(function(a,b){ return (b.size||0)-(a.size||0); });
  else files.sort(function(a,b){ return String(a.name).localeCompare(String(b.name),"zh-CN"); });

  var h="";
  var dirNames=Object.keys(dirs).sort(function(a,b){ return a.localeCompare(b,"zh-CN"); });
  if(dirNames.length&&!q){
    h+='<div class="qd-dirs">'+dirNames.map(function(d){
      return '<button class="qd-dir" data-dir="'+esc(VS.dir?VS.dir+"/"+d:d)+'">'+
        '<span class="qd-dir-ic">▸</span><span class="qd-dir-n">'+esc(d)+'</span>'+
        '<span class="qd-dir-c">'+dirs[d]+'</span></button>';
    }).join("")+'</div>';
  }

  if(!files.length&&!dirNames.length){
    h+='<div class="empty">这个文件夹里没有可显示的文件'+
      (c.status!=="ok"?"（当前为快照，重新授权后可读取实际内容）":"")+'</div>';
  }else if(files.length){
    h+='<div class="qd-files">';
    files.forEach(function(e){
      var st=pending[e.rel];
      var isImg=QD().isImg(e.name);
      var canEdit=QD().isText(e.name)&&c.rw&&c.status==="ok";
      var imgAttr=isImg?' data-img="'+esc(e.rel)+'"':'';
      var actBtn=isImg
        ? '<button class="btn sm" data-view="'+esc(e.rel)+'">预览</button>'
        : QD().isText(e.name)
          ? '<button class="btn sm'+(canEdit?" primary":"")+'" data-edit="'+esc(e.rel)+'">'+(canEdit?"编辑":"查看")+'</button>'
          : '<button class="btn sm" data-view="'+esc(e.rel)+'">详情</button>';
      h+='<div class="qd-file'+(isImg?" qd-imgrow":"")+'">'+
        '<div class="qd-ext"'+imgAttr+(isImg?' role="button" tabindex="0" title="点击预览"':'')+'>'+
          esc((QD().extOf(e.name)||"—").slice(0,4).toUpperCase())+'</div>'+
        '<div class="qd-fmain">'+
          '<div class="qd-fname"'+imgAttr+' title="'+esc(e.rel)+'">'+esc(e.name)+
            (st==='new'?'<span class="tag t-p2">新增</span>':st==='chg'?'<span class="tag t-amber">已变更</span>':'')+
            (!QD().isText(e.name)?'<span class="tag t-gray">只读</span>':'')+
          '</div>'+
          '<div class="qd-fmeta">'+QD().fmtSize(e.size)+' · '+QD().dateOf(e.mt)+' · '+esc(e.rel.split("/").slice(0,-1).join("/")||"根目录")+'</div>'+
        '</div>'+
        '<div class="qd-fact">'+
          actBtn+
          (c.rw&&c.status==="ok"?'<button class="btn sm ghost" data-replace="'+esc(e.rel)+'">替换</button>':'')+
          '<button class="btn sm ghost" data-copy="'+esc(e.rel)+'">路径</button>'+
          (c.rw&&c.status==="ok"?'<button class="btn sm ghost" style="color:#c0392b" data-del="'+esc(e.rel)+'">删</button>':'')+
        '</div></div>';
    });
    h+='</div>';
  }
  box.innerHTML=h;

  $$("[data-dir]",box).forEach(function(b){
    b.onclick=function(){ VS.dir=this.getAttribute("data-dir"); VS.q=""; paintList(host,route); };
  });
  $$("[data-edit]",box).forEach(function(b){
    b.onclick=function(){ openEditor(route,this.getAttribute("data-edit")); };
  });
  $$("[data-view]",box).forEach(function(b){
    b.onclick=function(){
      var rel=this.getAttribute("data-view");
      if(QD().isImg(rel)) openImg(route,rel);
      else fileInfo(route,rel);
    };
  });
  /* 双入口：扩展名方块 + 文件名 */
  $$("[data-img]",box).forEach(function(el){
    el.onclick=function(){ openImg(route,this.getAttribute("data-img")); };
    if(el.getAttribute("role")==="button"){
      el.onkeydown=function(ev){
        if(ev.key==="Enter"||ev.key===" "){
          ev.preventDefault();
          openImg(route,this.getAttribute("data-img"));
        }
      };
    }
  });
  $$("[data-replace]",box).forEach(function(b){
    b.onclick=function(){ replacePick(route,this.getAttribute("data-replace")); };
  });
  $$("[data-copy]",box).forEach(function(b){
    b.onclick=function(){
      var rel=this.getAttribute("data-copy");
      var p=joinVar(QD().cfgOf(route).path,rel);
      if(window.copyText) window.copyText(p); else toast(p,"ok");
    };
  });
  $$("[data-del]",box).forEach(function(b){
    b.onclick=function(){
      var rel=this.getAttribute("data-del");
      if(!confirm("删除本地文件「"+rel+"」？\n此操作会直接删除 E 盘原件，不可撤销。")) return;
      QD().removeEntry(route,rel).then(function(){
        toast("已删除","ok"); window.render("folder",true);
      },function(e){ toast(QD().errText(e),"err"); });
    };
  });

  /* 面包屑点击 */
  $$("[data-crumb]",host).forEach(function(b){
    b.onclick=function(){ VS.dir=this.getAttribute("data-crumb"); VS.q=""; paintList(host,route); };
  });
  /* 工具条 */
  var qi=$("#qdQ",host);
  if(qi) qi.oninput=function(){ VS.q=this.value; var pos=this.selectionStart; paintList(host,route);
    var n=$("#qdQ",host); if(n){ n.focus(); try{ n.setSelectionRange(pos,pos); }catch(e){} } };
  var so=$("#qdSort",host);
  if(so) so.onchange=function(){ VS.sort=this.value; paintList(host,route); };
  var fi=$("#qdFilter",host);
  if(fi) fi.onchange=function(){ VS.filter=this.value; paintList(host,route); };
}

/* ---------- 文本编辑器 ---------- */
function openEditor(route,rel){
  var c=QD().cfgOf(route);
  var name=rel.split("/").pop();
  var mask=openModal({
    title:(c.rw?"编辑 · ":"查看 · ")+name,
    okText:c.rw?"保存写回":"关闭",
    noCancel:!c.rw,
    body:'<div class="qd-ed-head" id="qdEdHead">读取中…</div>'+
      '<textarea class="qd-ed" id="qdEd" spellcheck="false" disabled placeholder="正在读取文件…"></textarea>'+
      '<div class="qd-ed-foot" id="qdEdFoot"></div>',
    onOk:function(scope){
      if(!c.rw) return true;
      var ta=$("#qdEd",scope);
      if(ta.disabled) return false;
      var btn=$("[data-ok]",scope);
      btn.disabled=true; btn.textContent="保存中…";
      QD().writeText(route,rel,ta.value,{bom:mask._bom,eol:mask._eol,enc:mask._enc}).then(function(){
        toast("已保存到本地","ok");
        mask._saved=true;
        btn.disabled=false; btn.textContent="保存写回";
        window.render("folder",true);
      }).catch(function(e){
        btn.disabled=false; btn.textContent="保存写回";
        toast(QD().errText(e),"err");
      });
      return false;
    }
  });
  var modal=$(".modal",mask); if(modal) modal.classList.add("modal-wide");

  QD().readText(route,rel).then(function(d){
    var ta=$("#qdEd",mask);
    mask._bom=d.bom; mask._eol=d.eol; mask._enc=d.enc;
    ta.value=d.text;
    ta.disabled=false;
    ta.onkeydown=function(e){
      if((e.ctrlKey||e.metaKey)&&(e.key==="s"||e.key==="S")){
        e.preventDefault();
        var ok=$("[data-ok]",mask); if(ok&&!ok.disabled) ok.click();
      }
    };
    setTimeout(function(){ ta.focus(); },60);
    var encName=d.enc==="gbk"?"GBK":d.enc==="utf-16le"?"UTF-16 LE":d.enc==="utf-16be"?"UTF-16 BE":"UTF-8";
    $("#qdEdHead",mask).innerHTML='<span>'+esc(rel)+'</span><span class="qd-ed-meta">原编码 '+encName+
      (d.bom?" · 含 BOM":"")+' · 换行 '+(d.eol==="\r\n"?"CRLF":d.eol==="\r"?"CR":"LF")+'</span>';
    var warn="";
    if(d.enc==="gbk") warn="该文件为 GBK 编码，保存后将以 UTF-8 写回（记事本、Excel、WPS 均可正常打开）。";
    if(d.enc==="utf-16le"||d.enc==="utf-16be") warn="该文件为 UTF-16 编码，保存后将以 UTF-8 写回。";
    $("#qdEdFoot",mask).innerHTML='<span class="qd-ed-cnt" id="qdCnt">'+d.text.length+' 字</span>'+
      (warn?'<span class="qd-ed-warn">'+warn+'</span>':'')+
      '<span class="qd-ed-kb">Ctrl + S 保存</span>';
    ta.oninput=function(){ var el=$("#qdCnt",mask); if(el) el.textContent=this.value.length+" 字"; };
  },function(e){
    $("#qdEdHead",mask).textContent=QD().errText(e);
    toast(QD().errText(e),"err");
    var ok=$("[data-ok]",mask); if(ok) ok.style.display="none";
  });
}

/* ---------- 图片预览（走共用弹层） ---------- */
function openImg(route,rel){
  if(!window.ImgView){ toast("预览模块未加载，请重新构建页面","err"); return; }
  var c=QD().cfgOf(route);
  var it=(c.idx||[]).filter(function(x){ return x.rel===rel; })[0]||{};
  var full=joinVar(c.path,rel);
  window.ImgView.open({
    name:rel.split("/").pop(), size:it.size||0, path:full,
    getBlob:function(escalate){
      var pre=escalate?QD().ensurePerm(route,"read"):Promise.resolve();
      return pre.then(function(){ return QD().readBlob(route,rel); });
    },
    onDetail:function(){ fileInfo(route,rel); }
  });
}

/* ---------- 二进制文件信息 / 替换 / 新建 ---------- */
function fileInfo(route,rel){
  var c=QD().cfgOf(route);
  var idx=(c.idx||[]).filter(function(e){ return e.rel===rel; })[0]||{};
  var full=joinVar(c.path,rel);
  openModal({
    title:"文件详情",
    okText:"复制完整路径",
    body:'<div class="qd-info">'+
      '<div class="qd-info-r"><span>文件名</span><b>'+esc(idx.name||rel.split("/").pop())+'</b></div>'+
      '<div class="qd-info-r"><span>相对路径</span><b>'+esc(rel)+'</b></div>'+
      '<div class="qd-info-r"><span>完整路径</span><b style="word-break:break-all">'+esc(full)+'</b></div>'+
      '<div class="qd-info-r"><span>大小</span><b>'+QD().fmtSize(idx.size)+'</b></div>'+
      '<div class="qd-info-r"><span>修改时间</span><b>'+QD().dateOf(idx.mt)+'</b></div>'+
      '<div class="qd-info-r"><span>站内编辑</span><b>不支持（二进制格式）</b></div>'+
      '</div>'+
      '<div class="qd-tip" style="margin-top:10px">浏览器无法启动 Word / Excel，也不能修改二进制格式。'+
      '可以「复制完整路径」后在资源管理器中打开编辑；改完回到本页点「刷新」，仪表盘会同步大小与修改时间。</div>',
    onOk:function(){
      if(window.copyText) window.copyText(full);
      toast("路径已复制","ok");
      return true;
    }
  });
}
function replacePick(route,rel){
  var inp=document.createElement("input");
  inp.type="file";
  inp.onchange=function(){
    var f=this.files&&this.files[0]; if(!f) return;
    if(!confirm("用「"+f.name+"」覆盖写回「"+rel.split("/").pop()+"」？\n原文件内容会被替换。")) return;
    QD().replaceFile(route,rel,f).then(function(){
      toast("已替换写回","ok"); window.render("folder",true);
    },function(e){ toast(QD().errText(e),"err"); });
  };
  inp.click();
}
function newTextFile(route){
  var c=QD().cfgOf(route);
  openModal({
    title:"新建文本文件",
    okText:"创建",
    body:'<div class="field"><label>文件名（含扩展名）</label>'+
      '<input type="text" id="qdNewName" value="新建记录.txt" placeholder="如：2026-11 质量检查记录.txt"></div>'+
      '<div class="qd-hintbox" style="margin-top:10px">将创建在当前目录：<b>'+esc(VS.dir||"根目录")+
      '</b>。支持 .txt / .md / .csv / .json。</div>',
    onOk:function(scope){
      var n=$("#qdNewName",scope).value.trim();
      if(!n){ toast("请填写文件名","err"); return false; }
      if(/[\\/:*?"<>|]/.test(n)){ toast("文件名不能包含 \\ / : * ? \" < > |","err"); return false; }
      var rel=VS.dir?VS.dir+"/"+n:n;
      var blob=new Blob(["\ufeff"],{type:"text/plain;charset=utf-8"});
      QD().createFile(route,rel,blob).then(function(){
        toast("已创建","ok"); window.render("folder",true);
      },function(e){ toast(QD().errText(e),"err"); });
      return true;
    }
  });
}

/* ---------- 页面注册 ---------- */
window.regPage("folder",{
  sub:"快速入口绑定的本地文件夹：浏览、编辑、保存回原件",
  render:function(host){
    if(!window.QD){
      host.innerHTML='<div class="card"><div class="card-b empty">文件夹模块未加载</div></div>';
      return;
    }
    if(!window.showDirectoryPicker){
      host.innerHTML='<div class="card"><div class="card-b">'+
        '<div class="qd-alert warn"><div><b>当前浏览器不支持目录授权</b>'+
        '<div class="qd-alert-d">本功能需要 Chromium 内核（Edge / Chrome）并支持 File System Access API。'+
        '请用 Edge 打开本文件后重试。</div></div></div></div></div>';
      return;
    }
    var route=window.getParam?window.getParam("r"):"";
    var detail=$("#pageTitle");
    if(route){ VS.dir=""; VS.q=""; }
    if(!route){ renderOverview(host); if(detail) detail.textContent="文件夹总览"; return; }
    if(detail) detail.textContent="文件夹 · "+(QD().LBL[route]||route);
    renderDetail(host,route);
    /* 进入即扫（不弹授权） */
    var c=QD().cfgOf(route);
    if(c.status==="ok"){
      setTimeout(function(){
        QD().autoScan({force:false});
      },400);
    }
  }
});
})();
