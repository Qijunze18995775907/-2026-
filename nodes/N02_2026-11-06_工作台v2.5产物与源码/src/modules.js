/* ===== 12 类台账模块 ===== */
(function(){
"use strict";
var A=window.APP, $=A.$, $$=A.$$, esc=A.esc;

function DB(){return A.db;}
function trunc(s,n){ s=String(s||""); return s.length>n?s.slice(0,n)+"…":s; }
function projName(id){ var p=DB().projects.filter(function(x){return x.id===id;})[0]; return p?p.name:""; }
function projOpts(){ return DB().projects.map(function(p){return [p.id,trunc(p.name,26)];}); }
function projShort(id){
  var n=projName(id); if(!n) return '<span style="color:#b6c0cc">—</span>';
  return '<span title="'+esc(n)+'">'+esc(trunc(n,16))+'</span>';
}
function tag(text,cls){ return text?'<span class="tag '+cls+'">'+esc(text)+'</span>':'<span style="color:#b6c0cc">—</span>'; }

/* ---------- 1. 每月质量会议 ---------- */
A.regSchema("meetings",{
  title:"质量会议",prefix:"m",key:"meetings",
  sortBy:"date",
  cols:[
    {k:"title",l:"会议主题",w:210,fmt:function(v,r){return '<div class="cell-main">'+esc(trunc(v,40))+'</div><div class="cell-sub">'+esc(r.place||"")+'</div>';}},
    {k:"date",l:"日期",w:100},
    {k:"form",l:"形式",w:80,fmt:function(v){return tag(v,"t-gray");}},
    {k:"host",l:"主持人",w:80},
    {k:"people",l:"参会人次",w:80,num:true},
    {k:"content",l:"主要内容",w:240,fmt:function(v){return '<span style="font-size:12.5px;color:var(--ink-2)">'+esc(trunc(v,52))+'</span>';}},
    {k:"status",l:"状态",w:80,fmt:function(v){return tag(v,v==="已归档"?"t-green":"t-amber");}}
  ],
  fields:[
    {k:"title",l:"会议主题",t:"text",req:true,full:true},
    {k:"date",l:"会议日期",t:"date",req:true},
    {k:"form",l:"会议形式",t:"select",opts:["线上","线下","线上+线下"]},
    {k:"level",l:"会议级别",t:"select",opts:["公司级","队级","项目级"]},
    {k:"place",l:"地点",t:"text"},
    {k:"host",l:"主持人",t:"text"},
    {k:"people",l:"参会人次",t:"number"},
    {k:"status",l:"状态",t:"select",opts:["待召开","已召开","已归档"]},
    {k:"content",l:"主要内容",t:"textarea",full:true},
    {k:"decision",l:"决议事项",t:"textarea",full:true}
  ],
  defaultNew:{form:"线上+线下",level:"公司级",status:"已召开",place:"三楼会议室"},
  filters:[{k:"form",l:"形式",opts:["线上","线下","线上+线下"]},{k:"status",l:"状态",opts:["待召开","已召开","已归档"]}]
});

/* ---------- 2. 质量培训 ---------- */
A.regSchema("trainings",{
  title:"质量培训",prefix:"tr",key:"trainings",sortBy:"date",
  cols:[
    {k:"title",l:"培训主题",w:230,fmt:function(v,r){return '<div class="cell-main">'+esc(trunc(v,42))+'</div><div class="cell-sub">'+esc(r.cover||"")+'</div>';}},
    {k:"date",l:"日期",w:100},
    {k:"form",l:"形式",w:90,fmt:function(v){return tag(v,"t-gray");}},
    {k:"teacher",l:"讲师",w:80},
    {k:"hours",l:"学时",w:65,num:true},
    {k:"people",l:"参训人次",w:85,num:true},
    {k:"assess",l:"考核方式",w:130},
    {k:"status",l:"状态",w:80,fmt:function(v){return tag(v,v==="已归档"?"t-green":"t-amber");}}
  ],
  fields:[
    {k:"title",l:"培训主题",t:"text",req:true,full:true},
    {k:"date",l:"培训日期",t:"date",req:true},
    {k:"form",l:"培训形式",t:"select",opts:["集中授课","现场实操","线上","外部培训"]},
    {k:"teacher",l:"讲师",t:"text"},
    {k:"hours",l:"学时",t:"number",step:"0.5"},
    {k:"people",l:"参训人次",t:"number"},
    {k:"status",l:"状态",t:"select",opts:["待开展","已开展","已归档"]},
    {k:"cover",l:"覆盖项目",t:"text",full:true},
    {k:"assess",l:"考核方式",t:"text",full:true}
  ],
  defaultNew:{form:"集中授课",status:"已开展"},
  filters:[{k:"form",l:"形式",opts:["集中授课","现场实操","线上","外部培训"]},{k:"status",l:"状态",opts:["待开展","已开展","已归档"]}]
});

/* ---------- 3. 质量活动统计 ---------- */
A.regSchema("stats",{
  title:"质量活动统计",prefix:"s",key:"stats",sortBy:"cutoff",
  cols:[
    {k:"month",l:"统计月份",w:120,fmt:function(v){return '<b>'+esc(v)+'</b>';}},
    {k:"cutoff",l:"截止日",w:100},
    {k:"training",l:"培训场次",w:80,num:true},
    {k:"trainPeople",l:"培训人次",w:85,num:true},
    {k:"qc",l:"QC 活动",w:80,num:true},
    {k:"review",l:"内审报告",w:85,num:true},
    {k:"check",l:"质量检查",w:85,num:true},
    {k:"issues",l:"指出问题",w:85,num:true},
    {k:"fixed",l:"整改完成",w:85,num:true},
    {k:"_rate",l:"整改率",w:90,fmt:function(v,r){
      var rate=r.issues?Math.round(r.fixed/r.issues*1000)/10:0;
      return '<div style="min-width:70px"><div style="font-size:12px;font-weight:700;color:'+(rate>=90?"#1f8b4c":"#b9770e")+'">'+rate+'%</div>'+
        '<div class="bar '+(rate>=90?"g":"a")+'" style="height:4px;margin-top:3px"><i style="width:'+Math.min(rate,100)+'%"></i></div></div>';
    }},
    {k:"note",l:"备注",w:150,fmt:function(v){return '<span style="font-size:12px;color:var(--muted)">'+esc(trunc(v,24))+'</span>';}}
  ],
  fields:[
    {k:"month",l:"统计月份",t:"text",req:true,ph:"如 2026 年 6 月"},
    {k:"cutoff",l:"统计截止日",t:"date"},
    {k:"doneProj",l:"完成项目数",t:"number"},
    {k:"acceptProj",l:"验收项目数",t:"number"},
    {k:"training",l:"质量培训场次",t:"number"},
    {k:"trainPeople",l:"培训人次",t:"number"},
    {k:"qc",l:"QC 活动数",t:"number"},
    {k:"review",l:"内审报告数",t:"number"},
    {k:"check",l:"质量检查次数",t:"number"},
    {k:"issues",l:"指出问题数",t:"number"},
    {k:"fixed",l:"整改完成数",t:"number"},
    {k:"other",l:"其他质量活动",t:"number"},
    {k:"note",l:"备注",t:"textarea",full:true}
  ],
  defaultNew:{training:0,trainPeople:0,qc:0,review:0,check:0,issues:0,fixed:0,other:0}
});

/* ---------- 4. QC 质量活动 ---------- */
A.regSchema("qcs",{
  title:"QC 质量活动",prefix:"q",key:"qcs",
  cols:[
    {k:"title",l:"课题名称",w:240,fmt:function(v,r){return '<div class="cell-main">'+esc(trunc(v,40))+'</div><div class="cell-sub">'+esc(r.group||"")+'</div>';}},
    {k:"type",l:"课题类型",w:90,fmt:function(v){return tag(v,"t-gray");}},
    {k:"leader",l:"组长",w:80},
    {k:"members",l:"组员",w:160,fmt:function(v){return '<span style="font-size:12px">'+esc(trunc(v,26))+'</span>';}},
    {k:"stage",l:"活动阶段",w:100,fmt:function(v){return tag(v,"t-amber");}},
    {k:"_rate",l:"完成率",w:110,fmt:function(v,r){
      var p=Math.round((r.rate||0)*100);
      return '<div style="min-width:80px"><div style="font-size:12px;font-weight:700">'+p+'%</div><div class="bar" style="height:4px;margin-top:3px"><i style="width:'+p+'%"></i></div></div>';
    }},
    {k:"status",l:"状态",w:80,fmt:function(v){return tag(v,v==="已结题"?"t-green":"t-amber");}}
  ],
  fields:[
    {k:"title",l:"课题名称",t:"text",req:true,full:true},
    {k:"group",l:"小组名称",t:"text"},
    {k:"type",l:"课题类型",t:"select",opts:["现场型","攻关型","管理型","创新型"]},
    {k:"leader",l:"组长",t:"text"},
    {k:"members",l:"组员",t:"text"},
    {k:"regDate",l:"注册时间",t:"date"},
    {k:"stage",l:"活动阶段",t:"select",opts:["选题","现状调查","设定目标","原因分析","对策实施","效果检查","总结发布"]},
    {k:"rate",l:"完成率（0-1）",t:"number",step:"0.01"},
    {k:"status",l:"状态",t:"select",opts:["筹备","活动中","已结题"]},
    {k:"target",l:"目标值",t:"text",full:true},
    {k:"result",l:"成果材料",t:"textarea",full:true},
    {k:"note",l:"备注",t:"textarea",full:true}
  ],
  defaultNew:{type:"现场型",stage:"选题",status:"筹备",rate:0}
});

/* ---------- 5. 施工方案内审记录 ---------- */
A.regSchema("reviews",{
  title:"方案内审记录",prefix:"r",key:"reviews",sortBy:"date",
  cols:[
    {k:"title",l:"方案名称",w:250,fmt:function(v,r){
      var n=window.ReviewAttach?window.ReviewAttach.count(r.id):0;
      return '<div class="cell-main">'+esc(trunc(v,44))+'</div>'+
        '<div class="cell-sub">'+esc(trunc(projName(r.projectId),30))+'</div>'+
        '<div class="cell-sub" style="margin-top:3px"><a class="ra-link" data-ra-open="'+esc(r.id)+'" '+
          'title="上传 / 查看 / 下载该方案的「施工方案」「审查记录」两类附件">附件'+(n?'·'+n:'')+'</a></div>';
    }},
    {k:"type",l:"方案类型",w:110,fmt:function(v){return tag(v,"t-gray");}},
    {k:"level",l:"内审级别",w:85,fmt:function(v){return tag(v,v==="队级"?"t-red":"t-p2");}},
    {k:"date",l:"内审时间",w:100},
    {k:"reviewer",l:"内审人",w:80},
    {k:"count",l:"意见数",w:70,num:true},
    {k:"conclusion",l:"结论",w:95,fmt:function(v){return tag(v,v==="通过"?"t-green":v==="不通过"?"t-red":"t-amber");}},
    {k:"closure",l:"修改闭环",w:90,fmt:function(v){return tag(v,v==="已闭环"?"t-green":v==="整改中"?"t-amber":"t-gray");}}
  ],
  fields:[
    {k:"title",l:"方案名称",t:"text",req:true,full:true},
    {k:"projectId",l:"受审项目",t:"select",opts:projOpts()},
    {k:"type",l:"方案类型",t:"select",opts:["施工组织设计","专项施工方案","技术报告","设计成果"]},
    {k:"level",l:"内审级别",t:"select",opts:["队级","公司级","项目级"]},
    {k:"date",l:"内审时间",t:"date"},
    {k:"reviewer",l:"内审人",t:"text"},
    {k:"count",l:"审查意见数",t:"number"},
    {k:"conclusion",l:"结论",t:"select",opts:["通过","修改后通过","不通过"]},
    {k:"closure",l:"修改闭环",t:"select",opts:["未开始","整改中","已闭环"]},
    {k:"note",l:"审查要点 / 备注",t:"textarea",full:true}
  ],
  defaultNew:{type:"施工组织设计",level:"队级",conclusion:"修改后通过",closure:"未开始",count:0},
  /* 行内「附件(N)」链接 + 页面级「附件总览」。renderTable 的 host 只含表格，
     总览按钮在表格外，故用 document 级查找；两者都只打开弹窗，不改动任何业务字段。 */
  afterRender:function(host){
    $$("[data-ra-open]",host).forEach(function(a){
      a.onclick=function(e){
        e.stopPropagation();
        if(window.ReviewAttach) window.ReviewAttach.open(this.getAttribute("data-ra-open"));
      };
    });
    Array.prototype.forEach.call(document.querySelectorAll("[data-ra-allbtn]"),function(b){
      b.onclick=function(){ if(window.ReviewAttach) window.ReviewAttach.openAll(); };
    });
  }
});

/* ---------- 6. 质量管理机构 ---------- */
A.regSchema("orgs",{
  title:"质量管理机构",prefix:"o",key:"orgs",
  cols:[
    {k:"name",l:"姓名",w:90,fmt:function(v){return '<b>'+esc(v)+'</b>';}},
    {k:"post",l:"职务",w:120},
    {k:"org",l:"所属机构",w:120,fmt:function(v){return tag(v,v==="质量管理委员会"?"t-red":v==="QC小组"?"t-p2":"t-gray");}},
    {k:"duty",l:"分工职责",w:280},
    {k:"phone",l:"联系电话",w:120},
    {k:"since",l:"任职时间",w:100}
  ],
  fields:[
    {k:"name",l:"姓名",t:"text",req:true},
    {k:"post",l:"职务",t:"text"},
    {k:"org",l:"所属机构",t:"select",opts:["质量管理委员会","质量管理领导小组","QC小组","项目部"]},
    {k:"duty",l:"分工职责",t:"text",full:true},
    {k:"phone",l:"联系电话",t:"text"},
    {k:"since",l:"任职时间",t:"date"},
    {k:"note",l:"备注",t:"text",full:true}
  ],
  defaultNew:{org:"质量管理委员会"}
});

/* ---------- 7. 作业指导书 ---------- */
A.regSchema("guides",{
  title:"作业指导书",prefix:"g",key:"guides",
  cols:[
    {k:"title",l:"名称",w:240,fmt:function(v){return '<b>'+esc(v)+'</b>';}},
    {k:"major",l:"适用专业",w:130,fmt:function(v){return tag(v,"t-p2");}},
    {k:"version",l:"版本",w:120},
    {k:"editor",l:"编制人",w:85},
    {k:"date",l:"发布日期",w:100},
    {k:"status",l:"状态",w:85,fmt:function(v){return tag(v,v==="有效"?"t-green":v==="修订中"?"t-amber":"t-gray");}},
    {k:"path",l:"原件路径",w:260,fmt:function(v){
      if(!v) return '<span style="color:#b6c0cc">—</span>';
      return '<span style="font-size:11.5px;color:var(--muted);cursor:pointer" title="'+esc(v)+'" data-copy="'+esc(v)+'">'+esc(trunc(v,34))+' ⧉</span>';
    }}
  ],
  fields:[
    {k:"title",l:"名称",t:"text",req:true,full:true},
    {k:"major",l:"适用专业",t:"select",opts:["地质灾害施工","地质灾害监理","基坑监测","基础施工","岩土工程勘察"]},
    {k:"version",l:"版本",t:"text"},
    {k:"editor",l:"编制人",t:"text"},
    {k:"date",l:"发布日期",t:"date"},
    {k:"status",l:"状态",t:"select",opts:["有效","修订中","作废"]},
    {k:"path",l:"原件路径",t:"text",full:true,ph:"E:\\workbuddy 缓存\\workbuddy\\总工作台\\raw\\a资源\\2026公司质量管理台账\\...docx"},
    {k:"note",l:"备注",t:"text",full:true}
  ],
  defaultNew:{status:"有效"},
  afterRender:function(host){ bindCopy(host); }
});

/* ---------- 8. 质量管理办法及制度 ---------- */
A.regSchema("policies",{
  title:"办法制度",prefix:"y",key:"policies",sortBy:"pubDate",
  cols:[
    {k:"title",l:"文件名称",w:250,fmt:function(v,r){return '<div class="cell-main">'+esc(trunc(v,40))+'</div><div class="cell-sub">'+esc(r.docNo||"")+'</div>';}},
    {k:"issuer",l:"发布单位",w:180,fmt:function(v){return '<span style="font-size:12px">'+esc(trunc(v,22))+'</span>';}},
    {k:"pubDate",l:"发布日期",w:105},
    {k:"implDate",l:"实施日期",w:105},
    {k:"scope",l:"适用范围",w:160,fmt:function(v){return '<span style="font-size:12px">'+esc(trunc(v,22))+'</span>';}},
    {k:"status",l:"状态",w:80,fmt:function(v){return tag(v,v==="现行"?"t-green":v==="修订中"?"t-amber":"t-gray");}},
    {k:"path",l:"原件路径",w:230,fmt:function(v){
      if(!v) return '<span style="color:#b6c0cc">—</span>';
      return '<span style="font-size:11.5px;color:var(--muted);cursor:pointer" title="'+esc(v)+'" data-copy="'+esc(v)+'">'+esc(trunc(v,30))+' ⧉</span>';
    }}
  ],
  fields:[
    {k:"title",l:"文件名称",t:"text",req:true,full:true},
    {k:"docNo",l:"文号",t:"text"},
    {k:"issuer",l:"发布单位",t:"text"},
    {k:"pubDate",l:"发布日期",t:"date"},
    {k:"implDate",l:"实施日期",t:"date"},
    {k:"scope",l:"适用范围",t:"text",full:true},
    {k:"status",l:"状态",t:"select",opts:["现行","修订中","废止"]},
    {k:"path",l:"原件路径",t:"text",full:true},
    {k:"note",l:"备注",t:"text",full:true}
  ],
  defaultNew:{status:"现行"},
  afterRender:function(host){ bindCopy(host); }
});

function bindCopy(host){
  $$("[data-copy]",host).forEach(function(el){
    el.onclick=function(){
      var txt=this.getAttribute("data-copy");
      copyText(txt);
    };
  });
}
function copyText(txt){
  txt=(txt==null?"":String(txt));
  /* 优先走同步 execCommand：必须在用户点击的同步调用栈内执行才可靠；
     剪贴板 API 是异步的，脱离手势上下文后在 file:// 或部分浏览器会静默失败。 */
  var done=false;
  function syncCopy(){
    var ta=document.createElement("textarea");
    ta.value=txt;
    ta.setAttribute("readonly","");
    ta.style.position="fixed";
    ta.style.left="-9999px";
    ta.style.top="0";
    ta.style.opacity="0";
    ta.style.width="1px";
    ta.style.height="1px";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    ta.setSelectionRange(0, txt.length);
    var ok=false;
    try{ ok=document.execCommand("copy"); }catch(e){ ok=false; }
    ta.remove();
    return ok;
  }
  if(syncCopy()){
    toast("路径已复制","ok");
    return;
  }
  /* 同步失败才降级到异步剪贴板 API */
  if(navigator.clipboard&&window.isSecureContext){
    navigator.clipboard.writeText(txt).then(function(){toast("路径已复制","ok");},function(){
      toast("复制失败，请手动选择","err");
    });
  }else{
    toast("复制失败，请手动选择","err");
  }
}
window.copyText=copyText;

/* ---------- 页面注册（简单表格类）---------- */
var PAGE_ROUTE={meetings:"meeting",trainings:"training",stats:"stats",qcs:"qc",reviews:"review",
                orgs:"org",guides:"guide",policies:"policy"};
function simplePage(key,schemaKey,extraHead,route){
  var rt=route||PAGE_ROUTE[schemaKey];
  return {
    sub:"",
    render:function(host){
      var h="";
      if(extraHead) h+=extraHead(DB());
      h+='<div class="card"><div class="card-b" id="tbHost" style="padding:14px 16px 6px"></div></div>';
      h+='<div id="mfHost"></div>';
      host.innerHTML=h;
      A.renderTable(schemaKey,$("#tbHost",host));
      if(rt&&window.moduleFilesCard) window.moduleFilesCard(rt,$("#mfHost",host));
    }
  };
}
A.regPage("meeting",simplePage("meetings","meetings",function(db){
  var total=db.meetings.reduce(function(s,m){return s+(m.people||0);},0);
  return '<div class="grid g4" style="margin-bottom:14px">'+
    '<div class="card kpi"><div class="k">已召开会议</div><div class="v">'+db.meetings.length+'<small>场</small></div><div class="d">全部为公司级</div></div>'+
    '<div class="card kpi"><div class="k">累计参会</div><div class="v">'+total+'<small>人次</small></div><div class="d">平均 '+(db.meetings.length?Math.round(total/db.meetings.length):0)+' 人次/场</div></div>'+
    '<div class="card kpi"><div class="k">最近一次</div><div class="v" style="font-size:16px">'+(db.meetings.length?db.meetings.map(function(m){return m.date;}).sort().slice(-1)[0]:"—")+'</div><div class="d">每月至少一次</div></div>'+
    '<div class="card kpi"><div class="k">本月计划</div><div class="v">11<small>月</small></div><div class="d">议程与签到表准备中</div></div>'+
  '</div>';
}));
A.regPage("training",simplePage("trainings","trainings",function(db){
  var done=db.trainings.filter(function(t){return t.status==="已归档";}).length;
  var people=db.trainings.reduce(function(s,t){return s+(t.people||0);},0);
  var hours=db.trainings.reduce(function(s,t){return s+(t.hours||0);},0);
  return '<div class="grid g4" style="margin-bottom:14px">'+
    '<div class="card kpi"><div class="k">已开展培训</div><div class="v">'+done+'<small>场</small></div><div class="d">另有 '+db.trainings.filter(function(t){return t.status==="待开展";}).length+' 场待开展</div></div>'+
    '<div class="card kpi"><div class="k">累计参训</div><div class="v">'+people+'<small>人次</small></div><div class="d">覆盖全部在建项目</div></div>'+
    '<div class="card kpi"><div class="k">累计学时</div><div class="v">'+hours+'<small>学时</small></div><div class="d">集中授课为主</div></div>'+
    '<div class="card kpi"><div class="k">年度目标</div><div class="v">4<small>场/季度</small></div><div class="d">第四季度尚未开展</div></div>'+
  '</div>';
}));
A.regPage("stats",simplePage("stats","stats",function(db){
  var iss=db.stats.reduce(function(s,x){return s+(x.issues||0);},0);
  var fix=db.stats.reduce(function(s,x){return s+(x.fixed||0);},0);
  var tp=db.stats.reduce(function(s,x){return s+(x.trainPeople||0);},0);
  var rate=iss?Math.round(fix/iss*1000)/10:0;
  return '<div class="grid g4" style="margin-bottom:14px">'+
    '<div class="card kpi"><div class="k">累计指出问题</div><div class="v">'+iss+'<small>个</small></div><div class="d">1—5 月合计</div></div>'+
    '<div class="card kpi"><div class="k">整改完成</div><div class="v">'+fix+'<small>个</small></div><div class="d">整改率 '+rate+'%</div></div>'+
    '<div class="card kpi"><div class="k">培训人次</div><div class="v">'+tp+'<small>人次</small></div><div class="d">月均 '+(db.stats.length?Math.round(tp/db.stats.length):0)+'</div></div>'+
    '<div class="card kpi"><div class="k">统计口径</div><div class="v" style="font-size:16px">16</div><div class="d">按局质量活动统计表</div></div>'+
  '</div>';
}));
A.regPage("qc",simplePage("qcs","qcs",function(db){
  var q=db.qcs[0]||{};
  return '<div class="card" style="margin-bottom:14px;border-left:3px solid #0f4c81"><div class="card-b">'+
    '<div style="display:flex;gap:14px;flex-wrap:wrap;align-items:center">'+
      '<div style="flex:1;min-width:220px"><div style="font-size:15px;font-weight:700;margin-bottom:4px">'+esc(q.title||"暂无课题")+'</div>'+
      '<div style="font-size:12.5px;color:var(--muted)">'+esc(q.group||"")+' · 组长 '+esc(q.leader||"—")+' · 注册于 '+esc(q.regDate||"—")+'</div>'+
      '<div style="font-size:12.5px;margin-top:8px">目标值：'+esc(q.target||"—")+'</div></div>'+
      '<div style="text-align:center"><div style="font-size:11.5px;color:var(--muted);margin-bottom:4px">当前阶段</div>'+
        '<span class="tag t-amber" style="font-size:12.5px;padding:4px 12px">'+esc(q.stage||"—")+'</span></div>'+
      '<div style="text-align:center;min-width:90px"><div style="font-size:11.5px;color:var(--muted);margin-bottom:4px">完成率</div>'+
        '<div style="font-size:22px;font-weight:700;color:#0f4c81">'+Math.round((q.rate||0)*100)+'%</div></div>'+
    '</div></div></div>';
}));
A.regPage("review",simplePage("reviews","reviews",function(db){
  var closed=db.reviews.filter(function(r){return r.closure==="已闭环";}).length;
  var cnt=db.reviews.reduce(function(s,r){return s+(r.count||0);},0);
  return '<div class="grid g4" style="margin-bottom:14px">'+
    '<div class="card kpi"><div class="k">内审方案</div><div class="v">'+db.reviews.length+'<small>份</small></div><div class="d">覆盖 6 个项目</div></div>'+
    '<div class="card kpi"><div class="k">审查意见</div><div class="v">'+cnt+'<small>条</small></div><div class="d">平均 '+(db.reviews.length?Math.round(cnt/db.reviews.length):0)+' 条/份</div></div>'+
    '<div class="card kpi"><div class="k">已闭环</div><div class="v">'+closed+'<small>份</small></div><div class="d">闭环率 '+Math.round(closed/Math.max(1,db.reviews.length)*100)+'%</div></div>'+
    '<div class="card kpi"><div class="k">待闭环</div><div class="v" style="color:#b9770e">'+(db.reviews.length-closed)+'<small>份</small></div><div class="d">马鞍山、西塞山</div></div>'+
  '</div>'+
  '<div class="card" style="margin-bottom:14px"><div class="card-b" style="padding:10px 16px;display:flex;align-items:center;gap:12px;flex-wrap:wrap">'+
    '<div style="flex:1;min-width:220px"><b style="font-size:13px">方案附件</b>'+
      '<span class="hint" style="margin-left:8px">按「施工方案 / 审查记录」两类分别管理；点击方案名称下的「附件(N)」管理该方案附件</span></div>'+
    '<button class="btn sm" data-ra-allbtn="1">附件总览</button>'+
  '</div></div>';
}));
A.regPage("org",simplePage("orgs","orgs",function(db){
  var wy=db.orgs.filter(function(o){return o.org==="质量管理委员会";}).length;
  var qc=db.orgs.filter(function(o){return o.org==="QC小组";}).length;
  return '<div class="grid g4" style="margin-bottom:14px">'+
    '<div class="card kpi"><div class="k">质量管理委员会</div><div class="v">'+wy+'<small>人</small></div><div class="d">主任 王盼 · 副主任 吴勇</div></div>'+
    '<div class="card kpi"><div class="k">QC 小组</div><div class="v">'+qc+'<small>人</small></div><div class="d">组长 代小俊</div></div>'+
    '<div class="card kpi"><div class="k">调整文号</div><div class="v" style="font-size:15px">中大〔2026〕9 号</div><div class="d">2025.4.22 调整</div></div>'+
    '<div class="card kpi"><div class="k">分管领导</div><div class="v" style="font-size:17px">代小俊</div><div class="d">总经理 · 质量管理分管</div></div>'+
  '</div>';
}));
A.regPage("guide",simplePage("guides","guides",function(db){
  var valid=db.guides.filter(function(g){return g.status==="有效";}).length;
  return '<div class="grid g4" style="margin-bottom:14px">'+
    '<div class="card kpi"><div class="k">作业指导书</div><div class="v">'+db.guides.length+'<small>份</small></div><div class="d">覆盖 5 个专业</div></div>'+
    '<div class="card kpi"><div class="k">现行有效</div><div class="v">'+valid+'<small>份</small></div><div class="d">可直接用于现场</div></div>'+
    '<div class="card kpi"><div class="k">修订中</div><div class="v" style="color:#b9770e">'+(db.guides.length-valid)+'<small>份</small></div><div class="d">地灾监理待定稿</div></div>'+
    '<div class="card kpi"><div class="k">编制人</div><div class="v" style="font-size:17px">祁骏泽</div><div class="d">技术负责人</div></div>'+
  '</div>';
}));
A.regPage("policy",simplePage("policies","policies",function(db){
  return '<div class="grid g4" style="margin-bottom:14px">'+
    '<div class="card kpi"><div class="k">办法制度</div><div class="v">'+db.policies.length+'<small>项</small></div><div class="d">含局、大队、公司三级</div></div>'+
    '<div class="card kpi"><div class="k">现行有效</div><div class="v">'+db.policies.filter(function(p){return p.status==="现行";}).length+'<small>项</small></div><div class="d">全部在有效期内</div></div>'+
    '<div class="card kpi"><div class="k">质量硬指标</div><div class="v">7<small>项</small></div><div class="d">见 2026 年度质量工作要点</div></div>'+
    '<div class="card kpi"><div class="k">任务分解</div><div class="v">4<small>季度</small></div><div class="d">季度考核依据</div></div>'+
  '</div>';
}));

/* ---------- 9. 在建项目业务清单（深度）---------- */
A.regSchema("projects",{
  title:"在建项目",prefix:"p",key:"projects",
  cols:[
    {k:"name",l:"项目名称",w:280,fmt:function(v,r){
      return '<div class="cell-main">'+esc(trunc(v,46))+'</div>'+
        '<div class="cell-sub">'+esc(r.place||"")+' · '+esc(r.kind==="新建"?"新建":"延续")+'</div>';}},
    {k:"type",l:"项目类型",w:100,fmt:function(v){
      var m={"地质灾害治理":"t-p2","边坡治理":"t-doing","监理服务":"t-amber","桩基施工":"t-amber","排危除险":"t-red","生态修复":"t-green"};
      return tag(v,m[v]||"t-gray");}},
    {k:"amount",l:"合同额(万元)",w:105,num:true,fmt:function(v){return '<b>'+A.nf(v)+'</b>';}},
    {k:"status",l:"状态",w:110,fmt:function(v){return tag(v,v==="施工实施"?"t-doing":v==="已验收"?"t-green":"t-amber");}},
    {k:"owner",l:"负责人",w:85},
    {k:"progress",l:"形象进度",w:110,fmt:function(v){
      var p=Math.round((v||0)*100);
      return '<div style="min-width:80px"><div style="font-size:12px;font-weight:700">'+p+'%</div><div class="bar" style="height:4px;margin-top:3px"><i style="width:'+p+'%"></i></div></div>';}},
    {k:"fixInfo",l:"整改情况",w:170,fmt:function(v){return '<span style="font-size:12px">'+esc(trunc(v,28))+'</span>';}},
    {k:"_act",l:"",w:70,fmt:function(v,r){return '<button class="btn sm" data-proj="'+esc(r.id)+'">详情</button>';}}
  ],
  fields:[
    {k:"name",l:"项目名称",t:"text",req:true,full:true},
    {k:"type",l:"项目类型",t:"select",opts:["地质灾害治理","边坡治理","桩基施工","监理服务","排危除险","生态修复"]},
    {k:"major",l:"主要内容（按专业、产业）",t:"select",opts:["地质灾害环境治理工程施工","生态保护和环境治理","其他"]},
    {k:"fund",l:"资金来源",t:"select",opts:["市场","市县财政","中央财政"]},
    {k:"dcontrol",l:"队（院）控项目",t:"select",opts:["否","是"]},
    {k:"amount",l:"合同额（万元）",t:"number",step:"0.01"},
    {k:"place",l:"项目地点",t:"text",full:true},
    {k:"status",l:"项目状态",t:"select",opts:["施工实施","已完工待验收","已验收","暂停"]},
    {k:"start",l:"开工日期",t:"date"},
    {k:"end",l:"预计完工",t:"date"},
    {k:"owner",l:"项目负责人",t:"text"},
    {k:"phone",l:"联系电话",t:"text"},
    {k:"progress",l:"形象进度（0-1）",t:"number",step:"0.01"},
    {k:"progDesc",l:"项目进度情况（导出用文字描述）",t:"textarea",full:true},
    {k:"kind",l:"延续/新建",t:"select",opts:["延续","新建"]},
    {k:"checkInfo",l:"质量检查情况",t:"textarea",full:true},
    {k:"fixInfo",l:"问题整改情况",t:"textarea",full:true},
    {k:"note",l:"备注",t:"textarea",full:true}
  ],
  defaultNew:{type:"地质灾害治理",fund:"市县财政",status:"施工实施",kind:"新建",progress:0,dcontrol:"否",major:"地质灾害环境治理工程施工"},
  extraButtons:function(){
    return '<button class="btn" data-xlsx="1" title="按桌面模板版式导出《所有项目业务清单》Excel">导出业务清单</button>';
  },
  afterRender:function(host){
    $$("[data-proj]",host).forEach(function(b){
      b.onclick=function(e){ e.stopPropagation(); projectDetail(this.getAttribute("data-proj")); };
    });
    var xb=$("[data-xlsx]",host);
    if(xb) xb.onclick=function(){ if(window.exportProjectList) window.exportProjectList(); };
  }
});

A.regPage("projects",{
  sub:"8 个在建项目，含合同额、形象进度、检查与整改闭环情况",
  render:function(host){
    var db=DB();
    var total=db.projects.reduce(function(s,p){return s+(p.amount||0);},0);
    var doing=db.projects.filter(function(p){return p.status==="施工实施";}).length;
    var wait=db.projects.filter(function(p){return p.status==="已完工待验收";}).length;
    var avg=db.projects.length?db.projects.reduce(function(s,p){return s+(p.progress||0);},0)/db.projects.length:0;
    host.innerHTML='<div class="grid g4" style="margin-bottom:14px">'+
      '<div class="card kpi"><div class="k">在建项目</div><div class="v">'+db.projects.length+'<small>个</small></div><div class="d">施工实施 '+doing+' · 待验收 '+wait+'</div></div>'+
      '<div class="card kpi"><div class="k">合同额合计</div><div class="v">'+A.nf(Math.round(total*100)/100)+'<small>万元</small></div><div class="d">最大单项 1340 万元</div></div>'+
      '<div class="card kpi"><div class="k">平均形象进度</div><div class="v">'+Math.round(avg*100)+'<small>%</small></div><div class="d">按项目简单平均</div></div>'+
      '<div class="card kpi"><div class="k">已内审项目</div><div class="v">'+db.projects.filter(function(p){return p.reviewed;}).length+'<small>个</small></div><div class="d">未审查：铜绿山、西塞山</div></div>'+
    '</div>'+
    '<div class="card"><div class="card-b" id="tbHost" style="padding:14px 16px 6px"></div></div>'+
    '<div id="mfHost"></div>';
    A.renderTable("projects",$("#tbHost",host));
    if(window.moduleFilesCard) window.moduleFilesCard("projects",$("#mfHost",host),{projectFilter:true,always:true,limit:8});
  }
});

function projectDetail(pid){
  var db=DB();
  var p=db.projects.filter(function(x){return x.id===pid;})[0]; if(!p) return;
  var insp=db.inspections.filter(function(i){return i.projectId===pid;});
  var iss=db.issues.filter(function(i){return i.projectId===pid;});
  var rev=db.reviews.filter(function(r){return r.projectId===pid;});
  var brf=db.briefings.filter(function(b){return b.projectId===pid;});
  var rsk=db.risks.filter(function(k){return k.projectId===pid;});
  var tsk=db.tasks.filter(function(t){return t.projectId===pid;});
  var fixed=iss.filter(function(i){return i.status==="已闭环";}).length;

  var h='<div style="display:flex;gap:16px;flex-wrap:wrap;margin-bottom:14px">'+
    '<div style="flex:1;min-width:200px"><div style="font-size:13px;color:var(--muted)">合同额</div><div style="font-size:19px;font-weight:700">'+A.nf(p.amount)+' 万元</div></div>'+
    '<div style="flex:1;min-width:200px"><div style="font-size:13px;color:var(--muted)">形象进度</div><div style="font-size:19px;font-weight:700">'+Math.round((p.progress||0)*100)+'%</div></div>'+
    '<div style="flex:1;min-width:200px"><div style="font-size:13px;color:var(--muted)">整改闭环</div><div style="font-size:19px;font-weight:700;color:'+(iss.length&&fixed<iss.length?"#b9770e":"#1f8b4c")+'">'+fixed+' / '+iss.length+'</div></div>'+
  '</div>'+
  '<div style="font-size:12.5px;line-height:1.9;background:var(--panel-2);padding:11px 13px;border-radius:8px;margin-bottom:14px">'+
    '<div><b>负责人：</b>'+esc(p.owner||"—")+' · '+esc(p.phone||"")+'</div>'+
    '<div><b>工期：</b>'+esc(p.start||"—")+' 至 '+esc(p.end||"—")+'</div>'+
    '<div><b>检查情况：</b>'+esc(p.checkInfo||"—")+'</div>'+
    '<div><b>整改情况：</b>'+esc(p.fixInfo||"—")+'</div>'+
    (p.note?'<div><b>备注：</b>'+esc(p.note)+'</div>':'')+
  '</div>';

  h+='<div id="pdFiles" style="margin-bottom:14px"></div>';

  function sec(title,arr,render){
    if(!arr.length) return '<div style="margin-bottom:12px"><div style="font-size:12.5px;font-weight:700;margin-bottom:5px">'+title+'（0）</div><div style="font-size:12px;color:var(--muted)">暂无记录</div></div>';
    return '<div style="margin-bottom:14px"><div style="font-size:12.5px;font-weight:700;margin-bottom:6px">'+title+'（'+arr.length+'）</div>'+
      arr.map(render).join("")+'</div>';
  }
  h+=sec("质量检查",insp,function(i){
    return '<div style="font-size:12px;padding:6px 9px;border-left:2px solid #dfe5ec;margin-bottom:4px">'+
      '<b>'+esc(i.no)+'</b> '+esc(i.date)+' · '+esc(i.conclusion)+' · 问题 '+i.issueCount+' 个，整改 '+i.fixedCount+' 个</div>';
  });
  h+=sec("检查问题",iss,function(i){
    var c=i.status==="已闭环"?"#1f8b4c":"#b9770e";
    return '<div style="font-size:12px;padding:6px 9px;border-left:2px solid '+c+';margin-bottom:4px">'+
      '<b>'+esc(i.no)+'</b> '+esc(i.desc)+' <span style="color:'+c+'">['+esc(i.status)+']</span></div>';
  });
  h+=sec("方案内审",rev,function(r){
    return '<div style="font-size:12px;padding:6px 9px;border-left:2px solid #dfe5ec;margin-bottom:4px">'+
      esc(r.date)+' · '+esc(r.conclusion)+' · 意见 '+(r.count||0)+' 条 · '+esc(r.closure)+'</div>';
  });
  h+=sec("技术交底",brf,function(b){
    return '<div style="font-size:12px;padding:6px 9px;border-left:2px solid #dfe5ec;margin-bottom:4px">'+
      esc(b.date)+' · '+esc(b.level)+' · '+esc(b.status)+' · '+esc(trunc(b.points,40))+'</div>';
  });
  h+=sec("风险识别",rsk,function(k){
    var c=k.level==="高"?"#c0392b":k.level==="中"?"#b9770e":"#1f8b4c";
    return '<div style="font-size:12px;padding:6px 9px;border-left:2px solid '+c+';margin-bottom:4px">'+
      '<b style="color:'+c+'">['+esc(k.level)+']</b> '+esc(k.title)+' · '+esc(k.status)+'</div>';
  });
  h+=sec("关联任务",tsk,function(t){
    return '<div style="font-size:12px;padding:6px 9px;border-left:2px solid #dfe5ec;margin-bottom:4px">'+
      esc(t.title)+' · '+esc(t.owner||"")+' · '+esc(t.due||"")+' · '+esc({todo:"未开始",doing:"进行中",done:"已完成"}[t.status]||t.status)+'</div>';
  });

  openModal({
    title:p.name,
    body:h, okText:"关闭", noCancel:true,
    afterRender:function(m){
      var LIMIT=5;
      function blockHTML(){
        var list=(db.files||[]).filter(function(f){return f.projectId===pid;});
        var pend=list.filter(function(f){return window.fileIsPending(f);});
        var conf=list.filter(function(f){return !window.fileIsPending(f);});
        var takeP=Math.min(pend.length,LIMIT);
        var top=pend.slice(0,takeP).concat(conf.slice(0,Math.max(0,LIMIT-takeP)));
        var s='<div style="margin-bottom:6px;font-size:12.5px;font-weight:700">本项目文件（'+list.length+'）'+
          (pend.length?' <span class="tag t-amber">待确认 '+pend.length+'</span>':'')+'</div>';
        if(!list.length){
          return s+'<div style="font-size:12px;color:var(--muted);line-height:1.8">该项目暂无登记文件。'+
            '可在「文件中心」上传时选本项目，或在文件「详情」里补关联项目。</div>';
        }
        if(!window.fileRowHTML){
          return s+'<div style="font-size:12px;color:var(--muted)">文件模块尚未就绪</div>';
        }
        s+=top.map(function(f){ return window.fileRowHTML(f,{open:true,toggle:true}); }).join("");
        var more=list.length-top.length;
        if(more>0) s+='<div style="font-size:11.5px;color:var(--muted);margin-top:6px">另有 '+more+' 个文件，见文件中心</div>';
        return s;
      }
      function paintFiles(){
        var box=$("#pdFiles",m); if(!box) return;
        var bodyEl=$(".modal-b",m), sy=bodyEl?bodyEl.scrollTop:0;
        box.innerHTML=blockHTML();
        if(window.fileBind) window.fileBind(box,function(){
          paintFiles();
          if(window.mfRefresh) window.mfRefresh(document.getElementById("mfHost"));
          if(window.refreshNav) window.refreshNav();
        });
        if(bodyEl) bodyEl.scrollTop=sy;
      }
      paintFiles();
    }
  });
}

/* ---------- 10. 质量检查整改回复（深度）----------
   字段与流程依据（三份实际单据逐字核对，不含空模板 xlsx）：
     ① 00公司整改回复/整改通知单/2026上半年公司质量检查整改回复.docx
        致送「队技术质量科」；检查日期 2026-07-27；检查形式《质量检查记录表》《质量问题整改通知单》；
        （一）存在的问题 1—4；（二）整改情况 1—4；（三）整改前后对比图片；
        问题整改责任人（签字）、验收人（签字）、报告时间 2026.7.30
     ② 06罗田生态恢复项目/整改通知单/罗田县生态恢复项目项目整改 回复单01.doc
        整改记录 1—7；整改人 + 2026-07-19；复核记录「已按照要求进行整改」；复核人 + 日期
     ③ 07宜昌稻花香边坡治理工程项目/质量整改回复单260922(1).docx
        项目名称 / 整改单位；整改内容及要求（检查人、日期）；限期整改时间（接收人签字）；
        整改措施（整改人、日期）；整改验证（责任人、日期）；问题一—七 + 附整改照片
   业务流程：检查下发 → 接收签收 → 限期整改 → 报送回复单 → 复核验证 → 闭环 / 退回
------------------------------------------------ */
var INS=window.INSP;

/* 状态配色：闭环绿、退回红、待复核蓝、整改中青、待整改黄 */
function inspCls(v){
  if(v==="已闭环") return "t-green";
  if(v==="复核退回") return "t-red";
  if(v==="已回复待复核") return "t-p2";
  if(v==="整改中") return "t-doing";
  return "t-amber";
}
function inspTag(v){ return tag(v,inspCls(v)); }

/* 原文未写明的字段统一显示「未提供」——只做展示回退，绝不把这两个字写进数据，
   否则后续真有了值会被「空白不覆盖」规则判成已填写而不再更新。 */
function naTxt(){ return '<span style="color:#b6c0cc">未提供</span>'; }

/* 源文件位置（srcLoc）展示：
   取值规则见 importer.js —— T{m}·R{n}=第 m 张表格第 n 行，L{n}=正文第 n 行。
   三种态：有位置 → 蓝色标识；有来源文件但无位置 → 橙色「未记录」；无来源 → 灰色「手工」 */
function locText(v,r){
  var s=String(v||"").trim();
  if(!s) return (r&&r.srcFileId)?"未记录":"手工";
  var m=/^T(\d+)[·:\-]R(\d+)$/.exec(s); if(m) return "表"+m[1]+"·行"+m[2];
  var m2=/^L(\d+)$/.exec(s); if(m2) return "第"+m2[1]+"行";
  return s;
}
function locFull(v){
  var s=String(v||"").trim();
  var m=/^T(\d+)[·:\-]R(\d+)$/.exec(s); if(m) return "源文件第 "+m[1]+" 张表格第 "+m[2]+" 行";
  var m2=/^L(\d+)$/.exec(s); if(m2) return "源文件正文第 "+m2[1]+" 行";
  return s;
}
function locTag(v,r){
  var s=String(v||"").trim(), cls="loc-tag", attrs=" ", title=locFull(s);
  if(!s){
    if(r&&r.srcFileId){ cls+=" is-miss"; title="该行来自文件，但早期版本未记录位置，重新同步该文件可补齐"; }
    else { cls+=" is-manual"; title="手工录入，不来自文件"; }
    return '<span class="'+cls+'" title="'+esc(title)+'">'+esc(locText(v,r))+'</span>';
  }
  if(r&&r.srcFileId) attrs=' data-src="'+esc(r.srcFileId)+'" ';
  return '<span class="'+cls+'"'+attrs+'title="'+esc(title+'（点击查看来源文件）')+'">'+esc(locText(v,r))+'</span>';
}

A.regSchema("inspections",{
  title:"质量检查",prefix:"i",key:"inspections",sortBy:"date",
  formNote:"流转顺序：待整改 → 整改中 → 已回复待复核 → 已闭环（复核不通过则退回「整改中」）。"+
    "置为「已闭环」必须已填复核结论与复核日期，且已整改数等于指出问题数。",
  cols:[
    {k:"no",l:"检查编号",w:126,fmt:function(v,r){
      var n=window.InspAttach?window.InspAttach.count(r.id):0;
      return '<b style="white-space:nowrap">'+esc(v)+'</b><div class="cell-sub" style="white-space:nowrap">'+
        esc(r.kind==="质量检查记录表"?"检查记录表":"整改通知单")+
        ' · <span class="ia-link" data-attach="'+esc(r.id)+'" '+
        'title="上传/下载该检查单的整改通知单与回复单附件">附件'+(n?'('+n+')':'')+'</span></div>';}},
    {k:"date",l:"检查日期",w:100,fmt:function(v){return v?esc(v):naTxt();}},
    {k:"projectId",l:"受检项目",w:140,fmt:function(v){return projShort(v);}},
    {k:"checker",l:"检查人",w:86,fmt:function(v){return v?esc(v):naTxt();}},
    {k:"conclusion",l:"结论",w:76,fmt:function(v){return v?tag(v,v==="合格"?"t-green":v==="不合格"?"t-red":"t-amber"):naTxt();}},
    {k:"issueCount",l:"问题数",w:52,num:true},
    {k:"fixedCount",l:"已整改",w:54,num:true},
    {k:"_rate",l:"整改率",w:72,fmt:function(v,r){
      var p=r.issueCount?Math.round(r.fixedCount/r.issueCount*100):0;
      return '<div style="min-width:70px"><div style="font-size:12px;font-weight:700">'+p+'%</div><div class="bar '+(p>=100?"g":"a")+'" style="height:4px;margin-top:3px"><i style="width:'+Math.min(p,100)+'%"></i></div></div>';}},
    {k:"deadline",l:"限期整改",w:102,fmt:function(v,r){
      if(!v) return naTxt();
      if(INS.isOpen(r.fixStatus)&&v<A.todayStr()){
        var od=A.diffDays(v,A.todayStr());
        return '<span style="color:#c0392b;font-weight:600;white-space:nowrap">'+esc(v)+'</span><div class="cell-sub" style="color:#c0392b">逾期 '+(od>0?od:0)+' 天</div>';
      }
      return '<span style="white-space:nowrap">'+esc(v)+'</span>';}},
    {k:"fixStatus",l:"整改状态",w:112,fmt:function(v,r){
      var s=inspTag(v);
      /* 复核日期并入状态列，避免表格过宽：闭环显示复核日，其余显示所处环节 */
      if(INS.isVerifying(v)) s+='<div class="cell-sub">待复核</div>';
      else if(INS.isClosed(v)&&r.reviewDate) s+='<div class="cell-sub">复核 '+esc(r.reviewDate.slice(5))+'</div>';
      else if(INS.isOpen(v)) s+='<div class="cell-sub">未复核</div>';
      return s;}},
    {k:"_pr",l:"",w:56,fmt:function(v,r){return '<button class="btn sm" data-print="'+esc(r.id)+'">打印</button>';}}
  ],
  fields:[
    /* —— 第一部分：检查下发（整改通知单抬头）—— */
    {k:"no",l:"检查编号",t:"text",req:true,ph:"如 ZLJC-2026-001"},
    {k:"kind",l:"单据类型",t:"select",opts:["质量问题整改通知单","质量检查记录表"]},
    {k:"date",l:"检查日期",t:"date",req:true},
    {k:"projectId",l:"受检项目",t:"select",opts:projOpts()},
    {k:"fixUnit",l:"整改单位",t:"text",ph:"项目部 / 施工队"},
    {k:"toOrg",l:"致送对象",t:"text",ph:"如 队技术质量科"},
    {k:"checker",l:"检查人",t:"text",req:true},
    {k:"sendDate",l:"下发日期",t:"date"},
    /* —— 第二部分：接收签收与限期 —— */
    {k:"receiver",l:"接收人",t:"text"},
    {k:"recvDate",l:"接收日期",t:"date"},
    {k:"deadline",l:"限期整改时间",t:"date"},
    /* —— 第三部分：问题与整改 —— */
    {k:"issueCount",l:"指出问题数",t:"number"},
    {k:"fixedCount",l:"已整改数",t:"number"},
    {k:"fixOwner",l:"整改责任人",t:"text",ph:"问题整改责任人（签字）"},
    {k:"reportDate",l:"整改报告时间",t:"date",ph:"回复单报送日期"},
    /* —— 第四部分：复核验证 —— */
    {k:"reviewer",l:"复核人（验收人）",t:"text"},
    {k:"reviewDate",l:"复核日期",t:"date"},
    {k:"verifyResult",l:"复核结论",t:"select",opts:["待复核","已按要求整改","部分整改","整改不到位"]},
    {k:"photos",l:"整改佐证",t:"text",ph:"如 附整改前后对比图片 12 张"},
    /* —— 第五部分：结论与状态 —— */
    {k:"fixStatus",l:"整改状态",t:"select",opts:INS.STATUS},
    {k:"conclusion",l:"检查结论",t:"select",opts:["合格","基本合格","不合格"]},
    {k:"content",l:"检查内容（存在的问题）",t:"textarea",full:true,ph:"逐条列出（一）（二）（三）……"},
    {k:"note",l:"备注",t:"textarea",full:true}
  ],
  filters:[
    {k:"fixStatus",l:"整改状态",opts:INS.STATUS},
    {k:"kind",l:"单据类型",opts:["质量问题整改通知单","质量检查记录表"]}
  ],
  defaultNew:{kind:"质量问题整改通知单",conclusion:"基本合格",fixStatus:"待整改",verifyResult:"待复核",issueCount:0,fixedCount:0},
  /* 校验规则：全部来自单据的签署与时间先后关系，硬校验不通过则不允许保存 */
  beforeSave:function(d,id){
    function bad(m){ toast(m,"err"); return false; }
    /* R1 检查人必填：三份单据均由检查人签署，缺失则整单不可追溯 */
    if(!d.checker) return bad("请填写「检查人」：整改通知单须由检查人签署");
    /* R2 时间先后：下发 ≤ 报告 */
    if(d.sendDate&&d.reportDate&&d.sendDate>d.reportDate)
      return bad("「下发日期」不能晚于「整改报告时间」");
    /* R3 时间先后：检查 ≤ 限期整改 */
    if(d.date&&d.deadline&&d.date>d.deadline)
      return bad("「限期整改时间」不能早于「检查日期」");
    /* R4 接收人与接收日期成对（回复单接收人签字需成对留存） */
    if(d.receiver&&!d.recvDate) return bad("已填「接收人」，请补「接收日期」");
    if(d.recvDate&&!d.receiver) return bad("已填「接收日期」，请补「接收人」");
    /* R5 计数合法性 */
    if(d.issueCount!=null&&d.fixedCount!=null&&d.fixedCount>d.issueCount)
      return bad("「已整改数」不能大于「指出问题数」");
    /* R6 状态流转合法性：禁止跨级跳转（新增行不校验） */
    if(id){
      var old=(DB().inspections||[]).filter(function(r){return r.id===id;})[0];
      if(old&&old.fixStatus&&old.fixStatus!==d.fixStatus&&!INS.canGo(old.fixStatus,d.fixStatus))
        return bad("整改状态不能从「"+old.fixStatus+"」直接改为「"+d.fixStatus+
          "」，须按 待整改→整改中→已回复待复核→已闭环 逐级流转（复核不通过改为「复核退回」）");
    }
    /* R7 已回复待复核 / 已闭环 必须有报告时间 */
    if((INS.isVerifying(d.fixStatus)||INS.isClosed(d.fixStatus))&&!d.reportDate)
      return bad("状态为「"+d.fixStatus+"」时必须填写「整改报告时间」（回复单报送日期）");
    /* R8 闭环前置条件：复核结论 + 复核日期 + 数量闭合 */
    if(INS.isClosed(d.fixStatus)){
      if(!d.verifyResult||d.verifyResult==="待复核")
        return bad("置为「已闭环」前须填写「复核结论」（整改验证结果）");
      if(d.verifyResult==="整改不到位")
        return bad("复核结论为「整改不到位」时不得闭环，请退回「整改中」重新整改");
      if(!d.reviewDate) return bad("置为「已闭环」前须填写「复核日期」");
      if((d.issueCount||0)>0&&(d.fixedCount||0)!==d.issueCount)
        return bad("置为「已闭环」时「已整改数」须等于「指出问题数」（"+d.issueCount+" 个）");
    }
    /* 软提示：逾期未闭环，不阻断保存 */
    if(INS.isOpen(d.fixStatus)&&d.deadline&&d.deadline<A.todayStr())
      toast("该单已超过限期整改时间，请督办","err");
    return true;
  },
  afterRender:function(host){
    $$("[data-print]",host).forEach(function(b){
      b.onclick=function(e){ e.stopPropagation(); if(window.printInspection) window.printInspection(this.getAttribute("data-print")); };
    });
    $$("[data-attach]",host).forEach(function(b){
      b.onclick=function(e){
        e.stopPropagation();
        if(window.InspAttach) window.InspAttach.open(this.getAttribute("data-attach"));
        else toast("附件模块未加载，请重新构建页面","err");
      };
    });
  }
});

A.regSchema("issues",{
  title:"检查问题",prefix:"w",key:"issues",
  formNote:"本模块仅收录已上传单据可核对的内容：3 张检查单 + 18 条问题，字段缺失标「未提供」，不作推断；"+
    "「源文件位置」指向该条在原文中的行号，可回原文逐条核对；"+
    "置为「已闭环」须已填整改措施、整改完成日期与整改佐证照片。",
  cols:[
    {k:"no",l:"问题编号",w:104,fmt:function(v,r){
      var sq=(r.seq&&!/^\d+$/.test(String(r.seq)))?r.seq:'';
      return '<b style="white-space:nowrap">'+esc(v)+'</b>'+(sq?'<div class="cell-sub">'+esc(sq)+'</div>':'');}},
    /* 新增列：该问题在源文件中的索引位置（表格行 / 正文行） */
    {k:"srcLoc",l:"源位置",w:80,fmt:function(v,r){return locTag(v,r);},
      print:function(v,r){return locText(v,r);}},
    {k:"desc",l:"质量问题描述",w:200,fmt:function(v,r){
      /* 罗田单原文只记整改记录、未写问题，描述留空 → 显示「未提供」，
         下方小字照录原文整改记录，既标明缺失又不丢信息 */
      if(!v){
        var sub=r.measure?"原文整改记录："+r.measure:(r.note||"");
        return '<div class="cell-main" style="color:#b6c0cc">未提供</div>'+
          (sub?'<div class="cell-sub">'+esc(trunc(sub,28))+'</div>':'');
      }
      return '<div class="cell-main" style="font-weight:500">'+esc(trunc(v,40))+'</div>'+
        (r.measure?'<div class="cell-sub">'+esc(trunc(r.measure,26))+'</div>':'');
    }},
    {k:"cat",l:"归类",w:86,fmt:function(v){return v?tag(v,"t-gray"):naTxt();}},
    {k:"level",l:"严重程度",w:70,fmt:function(v){return v?tag(v,v==="严重"?"t-red":v==="较重"?"t-amber":"t-gray"):naTxt();}},
    {k:"deadline",l:"整改期限",w:92,fmt:function(v){return v?'<span style="white-space:nowrap">'+esc(v)+'</span>':naTxt();}},
    {k:"finishDate",l:"整改完成时间",w:104,fmt:function(v){return v?'<span style="white-space:nowrap">'+esc(v)+'</span>':naTxt();}},
    {k:"photo",l:"整改佐证",w:84,fmt:function(v){
      /* 单据里写的是「附整改照片 / 整改前后对比图片」，列窄，用简称 + title 保留原文 */
      if(!v||v==="未附") return naTxt();
      var short=v.indexOf("前后")>=0?"前后对比":"整改照片";
      return '<span title="'+esc(v)+'">'+tag(short,v.indexOf("前后")>=0?"t-green":"t-p2")+'</span>';}},
    {k:"status",l:"整改状态",w:100,fmt:function(v){return inspTag(v);}},
    {k:"owner",l:"责任人",w:74,fmt:function(v){return v?esc(v):naTxt();}}
  ],
  fields:[
    {k:"no",l:"问题编号",t:"text",req:true},
    {k:"srcLoc",l:"源文件位置",t:"text",ph:"T1·R5 = 第1张表格第5行；L12 = 正文第12行；留空表示手工录入"},
    {k:"seq",l:"问题序号",t:"text",ph:"问题一 / 1"},
    {k:"inspectionId",l:"所属检查",t:"select",opts:function(){return DB().inspections.map(function(i){return [i.id,i.no+"（"+i.date+"）"];});}},
    {k:"projectId",l:"所属项目",t:"select",opts:projOpts()},
    {k:"desc",l:"问题描述",t:"text",req:true,full:true,ph:"对应通知单「存在的问题」条目"},
    {k:"cat",l:"归类",t:"select",opts:["签认手续不全","资料记录缺失","方案与制度完善","信息化应用","实体质量","内业资料","方案编制","材料设备","安全管理"]},
    {k:"level",l:"严重程度",t:"select",opts:["一般","较重","严重"]},
    {k:"requirement",l:"整改内容及要求",t:"textarea",full:true,ph:"通知单下发时提出的整改要求"},
    {k:"measure",l:"整改措施",t:"textarea",full:true,ph:"回复单中已采取的整改措施"},
    {k:"deadline",l:"整改期限",t:"date"},
    {k:"finishDate",l:"整改完成日期",t:"date"},
    {k:"owner",l:"整改责任人",t:"text"},
    {k:"photo",l:"整改佐证照片",t:"select",opts:["未附","附整改照片","附整改前后对比照片"]},
    {k:"verifyResult",l:"复核结论",t:"select",opts:["待复核","已按要求整改","部分整改","整改不到位"]},
    {k:"status",l:"整改状态",t:"select",opts:INS.STATUS},
    {k:"note",l:"备注",t:"text",full:true}
  ],
  filters:[{k:"status",l:"整改状态",opts:INS.STATUS}],
  defaultNew:{cat:"实体质量",level:"一般",status:"待整改",photo:"未附",verifyResult:"待复核"},
  /* 校验：闭环必须「有措施、有完成日期、有佐证」，与回复单「整改验证」栏一致 */
  beforeSave:function(d,id){
    function bad(m){ toast(m,"err"); return false; }
    if(INS.isClosed(d.status)){
      if(!d.measure) return bad("置为「已闭环」前须填写「整改措施」（回复单中的整改情况）");
      if(!d.finishDate) return bad("置为「已闭环」前须填写「整改完成日期」");
      if(!d.photo||d.photo==="未附") return bad("置为「已闭环」前须上传或标注「整改佐证照片」（整改前后对比）");
      if(d.verifyResult==="整改不到位") return bad("复核结论为「整改不到位」时不得闭环");
    }
    if(id){
      var old=(DB().issues||[]).filter(function(r){return r.id===id;})[0];
      if(old&&old.status&&old.status!==d.status&&!INS.canGo(old.status,d.status))
        return bad("整改状态不能从「"+old.status+"」直接改为「"+d.status+"」，须逐级流转");
    }
    if(d.deadline&&d.finishDate&&d.finishDate<d.deadline&&INS.isOpen(d.status))
      toast("已在期限内完成，请将状态推进到「已回复待复核」","ok");
    return true;
  }
});

A.regPage("inspect",{
  sub:"整改通知单 → 整改回复单 → 复核验证 → 闭环，逐单留痕可追溯",
  render:function(host){
    var db=DB(), iss=db.issues, ins=db.inspections, tdy=A.todayStr();
    var closed=iss.filter(function(i){return INS.isClosed(i.status);}).length;
    var rate=iss.length?Math.round(closed/iss.length*1000)/10:0;
    var verify=iss.filter(function(i){return INS.isVerifying(i.status);}).length;
    var overdue=iss.filter(function(i){return INS.isOpen(i.status)&&i.deadline&&i.deadline<tdy;}).length;
    var insPending=ins.filter(function(i){return INS.isOpen(i.fixStatus);}).length;
    var insVer=ins.filter(function(i){return INS.isVerifying(i.fixStatus);}).length;

    /* 状态分布：按新状态机 5 态统计，旧数据三值可直接落位 */
    var dist=INS.STATUS.map(function(s){
      return {s:s,n:iss.filter(function(i){return i.status===s;}).length};
    });
    var distMax=Math.max.apply(null,dist.map(function(d){return d.n;}).concat([1]));

    host.innerHTML='<div class="grid g5" style="margin-bottom:14px">'+
      '<div class="card kpi"><div class="k">质量检查</div><div class="v">'+ins.length+'<small>次</small></div><div class="d">'+
        (function(){ var pj=ins.filter(function(i){return i.projectId;});
          return pj.length?('覆盖 '+new Set(pj.map(function(i){return i.projectId;})).size+' 个项目'):'单据未写明项目';
        })()+' · 未闭环 '+insPending+' 单</div></div>'+
      '<div class="card kpi"><div class="k">指出问题</div><div class="v">'+iss.length+'<small>个</small></div><div class="d">严重 '+iss.filter(function(i){return i.level==="严重";}).length+' · 较重 '+iss.filter(function(i){return i.level==="较重";}).length+'</div></div>'+
      '<div class="card kpi"><div class="k">整改闭环率</div><div class="v" style="color:'+(rate>=90?"#1f8b4c":"#b9770e")+'">'+rate+'<small>%</small></div><div class="d">已闭环 '+closed+' / '+iss.length+'</div></div>'+
      '<div class="card kpi"><div class="k">待复核</div><div class="v" style="color:'+(verify?"#1a6fa8":"#1f8b4c")+'">'+verify+'<small>个</small></div><div class="d">已回复待复核 · 单据 '+insVer+' 份</div></div>'+
      '<div class="card kpi"><div class="k">超期未整改</div><div class="v" style="color:'+(overdue?"#c0392b":"#1f8b4c")+'">'+overdue+'<small>个</small></div><div class="d">已过限期整改时间</div></div>'+
    '</div>'+

    /* 状态流转条：一眼看出卡在哪个环节 */
    '<div class="card" style="margin-bottom:14px"><div class="card-h"><h3>整改状态流转</h3>'+
      '<span class="hint">待整改 → 整改中 → 已回复待复核 → 已闭环；复核不通过退回「整改中」</span></div>'+
      '<div class="card-b"><div style="display:flex;gap:10px;flex-wrap:wrap">'+
      dist.map(function(d){
        var c=d.s==="已闭环"?"#1f8b4c":d.s==="复核退回"?"#c0392b":d.s==="已回复待复核"?"#1a6fa8":"#b9770e";
        return '<div style="flex:1;min-width:120px;background:var(--panel-2);border-radius:7px;padding:9px 11px">'+
          '<div style="display:flex;align-items:center;gap:6px;font-size:12px">'+inspTag(d.s)+
          '<span style="margin-left:auto;font-weight:700;font-size:15px">'+d.n+'</span></div>'+
          '<div class="bar" style="height:5px;margin-top:7px"><i style="width:'+Math.round(d.n/distMax*100)+'%;background:'+c+'"></i></div>'+
        '</div>';
      }).join("")+
      '</div></div></div>'+

    '<div class="card" style="margin-bottom:14px"><div class="card-h"><h3>质量检查单（通知单 / 记录表）</h3>'+
      '<span class="hint">打印可还原《质量检查记录及整改回复单》；点编号下「附件」或右侧按钮上传/下载两类附件</span>'+
      '<div class="spacer"></div><button class="btn sm" data-attach-all="1">附件管理</button></div>'+
      '<div class="card-b" id="tbIns" style="padding:14px 16px 6px"></div></div>'+
    '<div class="card"><div class="card-h"><h3>检查问题与整改回复</h3><span class="hint">逐条登记，闭环后计入整改率</span></div>'+
      '<div class="card-b" id="tbIss" style="padding:14px 16px 6px"></div></div>'+
    '<div id="mfHost"></div>';
    A.renderTable("inspections",$("#tbIns",host));
    A.renderTable("issues",$("#tbIss",host));
    var ba=$("[data-attach-all]",host);
    if(ba) ba.onclick=function(){
      if(window.InspAttach&&window.InspAttach.openAll) window.InspAttach.openAll();
      else toast("附件模块未加载，请重新构建页面","err");
    };
    if(window.moduleFilesCard) window.moduleFilesCard("inspect",$("#mfHost",host));
  }
});

/* ---------- 11. 技术交底及风险识别 ---------- */
A.regSchema("briefings",{
  title:"技术交底",prefix:"b",key:"briefings",sortBy:"date",
  cols:[
    {k:"title",l:"交底主题",w:240,fmt:function(v,r){return '<div class="cell-main">'+esc(trunc(v,38))+'</div><div class="cell-sub">'+esc(trunc(projName(r.projectId),26))+'</div>';}},
    {k:"level",l:"交底类别",w:95,fmt:function(v){return tag(v,v==="公司级"?"t-red":v==="项目级"?"t-p2":"t-gray");}},
    {k:"date",l:"交底日期",w:100},
    {k:"briefer",l:"交底人",w:85},
    {k:"auditor",l:"审核人",w:85},
    {k:"people",l:"接受人数",w:85,num:true},
    {k:"status",l:"状态",w:90,fmt:function(v){return tag(v,v==="已归档"?"t-green":v==="待交底"?"t-amber":"t-p2");}}
  ],
  fields:[
    {k:"title",l:"交底主题",t:"text",req:true,full:true},
    {k:"projectId",l:"所属项目",t:"select",opts:projOpts()},
    {k:"level",l:"交底类别",t:"select",opts:["公司级","项目级","班组级"]},
    {k:"date",l:"交底日期",t:"date"},
    {k:"briefer",l:"交底人",t:"text"},
    {k:"auditor",l:"审核人",t:"text"},
    {k:"people",l:"接受交底人数",t:"number"},
    {k:"status",l:"状态",t:"select",opts:["待交底","已交底","已归档"]},
    {k:"points",l:"交底要点",t:"textarea",full:true},
    {k:"note",l:"备注",t:"text",full:true}
  ],
  defaultNew:{level:"公司级",status:"待交底",people:0}
});

A.regSchema("risks",{
  title:"风险识别",prefix:"k",key:"risks",sortBy:"date",
  cols:[
    {k:"title",l:"风险名称",w:220,fmt:function(v,r){return '<div class="cell-main">'+esc(trunc(v,32))+'</div><div class="cell-sub">'+esc(trunc(projName(r.projectId),26))+'</div>';}},
    {k:"cat",l:"风险类别",w:105,fmt:function(v){return tag(v,"t-gray");}},
    {k:"level",l:"风险等级",w:90,fmt:function(v){return tag(v,v==="高"?"t-red":v==="中"?"t-amber":"t-green");}},
    {k:"owner",l:"责任人",w:85},
    {k:"status",l:"当前状态",w:95,fmt:function(v){return tag(v,v==="已受控"?"t-green":v==="监控中"?"t-amber":"t-red");}},
    {k:"measure",l:"控制措施",w:300,fmt:function(v){return '<span style="font-size:12px">'+esc(trunc(v,52))+'</span>';}}
  ],
  fields:[
    {k:"title",l:"风险名称",t:"text",req:true,full:true},
    {k:"projectId",l:"所属项目",t:"select",opts:projOpts()},
    {k:"cat",l:"风险类别",t:"select",opts:["结构安全","施工工艺","地质条件","材料质量","环境因素","管理因素"]},
    {k:"level",l:"风险等级",t:"select",opts:["高","中","低"]},
    {k:"date",l:"识别时间",t:"date"},
    {k:"owner",l:"责任人",t:"text"},
    {k:"status",l:"当前状态",t:"select",opts:["未受控","监控中","已受控"]},
    {k:"measure",l:"控制措施",t:"textarea",full:true},
    {k:"note",l:"备注",t:"text",full:true}
  ],
  defaultNew:{cat:"施工工艺",level:"中",status:"监控中"}
});

A.regPage("brief",{
  sub:"三级技术交底记录与项目质量风险识别台账",
  render:function(host){
    var db=DB();
    var high=db.risks.filter(function(k){return k.level==="高";}).length;
    var uncontrolled=db.risks.filter(function(k){return k.status==="未受控";}).length;
    host.innerHTML='<div class="grid g4" style="margin-bottom:14px">'+
      '<div class="card kpi"><div class="k">技术交底</div><div class="v">'+db.briefings.length+'<small>次</small></div><div class="d">公司级 '+db.briefings.filter(function(b){return b.level==="公司级";}).length+' 次</div></div>'+
      '<div class="card kpi"><div class="k">待交底</div><div class="v" style="color:'+(db.briefings.filter(function(b){return b.status==="待交底";}).length?"#c0392b":"#1f8b4c")+'">'+db.briefings.filter(function(b){return b.status==="待交底";}).length+'<small>项</small></div><div class="d">西塞山项目已逾期</div></div>'+
      '<div class="card kpi"><div class="k">高风险项</div><div class="v" style="color:'+(high?"#c0392b":"#1f8b4c")+'">'+high+'<small>项</small></div><div class="d">共 '+db.risks.length+' 项风险</div></div>'+
      '<div class="card kpi"><div class="k">未受控</div><div class="v" style="color:'+(uncontrolled?"#c0392b":"#1f8b4c")+'">'+uncontrolled+'<small>项</small></div><div class="d">需立即落实措施</div></div>'+
    '</div>'+
    '<div class="card" style="margin-bottom:14px"><div class="card-h"><h3>技术交底记录</h3><div class="spacer"></div>'+
      '<div class="tabs"><button class="tab active" data-bt="briefings">技术交底</button><button class="tab" data-bt="risks">风险识别</button></div></div>'+
      '<div class="card-b" id="tbBrief" style="padding:14px 16px 6px"></div></div>'+
    '<div id="mfHost"></div>';
    A.renderTable("briefings",$("#tbBrief",host));
    if(window.moduleFilesCard) window.moduleFilesCard("brief",$("#mfHost",host));
    $$("[data-bt]",host).forEach(function(b){
      b.onclick=function(){
        $$("[data-bt]",host).forEach(function(x){x.classList.remove("active");});
        this.classList.add("active");
        A.renderTable(this.getAttribute("data-bt"),$("#tbBrief",host));
      };
    });
  }
});
})();
