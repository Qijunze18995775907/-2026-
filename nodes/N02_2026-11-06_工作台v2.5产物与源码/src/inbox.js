/* ===== 待处理事项：独立模块（跨台账归集 + 手工登记 + 一键办结回写） ===== */
(function(){
"use strict";
var A=window.APP, $=A.$, $$=A.$$, esc=A.esc;
var DB=A.db;

/* 来源字典：标签名 + 配色 + 跳转路由 */
var SRC={
  manual:{l:"手工登记",cls:"t-gray",route:"inbox"},
  task:{l:"计划任务",cls:"t-p2",route:"plan"},
  issue:{l:"检查问题",cls:"t-red",route:"inspect"},
  review:{l:"方案内审",cls:"t-amber",route:"review"},
  briefing:{l:"技术交底",cls:"t-green",route:"brief"},
  risk:{l:"风险识别",cls:"t-red",route:"brief"},
  meeting:{l:"质量会议",cls:"t-p2",route:"meeting"},
  training:{l:"质量培训",cls:"t-green",route:"training"},
  qc:{l:"QC 课题",cls:"t-amber",route:"qc"},
  guide:{l:"作业指导书",cls:"t-gray",route:"guide"},
  policy:{l:"办法制度",cls:"t-gray",route:"policy"},
  project:{l:"项目台账",cls:"t-gray",route:"projects"},
  filedir:{l:"文件夹新增",cls:"t-amber",route:"folder"}
};
var LVL={year:"年度目标",month:"月度目标",week:"周任务",day:"日待办"};

function ensure(){
  if(!Array.isArray(DB.inbox)) DB.inbox=[];
  if(!Array.isArray(DB.inboxIgnore)) DB.inboxIgnore=[];
}
ensure();

function pname(id){ var p=(DB.projects||[]).filter(function(x){return x.id===id;})[0]; return p?p.name:""; }
function pick(arr,id){ return (arr||[]).filter(function(x){return x.id===id;})[0]; }
function ownerPool(){
  var m={};
  (DB.orgs||[]).forEach(function(o){ if(o.name) m[o.name]=1; });
  (DB.tasks||[]).forEach(function(t){ if(t.owner) m[t.owner]=1; });
  return Object.keys(m);
}

/* ---------- 归集 ---------- */
function gather(){
  var today=A.todayStr(), end=A.addDays(today,7), out=[];

  /* 1 手工登记 */
  (DB.inbox||[]).forEach(function(m){
    if(m.status==="done") return;
    out.push({key:"manual:"+m.id,src:"manual",title:m.title,owner:m.owner,due:m.due,prio:m.priority||"P1",
      route:"inbox",note:m.note||"",raw:m,rawId:m.id,act:{l:"标记已办",verb:"done"}});
  });

  /* 2 计划任务：近 7 天到期，或已发生顺延 */
  (DB.tasks||[]).forEach(function(t){
    if(t.status==="done"||!t.due) return;
    if(!(t.due<=end||(t.carried||0)>0)) return;
    var note=[];
    if(t.carried) note.push("已顺延 "+t.carried+" 次"+(t.originDue?"（原截止 "+t.originDue+"）":""));
    if(t.level) note.push(LVL[t.level]||t.level);
    if(t.period) note.push("周期 "+t.period);
    out.push({key:"task:"+t.id,src:"task",title:t.title,owner:t.owner,due:t.due,prio:t.priority,
      route:"plan",note:note.join(" · "),raw:t,rawId:t.id,act:{l:"标记完成",verb:"done"}});
  });

  /* 3 检查问题未闭环 */
  (DB.issues||[]).forEach(function(w){
    if(w.status==="已闭环") return;
    out.push({key:"issue:"+w.id,src:"issue",title:(w.no?w.no+"　":"")+w.desc,
      owner:w.owner,due:w.deadline,prio:(w.level==="严重"?"P0":"P1"),route:"inspect",
      note:[pname(w.projectId),w.requirement?("要求："+w.requirement):""].filter(Boolean).join(" · "),
      raw:w,rawId:w.id,act:{l:"标记闭环",verb:"done"}});
  });

  /* 4 方案内审未闭环 */
  (DB.reviews||[]).forEach(function(r){
    if(r.closure==="已闭环") return;
    out.push({key:"review:"+r.id,src:"review",title:r.title,owner:r.reviewer,due:"",
      prio:"P1",route:"review",
      note:[r.type,r.level,r.date?("内审 "+r.date):"",r.conclusion,"意见 "+r.count+" 条","闭环："+r.closure].filter(Boolean).join(" · "),
      raw:r,rawId:r.id,act:{l:"标记闭环",verb:"done"}});
  });

  /* 5 技术交底待开展 */
  (DB.briefings||[]).forEach(function(b){
    if(b.status==="已归档"||b.status==="已交底") return;
    out.push({key:"briefing:"+b.id,src:"briefing",title:b.title,owner:b.briefer,due:b.date,
      prio:"P0",route:"brief",note:[b.level,pname(b.projectId),b.note||""].filter(Boolean).join(" · "),
      raw:b,rawId:b.id,act:{l:"标记已交底",verb:"done"}});
  });

  /* 6 风险未受控 */
  (DB.risks||[]).forEach(function(k){
    if(k.status!=="未受控") return;
    out.push({key:"risk:"+k.id,src:"risk",title:k.title,owner:k.owner,due:"",prio:"P0",route:"brief",
      note:[pname(k.projectId),k.cat,"等级 "+k.level,k.measure||""].filter(Boolean).join(" · "),
      raw:k,rawId:k.id,act:{l:"标记已受控",verb:"done"}});
  });

  /* 7 质量会议待召开 */
  (DB.meetings||[]).forEach(function(m){
    if(m.status!=="待召开") return;
    out.push({key:"meeting:"+m.id,src:"meeting",title:m.title,owner:m.host,due:m.date,prio:"P1",
      route:"meeting",note:[m.level,m.place||""].filter(Boolean).join(" · "),
      raw:m,rawId:m.id,act:{l:"标记已召开",verb:"done"}});
  });

  /* 8 质量培训待开展 */
  (DB.trainings||[]).forEach(function(t){
    if(t.status!=="待开展") return;
    out.push({key:"training:"+t.id,src:"training",title:t.title,owner:t.teacher,due:t.date,prio:"P1",
      route:"training",note:[t.form,t.cover||"",t.hours?(t.hours+" 学时"):""].filter(Boolean).join(" · "),
      raw:t,rawId:t.id,act:{l:"标记已开展",verb:"done"}});
  });

  /* 9 QC 课题未结题 */
  (DB.qcs||[]).forEach(function(q){
    if(q.status==="已结题") return;
    out.push({key:"qc:"+q.id,src:"qc",title:"QC 课题未结题："+q.title,owner:q.leader,due:"",prio:"P1",
      route:"qc",note:["阶段 "+q.stage,"完成率 "+Math.round((q.rate||0)*100)+"%",q.target||""].filter(Boolean).join(" · "),
      raw:q,rawId:q.id,act:{l:"标记结题",verb:"done"}});
  });

  /* 10 作业指导书修订中 */
  (DB.guides||[]).forEach(function(g){
    if(g.status!=="修订中") return;
    out.push({key:"guide:"+g.id,src:"guide",title:"作业指导书待定稿："+g.title,owner:g.editor,due:"",prio:"P2",
      route:"guide",note:[g.major,g.version].filter(Boolean).join(" · "),
      raw:g,rawId:g.id,act:{l:"标记已定稿",verb:"done"}});
  });

  /* 11 办法制度修订中 */
  (DB.policies||[]).forEach(function(y){
    if(y.status!=="修订中") return;
    out.push({key:"policy:"+y.id,src:"policy",title:"制度待发布："+y.title,owner:y.issuer,due:"",prio:"P2",
      route:"policy",note:[y.docNo,y.scope||""].filter(Boolean).join(" · "),
      raw:y,rawId:y.id,act:{l:"标记已发布",verb:"done"}});
  });

  /* 12 在建项目缺项（缺内审 / 缺公司级交底） */
  (DB.projects||[]).forEach(function(p){
    if(p.status!=="施工实施") return;
    var hasRev=(DB.reviews||[]).some(function(r){return r.projectId===p.id;});
    var hasBrf=(DB.briefings||[]).some(function(b){return b.projectId===p.id;});
    if(!hasRev) out.push({key:"prjrev:"+p.id,src:"project",title:"未做方案内审："+p.name,
      owner:p.owner,due:"",prio:"P1",route:"projects",note:"合同额 "+p.amount+" 万元 · 开工 "+p.start,
      raw:p,rawId:p.id,act:null});
    if(!hasBrf) out.push({key:"prjbrf:"+p.id,src:"project",title:"缺公司级技术交底："+p.name,
      owner:p.owner,due:"",prio:"P1",route:"projects",note:"开工前须完成三级交底 · 开工 "+p.start,
      raw:p,rawId:p.id,act:null});
  });

  /* 14 本地文件夹新增/变更（来自快速入口绑定） */
  if(window.QD&&window.QD.inboxItems){
    try{ window.QD.inboxItems().forEach(function(it){ out.push(it); }); }catch(e){}
  }
  /* v1.9：解析失败 / 扫描件待补录 / 待采纳解析结果 */
  if(window.IMPORT&&window.IMPORT.inboxItems){
    try{ window.IMPORT.inboxItems().forEach(function(it){ out.push(it); }); }catch(e){}
  }

  return out;
}

/* ---------- 紧急度 ---------- */
function urg(it,today){
  if(!it.due) return {rank:4,cls:"t-gray",txt:"无期限",over:false};
  var dd=A.diffDays(today,it.due);
  if(dd<0) return {rank:0,cls:"t-red",txt:"逾期 "+(-dd)+" 天",over:true};
  if(dd===0) return {rank:1,cls:"t-red",txt:"今日到期",over:false};
  if(dd<=3) return {rank:2,cls:"t-amber",txt:dd+" 天后",over:false};
  if(dd<=7) return {rank:3,cls:"t-p2",txt:dd+" 天后",over:false};
  return {rank:5,cls:"t-gray",txt:dd+" 天后",over:false};
}
var PRIO={P0:0,P1:1,P2:2};
function cmp(a,b){
  if(a.urg.rank!==b.urg.rank) return a.urg.rank-b.urg.rank;
  if(a.due&&b.due&&a.due!==b.due) return a.due<b.due?-1:1;
  if(!a.due&&b.due) return 1;
  if(a.due&&!b.due) return -1;
  var pa=PRIO[a.prio]!==undefined?PRIO[a.prio]:3, pb=PRIO[b.prio]!==undefined?PRIO[b.prio]:3;
  if(pa!==pb) return pa-pb;
  return String(a.title).localeCompare(String(b.title));
}

function openItems(){
  var today=A.todayStr(), ign=DB.inboxIgnore||[];
  var arr=gather().filter(function(it){ return ign.indexOf(it.key)<0; });
  arr.forEach(function(it){
    it.urg=urg(it,today);
    it.srcName=(SRC[it.src]||{l:it.src}).l;
    it.urgTxt=it.urg.txt; it.urgCls=it.urg.cls;
  });
  arr.sort(cmp);
  return arr;
}
window.inboxItems=openItems;
window.inboxCount=function(){ return openItems().length; };

/* ---------- 办结回写 ---------- */
function complete(it, silent){
  var today=A.todayStr(), r=it.raw;
  switch(it.src){
    case "manual":   r.status="done"; r.doneAt=today; break;
    case "task":     r.status="done"; r.doneAt=today; break;
    case "issue":
      r.status="已闭环"; r.finishDate=today;
      var insp=pick(DB.inspections,r.inspectionId);
      if(insp){
        var n=(DB.issues||[]).filter(function(w){return w.inspectionId===insp.id&&w.status==="已闭环";}).length;
        insp.fixedCount=n;
        insp.fixStatus=(n>=(insp.issueCount||0))?"已闭环":"整改中";
      }
      break;
    case "review":   r.closure="已闭环"; break;
    case "briefing": r.status="已交底"; break;
    case "risk":     r.status="已受控"; break;
    case "meeting":  r.status="已归档"; break;
    case "training": r.status="已归档"; break;
    case "qc":       r.status="已结题"; r.rate=1; break;
    case "guide":    r.status="有效"; break;
    case "policy":   r.status="现行"; break;
    case "import":
      return true;
    case "filedir":
      if(window.QD&&r&&r.route){
        /* v1.8：确认 = 清计数 + 归档进文件中心（与文件夹总览同一动作） */
        var res=window.QD.confirmFiles(r.route,[r.rel],{silent:true});
        if(res&&res.ok&&res.snap) confirmSnaps.push(res.snap);
      }else return false;
      break;
    default: return false;
  }
  if(!silent) A.save();
  return true;
}

function ignore(key){
  ensure();
  if(DB.inboxIgnore.indexOf(key)<0) DB.inboxIgnore.push(key);
  A.save();
}
function unignore(key){
  DB.inboxIgnore=(DB.inboxIgnore||[]).filter(function(k){return k!==key;});
  A.save();
}

/* ---------- 手工登记表单 ---------- */
var M_FIELDS=[
  {k:"title",l:"事项内容",req:true,full:true,ph:"如：催收罗田项目整改回复单盖章扫描件"},
  {k:"owner",l:"负责人",t:"datalist",opts:[],ph:"选择或输入姓名"},
  {k:"due",l:"截止日期",t:"date"},
  {k:"priority",l:"优先级",t:"select",opts:[["P0","P0 紧急"],["P1","P1 重要"],["P2","P2 一般"]]},
  {k:"note",l:"说明",t:"textarea",full:true,ph:"来源、要求、对接人等"}
];
function manualForm(id){
  ensure();
  var row=id?(DB.inbox.filter(function(m){return m.id===id;})[0]||{}):{priority:"P1",due:A.addDays(A.todayStr(),3)};
  var fields=M_FIELDS.map(function(f){
    var c=Object.assign({},f);
    if(f.k==="owner") c.opts=ownerPool();
    if(!f.req && f.k==="priority") c.def="P1";
    return c;
  });
  window.openModal({
    title:id?"编辑待处理事项":"新增待处理事项",
    body:window.formHTML(fields,row),
    okText:"保存",
    onOk:function(scope){
      var d=window.readForm(scope,fields);
      if(!d.title||!String(d.title).trim()){ toast("请填写事项内容","err"); return false; }
      if(id){
        var i=DB.inbox.findIndex(function(m){return m.id===id;});
        if(i>=0) DB.inbox[i]=Object.assign({},DB.inbox[i],d,{title:String(d.title).trim()});
      }else{
        DB.inbox.push({id:A.uid("ib"),title:String(d.title).trim(),owner:d.owner||"",due:d.due||"",
          priority:d.priority||"P1",note:d.note||"",status:"open",createdAt:A.todayStr()});
      }
      A.save(); toast(id?"已更新":"已新增","ok"); render("inbox");
    }
  });
}
window.manualForm=manualForm;

/* ---------- 打印 / 导出 ---------- */
function printList(rows){
  if(!window.printHTML){ toast("打印模块未加载","err"); return; }
  var body='<table><thead><tr>'+
    '<th style="width:34px">序号</th><th>事项内容</th><th style="width:74px">来源</th>'+
    '<th style="width:66px">负责人</th><th style="width:78px">截止日期</th>'+
    '<th style="width:72px">紧急度</th><th style="width:150px">备注</th></tr></thead><tbody>';
  rows.forEach(function(it,i){
    body+='<tr><td class="c">'+(i+1)+'</td><td>'+esc(it.title)+'</td>'+
      '<td class="c">'+esc((SRC[it.src]||{l:it.src}).l)+'</td>'+
      '<td class="c">'+esc(it.owner||"—")+'</td>'+
      '<td class="c">'+esc(it.due||"—")+'</td>'+
      '<td class="c">'+esc(it.urgTxt||"—")+'</td>'+
      '<td>'+esc(it.note||"")+'</td></tr>';
  });
  body+='</tbody></table><div class="note">说明：本清单由质量管理台账工作台自动归集，办结后请回原台账复核。</div>';
  window.printHTML("待处理事项清单",body,"共 "+rows.length+" 项　其中逾期 "+rows.filter(function(x){return x.urg.over;}).length+" 项");
}
function exportList(rows){
  window.exportCSV("inbox",{title:"待处理事项",cols:[
    {k:"title",l:"事项"},{k:"srcName",l:"来源"},{k:"owner",l:"负责人"},
    {k:"due",l:"截止日期"},{k:"urgTxt",l:"紧急度"},{k:"prio",l:"优先级"},{k:"note",l:"备注"}
  ]},rows);
}

/* ---------- 页面 ---------- */
var view={tab:"open",src:"all",owner:"all",q:"",sel:{}};
/* 一次性撤销快照：只存内存，再次批量或离开页面即失效 */
var undoState=null;
/* 文件确认产生的归档记录，随本次批量操作收集，撤销时一并回退 */
var confirmSnaps=[];

function canDo(it){ return !!(it&&it.act); }
function skipReason(it){
  if(!it) return "该事项不支持一键办结";
  if(it.src==="project") return "需到「在建项目业务清单」补做内审或公司级交底";
  if(it.src==="filedir") return "文件夹条目已失效，请刷新索引";
  return "该事项不支持一键办结";
}
var SRC2COL={manual:"inbox",task:"tasks",issue:"issues",review:"reviews",briefing:"briefings",
  risk:"risks",meeting:"meetings",training:"trainings",qc:"qcs",guide:"guides",policy:"policies"};
function findRec(src,id){
  var arr=DB[SRC2COL[src]]||[];
  return arr.filter(function(x){return x.id===id;})[0]||null;
}
function snapshot(it){
  if(it.src==="filedir"){
    var c=(window.QD&&it.raw&&it.raw.route)?window.QD.cfgOf(it.raw.route):null;
    return {k:it.key,src:"filedir",route:it.raw?it.raw.route:"",rel:it.raw?it.raw.rel:"",
      seen:c?(c.seen||{})[it.raw.rel]:undefined};
  }
  return {k:it.key,src:it.src,rawId:it.rawId,raw:JSON.parse(JSON.stringify(it.raw||{}))};
}
function restoreSnap(snap){
  var n=0;
  (snap||[]).forEach(function(s){
    if(s.src==="filedir"){
      if(!window.QD||!s.route||!s.rel) return;
      var c=window.QD.cfgOf(s.route);
      if(!c.seen) c.seen={};
      if(s.seen===undefined) delete c.seen[s.rel]; else c.seen[s.rel]=s.seen;
      c.ack=(c.ack||[]).filter(function(r){return r!==s.rel;});
      if(window.QD._recount) window.QD._recount(c);
      n++; return;
    }
    var cur=findRec(s.src,s.rawId);
    if(!cur) return;
    Object.keys(cur).forEach(function(k){ if(!(k in s.raw)) delete cur[k]; });
    Object.keys(s.raw).forEach(function(k){ cur[k]=s.raw[k]; });
    n++;
  });
  A.save();
  return n;
}
function bulkComplete(sel, wholeList, allCan){
  var can=(sel||[]).filter(canDo);
  var plain=wholeList||[];
  var all=allCan||can;
  /* 只有把可办结项全选时，才提示被跳过的项，避免只选几条时报告干扰 */
  var skip=(can.length===all.length)?plain.filter(function(x){ return !canDo(x); }):[];
  if(!can.length){ toast("当前列表没有可办结的事项","err"); return; }
  var bySrc={};
  can.forEach(function(x){ bySrc[x.src]=(bySrc[x.src]||0)+1; });
  var sum=Object.keys(bySrc).map(function(k){ return (SRC[k]||{l:k}).l+" "+bySrc[k]+" 项"; }).join("、");
  var skipTxt="";
  if(skip.length){
    var reasons={};
    skip.forEach(function(x){ var r=skipReason(x); reasons[r]=(reasons[r]||0)+1; });
    skipTxt='<p style="margin:10px 0 0;font-size:12.5px;color:#b9770e;line-height:1.8">将跳过 '+skip.length+' 项：'+
      Object.keys(reasons).map(function(r){ return esc(r)+"（"+reasons[r]+" 项）"; }).join("；")+'</p>';
  }
  window.openModal({
    title:"批量办结",
    okText:"办结 "+can.length+" 项",
    body:'<p style="margin:0 0 8px">本次将办结 <b>'+can.length+'</b> 项，按来源：'+esc(sum)+'。</p>'+
      '<p style="margin:0;font-size:12.5px;color:var(--muted);line-height:1.8">办结会直接改写对应台账的状态与完成日期，'+
      '检查问题会同步重算所属检查单的整改数。完成后可撤销 1 次（再次批量办结或刷新页面即失效）。</p>'+skipTxt,
    onOk:function(){
      var snap=can.map(snapshot);
      confirmSnaps=[];
      can.forEach(function(it){ complete(it,true); });
      A.save();
      undoState={at:Date.now(),snap:snap,n:can.length,conf:confirmSnaps.slice()};
      confirmSnaps=[];
      view.sel={};
      toast("已办结 "+can.length+" 项，原台账已同步","ok");
      window.render("inbox");
    }
  });
}
function undoBulk(){
  if(!undoState) return;
  var conf=undoState.conf||[];
  var n=restoreSnap(undoState.snap);
  /* 文件条目：先还原 seen（restoreSnap 已做），再删掉本次写进文件中心的记录 */
  if(conf.length&&window.QD) window.QD.undoConfirm(conf,false);
  undoState=null;
  confirmSnaps=[];
  view.sel={};
  toast("已撤销 "+n+" 项，状态已恢复","ok");
  window.render("inbox");
}

window.regPage("inbox",{
  sub:"12 类台账的待办自动汇到这里，办结后原台账同步更新",
  render:function(host){
    ensure();
    var today=A.todayStr();

    function draw(){
      var all=gather();
      var ign=DB.inboxIgnore||[];
      var isIgn=function(k){return ign.indexOf(k)>=0;};
      var open=openItems();
      var ignored=all.filter(function(it){return isIgn(it.key);}).map(function(it){
        it.urg=urg(it,today); it.srcName=(SRC[it.src]||{l:it.src}).l;
        it.urgTxt=it.urg.txt; it.urgCls=it.urg.cls; return it;
      });

      var nOver=open.filter(function(x){return x.urg.rank===0;}).length;
      var nToday=open.filter(function(x){return x.urg.rank===1;}).length;
      var weekEnd=A.addDays(today,7);
      var nWeek=open.filter(function(x){return x.due&&x.due>=today&&x.due<=weekEnd;}).length;

      /* KPI */
      var h="";
      if(undoState){
        h+='<div class="undo-bar"><span>已办结 <b>'+undoState.n+'</b> 项，原台账状态与完成日期已同步变更</span>'+
          '<div class="spacer"></div>'+
          '<button class="btn sm" id="ibUndo">撤销</button>'+
          '<button class="btn sm ghost" id="ibUndoX">知道了</button></div>';
      }
      h+='<div class="grid g4" style="margin-bottom:14px">'+
        '<div class="card kpi"><div class="k">待处理合计</div><div class="v">'+open.length+'<small>项</small></div>'+
          '<div class="d">手工登记 '+(DB.inbox.filter(function(m){return m.status!=="done";}).length)+' 项</div></div>'+
        '<div class="card kpi"><div class="k">已逾期</div><div class="v" style="color:#c0392b">'+nOver+'<small>项</small></div>'+
          '<div class="d">'+(nOver?"需优先处理":"无逾期")+'</div></div>'+
        '<div class="card kpi"><div class="k">今日到期</div><div class="v" style="color:#b9770e">'+nToday+'<small>项</small></div>'+
          '<div class="d">今天 '+today+'</div></div>'+
        '<div class="card kpi"><div class="k">本周到期</div><div class="v">'+nWeek+'<small>项</small></div>'+
          '<div class="d">含今日，截至 '+weekEnd+'</div></div>'+
      '</div>';

      /* 工具条 */
      var tabs=[["open","全部待办",open.length],["over","已逾期",nOver],["today","今日到期",nToday],
                ["week","本周到期",nWeek],["ign","已忽略",ignored.length]];
      var srcCount={};
      open.forEach(function(it){ srcCount[it.src]=(srcCount[it.src]||0)+1; });
      var srcOpts='<option value="all">全部来源</option>'+Object.keys(SRC).filter(function(k){return srcCount[k];})
        .map(function(k){return '<option value="'+k+'"'+(view.src===k?" selected":"")+'>'+esc(SRC[k].l)+'（'+srcCount[k]+'）</option>';}).join("");
      var ownSet={}; open.forEach(function(it){ ownSet[it.owner||"未指派"]=1; });
      var ownOpts='<option value="all">全部负责人</option>'+Object.keys(ownSet).sort()
        .map(function(k){return '<option value="'+esc(k)+'"'+(view.owner===k?" selected":"")+'>'+esc(k)+'</option>';}).join("");

      h+='<div class="card"><div class="card-h"><h3>待处理清单</h3>'+
        '<span class="hint">办结后自动回写原台账</span><div class="spacer"></div>'+
        '<button class="btn primary" id="ibAdd">+ 新增事项</button>'+
        '<button class="btn" id="ibPrint">打印清单</button>'+
        '<button class="btn" id="ibExport">导出 CSV</button></div>'+
        '<div class="card-b" style="padding-bottom:0">'+
        '<div class="toolbar" style="margin-bottom:10px">'+
          '<div class="tabs">'+tabs.map(function(t){
            return '<button class="tab'+(view.tab===t[0]?" active":"")+'" data-tab="'+t[0]+'">'+t[1]+' '+
              '<span style="opacity:.65">'+t[2]+'</span></button>';
          }).join("")+'</div>'+
          '<select id="ibSrc" style="max-width:190px">'+srcOpts+'</select>'+
          '<select id="ibOwn" style="max-width:150px">'+ownOpts+'</select>'+
          '<div class="search"><input type="search" id="ibQ" placeholder="搜索事项、备注" value="'+esc(view.q)+'"></div>'+
        '</div>';

      /* 过滤 */
      var list=(view.tab==="ign")?ignored:open;
      if(view.tab==="over") list=list.filter(function(x){return x.urg.rank===0;});
      else if(view.tab==="today") list=list.filter(function(x){return x.urg.rank===1;});
      else if(view.tab==="week") list=list.filter(function(x){return x.due&&x.due>=today&&x.due<=weekEnd;});
      if(view.src!=="all") list=list.filter(function(x){return x.src===view.src;});
      if(view.owner!=="all") list=list.filter(function(x){return (x.owner||"未指派")===view.owner;});
      if(view.q){
        var q=view.q.toLowerCase();
        list=list.filter(function(x){ return (x.title+" "+(x.note||"")+" "+(x.owner||"")).toLowerCase().indexOf(q)>=0; });
      }

      /* 勾选：只保留仍在当前列表中的可办结项 */
      var canList=list.filter(canDo);
      if(view.tab==="ign") view.sel={};
      else Object.keys(view.sel).forEach(function(k){
        if(!canList.some(function(x){return x.key===k;})) delete view.sel[k];
      });
      var selN=canList.filter(function(x){return view.sel[x.key];}).length;

      /* 批量栏：已忽略页不显示 */
      if(view.tab!=="ign"){
        h+='<div class="ib-bulk">'+
          '<label class="ib-all"><input type="checkbox" id="ibSelAll"'+
            (canList.length&&selN===canList.length?" checked":"")+
            (canList.length?"":" disabled")+'> 全选当前列表</label>'+
          '<span class="ib-cnt">已选 <b>'+selN+'</b> / 可办 <b>'+canList.length+'</b> 项</span>'+
          '<div class="spacer"></div>'+
          '<button class="btn sm primary" id="ibBulk"'+(selN?"":" disabled")+'>办结所选（'+selN+'）</button>'+
          '<button class="btn sm ghost" id="ibSelClear"'+(selN?"":" disabled")+'>取消全部勾选</button>'+
        '</div>';
      }

      /* 分组渲染 */
      var groups=[
        {t:"已逾期",f:function(u){return u.rank===0;}},
        {t:"今日到期",f:function(u){return u.rank===1;}},
        {t:"3 天内",f:function(u){return u.rank===2;}},
        {t:"本周内",f:function(u){return u.rank===3;}},
        {t:"更远期",f:function(u){return u.rank===5;}},
        {t:"无期限（需补计划）",f:function(u){return u.rank===4;}}
      ];
      var html="";
      if(!list.length){
        html='<div class="empty">'+(view.tab==="ign"?"没有忽略记录":"没有符合条件的待处理事项")+'</div>';
      }else{
        groups.forEach(function(g){
          var rows=list.filter(function(x){return g.f(x.urg);});
          if(!rows.length) return;
          html+='<div class="grp-h">'+esc(g.t)+' <span class="n">'+rows.length+' 项</span></div>';
          rows.forEach(function(it){ html+=rowHTML(it,view.tab==="ign",!!view.sel[it.key]); });
        });
      }
      h+=html+'</div>';

      /* 规则说明 */
      h+='<div class="card-b" style="border-top:1px solid var(--line);font-size:12px;color:var(--muted);line-height:1.85">'+
        '<b style="color:var(--ink-2)">归集规则：</b>计划任务取近 7 天到期与已顺延项；检查问题取未闭环；方案内审取未闭环；'+
        '技术交底取待交底；风险取未受控；在建项目取施工中缺内审或缺公司级交底；作业指导书、制度取修订中；QC 取未结题。<br>'+
        '<b style="color:var(--ink-2)">办结回写：</b>点「标记…」直接改写对应台账的状态与完成日期，检查问题会同步重算所属检查单的整改数。<br>'+
        '<b style="color:var(--ink-2)">批量办结：</b>勾选左侧圆点（或点「全选当前列表」）后点「办结所选」，只对当前筛选结果生效；'+
        '不支持一键办结的项会自动跳过，完成后可撤销 1 次。<br>'+
        '<b style="color:var(--ink-2)">忽略：</b>不删除任何记录，只从本清单隐藏，可在「已忽略」页恢复。'+
      '</div></div>';

      host.innerHTML=h;

      /* 事件 */
      $("#ibAdd",host).onclick=function(){ manualForm(null); };
      $("#ibPrint",host).onclick=function(){ printList(list); };
      $("#ibExport",host).onclick=function(){ exportList(list); };
      $$("[data-tab]",host).forEach(function(b){
        b.onclick=function(){ view.tab=this.getAttribute("data-tab"); draw(); };
      });
      $("#ibSrc",host).onchange=function(){ view.src=this.value; draw(); };
      $("#ibOwn",host).onchange=function(){ view.owner=this.value; draw(); };
      var sa=$("#ibSelAll",host);
      if(sa){
        sa.indeterminate=(selN>0&&selN<canList.length);
        sa.onchange=function(){
          if(this.checked){ canList.forEach(function(x){ view.sel[x.key]=1; }); }
          else view.sel={};
          draw();
        };
      }
      var bulk=$("#ibBulk",host);
      if(bulk) bulk.onclick=function(){
        bulkComplete(canList.filter(function(x){return view.sel[x.key];}),list,canList);
      };
      var clr=$("#ibSelClear",host);
      if(clr) clr.onclick=function(){ view.sel={}; draw(); };
      var ub=$("#ibUndo",host);
      if(ub) ub.onclick=function(){ undoBulk(); };
      var ux=$("#ibUndoX",host);
      if(ux) ux.onclick=function(){ undoState=null; draw(); };
      var q=$("#ibQ",host);
      if(q){
        var timer=null;
        q.oninput=function(){
          var v=this.value; clearTimeout(timer);
          timer=setTimeout(function(){ view.q=v; draw(); var el=$("#ibQ"); if(el){ el.focus(); el.setSelectionRange(el.value.length,el.value.length); } },260);
        };
      }
      $$("[data-k]",host).forEach(function(rowEl){
        var key=rowEl.getAttribute("data-k");
        var item=all.filter(function(x){return x.key===key;})[0];
        if(!item) return;
        $$("[data-done]",rowEl).forEach(function(d){
          if(d.getAttribute("data-done")!=="1") return;
          d.onclick=function(e){ e.stopPropagation(); doComplete(item,draw); };
        });
        $$("[data-sel]",rowEl).forEach(function(d){
          if(d.getAttribute("data-sel")!=="1") return;
          d.onclick=function(e){
            e.stopPropagation();
            if(view.sel[key]) delete view.sel[key]; else view.sel[key]=1;
            draw();
          };
        });
        var j=$("[data-jump]",rowEl);
        if(j) j.onclick=function(){
          var rt=(SRC[item.src]||{}).route||"dash";
          if(item.src==="filedir"&&item.raw&&item.raw.route) rt="folder?r="+encodeURIComponent(item.raw.route);
          location.hash="#/"+rt;
        };
        var ed=$("[data-edit]",rowEl);
        if(ed) ed.onclick=function(){ manualForm(item.rawId); };
        var dl=$("[data-del]",rowEl);
        if(dl) dl.onclick=function(){
          window.openModal({title:"删除事项",body:'<p style="margin:0">确定删除「<b>'+esc(item.title)+'</b>」？</p>',
            okText:"删除",onOk:function(){
              DB.inbox=DB.inbox.filter(function(m){return m.id!==item.rawId;});
              A.save(); toast("已删除","ok"); draw();
            }});
        };
        var ig=$("[data-ig]",rowEl);
        if(ig) ig.onclick=function(e){ e.stopPropagation(); ignore(key); toast("已忽略，可在「已忽略」恢复","ok"); draw(); };
        var un=$("[data-unig]",rowEl);
        if(un) un.onclick=function(){ unignore(key); toast("已恢复","ok"); draw(); };
      });
    }

    draw();
  }
});

function rowHTML(it,isIgnored,isSel){
  var s=SRC[it.src]||{l:it.src,cls:"t-gray"};
  var pickable=!isIgnored&&canDo(it);
  var meta=[];
  meta.push('<span class="tag '+s.cls+'">'+esc(s.l)+'</span>');
  if(it.prio) meta.push('<span class="tag t-'+String(it.prio).toLowerCase()+'">'+esc(it.prio)+'</span>');
  meta.push('<span>'+esc(it.owner||"未指派")+'</span>');
  meta.push('<span>截止 '+(it.due?esc(it.due):"未设")+'</span>');
  meta.push('<span class="'+(it.urg.over?"ovd":"")+'">'+esc(it.urg.txt)+'</span>');
  if(it.note) meta.push('<span style="color:#8a99ab">'+esc(it.note)+'</span>');

  var acts="";
  if(isIgnored){
    acts='<button class="btn sm" data-unig="1">恢复</button><button class="btn sm" data-jump="1">去处理</button>';
  }else{
    if(it.act) acts+='<button class="btn sm" data-done="1">'+esc(it.act.l)+'</button>';
    acts+='<button class="btn sm" data-jump="1">去处理</button>';
    if(it.src==="manual"){
      acts+='<button class="btn sm" data-edit="1">编辑</button>'+
            '<button class="btn sm ghost" data-del="1">删除</button>';
    }else{
      acts+='<button class="btn sm ghost" data-ig="1">忽略</button>';
    }
  }

  var chk='<div class="chk'+(isSel&&pickable?" checked":"")+(pickable?"":" disabled")+'"'+
    (pickable?' data-sel="1" title="勾选后可批量办结"':' title="该事项需到原台账处理"')+
    '>✓</div>';

  return '<div class="task-row'+(it.urg.over?" overdue":"")+(isSel&&pickable?" sel":"")+'" data-k="'+esc(it.key)+'">'+
    chk+
    '<div class="body">'+
      '<div class="t-title">'+esc(it.title)+'</div>'+
      '<div class="t-meta">'+meta.join("")+'</div>'+
      '<div class="row-actions" style="margin-top:7px">'+acts+'</div>'+
    '</div></div>';
}

function doComplete(it,after){
  if(!it.act){ toast("该事项需到原台账处理","err"); return; }
  /* v1.9：解析类事项直接跳到对应动作，不弹「确认办结」 */
  if(it.src==="import"){
    var fid=it.raw&&it.raw.fileId;
    if(!fid||!window.IMPORT) return;
    var fr=(DB.files||[]).filter(function(x){ return x.id===fid; })[0];
    if(fr&&fr.parse&&fr.parse.state==="preview") window.IMPORT.preview(fid);
    else window.IMPORT.reparse(fid);
    if(after) after();
    return;
  }
  var label=it.act.l;
  var isFD=(it.src==="filedir"&&it.raw&&it.raw.route);
  var mod=isFD&&window.QD?window.QD.modOfRoute(it.raw.route):"";
  window.openModal({
    title:label,
    body:'<p style="margin:0 0 8px">确认对「<b>'+esc(it.title)+'</b>」执行<b>'+esc(label)+'</b>？</p>'+
      '<p style="margin:0;font-size:12.5px;color:var(--muted)">'+
      (isFD
        ? '确认后清空该文件的待确认计数，并在「文件中心」归档一条记录（归入 '+esc(mod)+
          '，指向本地原件，不复制文件）。'
        : '将同步改写「'+esc((SRC[it.src]||{l:it.src}).l)+'」台账的状态与完成日期。')+
      '</p>',
    okText:label,
    onOk:function(){
      confirmSnaps=[];
      if(complete(it)){ toast(isFD?"已确认并归档到文件中心":"已办结，原台账已同步","ok"); if(after) after(); }
      else toast("该事项不支持一键办结","err");
    }
  });
}
window.inboxComplete=doComplete;
})();
