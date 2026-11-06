/* ===== 计划看板 / 拆解引擎 / 逾期顺延 / 仪表盘 ===== */
(function(){
"use strict";
var A=window.APP, $=A.$, $$=A.$$, esc=A.esc;
var DB=A.db;
/* 整改状态机（core.js 定义，模块页与仪表盘共用同一套判定） */
var INS=window.INSP;

var MAX_CARRY=3; // 超过 3 次不再自动顺延，转「滞留」待人工处理

/* ---------- 逾期顺延 ---------- */
function nextDue(today,due,level){
  var gap=A.diffDays(due,today); // >0 表逾期天数
  if(gap<=0) return null;
  var d=due;
  if(level==="day") d=A.addDays(due,gap);
  else if(level==="week") d=A.addDays(due,Math.ceil(gap/7)*7);
  else if(level==="month"){
    var dt=A.parseD(due), n=0;
    while((dt.getFullYear()+"-"+((dt.getMonth()+1)<10?"0":"")+(dt.getMonth()+1)+"-"+(dt.getDate()<10?"0":"")+dt.getDate()) < today && n<40){
      dt.setMonth(dt.getMonth()+1); n++;
    }
    d=dt.getFullYear()+"-"+((dt.getMonth()+1)<10?"0":"")+(dt.getMonth()+1)+"-"+(dt.getDate()<10?"0":"")+dt.getDate();
  }else{
    d=today.slice(0,4)+due.slice(4);
    if(d<today) d=(+today.slice(0,4)+1)+due.slice(4);
  }
  return d;
}
function periodOfLevel(level,due){
  if(level==="year") return due.slice(0,4);
  if(level==="month") return due.slice(0,7);
  if(level==="week") return A.weekKey(due);
  return due;
}
function rollover(){
  var today=A.todayStr(), changed=0, stuck=0;
  DB.tasks.forEach(function(t){
    if(t.status==="done"||!t.due) return;
    if(t.due>=today) return;
    if(t.lastRoll===today) return;
    if((t.carried||0)>=MAX_CARRY){ t.stuck=true; stuck++; return; }
    var nd=nextDue(today,t.due,t.level);
    if(!nd) return;
    if(!t.originDue) t.originDue=t.due;
    t.carried=(t.carried||0)+1;
    t.carriedDays=(t.carriedDays||0)+A.diffDays(t.due,today);
    t.lastRoll=today;
    t.due=nd;
    t.period=periodOfLevel(t.level,nd);
    (t.log=t.log||[]).push({at:today,from:t.due,days:A.diffDays(t.due,today)});
    changed++;
  });
  if(changed||stuck){ A.save(); }
  return {changed:changed,stuck:stuck};
}
window.rolloverTasks=rollover;
window.onBoot=function(){
  var r=rollover();
  window.__rollInfo=r;
};

/* ---------- 统计 ---------- */
function collect(level,period){
  var today=A.todayStr();
  var arr=DB.tasks.filter(function(t){
    if(level==="all") return true;
    if(level==="week"){
      if(t.level==="week") return !period||t.period===period;
      if(t.level==="day"){ var r=A.weekRange(period); return t.due>=r[0]&&t.due<=r[1]; }
      return false;
    }
    if(level==="month"){
      if(t.level==="month") return !period||t.period===period;
      if(t.level==="week"||t.level==="day") return String(t.due||"").slice(0,7)===period;
      return false;
    }
    return !period||t.period===period;
  });
  var tw=0,dw=0,done=0,od=0,cd=0;
  arr.forEach(function(t){
    var w=t.weight||1; tw+=w;
    if(t.status==="done"){ dw+=w; done++; }
    else if(t.due&&t.due<today){ od++; }
    if(t.carried) cd++;
  });
  return {list:arr,total:arr.length,done:done,rate:tw?Math.round(dw/tw*1000)/10:0,overdue:od,carried:cd};
}

/* ---------- 通用小部件 ---------- */
function ring(rate,color,label,sub){
  var r=54,c=2*Math.PI*r,off=c*(1-Math.min(rate,100)/100);
  return '<div class="ring"><svg viewBox="0 0 130 130" aria-label="'+esc(label)+' '+rate+'%">'+
    '<circle cx="65" cy="65" r="54" fill="none" stroke="#e8edf3" stroke-width="13"/>'+
    '<circle cx="65" cy="65" r="54" fill="none" stroke="'+color+'" stroke-width="13" stroke-linecap="round" '+
      'stroke-dasharray="'+c.toFixed(1)+'" stroke-dashoffset="'+off.toFixed(1)+'"/></svg>'+
    '<div class="val"><b style="color:'+color+'">'+rate+'<span style="font-size:13px">%</span></b>'+
    '<span>'+esc(sub||label)+'</span></div></div>';
}
function kpi(k,v,unit,d,color,link){
  var inner='<div class="k">'+esc(k)+(link?'<span class="kpi-arrow">→</span>':'')+'</div>'+
    '<div class="v" style="'+(color?"color:"+color:"")+'">'+esc(v)+(unit?'<small>'+esc(unit)+'</small>':'')+'</div>'+
    (d?'<div class="d">'+d+'</div>':'');
  if(link) return '<a class="card kpi kpi-link" href="'+esc(link)+'" title="查看详情">'+inner+'</a>';
  return '<div class="card kpi">'+inner+'</div>';
}

/* ---------- 任务行 ---------- */
function levelName(l){ return {year:"年度",month:"月度",week:"周",day:"日"}[l]||l; }
function priorityTag(p){ return '<span class="tag t-'+String(p||"P2").toLowerCase()+'">'+esc(p||"P2")+'</span>'; }
function statusTag(s){ return '<span class="tag t-'+s+'">'+({todo:"未开始",doing:"进行中",done:"已完成"}[s]||s)+'</span>'; }

function taskRow(t,opts){
  opts=opts||{};
  var today=A.todayStr();
  var over = t.status!=="done" && t.due && t.due<today;
  var carried = (t.carried||0)>0 && t.status!=="done";
  var proj = t.projectId ? (DB.projects.filter(function(p){return p.id===t.projectId;})[0]||{}).name : "";
  var meta=[];
  meta.push('<span class="tag t-gray">'+levelName(t.level)+'</span>');
  meta.push(priorityTag(t.priority));
  meta.push('<span>'+esc(t.owner||"未指派")+'</span>');
  if(t.due) meta.push('<span>截止 '+esc(t.due)+'</span>');
  if(over) meta.push('<span class="ovd">逾期 '+A.diffDays(t.due,today)+' 天</span>');
  if(carried) meta.push('<span class="overdue-flag">已顺延 '+(t.carried)+' 次</span>');
  if(t.stuck) meta.push('<span class="overdue-flag">滞留待处理</span>');
  if(t.status!=="done"&&!over) meta.push(statusTag(t.status));
  if(proj) meta.push('<span>· '+esc(proj.length>18?proj.slice(0,18)+"…":proj)+'</span>');

  return '<div class="task-row '+(t.status==="done"?"done ":"")+(over?"overdue":"")+'" data-tid="'+esc(t.id)+'">'+
    '<div class="chk" data-toggle="'+esc(t.id)+'" role="checkbox" aria-checked="'+(t.status==="done")+'" tabindex="0">'+
      (t.status==="done"?'<svg width="11" height="11" viewBox="0 0 12 12"><path d="M2 6.2 4.6 8.8 10 3.4" stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>':'')+
    '</div>'+
    '<div class="body">'+
      '<div class="t-title">'+esc(t.title)+'</div>'+
      '<div class="t-meta">'+meta.join("")+'</div>'+
      (t.note?'<div style="font-size:11.5px;color:var(--muted);margin-top:4px">'+esc(t.note)+'</div>':'')+
    '</div>'+
    '<div class="row-actions">'+
      '<button class="btn sm ghost" data-tedit="'+esc(t.id)+'">编辑</button>'+
      (t.status!=="done"?'<button class="btn sm ghost" data-tdone="'+esc(t.id)+'">完成</button>':'')+
      '<button class="btn sm ghost" style="color:#c0392b" data-tdel="'+esc(t.id)+'">删</button>'+
    '</div>'+
  '</div>';
}

function bindTaskRows(host){
  $$("[data-toggle]",host).forEach(function(el){
    el.onclick=function(){ toggle(this.getAttribute("data-toggle")); };
    el.onkeydown=function(e){ if(e.key===" "||e.key==="Enter"){ e.preventDefault(); toggle(this.getAttribute("data-toggle")); } };
  });
  $$("[data-tdone]",host).forEach(function(b){ b.onclick=function(){ toggle(this.getAttribute("data-tdone"),"done"); }; });
  $$("[data-tedit]",host).forEach(function(b){ b.onclick=function(){ taskForm(this.getAttribute("data-tedit")); }; });
  $$("[data-tdel]",host).forEach(function(b){ b.onclick=function(){
    var id=this.getAttribute("data-tdel");
    var t=DB.tasks.filter(function(x){return x.id===id;})[0];
    if(!confirm("确定删除「"+(t?t.title:"")+"」？")) return;
    DB.tasks=DB.tasks.filter(function(x){return x.id!==id;});
    A.save(); toast("已删除","ok"); render(A.getRoute?A.getRoute():window.getRoute());
  };});
}
function toggle(id,force){
  var t=DB.tasks.filter(function(x){return x.id===id;})[0]; if(!t) return;
  if(force==="done") t.status="done";
  else t.status = t.status==="done"?"todo":"done";
  if(t.status==="done"){ t.doneAt=A.todayStr(); t.stuck=false; }
  A.save();
  var r=window.getRoute();
  window.render(r);
}

/* ---------- 任务表单 ---------- */
function taskForm(id){
  var t = id ? DB.tasks.filter(function(x){return x.id===id;})[0] : {level:"month",period:A.todayStr().slice(0,7),status:"todo",priority:"P1",weight:3,owner:"",source:"项目实际"};
  if(!t) return;
  var owners={}; DB.tasks.forEach(function(x){ if(x.owner) owners[x.owner]=1; });
  DB.orgs.forEach(function(o){ owners[o.name]=1; });
  var ownerList=Object.keys(owners);
  var parentOpts=DB.tasks.filter(function(x){return ["year","month","week"].indexOf(x.level)>=0;})
    .map(function(x){return [x.id,levelName(x.level)+"｜"+x.title.slice(0,26)];});
  var projOpts=DB.projects.map(function(p){return [p.id,p.name.slice(0,24)];});
  var periods=[]; (function(){ for(var m=1;m<=12;m++) periods.push("2026-"+(m<10?"0":"")+m); })();

  var body=
   '<div class="form-grid">'+
    '<div class="field full"><label for="f_title">任务名称 <span style="color:#c0392b">*</span></label>'+
      '<input type="text" id="f_title" value="'+esc(t.title||"")+'" placeholder="如：完成第四季度在建项目质量检查"></div>'+
    '<div class="field"><label for="f_level">层级</label><select id="f_level">'+
      ["year","month","week","day"].map(function(l){return '<option value="'+l+'"'+(t.level===l?" selected":"")+'>'+levelName(l)+(l==="year"?"目标":l==="month"?"目标":l==="week"?"任务":"待办")+'</option>';}).join("")+
    '</select></div>'+
    '<div class="field"><label for="f_period">周期</label><input type="text" id="f_period" value="'+esc(t.period||"")+'" placeholder="2026 / 2026-11 / 2026-W45 / 2026-11-05" list="plist">'+
      '<datalist id="plist">'+periods.map(function(p){return '<option value="'+p+'">';}).join("")+'</datalist></div>'+
    '<div class="field"><label for="f_parent">上级目标</label><select id="f_parent"><option value="">— 无 —</option>'+
      parentOpts.map(function(o){return '<option value="'+esc(o[0])+'"'+(t.parent===o[0]?" selected":"")+'>'+esc(o[1])+'</option>';}).join("")+'</select></div>'+
    '<div class="field"><label for="f_owner">负责人</label><input type="text" id="f_owner" value="'+esc(t.owner||"")+'" list="olist" placeholder="姓名">'+
      '<datalist id="olist">'+ownerList.map(function(o){return '<option value="'+esc(o)+'">';}).join("")+'</datalist></div>'+
    '<div class="field"><label for="f_dept">责任部门</label><select id="f_dept">'+
      ["公司领导","工程技术部","各项目部","市场经营部"].map(function(d){return '<option'+(t.dept===d?" selected":"")+'>'+d+'</option>';}).join("")+'</select></div>'+
    '<div class="field"><label for="f_priority">优先级</label><select id="f_priority">'+
      ["P0","P1","P2"].map(function(p){return '<option'+(t.priority===p?" selected":"")+'>'+p+'</option>';}).join("")+'</select></div>'+
    '<div class="field"><label for="f_status">状态</label><select id="f_status">'+
      [["todo","未开始"],["doing","进行中"],["done","已完成"]].map(function(s){return '<option value="'+s[0]+'"'+(t.status===s[0]?" selected":"")+'>'+s[1]+'</option>';}).join("")+'</select></div>'+
    '<div class="field"><label for="f_due">截止日期</label><input type="date" id="f_due" value="'+esc(t.due||"")+'"></div>'+
    '<div class="field"><label for="f_weight">权重（1-5）</label><input type="number" id="f_weight" min="1" max="5" value="'+esc(t.weight||3)+'"></div>'+
    '<div class="field"><label for="f_source">任务来源</label><select id="f_source">'+
      ["局/大队要求","公司年度要点","项目实际","临时任务"].map(function(s){return '<option'+(t.source===s?" selected":"")+'>'+s+'</option>';}).join("")+'</select></div>'+
    '<div class="field"><label for="f_projectId">关联项目</label><select id="f_projectId"><option value="">— 无 —</option>'+
      projOpts.map(function(o){return '<option value="'+esc(o[0])+'"'+(t.projectId===o[0]?" selected":"")+'>'+esc(o[1])+'</option>';}).join("")+'</select></div>'+
    '<div class="field full"><label for="f_note">备注</label><textarea id="f_note" placeholder="补充说明、验收标准、交付物…">'+esc(t.note||"")+'</textarea></div>'+
   '</div>';

  openModal({
    title:(id?"编辑任务":"新增任务"),
    body:body,
    onOk:function(scope){
      var title=$("#f_title",scope).value.trim();
      if(!title){ toast("请填写任务名称","err"); return false; }
      var data={
        title:title,
        level:$("#f_level",scope).value,
        period:$("#f_period",scope).value.trim()||"2026-11",
        parent:$("#f_parent",scope).value,
        owner:$("#f_owner",scope).value.trim(),
        dept:$("#f_dept",scope).value,
        priority:$("#f_priority",scope).value,
        status:$("#f_status",scope).value,
        due:$("#f_due",scope).value,
        weight:+$("#f_weight",scope).value||1,
        source:$("#f_source",scope).value,
        projectId:$("#f_projectId",scope).value,
        note:$("#f_note",scope).value.trim()
      };
      if(data.due && !data.period) data.period=periodOfLevel(data.level,data.due);
      if(id){
        var i=DB.tasks.findIndex(function(x){return x.id===id;});
        DB.tasks[i]=Object.assign({},DB.tasks[i],data);
      }else{
        data.id=A.uid("t");
        DB.tasks.push(data);
      }
      A.save(); toast(id?"已更新":"已新增","ok"); window.render(window.getRoute());
    }
  });
}

/* ---------- 自动拆解 ---------- */
function breakdown(){
  var months=DB.tasks.filter(function(t){return t.level==="month"&&t.status!=="done";});
  if(!months.length){ toast("没有可拆解的月度目标","err"); return; }
  var body='<p style="margin:0 0 12px;font-size:13px;color:var(--ink-2)">选择一个月度目标，系统将按<b>剩余工作日</b>自动生成周任务；当前周再拆出每日待办。已存在的子任务不会重复生成。</p>'+
   '<div class="field"><label for="f_m">月度目标</label><select id="f_m" style="width:100%">'+
    months.map(function(m){return '<option value="'+m.id+'">'+esc(m.period+"｜"+m.title.slice(0,40))+'</option>';}).join("")+
   '</select></div>'+
   '<div class="field" style="margin-top:12px"><label for="f_n">每层生成粒度</label><select id="f_n" style="width:100%">'+
    '<option value="both">周任务 + 每日待办（推荐）</option>'+
    '<option value="week">仅周任务</option>'+
   '</select></div>'+
   '<div style="margin-top:14px;font-size:12px;color:var(--muted);line-height:1.7">'+
    '规则：以目标截止日为终点，从今天起按自然周切分；每周任务的权重按周数均分，截止日取该周末（不超过月目标截止日）；'+
    '当前周再按工作日生成日待办，每天一条，标题带推进序号。</div>';
  openModal({
    title:"自动拆解 · 月度目标 → 周 → 日",
    body:body, okText:"开始拆解",
    onOk:function(scope){
      var mid=$("#f_m",scope).value, mode=$("#f_n",scope).value;
      var m=DB.tasks.filter(function(t){return t.id===mid;})[0];
      if(!m) return false;
      var today=A.todayStr();
      var end=m.due||A.periodEnd(m.period);
      var start=today> A.periodStart(m.period) ? today : A.periodStart(m.period);
      if(end<start) end=A.addDays(start,7);
      var weeks=[], cur=start;
      while(cur<=end){
        var wk=A.weekKey(cur);
        var rg=A.weekRange(wk);
        var wEnd=rg[1]>end?end:rg[1];
        weeks.push({key:wk,start:cur>rg[0]?cur:rg[0],end:wEnd});
        cur=A.addDays(rg[1],1);
      }
      weeks=weeks.slice(0,10);
      var per=Math.max(1,Math.round((m.weight||3)/Math.max(1,weeks.length)*10)/10);
      var created=0;
      var existing=DB.tasks.filter(function(t){return t.parent===mid;});
      weeks.forEach(function(w,i){
        if(existing.some(function(e){return e.level==="week"&&e.period===w.key;})) return;
        DB.tasks.push({id:A.uid("t"),title:"周推进（"+w.key+"）："+m.title,level:"week",period:w.key,parent:mid,
          owner:m.owner,dept:m.dept,priority:m.priority,status:"todo",due:w.end,weight:per,
          source:"自动拆解",projectId:m.projectId,note:"由月度目标自动拆解，第 "+(i+1)+" / "+weeks.length+" 周"});
        created++;
      });
      if(mode==="both"){
        var thisWk=A.weekKey(today);
        var rg=A.weekRange(thisWk);
        var wkTask=DB.tasks.filter(function(t){return t.parent===mid&&t.level==="week"&&t.period===thisWk;})[0];
        var day=today;
        while(day<=rg[1] && day<=end){
          var dow=A.parseD(day).getDay();
          if(dow!==0&&dow!==6){
            var dup=DB.tasks.some(function(t){return t.parent===mid&&t.level==="day"&&t.period===day;});
            if(!dup){
              DB.tasks.push({id:A.uid("t"),title:"推进："+m.title.slice(0,26)+"（"+day.slice(5)+"）",level:"day",period:day,
                parent:wkTask?wkTask.id:mid,owner:m.owner,dept:m.dept,priority:m.priority,status:"todo",due:day,
                weight:1,source:"自动拆解",projectId:m.projectId,note:"本周每日推进项"});
              created++;
            }
          }
          day=A.addDays(day,1);
        }
      }
      A.save();
      toast("已生成 "+created+" 条子任务","ok");
      window.render(window.getRoute());
    }
  });
}

/* ---------- 计划看板页面 ---------- */
window.regPage("plan",{
  sub:"月度目标逐层拆解为周任务与每日待办，逾期自动顺延并留痕",
  render:function(host,sub){
    var today=A.todayStr(), wk=A.weekKey(today), mo=today.slice(0,7);
    var yearS=collect("year","2026"), monthS=collect("month",mo), weekS=collect("week",wk), allS=collect("all");
    var info=window.__rollInfo||{changed:0,stuck:0};

    var html='';
    if(info.changed>0){
      html+='<div class="card" style="margin-bottom:14px;border-left:3px solid #c0392b"><div class="card-b" style="padding:11px 16px;font-size:13px">'+
        '<b style="color:#c0392b">已自动顺延 '+info.changed+' 条逾期任务</b>，并保留「已顺延 N 次」痕迹；'+
        (info.stuck?info.stuck+' 条已顺延 '+MAX_CARRY+' 次转为滞留，需人工介入。':'')+'</div></div>';
    }

    html+='<div class="grid g4" style="margin-bottom:14px">'+
      kpi("年度目标完成率",yearS.rate,"%",yearS.done+" / "+yearS.total+" 项已完成",yearS.rate>=80?"#1f8b4c":"#0f4c81")+
      kpi("本月完成率",monthS.rate,"%",monthS.done+" / "+monthS.total+" 项",monthS.rate>=80?"#1f8b4c":"#0f4c81")+
      kpi("本周完成率",weekS.rate,"%",weekS.done+" / "+weekS.total+" 项",weekS.rate>=80?"#1f8b4c":"#0f4c81")+
      kpi("逾期 / 顺延",allS.overdue+"",'项',"累计顺延 "+allS.carried+" 项",allS.overdue>0?"#c0392b":"#1f8b4c")+
    '</div>';

    // 支持仪表盘跳转定位：#/plan?v=year|month|week
    var TABS=[["today","今日待办"],["week","本周"],["month","本月"],["year","年度目标"],["all","全部任务"],["overdue","逾期与顺延"]];
    var initTab=A.getParam?A.getParam("v"):"";
    if(!TABS.some(function(t){return t[0]===initTab;})) initTab="today";

    html+='<div class="card" style="margin-bottom:14px"><div class="card-h">'+
      '<div class="tabs">'+
        TABS.map(function(t){
          return '<button class="tab'+(t[0]===initTab?" active":"")+'" data-v="'+t[0]+'">'+t[1]+'</button>';
        }).join("")+
      '</div><div class="spacer"></div>'+
      '<button class="btn" id="btnBreak">自动拆解</button>'+
      '<button class="btn primary" id="btnAddTask">+ 新增任务</button>'+
      '</div><div id="taskList"></div></div>';

    html+='<div class="grid g2">'+
      '<div class="card"><div class="card-h"><h3>完成率走势（近 8 周）</h3><span class="hint">按权重加权</span></div><div class="card-b" id="weekChart"></div></div>'+
      '<div class="card"><div class="card-h"><h3>责任人负荷</h3><span class="hint">未完成 / 总数</span></div><div class="card-b" id="ownerStat"></div></div>'+
    '</div>';

    host.innerHTML=html;

    function rowsFor(v){
      var arr=DB.tasks.slice();
      if(v==="today") arr=arr.filter(function(t){ return t.status!=="done" && t.due && t.due<=today; });
      else if(v==="week"){ var rg=A.weekRange(wk); arr=arr.filter(function(t){ return t.due>=rg[0]&&t.due<=rg[1] && !(t.level==="month"||t.level==="year"); }); }
      else if(v==="month") arr=arr.filter(function(t){ return t.level==="month"&&t.period===mo || ((t.level==="week"||t.level==="day")&&String(t.due).slice(0,7)===mo); });
      else if(v==="year") arr=arr.filter(function(t){ return t.level==="year"||t.level==="month"; });
      else if(v==="overdue") arr=arr.filter(function(t){ return t.status!=="done" && (t.carried>0 || t.due<today); });
      var ord={P0:0,P1:1,P2:2};
      arr.sort(function(a,b){
        if((a.status==="done")!==(b.status==="done")) return a.status==="done"?1:-1;
        var d=(ord[a.priority]||9)-(ord[b.priority]||9); if(d) return d;
        return String(a.due||"9999").localeCompare(String(b.due||"9999"));
      });
      return arr;
    }
    function paint(v){
      var box=$("#taskList",host);
      var arr=rowsFor(v);
      if(!arr.length){ box.innerHTML='<div class="empty">该视图下暂无任务</div>'; return; }
      if(v==="year"||v==="month"){
        var g={};
        arr.forEach(function(t){ var k=t.level==="year"?"年度目标":(t.period+(t.level==="month"?"":" · "+new Date(t.due).getMonth()+"月")); if(!g[t.level]) g[t.level]=[]; g[t.level].push(t); });
        var out="";
        ["year","month","week","day"].forEach(function(lv){
          if(!g[lv]) return;
          out+='<div style="padding:8px 14px;background:#f4f7fa;font-size:12px;font-weight:700;color:var(--ink-2);border-top:1px solid var(--line)">'+
               levelName(lv)+(lv==="year"?"目标":lv==="month"?"目标":lv==="week"?"任务":"待办")+' · '+g[lv].length+' 项</div>';
          g[lv].forEach(function(t){ out+=taskRow(t); });
        });
        box.innerHTML=out;
      }else{
        box.innerHTML=arr.map(function(t){return taskRow(t);}).join("");
      }
      bindTaskRows(box);
    }
    paint(initTab);

    $$(".tab",host).forEach(function(b){
      b.onclick=function(){ $$(".tab",host).forEach(function(x){x.classList.remove("active");}); this.classList.add("active"); paint(this.getAttribute("data-v")); };
    });
    $("#btnAddTask",host).onclick=function(){ taskForm(null); };
    $("#btnBreak",host).onclick=breakdown;

    // 周走势
    var weeks=[];
    for(var i=7;i>=0;i--){
      var d=A.addDays(today,-i*7);
      var k=A.weekKey(d);
      if(!weeks.some(function(w){return w.k===k;})) weeks.push({k:k,d:d});
    }
    var baseY=92, topY=18, slot=44;
    var W=weeks.length*slot+12, H=118;
    var svg='<svg viewBox="0 0 '+W+' '+H+'" style="width:100%;height:auto" role="img" aria-label="近八周完成率">';
    [0,50,100].forEach(function(g){
      var y=baseY-(baseY-topY)*g/100;
      svg+='<line x1="14" y1="'+y+'" x2="'+(W-4)+'" y2="'+y+'" stroke="#eef1f5" stroke-width="1"/>'+
           '<text x="0" y="'+(y+3)+'" font-size="7" fill="#b6c0cc">'+g+'</text>';
    });
    weeks.forEach(function(w,i){
      var s=collect("week",w.k);
      var h=(baseY-topY)*Math.min(s.rate,100)/100;
      var x=i*slot+16, bw=26;
      var has=s.total>0;
      var color=s.rate>=80?"#1f8b4c":s.rate>=50?"#1a6fa8":"#c0392b";
      if(has){
        svg+='<rect x="'+x+'" y="'+topY+'" width="'+bw+'" height="'+(baseY-topY)+'" rx="3" fill="#f4f7fa"/>';
        svg+='<rect x="'+x+'" y="'+(baseY-Math.max(h,2))+'" width="'+bw+'" height="'+Math.max(h,2)+'" rx="3" fill="'+color+'"/>';
        svg+='<text x="'+(x+bw/2)+'" y="'+(baseY-Math.max(h,2)-5)+'" font-size="8.5" text-anchor="middle" fill="#3d4a5c">'+s.rate+'%</text>';
      }else{
        svg+='<rect x="'+x+'" y="'+topY+'" width="'+bw+'" height="'+(baseY-topY)+'" rx="3" fill="#fafbfc" stroke="#f0f3f6"/>';
        svg+='<text x="'+(x+bw/2)+'" y="'+(baseY-4)+'" font-size="11" text-anchor="middle" fill="#b6c0cc">—</text>';
      }
      svg+='<text x="'+(x+bw/2)+'" y="'+(baseY+15)+'" font-size="8.5" text-anchor="middle" fill="#8a99ab">'+w.k.slice(5)+'</text>';
    });
    svg+='</svg><div style="font-size:11px;color:var(--muted);text-align:center;margin-top:4px">「—」表示该周无任务安排；柱高为按权重加权的完成率</div>';
    $("#weekChart",host).innerHTML=svg;

    // 责任人
    var own={};
    allS.list.forEach(function(t){
      var o=t.owner||"未指派";
      if(!own[o]) own[o]={n:0,done:0,od:0,w:0,dw:0};
      own[o].n++; own[o].w+=(t.weight||1);
      if(t.status==="done"){ own[o].done++; own[o].dw+=(t.weight||1); }
      else if(t.due&&t.due<today) own[o].od++;
    });
    var list=Object.keys(own).map(function(k){return {name:k,v:own[k],rate:Math.round(own[k].dw/own[k].w*100)};})
      .sort(function(a,b){return b.v.n-a.v.n;}).slice(0,8);
    $("#ownerStat",host).innerHTML=list.map(function(o){
      return '<div style="margin-bottom:11px">'+
        '<div style="display:flex;font-size:12.5px;margin-bottom:4px"><b>'+esc(o.name)+'</b>'+
        '<span style="margin-left:auto;color:var(--muted)">'+o.v.done+'/'+o.v.n+' 完成'+(o.v.od?' · <span style="color:#c0392b">逾期 '+o.v.od+'</span>':'')+'</span></div>'+
        '<div class="bar '+(o.rate>=80?"g":o.rate>=50?"":"r")+'"><i style="width:'+o.rate+'%"></i></div></div>';
    }).join("")||'<div class="empty">暂无数据</div>';
  }
});

/* ---------- 总览仪表盘 ---------- */
window.regPage("dash",{
  sub:"按周、月、总目标多维度展示完成率，实时刷新",
  render:function(host,sub){
    var today=A.todayStr(), wk=A.weekKey(today), mo=today.slice(0,7);
    var y=collect("year","2026"), m=collect("month",mo), w=collect("week",wk), all=collect("all");
    var projCount=DB.projects.length;
    /* 未闭环口径：待整改 / 整改中 / 已回复待复核 / 复核退回 均计入（兼容旧三值） */
    var openIssues=DB.issues.filter(function(i){return INS.isOpen(i.status);}).length;
    var verifying=DB.issues.filter(function(i){return INS.isVerifying(i.status);}).length;
    var overdueIss=DB.issues.filter(function(i){return INS.isOpen(i.status)&&i.deadline&&i.deadline<today;}).length;
    var fixRate=Math.round(DB.issues.filter(function(i){return INS.isClosed(i.status);}).length/Math.max(1,DB.issues.length)*1000)/10;
    var insOpen=DB.inspections.filter(function(i){return INS.isOpen(i.fixStatus);}).length;
    var insVer=DB.inspections.filter(function(i){return INS.isVerifying(i.fixStatus);}).length;

    var h='';
    if(window.__rollInfo&&window.__rollInfo.changed){
      h+='<div class="card" style="margin-bottom:14px;border-left:3px solid #c0392b"><div class="card-b" style="padding:11px 16px;font-size:13px">'+
        '<b style="color:#c0392b">今日已自动顺延 '+window.__rollInfo.changed+' 条逾期任务</b>，原截止日期保留在任务记录中，可追溯。</div></div>';
    }

    var qt=(window.QD?QD.totals():{total:0,nw:0,chg:0,gone:0,bound:0});
    var qPend=(qt.nw||0)+(qt.chg||0);
    h+='<div class="grid g5" style="margin-bottom:14px">'+
      kpi("年度总目标",y.rate,"%","已完成 "+y.done+" / "+y.total+" 项","","#/plan?v=year")+
      kpi("本月完成率",m.rate,"%","已完成 "+m.done+" / "+m.total+" 项","","#/plan?v=month")+
      kpi("本周完成率",w.rate,"%","已完成 "+w.done+" / "+w.total+" 项","","#/plan?v=week")+
      kpi("在建项目",projCount+"","个",
        "整改闭环 "+fixRate+"% · 待复核 "+verifying+(overdueIss?(" · <span style=\"color:#c0392b\">超期 "+overdueIss+"</span>"):""),
        overdueIss?"#b9770e":"","#/projects")+
      kpi("本地文件",qt.total+"","个",
        (qt.bound?("已绑定 "+qt.bound+" 个入口 · "+(qPend?("待确认 "+qPend+" 项"):"无待确认")):"尚未绑定文件夹"),
        qPend?"#b9770e":"","#/folder")+
    '</div>';

    h+='<div class="grid g3" style="margin-bottom:14px">'+
      '<div class="card"><div class="card-b">'+ring(y.rate,"#0f4c81","年度","总目标")+
        '<div class="legend"><span>已完成 '+y.done+' 项</span><span>逾期 '+y.overdue+' 项</span></div></div></div>'+
      '<div class="card"><div class="card-b">'+ring(m.rate,"#1a6fa8","月度","本月 "+mo)+
        '<div class="legend"><span>已完成 '+m.done+' 项</span><span>顺延 '+m.carried+' 项</span></div></div></div>'+
      '<div class="card"><div class="card-b">'+ring(w.rate,w.rate>=80?"#1f8b4c":"#b9770e","周","本周 "+wk)+
        '<div class="legend"><span>已完成 '+w.done+' 项</span><span>共 '+w.total+' 项</span></div></div></div>'+
    '</div>';

    h+='<div class="grid g2" style="margin-bottom:14px">'+
      '<div class="card"><div class="card-h"><h3>待处理事项</h3><span class="hint">按紧急度排序 · 取前 5 项</span></div><div class="card-b" style="padding:0">';
    var inb=(window.inboxItems?window.inboxItems():[]);
    var inbTop=inb.slice(0,5);
    if(!inbTop.length) h+='<div class="empty">当前没有待处理事项</div>';
    inbTop.forEach(function(it){
      h+='<div style="display:flex;gap:10px;padding:9px 16px;border-bottom:1px solid #eef1f5;align-items:flex-start">'+
        '<span class="tag '+(it.urgCls||"t-gray")+'" style="margin-top:1px">'+esc(it.urgTxt||"待办")+'</span>'+
        '<div style="flex:1;min-width:0"><div style="font-size:13px;font-weight:600;line-height:1.4">'+esc(it.title)+'</div>'+
        '<div style="font-size:11.5px;color:var(--muted);margin-top:2px">'+esc(it.srcName||"")+' · '+esc(it.owner||"未指派")+
        (it.due?' · 截止 '+esc(it.due):'')+'</div></div></div>';
    });
    h+='<div style="padding:9px 16px;border-top:1px solid #eef1f5;display:flex;gap:6px;flex-wrap:wrap">'+
      (function(){
        var sc={}; inb.forEach(function(it){ var k=it.srcName||"其他"; sc[k]=(sc[k]||0)+1; });
        var ks=Object.keys(sc);
        if(!ks.length) return '<span style="font-size:12px;color:var(--muted)">暂无来源分布</span>';
        return ks.map(function(k){return '<span class="tag t-gray">'+esc(k)+' '+sc[k]+'</span>';}).join("");
      })()+'</div>'+
      '<div style="padding:10px 16px;border-top:1px solid #eef1f5;display:flex;align-items:center;gap:8px">'+
      '<span style="font-size:12px;color:var(--muted)">共 '+inb.length+' 项待处理</span><div class="spacer"></div>'+
      '<button class="btn sm" data-go="inbox">进入待处理事项 →</button></div>'+
      '</div></div>';

    h+='<div class="card"><div class="card-h"><h3>台账健康度</h3><span class="hint">12 类台账现状</span></div><div class="card-b">';
    var health=[
      ["在建项目",DB.projects.length,"个"],
      ["质量检查",DB.inspections.length,"次（未闭环 "+insOpen+(insVer?" · 待复核 "+insVer:"")+"）"],
      ["检查问题",DB.issues.length,"条（未闭环 "+openIssues+(verifying?" · 待复核 "+verifying:"")+(overdueIss?" · 超期 "+overdueIss:"")+"）"],
      ["方案内审",DB.reviews.length,"份"],
      ["技术交底",DB.briefings.length,"次"],
      ["风险识别",DB.risks.length,"项"],
      ["质量会议",DB.meetings.length,"场"],
      ["质量培训",DB.trainings.length,"场"],
      ["QC 课题",DB.qcs.length,"个"],
      ["作业指导书",DB.guides.length,"份"],
      ["办法制度",DB.policies.length,"项"],
      ["机构人员",DB.orgs.length,"人"]
    ];
    h+=health.map(function(x){
      return '<div style="display:flex;padding:6px 0;border-bottom:1px dashed #eef1f5;font-size:12.5px">'+
        '<span style="color:var(--ink-2)">'+esc(x[0])+'</span>'+
        '<span style="margin-left:auto;font-weight:700">'+x[1]+' <span style="font-weight:400;color:var(--muted);font-size:11.5px">'+esc(x[2])+'</span></span></div>';
    }).join("");

    /* 整改流转分布：在总仪表盘直接看出问题卡在哪个环节 */
    h+='<div style="margin-top:12px;padding-top:11px;border-top:1px solid #eef1f5">'+
      '<div style="display:flex;align-items:center;font-size:12px;color:var(--ink-2);margin-bottom:8px">'+
        '<span>整改流转</span><span style="margin-left:auto;font-size:11.5px;color:var(--muted)">共 '+DB.issues.length+' 个问题项</span></div>'+
      '<div style="display:flex;gap:6px;flex-wrap:wrap">'+
      INS.STATUS.map(function(s){
        var n=DB.issues.filter(function(i){return i.status===s;}).length;
        var c=s==="已闭环"?"#1f8b4c":s==="复核退回"?"#c0392b":s==="已回复待复核"?"#1a6fa8":"#b9770e";
        return '<div style="flex:1;min-width:94px;background:var(--panel-2);border-radius:6px;padding:7px 9px">'+
          '<div style="font-size:11.5px;color:var(--muted)">'+esc(s)+'</div>'+
          '<div style="font-size:16px;font-weight:700;color:'+(n?c:"#b6c0cc")+'">'+n+'</div></div>';
      }).join("")+
      '</div>'+
      '<div style="margin-top:9px;font-size:11.5px;color:var(--muted);line-height:1.5">'+
        '口径：闭环率 = 已闭环 ÷ 问题总数；「待复核」为已报送整改回复单、尚未完成整改验证。</div>'+
    '</div>';
    h+='</div></div></div>';

    h+='<div class="card"><div class="card-h"><h3>快速入口</h3><span class="hint">已绑定文件夹的入口，点击直接进入该文件夹</span><div class="spacer"></div>'+
      '<button class="btn" id="dashBind">文件夹绑定</button>'+
      '<button class="btn" id="dashBreak">自动拆解月目标</button>'+
      '<button class="btn" id="dashExport">导出全部为 CSV</button>'+
      '<button class="btn primary" id="dashAdd">+ 新增任务</button></div>'+
      '<div class="card-b"><div class="qe-grid">'+
      [["inbox","待处理事项"],["plan","计划表看板"],["folder","本地文件夹"],["space","工作空间站"],["projects","在建项目"],["inspect","检查整改"],["review","方案内审"],["brief","交底与风险"],["meeting","质量会议"],["training","质量培训"],["stats","活动统计"],["qc","QC 活动"],["org","机构人员"],["guide","作业指导书"],["policy","办法制度"],["files","文件中心"]]
        .map(function(x){
          var r=x[0], bound=false, cnt=null, pend=0;
          if(window.QD&&QD.isBound&&QD.isBound(r)){
            bound=true;
            cnt=QD.countOf(r);
            pend=(cnt.new||0)+(cnt.chg||0);
          }
          var to=bound?("#/folder?r="+r):("#/"+r);
          return '<a class="qe'+(bound?" bound":"")+'" href="'+to+'" title="'+
            (bound?("打开绑定文件夹 · 索引 "+cnt.total+" 个文件"):"尚未绑定本地文件夹，点击进入台账")+'">'+
            '<span class="qe-t">'+x[1]+'</span>'+
            (bound?'<span class="qe-n">'+cnt.total+'</span>':"")+
            (pend?'<span class="qe-dot" title="有 '+pend+' 项待确认"></span>':"")+
            '</a>';
        }).join("")+
      '</div>'+
      '<div class="qe-legend">'+
        '<span><i class="qe-sw bound"></i>已绑定文件夹（点击进文件夹）</span>'+
        '<span><i class="qe-sw"></i>未绑定（点击进台账）</span>'+
        '<span><i class="qe-sw dot"></i>有待确认的新增或变更</span>'+
      '</div></div></div>';

    host.innerHTML=h;
    $("#dashBind",host).onclick=function(){ location.hash="#/folder"; };
    $("#dashAdd",host).onclick=function(){ taskForm(null); };
    $("#dashBreak",host).onclick=breakdown;
    $("#dashExport",host).onclick=function(){ if(window.exportAllCSV) window.exportAllCSV(); };
    $$("[data-go]",host).forEach(function(b){ b.onclick=function(){ location.hash="#/"+this.getAttribute("data-go"); }; });
  }
});

window.taskForm=taskForm;
})();
