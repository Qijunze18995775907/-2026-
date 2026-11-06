/* ===== 同步引擎（v1.9）：文件 → 解析 → 差异 → 落库 → 回退 → 对账 =====
   设计要点：
   1) 文件身份与路径解耦：files.id 是主键，rel 只是当前路径，改名只改 rel；
   2) 单向真相源：解析结果 → 台账行，台账行带 srcFileId/srcKey，手工行永不被自动删改；
   3) 批次事务：一个文件一个 batch，整批成功或整批回滚，可单批撤销；
   4) 分级确认：结构固定的表（统计/项目/机构/指导书/制度）自动落库，其余进差异预览；
   5) 全部异步串行，绝不阻塞扫描，也不整页重绘。 */
(function(){
"use strict";
var A=window.APP, $=A.$, $$=A.$$, esc=A.esc;
function DB(){return A.db;}
function P(){return window.Parse;}

var MAX_BYTES=12*1024*1024;
var AUTO_ROUTES={"stats":1,"projects":1,"orgs":1,"guides":1,"policies":1,"inspect":1};
var ROUTES=["stats","projects","orgs","guides","policies","meetings","trainings","qcs","reviews","brief","inspect"];

/* ---------------- 文件名规则识别（图片 / 扫描件 / 无文本层文件的兜底） ---------------- */
var NAME_RULES=[
  {route:"stats",    re:/(质量活动统计|活动统计|质量月报|统计表)/},
  {route:"inspect",  re:/(检查|巡检|整改|回复|通知单)/},
  {route:"issues",   re:/(问题|隐患|缺陷|通病)/},
  {route:"trainings",re:/(培训|教育|学习|签到)/},
  {route:"meetings", re:/(会议|纪要)/},
  {route:"policies", re:/(制度|办法|规定|细则|程序)/},
  {route:"guides",   re:/(指导书|作业指导|规程|方案|交底|工艺)/},
  {route:"projects", re:/(项目|业务清单|台账)/},
  {route:"orgs",     re:/(机构|组织|人员|分工|职责)/}
];
var ROUTE_LABEL={stats:"质量活动统计",inspect:"质量检查整改回复",issues:"问题清单",
  policies:"制度文件",guides:"作业指导书",projects:"在建项目业务清单",
  orgs:"组织机构与职责",meetings:"会议记录",trainings:"教育培训"};
/* 从文件名猜模块与期间：2026.3 / 2026年3月 / 2026-03-05 / 202603 */
function guessMonth(name){
  var s=String(name||"");
  var m=/(20\d{2})\s*[年.\-_\/]\s*(\d{1,2})(?!\d)/.exec(s);
  if(!m){
    m=/(20\d{2})(0[1-9]|1[0-2])(?:\d{2})?/.exec(s);
    if(m) return m[1]+"-"+m[2];
    return "";
  }
  var mo=+m[2];
  if(mo<1||mo>12) return "";
  return m[1]+"-"+pad(mo);
}
function filenameHint(rec){
  var name=rec&&rec.name;
  if(!name) return null;
  var route="", i;
  /* 所在目录若已绑定模块，以目录为准 */
  if(rec.route&&ROUTE_LABEL[rec.route]) route=rec.route;
  if(!route){
    /* 取命中关键词最长的那条规则，等长时靠前优先（如「培训签到」归培训而非会议） */
    var bestLen=0;
    for(i=0;i<NAME_RULES.length;i++){
      var mm=NAME_RULES[i].re.exec(name);
      if(!mm) continue;
      if(mm[0].length>bestLen){ bestLen=mm[0].length; route=NAME_RULES[i].route; }
    }
  }
  var mon=guessMonth(name);
  if(!route&&!mon) return null;
  var label=(route?ROUTE_LABEL[route]:rec.module||"未定模块")+(mon?(" · "+mon.replace("-"," 年 ")+" 月"):"");
  return {route:route,month:mon,label:label};
}
/* 同名相邻文件配对：图片/扫描件所在目录里，找主名相近且有文本层的文件 */
function pairOf(rec){
  if(!rec||!rec.name) return null;
  var files=DB().files||[];
  var base=String(rec.name).replace(/\.[^.]+$/,"").replace(/[\s\-_（）()]/g,"");
  var dir=String(rec.rel||rec.path||"").replace(/[^\/\\]*$/,"");
  var best=null,score=0;
  files.forEach(function(f){
    if(!f||f.id===rec.id) return;
    var p=f.parse||{};
    if(p.state!=="ok"&&p.state!=="preview") return;
    var fdir=String(f.rel||f.path||"").replace(/[^\/\\]*$/,"");
    if(dir&&fdir!==dir) return;
    var fb=String(f.name||"").replace(/\.[^.]+$/,"").replace(/[\s\-_（）()]/g,"");
    if(!fb) return;
    var s=0;
    if(fb===base) s=3;
    else if(fb.indexOf(base)>=0||base.indexOf(fb)>=0) s=2;
    else{
      /* 期间相同也算弱配对（2026.3会议记录 ↔ 2026年3月统计） */
      var m1=guessMonth(rec.name), m2=guessMonth(f.name);
      if(m1&&m1===m2) s=1;
    }
    if(s>score){ score=s; best=f; }
  });
  return score>=1?best:null;
}

var Q=[], BUSY=false, LASTMSG="";
var PEND={};   /* fileId -> {route, items, conf, note} 待人工采纳的解析结果 */

/* ---------------- 基础工具 ---------------- */
function pad(n){ n=+n; return n<10?"0"+n:""+n; }
function nowStr(){
  var d=new Date();
  return d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate())+" "+pad(d.getHours())+":"+pad(d.getMinutes());
}
function txt(v){ return String(v===null||v===undefined?"":v).replace(/\s+/g," ").trim(); }
function num(v){
  if(v===null||v===undefined||v==="") return null;
  if(typeof v==="number") return isFinite(v)?v:null;
  var s=String(v).replace(/[,，\s]/g,"").replace(/[^\d.\-]/g,"");
  if(!s||s==="-"||s===".") return null;
  var n=parseFloat(s);
  return isNaN(n)?null:n;
}
function intOf(v){ var n=num(v); return n===null?null:Math.round(n); }
function dateOf(v){
  if(typeof v==="number"){ var d=P()&&P().xlDate?P().xlDate(v):""; return d||""; }
  var s=txt(v);
  if(!s) return "";
  var m=/(\d{4})\s*[年.\-\/]\s*(\d{1,2})\s*[月.\-\/]\s*(\d{1,2})/.exec(s);
  if(m) return m[1]+"-"+pad(m[2])+"-"+pad(m[3]);
  m=/^(\d{4})(\d{2})(\d{2})$/.exec(s);
  if(m) return m[1]+"-"+m[2]+"-"+m[3];
  m=/(\d{4})\s*[年.\-\/]\s*(\d{1,2})\s*月?/.exec(s);
  if(m) return m[1]+"-"+pad(m[2])+"-01";
  return "";
}
function monthKey(v){
  if(typeof v==="number"){ var d=P()&&P().xlDate?P().xlDate(v):""; return d?d.slice(0,7):""; }
  var s=txt(v);
  if(!s) return "";
  var m=/(\d{4})\s*[年.\-\/]\s*(\d{1,2})/.exec(s);
  if(m) return m[1]+"-"+pad(m[2]);
  m=/^(\d{4})(\d{2})/.exec(s);
  if(m) return m[1]+"-"+m[2];
  return "";
}
function monthLabel(k){
  var m=/^(\d{4})-(\d{2})$/.exec(k||"");
  return m?(+m[1])+" 年 "+(+m[2])+" 月":"";
}
function hdr(v){ return txt(v).replace(/[\s\n\r]/g,""); }
function normName(s){
  return txt(s).replace(/[（()）【】\[\]〔〕<>《》\s、，,。.;；:：\-—_]/g,"")
    .replace(/^[\d一二三四五六七八九十]+[、.]/,"");
}

/* ---------------- 字段别名表 ---------------- */
var ALIAS={
  stats:{
    date:["日期","统计日期"],doneProj:["完成项目数"],acceptProj:["项目验收数"],rateProj:["评级项目数"],
    training:["质量培训数量","培训数量","培训场次"],trainPeople:["质量培训人次","培训人次"],
    qc:["QC活动数","QC活动"],review:["内审报告数","内审报告"],check:["质量检查数量","质量检查次数","检查次数"],
    issues:["指出问题数","问题数"],rate:["问题整改率","整改率"],other:["其他质量活动数"],otherPeople:["其他活动参与人数"]
  },
  projects:{
    no:["序号"],name:["项目/业务名称","项目名称","项目业务名称"],major:["主要内容"],
    dcontrol:["队（院）控项目","队院控项目"],fund:["资金来源"],amount:["合同额"],
    place:["项目地点"],status:["项目状态"],span:["起止时间"],dept:["承担部门"],
    owner:["联系人"],phone:["联系电话"],checkInfo:["质量检查情况"],fixInfo:["问题整改情况"],
    progDesc:["项目进度情况"],end:["预计完工时间"],reviewed:["是否审查"],note:["备注"],kind:["延续/新建"]
  },
  meetings:{
    title:["会议主题","会议名称","主题"],date:["会议日期","日期","时间"],form:["会议形式","形式"],
    level:["会议级别","级别"],place:["地点","会议地点"],host:["主持人","主持"],
    people:["参会人次","参会人数","参与人次","人数"],content:["主要内容","内容"],decision:["决议事项","决议"]
  },
  trainings:{
    title:["培训主题","培训名称","主题","课程"],date:["培训日期","日期","时间"],form:["培训形式","形式"],
    teacher:["讲师","授课人","主讲人"],hours:["学时","课时"],people:["参训人次","参训人数","人数"],
    cover:["覆盖项目","覆盖范围"],assess:["考核方式","考核"]
  },
  qcs:{
    title:["课题名称","课题"],group:["小组名称","小组"],type:["课题类型","类型"],leader:["组长"],
    members:["组员","成员"],regDate:["注册时间","注册日期"],stage:["活动阶段","阶段"],
    target:["目标值","目标"],rate:["完成率"],status:["状态"]
  },
  reviews:{
    title:["方案名称","资料名称","方案","名称"],projectId:["受审项目","项目名称","所属项目"],
    type:["方案类型","类型"],level:["内审级别","级别"],date:["内审时间","内审日期","日期","时间"],
    reviewer:["内审人"],count:["审查意见数","意见数"],conclusion:["结论"],closure:["修改闭环","闭环"]
  },
  briefings:{
    title:["交底主题","交底名称","主题"],projectId:["所属项目","项目名称"],
    level:["交底类别","级别","类别"],date:["交底日期","日期"],briefer:["交底人"],
    auditor:["审核人"],people:["接受交底人数","人数"],points:["交底要点","要点"]
  },
  risks:{
    title:["风险名称","风险点","风险"],cat:["风险类别","类别"],level:["风险等级","等级"],
    owner:["责任人"],status:["当前状态","状态"],measure:["控制措施","措施"]
  },
  inspections:{
    /* 顺序即优先级：越具体越靠前，避免「接收日期」被 date 抢走 */
    no:["检查编号","编号"],kind:["单据类型","检查形式"],toOrg:["致送对象","致送"],
    date:["检查日期","检查时间"],projectId:["受检项目","项目名称"],fixUnit:["整改单位"],
    checker:["检查人"],receiver:["接收人"],recvDate:["接收日期"],sendDate:["下发日期"],
    deadline:["限期整改时间","整改期限"],reportDate:["整改报告时间","报告时间"],
    verifyResult:["复核结论","整改验证"],reviewer:["复核人","验收人"],reviewDate:["复核日期"],
    conclusion:["结论"],issueCount:["指出问题数","问题数"],
    fixedCount:["已整改数","已整改"],fixStatus:["整改状态"]
  },
  issues:{
    no:["问题编号","编号"],seq:["问题序号","序号"],desc:["问题描述","问题"],cat:["问题类别","类别"],
    level:["严重程度","程度"],requirement:["整改内容及要求","整改要求","要求"],
    measure:["整改措施","整改情况","措施"],deadline:["整改期限","期限"],
    finishDate:["整改完成日期","完成日期"],photo:["整改佐证","整改照片","佐证"],
    verifyResult:["复核结论"],status:["整改状态","状态"],owner:["整改责任人","责任人"]
  },
  orgs:{
    name:["姓名","名字"],post:["职务","职位"],org:["所属机构","机构","部门"],
    duty:["分工职责","职责","分工"],phone:["联系电话","电话"],since:["任职时间"]
  },
  guides:{
    title:["名称","文件名","指导书名称"],major:["适用专业","专业"],version:["版本"],
    editor:["编制人"],date:["发布日期","日期"],status:["状态"]
  },
  policies:{
    title:["文件名称","名称","制度名称"],docNo:["文号","编号"],issuer:["发布单位","单位"],
    pubDate:["发布日期","日期"],implDate:["实施日期"],scope:["适用范围","范围"],status:["状态"]
  },
  trainingsFromStats:{ title:["主题","培训主题"],date:["时间","日期"],form:["会议/培训形式","形式"],level:["类别"],place:["地点"],content:["主要内容"],people:["参与人次"] }
};

/* 字段中文名（用于预览与冲突提示） */
var FLABEL={
  stats:{month:"统计月份",cutoff:"截止日",doneProj:"完成项目数",acceptProj:"验收数",training:"培训场次",
    trainPeople:"培训人次",qc:"QC活动",review:"内审报告",check:"质量检查",issues:"问题数",fixed:"整改完成",other:"其他活动",note:"备注"},
  projects:{name:"项目名称",type:"项目类型",major:"主要内容",fund:"资金来源",dcontrol:"队控",amount:"合同额",
    place:"项目地点",status:"项目状态",start:"开工",end:"预计完工",owner:"负责人",phone:"电话",
    progress:"形象进度",progDesc:"进度情况",kind:"延续/新建",checkInfo:"检查情况",fixInfo:"整改情况",note:"备注"},
  meetings:{title:"会议主题",date:"日期",form:"形式",level:"级别",place:"地点",host:"主持人",people:"参会人次",content:"主要内容",decision:"决议"},
  trainings:{title:"培训主题",date:"日期",form:"形式",teacher:"讲师",hours:"学时",people:"参训人次",cover:"覆盖项目",assess:"考核"},
  qcs:{title:"课题名称",group:"小组",type:"类型",leader:"组长",members:"组员",regDate:"注册",stage:"阶段",target:"目标值",rate:"完成率",status:"状态"},
  reviews:{title:"方案名称",projectId:"受审项目",type:"类型",level:"级别",date:"内审时间",reviewer:"内审人",count:"意见数",conclusion:"结论",closure:"闭环"},
  briefings:{title:"交底主题",projectId:"项目",level:"类别",date:"日期",briefer:"交底人",auditor:"审核人",people:"人数",points:"要点",status:"状态"},
  risks:{title:"风险名称",projectId:"项目",cat:"类别",level:"等级",date:"识别时间",owner:"责任人",status:"状态",measure:"措施"},
  inspections:{no:"检查编号",kind:"单据类型",toOrg:"致送对象",date:"检查日期",projectId:"受检项目",
    fixUnit:"整改单位",checker:"检查人",receiver:"接收人",recvDate:"接收日期",sendDate:"下发日期",
    deadline:"限期整改时间",reportDate:"整改报告时间",verifyResult:"复核结论",reviewer:"复核人",
    reviewDate:"复核日期",conclusion:"结论",issueCount:"问题数",fixedCount:"已整改",fixStatus:"整改状态",content:"检查内容"},
  issues:{no:"问题编号",seq:"问题序号",projectId:"项目",desc:"问题描述",cat:"类别",level:"程度",
    requirement:"整改内容及要求",measure:"整改措施",deadline:"期限",finishDate:"整改完成日期",
    photo:"整改佐证",verifyResult:"复核结论",status:"状态",owner:"整改责任人"},
  orgs:{name:"姓名",post:"职务",org:"机构",duty:"职责",phone:"电话",since:"任职"},
  guides:{title:"名称",major:"专业",version:"版本",editor:"编制人",date:"发布日期",status:"状态"},
  policies:{title:"文件名称",docNo:"文号",issuer:"发布单位",pubDate:"发布日期",implDate:"实施日期",scope:"范围",status:"状态"}
};
var ARR={stats:"stats",projects:"projects",meetings:"meetings",trainings:"trainings",qcs:"qcs",
  reviews:"reviews",briefings:"briefings",risks:"risks",inspections:"inspections",issues:"issues",
  orgs:"orgs",guides:"guides",policies:"policies"};
var PREFIX={stats:"s",projects:"p",meetings:"m",trainings:"tr",qcs:"q",reviews:"r",briefings:"b",
  risks:"k",inspections:"i",issues:"w",orgs:"o",guides:"g",policies:"y"};

/* ---------------- 路由 → 适配器 ---------------- */
function routesOf(rec){
  var rt=rec.route||"";
  if(rt==="folder"||!rt){
    var m=rec.module||"";
    rt={"质量活动统计":"stats","在建项目":"projects","质量会议":"meetings","质量培训":"trainings",
        "QC 活动":"qcs","方案内审":"reviews","技术交底":"brief","风险识别":"brief",
        "质量检查":"inspect","质量管理机构":"orgs","作业指导书":"guides","办法制度":"policies"}[m]||"";
  }
  if(rt==="qc") return ["qcs"];
  if(rt==="review") return ["reviews"];
  if(rt==="brief") return ["briefings","risks"];
  if(rt==="inspect") return ["inspections","issues"];
  if(rt==="org") return ["orgs"];
  if(rt==="guide") return ["guides"];
  if(rt==="policy") return ["policies"];
  if(rt==="plan") return [];
  if(rt==="stats") return ["stats"];
  if(rt==="projects") return ["projects"];
  if(rt==="meeting") return ["meetings"];
  if(rt==="training") return ["trainings"];
  return ROUTES.indexOf(rt)>=0?[rt]:[];
}

/* ---------------- 表头识别 ---------------- */
function tables(parsed){
  var out=[];
  if(parsed.sheets) parsed.sheets.forEach(function(s){
    if(s&&s.rows&&s.rows.length) out.push({name:s.name||"",rows:s.rows});
  });
  if(parsed.blocks){
    var n=0;
    parsed.blocks.forEach(function(b){ if(b.t==="tbl"){ n++; out.push({name:"表格"+n,rows:b.rows}); } });
  }
  return out;
}
function pickTable(rows,alias){
  var best=null, i, c, f, r, h, map, hit;
  for(i=0;i<Math.min(rows.length,22);i++){
    r=rows[i]||[]; map={}; hit=0;
    for(c=0;c<r.length;c++){
      h=hdr(r[c]); if(!h) continue;
      for(f in alias){
        if(map[f]!==undefined) continue;
        if(alias[f].some(function(a){ return h.indexOf(hdr(a))>=0; })){ map[f]=c; hit++; break; }
      }
    }
    if(hit>=3&&(!best||hit>best.hit)) best={headerAt:i,map:map,hit:hit};
  }
  return best;
}
function isEmptyRow(r){
  for(var i=0;i<r.length;i++){ var v=r[i]; if(v!==null&&v!==undefined&&txt(v)!=="") return false; }
  return true;
}
function isTotalRow(r){ return txt(r&&r[0]).replace(/\s/g,"").indexOf("合计")>=0; }

/* 按别名表抽取行 */
function rowsByAlias(tb,alias,keyField){
  var pick=pickTable(tb.rows,alias);
  if(!pick) return {rows:[],pick:null};
  var out=[];
  for(var i=pick.headerAt+1;i<tb.rows.length;i++){
    var r=tb.rows[i]||[];
    if(isEmptyRow(r)||isTotalRow(r)) continue;
    var o={}, any=false;
    for(var f in pick.map){
      var v=r[pick.map[f]];
      if(v===undefined) continue;
      o[f]=v;
      if(txt(v)!=="") any=true;
    }
    if(any) out.push({raw:r,data:o,rowNo:i+1});
  }
  return {rows:out,pick:pick};
}

/* 文本型（PDF/docx 段落）标签抽取 */
function textFields(text,rules){
  var o={}, hit=0;
  Object.keys(rules).forEach(function(k){
    var al=rules[k];
    for(var i=0;i<al.length;i++){
      var re=new RegExp(al[i]+"\\s*[:：]\\s*([^\\n\\r]{1,80})");
      var m=re.exec(text);
      if(m){ o[k]=m[1].trim(); hit++; break; }
    }
  });
  return {data:o,hit:hit};
}
/* 无冒号连排的正文（Word 表格转文本、老 .doc 会议记录常见）：
   用已知标签做锚点，值取到下一个锚点为止 */
function anchorFields(text,labelMap){
  var hits=[], i;
  for(i=0;i<labelMap.length;i++){
    var it=labelMap[i];
    var label=it.label!==undefined?it.label:it[0];     /* 兼容 [标签,字段] 数组写法 */
    var field=it.field!==undefined?it.field:it[1];
    if(!label) continue;
    var idx=text.indexOf(label), guard=0;
    while(idx>=0&&guard++<3){
      hits.push({at:idx,end:idx+label.length,field:field,label:label});
      idx=text.indexOf(label,idx+label.length);
    }
  }
  hits.sort(function(a,b){ return a.at-b.at; });
  var o={}, hit=0, used={};
  for(i=0;i<hits.length;i++){
    var h=hits[i];
    if(used[h.field]) continue;
    var nx=hits[i+1];
    var stop=nx?Math.min(nx.at,h.end+140):h.end+140;
    var v=text.slice(h.end,stop)
      .replace(/^[\s:：、，,。]+/,"")
      .replace(/\s+/g," ")
      .trim();
    if(!v||v.length<1) continue;
    o[h.field]=v;
    used[h.field]=1; hit++;
  }
  return {data:o,hit:hit};
}
/* 从任意字符串里取第一个可信日期 */
function pickDate(s){
  var t=txt(s);
  if(!t) return "";
  var m=/(20\d{2})\s*[年.\-\/]\s*(\d{1,2})\s*[月.\-\/]\s*(\d{1,2})/.exec(t);
  if(m) return m[1]+"-"+pad(m[2])+"-"+pad(m[3]);
  m=/(20\d{2})\s*[年.\-\/]\s*(\d{1,2})\s*月?/.exec(t);
  if(m) return m[1]+"-"+pad(m[2])+"-01";
  return "";
}
/* 人名串 → 人数（"共 12 人"直接取数，否则按分隔符数人头） */
function headCount(s){
  var t=txt(s);
  if(!t) return null;
  var m=/(\d{1,3})\s*[名位]?\s*人/.exec(t);
  if(m) return +m[1];
  var parts=t.split(/[、，,;；\/\s]+/).filter(function(x){ return x.length>=2&&x.length<=12; });
  return parts.length?parts.length:null;
}
/* 正文型模块的中文标签表：这些模块没有固定表格，靠正文锚点抽要素 */
var DOC_LABELS={
  meetings:[["会议主题","title"],["会议名称","title"],["会议时间","date"],["会议日期","date"],
    ["会议地点","place"],["会议形式","form"],["主持人","host"],["参会人员","peopleRaw"],
    ["参加人员","peopleRaw"],["记录人","recorder"],["会议内容","content"],["会议议题","content"],
    ["决议事项","decision"]],
  trainings:[["培训主题","title"],["培训名称","title"],["培训时间","date"],["培训日期","date"],
    ["培训地点","place"],["主讲人","teacher"],["讲师","teacher"],["参加人员","peopleRaw"],
    ["参训人员","peopleRaw"],["培训形式","form"],["学时","hours"],["培训内容","content"],
    ["考核方式","assess"]],
  reviews:[["方案名称","title"],["资料名称","title"],["项目名称","project"],["内审时间","date"],
    ["内审日期","date"],["内审人","reviewer"],["审查意见","count"],["审查结论","conclusion"],
    ["结论","conclusion"],["修改闭环","closure"]],
  policies:[["文件名称","title"],["文件标题","title"],["文号","docNo"],["发文字号","docNo"],
    ["发布单位","issuer"],["发布日期","pubDate"],["实施日期","implDate"],["适用范围","scope"]],
  guides:[["作业指导书名称","title"],["文件名称","title"],["适用专业","major"],["版本","version"],
    ["编制人","editor"],["发布日期","date"]]
};
/* 正文值按模块字段做清洗（日期归一、人数、形式判定） */
function cleanDocData(route,d,text){
  var o={}, k;
  for(k in d){
    if(!Object.prototype.hasOwnProperty.call(d,k)) continue;
    var v=d[k];
    if(v===undefined||v===null||v==="") continue;
    if(k==="date"||k==="pubDate"||k==="implDate"){
      var dd=pickDate(v)||pickDate(text);
      if(dd) o[k]=dd;
      continue;
    }
    if(k==="peopleRaw"){ var n=headCount(v); if(n) o.people=n; continue; }
    if(k==="hours"||k==="count"){
      var nn=num(v); if(nn!==null) o[k]=nn; continue;
    }
    if(k==="form"){
      var s=txt(v);
      if(/线上/.test(s)&&/线下|现场/.test(s)) o.form="线上+线下";
      else if(/线上|视频|腾讯会议|钉钉/.test(s)) o.form=route==="meetings"?"线上":"线上";
      else if(/线下|现场|会议|集中/.test(s)) o.form=route==="meetings"?"线下":"集中授课";
      continue;
    }
    if(k==="content"||k==="decision"||k==="scope"||k==="conclusion"){
      var b=txt(v);
      if(b.length>300) b=b.slice(0,300)+"…";
      if(b) o[k]=b;
      continue;
    }
    var t2=txt(v);
    if(t2) o[k]=(t2.length>60?t2.slice(0,60)+"…":t2);
  }
  return o;
}

/* ---------------- 各适配器：把解析结果变成 {arr,key,data} ---------------- */
function adaptStats(parsed,W){
  var tb=tables(parsed).filter(function(t){ return pickTable(t.rows,ALIAS.stats); })[0];
  if(!tb) return null;
  var pick=pickTable(tb.rows,ALIAS.stats);
  var out=[], today=A.todayStr().slice(0,7);
  for(var i=pick.headerAt+1;i<tb.rows.length;i++){
    var r=tb.rows[i]||[];
    if(isEmptyRow(r)) continue;
    var dv=r[pick.map.date];
    var mk=monthKey(dv);
    if(!mk) continue;
    if(mk>today) continue;                       /* 未来月份不导入 */
    var d={month:monthLabel(mk),cutoff:dateOf(dv)};
    for(var f in pick.map){
      if(f==="date"||f==="rate") continue;
      var v=r[pick.map[f]];
      if(v===undefined||txt(v)==="") continue;
      d[f]=num(v);
    }
    var rate=num(r[pick.map.rate]);
    if(d.issues!==undefined||d.issues!==null){
      var iss=d.issues||0;
      if(rate!==null&&rate!==undefined){
        if(rate<=1.0001) d.fixed=Math.round(iss*rate);
        else d.fixed=Math.min(iss,Math.round(rate));
      }
    }
    var keys=Object.keys(d).filter(function(k){ return k!=="month"&&k!=="cutoff"; });
    if(!keys.length) continue;
    out.push({arr:"stats",key:mk,data:d,label:d.month,rowNo:i+1});
  }
  return out.length?{items:out,conf:"high",note:"总表 "+out.length+" 个月"}:null;
}

function adaptProjects(parsed,W){
  var tb=tables(parsed).filter(function(t){ return pickTable(t.rows,ALIAS.projects); })[0];
  if(!tb) return null;
  var pick=pickTable(tb.rows,ALIAS.projects);
  if(pick.hit<5) return null;
  var out=[];
  for(var i=pick.headerAt+1;i<tb.rows.length;i++){
    var r=tb.rows[i]||[];
    if(isEmptyRow(r)||isTotalRow(r)) continue;
    var g=function(k){ return pick.map[k]===undefined?null:r[pick.map[k]]; };
    var name=txt(g("name"));
    if(!name||name.length<4) continue;
    var d={name:name};
    var major=txt(g("major")); if(major) d.major=major;
    var dc=txt(g("dcontrol")); if(dc) d.dcontrol=(dc.indexOf("是")>=0?"是":"否");
    var fund=txt(g("fund")); if(fund) d.fund=fund;
    var amt=num(g("amount")); if(amt!==null) d.amount=amt;
    var place=txt(g("place")); if(place) d.place=place;
    var st=txt(g("status"));
    if(st) d.status=/验收/.test(st)?"已验收":/完|竣工/.test(st)?"已完工待验收":/暂停/.test(st)?"暂停":"施工实施";
    var span=txt(g("span"));
    if(span){
      var mm=/(\d{4})[.\-\/](\d{1,2})[.\-\/]?(\d{1,2})?/.exec(span);
      if(mm) d.start=mm[1]+"-"+pad(mm[2])+"-"+pad(mm[3]||1);
      var tail=span.split(/[～~至]/)[1]||"";
      var de=dateOf(tail);
      if(de) d.end=de;
    }
    var endD=dateOf(g("end")); if(endD) d.end=endD;
    var owner=txt(g("owner")); if(owner) d.owner=owner;
    var ph=txt(g("phone")); if(ph) d.phone=ph;
    var ci=txt(g("checkInfo")); if(ci) d.checkInfo=ci;
    var fi=txt(g("fixInfo")); if(fi) d.fixInfo=fi;
    var pd=txt(g("progDesc")); if(pd) d.progDesc=pd;
    var nt=txt(g("note")); if(nt) d.note=nt;
    var kd=txt(g("kind")); if(kd) d.kind=(kd.indexOf("新")>=0?"新建":"延续");
    var rv=txt(g("reviewed")); if(rv) d.reviewed=/是|已/.test(rv);
    var mp=matchProject(name);
    var key=normName(name);
    if(mp){
      /* 命中既有项目：沿用它的主键，名称以台账为准（名单里的全称常带“采购/监理”后缀） */
      key=normName(mp.name);
      delete d.name;
    }
    out.push({arr:"projects",key:key,data:d,label:name,rowNo:i+1});
  }
  if(!out.length) return null;
  var matched=0;
  /* 用原始文件名（label）而非 data.name 判定：命中既有项目时 data.name 已被移除 */
  out.forEach(function(it){ if(matchProject(it.label||it.data.name)) matched++; });
  var conf=(matched/out.length>=0.6)?"high":"low";
  return {items:out,conf:conf,note:out.length+" 个项目（已匹配 "+matched+"）"};
}

function matchProject(name){
  var n=normName(name), list=DB().projects||[];
  var best=null;
  for(var i=0;i<list.length;i++){
    var b=normName(list[i].name);
    if(!b) continue;
    if(b===n) return list[i];
    if(b.length>=8&&n.length>=8&&(b.indexOf(n)>=0||n.indexOf(b)>=0)){ best=list[i]; continue; }
    var head=b.slice(0,10);
    if(head.length>=8&&n.indexOf(head)>=0&&!best) best=list[i];
  }
  return best;
}

/* 状态归一：把表里各种写法映射回状态机的 5 个合法值，映射不上则返回空（不写入） */
function normInsp(s){
  s=txt(s); if(!s) return "";
  if(/复核退回|退回|不通过|未通过/.test(s)) return "复核退回";
  if(/已闭环|闭环|已完成|已整改/.test(s)) return "已闭环";
  if(/待复核|已回复|已报送|回复单已/.test(s)) return "已回复待复核";
  if(/整改中|进行中|催办/.test(s)) return "整改中";
  if(/待整改|未整改|新下发/.test(s)) return "待整改";
  return "";
}
/* ---------- 源文件位置标识 ----------
   取值规则（写入问题行 srcLoc 字段）：
     T{m}·R{n}  第 m 张表格的第 n 行（rows 数组 1 起算，含表头行）
     L{n}       正文第 n 行（parsed.text 按换行切分，1 起算）
   空值表示该行不是从文件抽取的（手工录入），界面显示「手工」          */
function locTable(idx,row){ return "T"+idx+"·R"+row; }
function locLine(n){ return "L"+n; }

function adaptInspect(parsed){
  var out=[];
  var tbs=tables(parsed);
  var tb=tbs.filter(function(t){ return pickTable(t.rows,ALIAS.inspections); })[0];
  if(tb){
    var pick=pickTable(tb.rows,ALIAS.inspections);
    for(var i=pick.headerAt+1;i<tb.rows.length;i++){
      var r=tb.rows[i]||[];
      if(isEmptyRow(r)) continue;
      var g=function(k){ return pick.map[k]===undefined?null:r[pick.map[k]]; };
      var no=txt(g("no"));
      if(!no) continue;
      var d={no:no,date:dateOf(g("date"))||A.todayStr()};
      var pj=txt(g("projectId")); if(pj){ var p=matchProject(pj); if(p) d.projectId=p.id; }
      var kd=txt(g("kind")); if(kd) d.kind=kd.indexOf("记录表")>=0?"质量检查记录表":"质量问题整改通知单";
      var to=txt(g("toOrg")); if(to) d.toOrg=to;
      var fu=txt(g("fixUnit")); if(fu) d.fixUnit=fu;
      var ck=txt(g("checker")); if(ck) d.checker=ck;
      var rc=txt(g("receiver")); if(rc) d.receiver=rc;
      var rcd=dateOf(g("recvDate")); if(rcd) d.recvDate=rcd;
      var sd=dateOf(g("sendDate")); if(sd) d.sendDate=sd;
      var dl=dateOf(g("deadline")); if(dl) d.deadline=dl;
      var rp=dateOf(g("reportDate")); if(rp) d.reportDate=rp;
      var vr=txt(g("verifyResult"));
      if(vr) d.verifyResult=vr.indexOf("不到位")>=0?"整改不到位":vr.indexOf("部分")>=0?"部分整改":
        (vr.indexOf("整改")>=0?"已按要求整改":"待复核");
      var rv=txt(g("reviewer")); if(rv) d.reviewer=rv;
      var rd=dateOf(g("reviewDate")); if(rd) d.reviewDate=rd;
      var cc=txt(g("conclusion")); if(cc) d.conclusion=cc.indexOf("不合格")>=0?"不合格":cc.indexOf("基本")>=0?"基本合格":"合格";
      var ic=intOf(g("issueCount")); if(ic!==null) d.issueCount=ic;
      var fc=intOf(g("fixedCount")); if(fc!==null) d.fixedCount=fc;
      var fs=txt(g("fixStatus")); if(fs&&normInsp(fs)) d.fixStatus=normInsp(fs);
      out.push({arr:"inspections",key:no,data:d,label:no,rowNo:i+1});
    }
  }
  var tb2=tbs.filter(function(t){ return pickTable(t.rows,ALIAS.issues); })[0];
  if(tb2){
    var tIdx=tbs.indexOf(tb2)+1;   /* 1 起算，与「第 N 张表格」一致 */
    var p2=pickTable(tb2.rows,ALIAS.issues);
    for(var j=p2.headerAt+1;j<tb2.rows.length;j++){
      var r2=tb2.rows[j]||[];
      if(isEmptyRow(r2)) continue;
      var g2=function(k){ return p2.map[k]===undefined?null:r2[p2.map[k]]; };
      var no2=txt(g2("no")), desc=txt(g2("desc"));
      if(!no2&&!desc) continue;
      var d2={no:no2||("问题"+j),desc:desc||no2};
      var sq=txt(g2("seq")); if(sq) d2.seq=sq;
      var dl=dateOf(g2("deadline")); if(dl) d2.deadline=dl;
      var fnd=dateOf(g2("finishDate")); if(fnd) d2.finishDate=fnd;
      var rq=txt(g2("requirement")); if(rq) d2.requirement=rq;
      var ms=txt(g2("measure")); if(ms) d2.measure=ms;
      var ph=txt(g2("photo")); if(ph) d2.photo=ph;
      var vv=txt(g2("verifyResult"));
      if(vv) d2.verifyResult=vv.indexOf("不到位")>=0?"整改不到位":vv.indexOf("部分")>=0?"部分整改":
        (vv.indexOf("整改")>=0?"已按要求整改":"待复核");
      var sv=txt(g2("status")); if(sv&&normInsp(sv)) d2.status=normInsp(sv);
      var ow=txt(g2("owner")); if(ow) d2.owner=ow;
      var lv=txt(g2("level")); if(lv) d2.level=lv;
      var ct=txt(g2("cat")); if(ct) d2.cat=ct;
      d2.srcLoc=locTable(tIdx,j+1);   /* 该问题在第 tIdx 张表格的第 j+1 行 */
      out.push({arr:"issues",key:d2.no,data:d2,label:d2.no,rowNo:j+1,srcLoc:d2.srcLoc});
    }
  }
  /* 无问题表时，从正文抽「问题一 / 问题二 …」条目：整改回复单的常见写法，
     每条记为 L{n}（正文第 n 行），不再臆造没有依据的问题 */
  if(!out.filter(function(x){ return x.arr==="issues"; }).length){
    docIssueItems(parsed).forEach(function(x){ out.push(x); });
  }
  return out.length?{items:out,conf:"low",note:out.length+" 条检查/问题"}:null;
}

/* 从正文「问题一 / 问题二 …」抽问题条目，携带正文行号 */
function docIssueItems(parsed,nameHint){
  var text=parsed.text||"";
  if(text.length<20) return [];
  var lines=text.split(/\r?\n/);
  var RE=/^\s*问题\s*([一二三四五六七八九十]+|\d{1,2})\s*[：:、.．]?\s*(.*)$/;
  var hits=[], i, m;
  for(i=0;i<lines.length;i++){
    m=RE.exec(lines[i]);
    if(m) hits.push({line:i+1,num:m[1],body:txt(m[2]||"")});
  }
  if(!hits.length) return [];
  var out=[], base=txt(nameHint||"").replace(/\.[a-z0-9]+$/i,"");
  hits.forEach(function(h,idx){
    /* 条目正文为空时，取到下一个条目之前的首行非空内容 */
    var body=h.body, n=h.line;   /* n 已为 1 起算行号，下一行索引即 n */
    if(!body){
      for(var k=n;k<lines.length;k++){
        var cand=txt(lines[k]);
        if(!cand) continue;
        if(RE.test(lines[k])) break;
        body=cand; break;
      }
    }
    if(body.length<4) return;    /* 太短的多半是标题残留，丢弃 */
    var d={
      no:"问题"+h.num,
      seq:"问题"+h.num,
      desc:body.slice(0,120),
      srcLoc:locLine(h.line)
    };
    /* 主键带文件名：不同项目的「问题一」不能互相覆盖 */
    var key=normName((base?base+"|":"")+"问题"+h.num+"|"+d.desc.slice(0,16));
    out.push({arr:"issues",key:key,data:d,label:"问题"+h.num,rowNo:h.line,srcLoc:d.srcLoc});
  });
  return out;
}

/* 通用清单类：按别名表抽表；无表则按文本标签抽 1 条 */
function adaptGeneric(route,parsed,rec){
  var alias=ALIAS[route];
  if(!alias) return null;
  var tbs=tables(parsed);
  for(var i=0;i<tbs.length;i++){
    var res=rowsByAlias(tbs[i],alias);
    if(!res.pick||res.pick.hit<3||!res.rows.length) continue;
    var items=[];
    res.rows.forEach(function(x){
      var d={}, nonEmpty=0;
      Object.keys(x.data).forEach(function(k){
        var v=x.data[k];
        if(k==="date"||k==="regDate"||k==="pubDate"||k==="implDate"||k==="deadline"||k==="since"){
          var dd=dateOf(v); if(dd){ d[k]=dd; nonEmpty++; }
          return;
        }
        if(["people","hours","count","issueCount","fixedCount","rate"].indexOf(k)>=0){
          var n=num(v); if(n!==null){ d[k]=n; nonEmpty++; }
          return;
        }
        var s=txt(v); if(s){ d[k]=s; nonEmpty++; }
      });
      if(nonEmpty<2) return;
      if(d.projectId){ var p=matchProject(d.projectId); if(p) d.projectId=p.id; else delete d.projectId; }
      var keyField=(route==="orgs")?"name":(route==="guides"||route==="policies"||route==="qcs"||route==="meetings"||route==="trainings"||route==="reviews"||route==="briefings"||route==="risks")?"title":"title";
      var key=normName(d[keyField]||"");
      if(!key) key=normName(JSON.stringify(d).slice(0,40));
      items.push({arr:ARR[route],key:key,data:d,label:d.title||d.name||key,rowNo:x.rowNo,
        srcLoc:locTable(i+1,x.rowNo)});   /* 表格序号 i+1，行号 x.rowNo（含表头起算） */
    });
    if(items.length) return {items:items,conf:AUTO_ROUTES[route]?"high":"low",note:items.length+" 条"};
  }
  /* 问题清单：没有标准问题表时，按正文「问题一 / 问题二 …」条目抽，并记正文行号 */
  if(route==="issues"){
    var di=docIssueItems(parsed,rec&&rec.name);
    if(di.length) return {items:di,conf:"low",note:di.length+" 条问题（正文条目）"};
  }
  /* 文档型：先按"标签：值"抓，抓不到再按无冒号连排的锚点切 */
  var text=parsed.text||"";
  if(text.length<=20) return null;
  var rules={};
  ["title","date","level","host","place","people","briefer","auditor"].forEach(function(k){
    if(alias[k]) rules[k]=alias[k];
  });
  var tf=textFields(text,rules);
  var af=DOC_LABELS[route]?anchorFields(text,DOC_LABELS[route]):{data:{},hit:0};
  var merged={}, hit=0, kk;
  for(kk in af.data){ if(af.data[kk]!==undefined){ merged[kk]=af.data[kk]; hit++; } }
  for(kk in tf.data){ if(tf.data[kk]&&!merged[kk]){ merged[kk]=tf.data[kk]; hit++; } }
  if(hit<2) return fileRecord(route,parsed,rec);
  var d2=cleanDocData(route,merged,text);
  if(!d2.title) d2.title=titleFromName(rec&&rec.name,text);
  if(!d2.date){ var gd=pickDate(text); if(gd) d2.date=gd; }
  if(!d2.title&&!d2.date) return null;
  var key2=normName(d2.title||"");
  if(!key2) return null;
  /* 文档型记录的位置：拿最长的那个字段值回查它落在正文第几行 */
  var lv="", kx;
  for(kx in d2){ var vv=txt(d2[kx]); if(vv.length>lv.length) lv=vv; }
  var dloc=locOfValue(text,lv);
  return {items:[{arr:ARR[route],key:key2,data:d2,label:d2.title||key2,srcLoc:dloc}],
          conf:"low",note:"正文抽取 "+hit+" 个要素"};
}
/* 有值但不知道确切条目时，按值回查行号；查不到就留空（界面显示「未记录」） */
function locOfValue(text,v){
  var s=txt(v);
  if(!s||s.length<4) return "";
  var probe=s.slice(0,12), lines=String(text||"").split(/\r?\n/);
  for(var i=0;i<lines.length;i++){ if(lines[i].indexOf(probe)>=0) return locLine(i+1); }
  return "";
}
/* 制度/指导书这类"一份文件就是一条记录"的模块：正文没有标签也要收进来 */
var FILE_RECORD={
  policies:{t:"title",d:"pubDate",st:"现行"},
  guides:{t:"title",d:"date",st:"在用"},
  trainings:{t:"title",d:"date"},
  reviews:{t:"title",d:"date"},
  qcs:{t:"title",d:"date"},
  briefings:{t:"title",d:"date"},
  risks:{t:"title",d:"date"},
  inspections:{t:"no",d:"date",extra:"content"}
};
var FILE_RECORD_NOTE="按文件名归档（低置信），要素待人工补全";
function docTitle(name,text){
  var s=String(name||"").replace(/\.[^.]+$/,"")
    .replace(/[\(（]\s*(可参考版|修改版|未修改版|最终版|定稿|副本|1|2)\s*[\)）]/g,"")
    .replace(/^~\$/,"").replace(/[\s\-_]+$/,"").trim();
  if(s.length>=4) return s;
  var line=String(text||"").split("\n").map(function(x){ return x.trim(); })
    .filter(function(x){ return x.length>=4&&x.length<=40; })[0];
  return line||s;
}
/* 单份《质量问题整改通知单》/《质量整改回复单》要素抽取。
   三份实际单据共有的可机读字段：致送对象、检查人、接收人、整改责任人、
   复核人、限期整改时间、报告时间、存在问题条数、整改佐证照片。
   抽不到就不填，留给人工补全（本函数只用于低置信归档行）。 */
function dateNear(t,label){
  var m=new RegExp(label+"[：:]?\\s*([^\\n]{0,40})").exec(t);
  if(!m) return "";
  return pickDate(m[1])||"";
}
/* 从"标签：值"里取值：值不能是另一个标签、也不能是日期（签字栏留空时常见） */
function labVal(v){
  v=String(v||"").replace(/\s+$/,"");
  if(!v) return "";
  if(/^[\d０-９]/.test(v)) return "";                                  // 日期/编号
  if(/^(验收|复核|检查|接收|整改|责任|报告|日期|签字|盖章|注)/.test(v)) return ""; // 串到下一个标签
  return v;
}
function inspExtra(text,name){
  var t=String(text||""), d={}, m;
  function put(k,v){ v=labVal(v); if(v) d[k]=v; }
  /* 抬头：文书写作「致：队技术质量科」或「致送对象：…」 */
  if((m=/(?:致送对象|致送|致)\s*[：:]\s*([^\s\n，,。；;：:（）()]{2,20})/.exec(t))) put("toOrg",m[1]);
  if((m=/(?:检查人|检查人员)\s*[：:]\s*([^\s\n，,。；;：:（）()]{2,16})/.exec(t))) put("checker",m[1]);
  if((m=/接收人(?:[（(]签字[)）])?\s*[：:]\s*([^\s\n，,。；;：:（）()]{2,16})/.exec(t))) put("receiver",m[1]);
  if((m=/(?:整改责任人|整改人|责任人)(?:[（(]签字[)）])?\s*[：:]\s*([^\s\n，,。；;：:（）()]{2,16})/.exec(t))) put("fixOwner",m[1]);
  if((m=/(?:复核人|验收人)(?:[（(]签字[)）])?\s*[：:]\s*([^\s\n，,。；;：:（）()]{2,16})/.exec(t))) put("reviewer",m[1]);
  var dl=dateNear(t,"限期整改时间"); if(dl) d.deadline=dl;
  var rp=dateNear(t,"报告时间")||dateNear(t,"报送时间"); if(rp) d.reportDate=rp;
  var rd=dateNear(t,"复核日期")||dateNear(t,"整改验证"); if(rd) d.reviewDate=rd;
  if(/整改通知单/.test(t)||/整改通知单/.test(name)) d.kind="质量问题整改通知单";
  else if(/检查记录表/.test(t)||/检查记录表/.test(name)) d.kind="质量检查记录表";
  if(/已按照要求进行整改|已按要求整改/.test(t)) d.verifyResult="已按要求整改";
  if(/整改不到位|未按要求整改/.test(t)) d.verifyResult="整改不到位";
  if(/整改前后|对比图片|整改照片|附照片|附整改/.test(t)) d.photos="附整改前后对比照片";
  /* 问题条数：优先数「存在的问题」段落内的（一）（二）…，其次数「问题一/二/…」 */
  var seg="";
  var a=/存在的?问题/.exec(t), b=/整改情况|整改措施|整改验证/.exec(t);
  if(a) seg=t.slice(a.index, (b&&b.index>a.index)?b.index:(a.index+4000));
  var cn=(seg.match(/[（(][一二三四五六七八九十]{1,2}[)）]/g)||[]).length;
  var cn2=(t.match(/问题[一二三四五六七八九十]{1,2}(?=[：:、\s])/g)||[]).length;
  var n=Math.max(cn,cn2);
  if(n>0) d.issueCount=n;
  return d;
}
function fileRecord(route,parsed,rec){
  var cfg=FILE_RECORD[route];
  if(!cfg) return null;
  var text=parsed.text||"";
  if(text.length<30) return null;
  var name=(rec&&rec.name)||"";
  var title=docTitle(name,text);
  if(!title||title.length<4) return null;
  var d={};
  d[cfg.t]=title;
  if(rec&&rec.rel&&(route==="policies"||route==="guides")) d.path=rec.rel;
  if(cfg.extra==="content"){
    var body=txt(text);
    if(body) d.content=(body.length>200?body.slice(0,200)+"…":body);
  }
  var dd=pickDate(text)||pickDate(name);
  if(dd) d[cfg.d]=dd;
  if(route==="policies"){
    var no=/[〔\[［]\s*(20\d{2})\s*[〕\]］]\s*(\d{1,3})\s*号/.exec(text)||
           /[〔\[［]\s*(20\d{2})\s*[〕\]］]\s*(\d{1,3})\s*号/.exec(name);
    if(no) d.docNo="〔"+no[1]+"〕"+no[2]+"号";
  }
  if(cfg.st) d.status=cfg.st;
  /* 整改单据：补抽致送对象/检查人/限期/报告时间等要素 */
  if(route==="inspections"){
    var ex=inspExtra(text,name);
    for(var k in ex){
      if(!Object.prototype.hasOwnProperty.call(ex,k)) continue;
      if(ex[k]!==""&&ex[k]!==undefined&&ex[k]!==null&&d[k]===undefined) d[k]=ex[k];
    }
  }
  return {items:[{arr:ARR[route],key:normName(title),data:d,label:title}],
          conf:"low",note:FILE_RECORD_NOTE};
}
/* 文件名兜底出标题：去掉"关于/会议记录/模板/括号注"这类无信息片段 */
function titleFromName(name,text){
  var s=String(name||"").replace(/\.[^.]+$/,"");
  s=s.replace(/^关于(印发)?/,"").replace(/[\(（][^\)）]{0,30}[\)）]/g,"")
      .replace(/(会议记录|会议纪要|纪要|简报|通知|模板|范本|可参考版|修改版|未修改版)/g,"")
      .replace(/[\s\-_]+/g," ").trim();
  if(s.length>=4) return s;
  var line=String(text||"").split("\n").map(function(x){ return x.trim(); })
    .filter(function(x){ return x.length>=4&&x.length<=40; })[0];
  return line||s;
}

/* 一个解析结果 → 建议行集合 */
function build(rec,parsed){
  var rs=routesOf(rec);
  var results=[];
  rs.forEach(function(route){
    var r=null;
    if(route==="stats") r=adaptStats(parsed,rec);
    else if(route==="projects") r=adaptProjects(parsed,rec);
    else if(route==="inspect") r=adaptInspect(parsed);
    else r=adaptGeneric(route,parsed,rec);
    if(r&&r.items&&r.items.length) results.push({route:route,items:r.items,conf:r.conf,note:r.note||""});
  });
  return results;
}

/* ---------------- 事务 ---------------- */
function begin(route,fileRec){
  return {id:A.uid("b"),route:route,fileId:fileRec?fileRec.id:"",fileName:fileRec?fileRec.name:"",
          at:nowStr(),ops:[],n:0,conflicts:[]};
}
function rowKeyOf(route,row){
  if(route==="stats") return monthKey(row.month);
  if(route==="projects") return normName(row.name);
  if(route==="orgs") return normName(row.name);
  /* 问题行以 srcKey 为主键：同一份回复单多条「问题一/二」不会跨文件撞键 */
  if(route==="issues"&&row.srcKey) return row.srcKey;
  return normName(row.title||row.name||row.no||"");
}
function findRow(arr,route,key,extra){
  var i, r;
  for(i=0;i<arr.length;i++){
    r=arr[i];
    if(extra&&extra.fileId&&r.srcFileId===extra.fileId&&r.srcKey===key) return r;
  }
  for(i=0;i<arr.length;i++){
    if(rowKeyOf(route,arr[i])===key) return arr[i];
  }
  return null;
}
var NUMERIC={amount:1,progress:1,people:1,hours:1,count:1,issueCount:1,fixedCount:1,rate:1,
  training:1,trainPeople:1,qc:1,review:1,check:1,issues:1,fixed:1,other:1,doneProj:1,acceptProj:1,weight:1};
var SKIP_FIELDS={name:1,title:1,no:1,month:1};

/* 字段级「人工改过」判定：v2.0 起编辑表单会写 row._df 记录被改字段；
   老数据只有 row.dirty，没有 _df，按整行保护（宁可多问一次，不静默覆盖） */
function fieldDirty(row,f){
  if(!row||!row.dirty) return false;
  if(row._df) return !!row._df[f];
  return true;
}
/* 来源版本：同一业务主键被多份文件命中时（如每月一份项目清单），
   只有"更新"的文件能覆盖行，避免旧月报把新月报的数据改回去 */
function verOf(rec){
  if(!rec) return "";
  var m=guessMonth(rec.name)||guessMonth(rec.rel||"");
  if(m) return m;
  if(rec.mt) return String(rec.mt);
  return "";
}
function ignored(fileRec,arrName,key){
  if(!fileRec||!fileRec.ignore) return false;
  return !!fileRec.ignore[arrName+"|"+(key||"")];
}
function applyItems(batch,route,items,fileRec){
  var arr=DB()[ARR[route]]||(DB()[ARR[route]]=[]);
  var applied=0;
  items.forEach(function(it){
    var key=it.key, data=it.data;
    /* 源文件位置：条目层携带的 rowNo/srcLoc 落进行数据，供「源位置」列展示 */
    if(data&&!data.srcLoc){
      var lc=it.srcLoc||(it.rowNo?locTable(1,it.rowNo):"");
      if(lc) data.srcLoc=lc;
    }
    if(ignored(fileRec,ARR[route],key)) return;   /* 人工删除过的记录不再回填 */
    var hit=findRow(arr,route,key,{fileId:fileRec?fileRec.id:""});
    if(hit){
      /* 旧版本不覆盖新版本：7 月的清单不该把 10 月已写入的进度改回去 */
      var verN=verOf(fileRec), verO=hit.srcVer||"";
      if(fileRec&&verN&&verO&&verN<verO){ batch.stale=(batch.stale||0)+1; return; }
      var before=A.clone(hit), changed=false;
      var force=it.force||"", fmap=it.forceMap||null;
      Object.keys(data).forEach(function(f){
        var nv=data[f];
        if(nv===null||nv===undefined||nv==="") return;   /* 空白不覆盖 */
        if(NUMERIC[f]&&typeof nv==="number"&&!isFinite(nv)) return;
        var ov=hit[f];
        if(String(ov)===String(nv)) return;
        /* 溯源类字段（源文件位置）不参与人工冲突裁决：它是文件属性，不是业务值 */
        if(f==="srcLoc"){ hit[f]=nv; changed=true; return; }
        var fd=fmap&&fmap[f]?fmap[f]:force;
        if(fieldDirty(hit,f)&&fd!=="file"){
          /* 人工改过的字段：默认保护，记入冲突，等用户在预览里裁决 */
          batch.conflicts.push({arr:ARR[route],id:hit.id,field:f,label:(FLABEL[route]||{})[f]||f,
            old:ov,neo:nv,row:hit.name||hit.title||hit.month||""});
          return;
        }
        hit[f]=nv; changed=true;
      });
      if(changed){
        hit.srcFileId=fileRec?fileRec.id:hit.srcFileId;
        hit.srcRel=fileRec?(fileRec.rel||fileRec.path||""):hit.srcRel;
        hit.srcKey=key;
        hit.importBatch=batch.id;
        hit.srcState="ok";
        if(verN) hit.srcVer=verN;
        if(!hit.date&&data.date) hit.date=data.date;
        batch.ops.push({arr:ARR[route],id:hit.id,op:"update",before:before});
        batch.n++;
        applied++;
      }else if(fileRec&&!(verN&&verO&&verN<verO)){
        /* 值没变也要补溯源，否则对账会把这些行算成「无来源」 */
        var link=false;
        if(hit.srcFileId!==fileRec.id){ hit.srcFileId=fileRec.id; link=true; }
        var rel=fileRec.rel||fileRec.path||"";
        if(hit.srcRel!==rel){ hit.srcRel=rel; link=true; }
        if(hit.srcKey!==key){ hit.srcKey=key; link=true; }
        if(link){
          hit.srcState="ok";
          batch.ops.push({arr:ARR[route],id:hit.id,op:"update",before:before});
        }
      }
    }else{
      var row={id:A.uid(PREFIX[route]||"x")};
      Object.keys(data).forEach(function(f){
        var nv=data[f];
        if(nv===null||nv===undefined||nv==="") return;
        row[f]=nv;
      });
      if(!row.date&&row[mkDateField(route)]) row.date=row[mkDateField(route)];
      row.srcFileId=fileRec?fileRec.id:"";
      row.srcRel=fileRec?(fileRec.rel||fileRec.path||""):"";
      row.srcKey=key;
      row.importBatch=batch.id;
      row.srcState="ok";
      var vNew=verOf(fileRec);
      if(vNew) row.srcVer=vNew;
      row.importedAt=nowStr();
      arr.push(row);
      batch.ops.push({arr:ARR[route],id:row.id,op:"insert",before:null});
      batch.n++;
      applied++;
    }
  });
  return applied;
}
function mkDateField(route){
  if(route==="meetings"||route==="trainings"||route==="reviews") return "date";
  if(route==="briefings") return "date";
  if(route==="qcs") return "regDate";
  if(route==="policies") return "pubDate";
  return "date";
}

/* 回滚：逆序还原，insert 删掉、update 还原 before */
function rollback(batch){
  if(!batch||!batch.ops) return 0;
  var n=0;
  for(var i=batch.ops.length-1;i>=0;i--){
    var op=batch.ops[i];
    var arr=DB()[op.arr]||(DB()[op.arr]=[]);
    if(op.op==="insert"){
      for(var j=arr.length-1;j>=0;j--){ if(arr[j].id===op.id){ arr.splice(j,1); n++; break; } }
    }else if(op.op==="update"){
      for(var k=0;k<arr.length;k++){ if(arr[k].id===op.id){ arr[k]=A.clone(op.before); n++; break; } }
    }else if(op.op==="delete"){
      if(op.before) arr.push(A.clone(op.before));
      n++;
    }
  }
  return n;
}
function commit(batch,fileRec,opt){
  opt=opt||{};
  if(!batch.ops.length&&!batch.n) return {ok:true,n:0,batch:batch};
  if(!A.save()){
    rollback(batch);
    return {ok:false,n:0,err:"STORAGE_FULL"};
  }
  DB().importBatches=DB().importBatches||[];
  DB().importBatches.push({id:batch.id,route:batch.route,fileId:batch.fileId,fileName:batch.fileName,
    at:batch.at,n:batch.n,conflicts:batch.conflicts.length,ops:batch.ops});
  if(DB().importBatches.length>120) DB().importBatches=DB().importBatches.slice(-120);
  log(batch,opt);
  return {ok:true,n:batch.n,batch:batch};
}
function log(batch,opt){
  DB().importLog=DB().importLog||[];
  DB().importLog.push({at:batch.at,file:batch.fileName,route:batch.route,n:batch.n,
    conf:(opt&&opt.conf)||"",err:(opt&&opt.err)||""});
  if(DB().importLog.length>200) DB().importLog=DB().importLog.slice(-200);
}
function undo(batchId){
  var list=DB().importBatches||[], b=null, i;
  for(i=0;i<list.length;i++){ if(list[i].id===batchId){ b=list[i]; break; } }
  if(!b) return 0;
  if(b.undone) return 0;
  var n=rollback(b);
  b.undone=1;
  A.save();
  return n;
}

/* ---------------- 读取字节 ---------------- */
function bytesOf(rec){
  if(!rec) return Promise.reject(new Error("NO_REC"));
  if(window.QD&&rec.route&&rec.rel&&window.QD.readBlob){
    return window.QD.readBlob(rec.route,rec.rel).then(function(f){ return f.arrayBuffer(); });
  }
  if(rec.mode==="idb"&&window.fileBlob){
    return window.fileBlob(rec.id).then(function(b){
      if(!b) throw new Error("NO_BLOB");
      return b.arrayBuffer();
    });
  }
  return Promise.reject(new Error("NO_BYTES"));
}
function setParse(rec,patch){
  if(!rec) return;
  rec.parse=rec.parse||{};
  Object.keys(patch).forEach(function(k){ rec.parse[k]=patch[k]; });
  rec.parse.at=nowStr();
}

/* ---------------- 解析单个文件 ---------------- */
function parseOne(job){
  var rec=(DB().files||[]).filter(function(x){ return x.id===job.id; })[0];
  if(!rec) return Promise.resolve({skip:true});
  var kind=P()?P().sniff(rec.name):"other";
  if(kind==="other"||kind==="img"){
    /* 图片 / 二进制：没有文本层，但文件名往往已经给出了模块与期间，
       再在同目录里找一份有文本的相邻文件，作为人工补录的参照 */
    var hint=filenameHint(rec);
    var pr=hint?pairOf(rec):null;
    var st=hint?"scan":(kind==="img"?"image":"skip");
    setParse(rec,{state:st,n:0,err:"",kind:kind,hint:hint,pair:pr?pr.id:""});
    A.save();
    return Promise.resolve({skip:true,kind:kind,hint:hint,pair:pr?pr.name:""});
  }
  if(rec.size>MAX_BYTES){
    setParse(rec,{state:"fail",n:0,err:"超过 "+Math.round(MAX_BYTES/1048576)+"MB 解析上限"});
    A.save();
    return Promise.resolve({err:"BIG"});
  }
  return bytesOf(rec).then(function(buf){
    var parsed=P().parse(rec.name,buf);
    if(parsed.type==="temp"){
      setParse(rec,{state:"skip",n:0,err:"Office 临时锁文件（~$），已跳过"});
      A.save();
      return {skip:true,temp:true};
    }
    if(parsed.type==="err"){
      setParse(rec,{state:"fail",n:0,err:parsed.err||"解析失败"});
      A.save();
      return {err:parsed.err};
    }
    if(parsed.type==="pdf"&&parsed.scan){
      var ph=filenameHint(rec), pp=ph?pairOf(rec):null;
      setParse(rec,{state:"scan",n:0,err:"扫描件无文本层",kind:"pdf",
        hint:ph,pair:pp?pp.id:"",text:(parsed.text||"").slice(0,400)});
      A.save();
      return {scan:true,hint:ph,pair:pp?pp.name:""};
    }
    var rs=build(rec,parsed);
    if(!rs.length){
      setParse(rec,{state:"none",n:0,err:"未识别到可入库的字段",text:(parsed.text||"").slice(0,300)});
      A.save();
      return {none:true};
    }
    var allHigh=true, total=0, batchAll=[];
    rs.forEach(function(r){ if(r.conf!=="high") allHigh=false; total+=r.items.length; });
    var auto=allHigh&&AUTO_ROUTES[rs[0].route]&&job.auto!==false;
    if(auto){
      var batch=begin(rs[0].route,rec);
      rs.forEach(function(r){ applyItems(batch,r.route,r.items,rec); });
      var res=commit(batch,rec,{conf:"auto"});
      if(res.ok){
        setParse(rec,{state:"ok",n:res.n,batch:batch.id,err:"",conf:"auto",conflict:batch.conflicts.length});
        A.save();
        refreshViews();
        return {ok:true,n:res.n,auto:true};
      }
      setParse(rec,{state:"fail",n:0,err:"本地存储已满，已整批回滚"});
      A.save();
      return {err:"QUOTA"};
    }
    PEND[rec.id]={route:rs[0].route,groups:rs,n:total};
    setParse(rec,{state:"preview",n:total,err:"",conf:"low"});
    A.save();
    refreshViews();
    return {preview:true,n:total};
  }).catch(function(e){
    setParse(rec,{state:"fail",n:0,err:(e&&e.message)||"读取失败"});
    try{ A.save(); }catch(x){}
    return {err:(e&&e.message)||"READ"};
  });
}

/* ---------------- 队列 ---------------- */
function enqueue(ids,opt){
  if(!ids) return;
  var arr=Array.isArray(ids)?ids:[ids];
  arr.forEach(function(id){
    if(!id) return;
    var hit=Q.filter(function(j){ return j.id===id; })[0];
    if(hit){ if(opt&&opt.auto===false) hit.auto=false; return; }
    Q.push({id:id,auto:!(opt&&opt.auto===false)});
  });
  pump();
}
function pump(){
  if(BUSY||!Q.length) return;
  BUSY=true;
  var job=Q.shift();
  Promise.resolve().then(function(){ return parseOne(job); })
    .catch(function(e){ console.warn("解析失败",e); })
    .then(function(){ BUSY=false; setTimeout(pump,60); });
}
function queueLen(){ return Q.length+(BUSY?1:0); }

/* 供外部：把待确认/上传/归档的文件推进队列 */
function afterAdd(rec){ if(rec&&rec.id) enqueue(rec.id); }
function afterConfirm(ids){ enqueue(ids); }

/* ---------------- 预览与采纳 ---------------- */
function pendOf(fileId){ return PEND[fileId]||null; }
function rowPatch(route,data){
  var out=[];
  Object.keys(data).forEach(function(k){
    var lab=(FLABEL[route]||{})[k]||k;
    var v=data[k];
    if(v===null||v===undefined||v==="") return;
    out.push('<span class="imp-kv"><i>'+esc(lab)+'</i>'+esc(String(v).slice(0,26))+'</span>');
  });
  return out.join("");
}
/* 逐格比对：把「新值」与「台账现值」对齐，产出 diff
   kind: new 新增行 / upd 有字段变化 / same 完全一致（可跳过） */
function diffOf(route,it,fileId){
  var arr=DB()[ARR[route]]||[];
  var hit=findRow(arr,route,it.key,{fileId:fileId||""});
  var res={kind:hit?"upd":"new",row:hit||null,chg:[],conf:[],same:0};
  var lab=FLABEL[route]||{};
  if(!hit) return res;
  Object.keys(it.data||{}).forEach(function(f){
    var nv=it.data[f];
    if(nv===null||nv===undefined||nv==="") return;
    if(NUMERIC[f]&&typeof nv==="number"&&!isFinite(nv)) return;
    var ov=hit[f];
    if(String(ov)===String(nv)){ res.same++; return; }
    var o={f:f,label:lab[f]||f,old:ov,neo:nv};
    if(fieldDirty(hit,f)) res.conf.push(o);
    else res.chg.push(o);
  });
  if(!res.chg.length&&!res.conf.length) res.kind="same";
  return res;
}
function diffVal(v){
  if(v===null||v===undefined||v==="") return '<i class="imp-nil">未填</i>';
  var s=String(v);
  if(s.length>28) s=s.slice(0,28)+"…";
  return esc(s);
}
function diffKV(o,gi,ii,conf){
  var oldCell=(o.old===null||o.old===undefined||o.old==="")
    ? '<span class="imp-old is-empty">未填</span>'
    : '<s class="imp-old">'+diffVal(o.old)+'</s>';
  if(!conf)
    return '<span class="imp-kv"><i>'+esc(o.label)+'</i>'+oldCell+
      '<b class="imp-new">'+diffVal(o.neo)+'</b></span>';
  var nm="cf-"+gi+"-"+ii+"-"+o.f;
  return '<span class="imp-kv is-conf"><i>'+esc(o.label)+'</i>'+oldCell+
    '<b class="imp-new">'+diffVal(o.neo)+'</b>'+
    '<span class="imp-pick">'+
      '<label><input type="radio" name="'+nm+'" value="ledger" checked><span>以台账为准</span></label>'+
      '<label><input type="radio" name="'+nm+'" value="file"><span>以文件为准</span></label>'+
    '</span></span>';
}
function preview(fileId){
  var p=PEND[fileId];
  var rec=(DB().files||[]).filter(function(x){ return x.id===fileId; })[0];
  if(!rec) return;
  if(!p){
    toast("该文件暂无待采纳的解析结果","err");
    return;
  }
  var nUpd=0,nNew=0,nSame=0,nConf=0;
  var body=p.groups.map(function(g,gi){
    var arr=DB()[ARR[g.route]]||[];
    var rows=g.items.map(function(it,ii){
      var d=diffOf(g.route,it,fileId);
      if(d.kind==="new") nNew++; else if(d.kind==="upd") nUpd++; else nSame++;
      nConf+=d.conf.length;
      var tag=d.kind==="new"?'<span class="tag t-gray">新增行</span>'
        :d.kind==="same"?'<span class="tag t-gray">无变化</span>'
        :'<span class="tag t-p2">变化 '+(d.chg.length+d.conf.length)+' 处</span>';
      var kvs=d.chg.map(function(o){ return diffKV(o,gi,ii,false); }).join("")+
              d.conf.map(function(o){ return diffKV(o,gi,ii,true); }).join("");
      if(!kvs) kvs='<span class="imp-kv"><i>全部字段</i>与台账一致，无需写入</span>';
      if(d.kind==="new") kvs=rowPatch(g.route,it.data);
      return '<div class="imp-row'+(d.kind==="same"?" is-same":"")+'">'+
        '<input type="checkbox" data-imp="'+gi+"-"+ii+'"'+(d.kind==="same"?"":" checked")+' style="width:16px;height:16px;margin-top:1px">'+
        '<div style="flex:1;min-width:0"><div class="imp-t">'+esc(it.label||it.key)+' '+tag+
          (d.conf.length?' <span class="tag t-red">冲突 '+d.conf.length+'</span>':'')+'</div>'+
        '<div class="imp-kvs">'+kvs+'</div></div></div>';
    }).join("");
    return '<div class="imp-grp"><div class="imp-gt">'+esc(g.note||("模块 "+g.route))+
      '　<span class="tag t-amber">'+g.items.length+' 条</span></div>'+rows+'</div>';
  }).join("");
  var html='<div class="imp-head">'+
    '<div>文件：<b>'+esc(rec.name)+'</b>　共 <b>'+p.n+'</b> 条建议：'+
      '<span class="tag t-p2">更新 '+nUpd+'</span> <span class="tag t-gray">新增 '+nNew+'</span>'+
      (nSame?' <span class="tag t-gray">无变化 '+nSame+'</span>':'')+
      (nConf?' <span class="tag t-red">冲突 '+nConf+'</span>':'')+'</div>'+
    '<div class="imp-tip">红色删除线=台账现值，绿色=文件新值。冲突项为人工改过的字段，默认「以台账为准」。</div>'+
    (nConf?'<div class="imp-bar"><button class="btn sm" data-cfall="ledger">全部以台账为准</button>'+
      '<button class="btn sm" data-cfall="file">全部以文件为准</button></div>':'')+
    '</div>'+body;
  var mask=openModal({
    title:"导入预览 · "+rec.name,
    okText:"采纳所选",
    body:html,
    onOk:function(scope){
      var picked={};
      $$("[data-imp]",scope).forEach(function(cb){ if(cb.checked) picked[cb.getAttribute("data-imp")]=1; });
      /* 冲突裁决：radio name = cf-<gi>-<ii>-<field>，收集成 forceMap 交给 applyItems */
      var fm={};
      $$("input[type=radio]",scope).forEach(function(el){
        if(!el.checked) return;
        var m=/^cf-(\d+)-(\d+)-(.+)$/.exec(el.name||"");
        if(m) fm[m[1]+"-"+m[2]+"-"+m[3]]=el.value;
      });
      var batch=begin(p.groups[0].route,rec), n=0;
      p.groups.forEach(function(g,gi){
        var rows=g.items.filter(function(it,ii){
          if(!picked[gi+"-"+ii]) return false;
          var map={}, has=false;
          Object.keys(fm).forEach(function(k){
            var m=/^(\d+)-(\d+)-(.+)$/.exec(k);
            if(m&&+m[1]===gi&&+m[2]===ii){ map[m[3]]=fm[k]; has=true; }
          });
          if(has) it.forceMap=map;
          return true;
        });
        if(rows.length) n+=applyItems(batch,g.route,rows,rec);
      });
      if(!n){ toast("没有选中任何可写入的条目","err"); return false; }
      var res=commit(batch,rec,{conf:"manual"});
      if(!res.ok){ toast("写入失败，已回滚（本地存储可能已满）","err"); return false; }
      delete PEND[fileId];
      setParse(rec,{state:"ok",n:res.n,batch:batch.id,err:"",conf:"manual",conflict:batch.conflicts.length});
      A.save();
      toast("已写入 "+res.n+" 条"+(batch.conflicts.length?("，保留台账值 "+batch.conflicts.length+" 处"):"")+"，可在文件详情中撤销","ok");
      refreshViews();
      if(window.refreshNav) window.refreshNav();
      return true;
    }
  });
  var modal=$(".modal",mask); if(modal) modal.classList.add("modal-wide");
  /* 批量冲突裁决：一键把单选项全部切到同一侧 */
  $$("[data-cfall]",mask).forEach(function(b){
    b.onclick=function(){
      var v=b.getAttribute("data-cfall");
      $$("input[type=radio]",mask).forEach(function(el){ if(el.value===v) el.checked=true; });
      toast(v==="file"?"全部改为以文件为准":"全部改为以台账为准","ok");
    };
  });
}
function previewCount(){
  var n=0;
  Object.keys(PEND).forEach(function(k){ n+=PEND[k].n; });
  return n;
}

/* ---------------- 来源追溯：从台账行进到文件 ---------------- */
function rowsOfFile(fileId){
  var out=[];
  Object.keys(ARR).forEach(function(route){
    (DB()[ARR[route]]||[]).forEach(function(r){
      if(r.srcFileId===fileId) out.push({route:route,row:r});
    });
  });
  return out;
}
function showSource(fileId){
  var f=(DB().files||[]).filter(function(x){ return x.id===fileId; })[0];
  if(!f){ toast("来源文件的记录已不存在（可能已删除）","err"); return; }
  var rows=rowsOfFile(fileId);
  var p=f.parse||{};
  var stTxt={ok:'<span class="tag t-green">已同步</span>',preview:'<span class="tag t-amber">待采纳</span>',
    scan:'<span class="tag t-gray">扫描件</span>',fail:'<span class="tag t-red">解析失败</span>',
    none:'<span class="tag t-gray">无可入库</span>',image:'<span class="tag t-gray">图片</span>',
    queued:'<span class="tag t-gray">排队中</span>'}[p.state]||'<span class="tag t-gray">未解析</span>';
  var bs=(DB().importBatches||[]).filter(function(b){ return b.fileId===fileId&&!b.undone; });
  var last=bs[bs.length-1];
  var list=rows.length?rows.map(function(o){
      var lab=o.row.name||o.row.title||o.row.month||o.row.no||o.row.id;
      var mod=ROUTE_LABEL[o.route]||o.route;
      return '<li>'+esc(lab)+' <span class="tag t-gray">'+esc(mod)+'</span>'+
        (o.row.dirty?' <span class="tag t-p2">人工改过</span>':'')+
        (o.row.srcState==="missing"?' <span class="tag t-red">原件缺失</span>':'')+'</li>';
    }).join(""):'<li style="color:var(--muted)">暂无写入台账的记录</li>';
  var body='<div class="src-box">'+
    '<div class="src-h">'+esc(f.name)+' '+stTxt+'</div>'+
    '<div class="src-l"><b>路径</b>'+(f.rel?esc(f.rel):(f.path?esc(f.path):'（上传文件，无本地路径）'))+'</div>'+
    '<div class="src-l"><b>写入</b>'+(p.n||0)+' 条 · 关联台账行 '+rows.length+' 条'+
      (last?(' · 最近批次 '+esc(last.at||"")):'')+'</div>'+
    (p.err?'<div class="src-l" style="color:#c0392b"><b>错误</b>'+esc(p.err)+'</div>':'')+
    '<div class="src-l" style="margin-top:6px"><b>派生记录</b></div>'+
    '<ul class="src-ul">'+list+'</ul>'+
    (last?'<div class="src-l" style="color:var(--muted)">撤销本次导入会删除/还原上述记录（人工改过的字段一并还原）</div>':'')+
    '</div>';
  var mask=openModal({title:"来源文件",body:body,okText:"关闭",noCancel:true,
    onOk:function(){ return true; }});
  var after='<div class="src-acts">'+
    (last?'<button class="btn sm" data-src-undo="'+esc(last.id)+'">撤销本次导入</button>':'')+
    '<button class="btn sm" data-src-re="1">重新解析</button></div>';
  var box=$(".src-box",mask); if(box) box.insertAdjacentHTML("afterend",after);
  var ub=$("[data-src-undo]",mask);
  if(ub) ub.onclick=function(){
    var n=undo(ub.getAttribute("data-src-undo"));
    toast(n?("已撤销 "+n+" 条写入"):"该批次已撤销或无可回退内容",n?"ok":"err");
    mask.remove();
    refreshViews();
  };
  var rb=$("[data-src-re]",mask);
  if(rb) rb.onclick=function(){ mask.remove(); reparse(fileId); };
}
/* 表格里的小圆点：有来源的文件才显示 */
function srcChip(r){
  if(!r||!r.srcFileId) return "";
  var miss=r.srcState==="missing";
  return '<span class="src-chip'+(miss?" is-miss":"")+'" data-src="'+esc(r.srcFileId)+'" '+
    'title="'+(miss?"来源文件已缺失":"随文件自动同步")+'，点击查看来源">⇄</span>';
}

/* ---------------- 改名 / 删除同步 ---------------- */
function absPath(route,rel){
  if(window.QD&&window.QD.absOf) return window.QD.absOf(route,rel);
  return rel;
}
/* 扫描差异：改名 → 只改路径；消失 → 标记缺失并删除派生行（手工行保留） */
function onIndexChange(route,prev,next){
  if(!prev||!prev.length) return {ren:0,del:0};
  if(window.QD&&window.QD.cfgOf){
    var c=window.QD.cfgOf(route);
    if(c&&c.status==="unbound") return {ren:0,del:0};
  }
  var pm={}, nm={}, i;
  (prev||[]).forEach(function(e){ pm[e.rel]=e; });
  (next||[]).forEach(function(e){ nm[e.rel]=e; });
  var gone=[], added=[];
  Object.keys(pm).forEach(function(r){ if(!nm[r]) gone.push(pm[r]); });
  Object.keys(nm).forEach(function(r){ if(!pm[r]) added.push(nm[r]); });

  /* 改名判定：(size,mt) 两侧各唯一才算改名，避免把“同大小副本”误判 */
  var gBy={}, aBy={};
  gone.forEach(function(e){ var k=(e.size||0)+"|"+(e.mt||0); (gBy[k]=gBy[k]||[]).push(e); });
  added.forEach(function(e){ var k=(e.size||0)+"|"+(e.mt||0); (aBy[k]=aBy[k]||[]).push(e); });
  var pairs=[];
  Object.keys(gBy).forEach(function(k){
    if(gBy[k].length===1&&aBy[k]&&aBy[k].length===1) pairs.push({from:gBy[k][0],to:aBy[k][0]});
  });
  var files=DB().files||[], ren=0;
  var usedFrom={}, usedTo={};
  pairs.forEach(function(p){
    var rec=files.filter(function(f){ return f.route===route&&f.rel===p.from.rel; })[0];
    if(!rec) return;
    rec.rel=p.to.rel; rec.name=p.to.name; rec.path=absPath(route,p.to.rel);
    rec.srcState="ok";
    /* 指纹跟着改名走，否则下一轮会被当成「消失 + 新增」 */
    try{
      var cf=(window.QD&&window.QD.cfgOf)?window.QD.cfgOf(route):null;
      if(cf){
        if(cf.seen&&cf.seen[p.from.rel]!==undefined){ cf.seen[p.to.rel]=cf.seen[p.from.rel]; delete cf.seen[p.from.rel]; }
        if(cf.ack&&cf.ack.indexOf(p.from.rel)>=0){
          cf.ack.splice(cf.ack.indexOf(p.from.rel),1);
          if(cf.ack.indexOf(p.to.rel)<0) cf.ack.push(p.to.rel);
        }
      }
    }catch(e){}
    var arrs=Object.keys(ARR);
    for(var a=0;a<arrs.length;a++){
      var arr=DB()[ARR[arrs[a]]]||[];
      for(var j=0;j<arr.length;j++){
        if(arr[j].srcFileId===rec.id) arr[j].srcRel=p.to.rel;
      }
    }
    usedFrom[p.from.rel]=1; usedTo[p.to.rel]=1; ren++;
  });
  /* 剩余消失项：删派生行（未手工编辑过），文件记录标 missing */
  var del=0, batch=null;
  gone.forEach(function(e){
    if(usedFrom[e.rel]) return;
    var rec=files.filter(function(f){ return f.route===route&&f.rel===e.rel; })[0];
    if(rec) rec.srcState="missing";
    var arrs=Object.keys(ARR);
    for(var a=0;a<arrs.length;a++){
      var name=ARR[arrs[a]], arr=DB()[name]||[];
      for(var j=arr.length-1;j>=0;j--){
        if(arr[j].srcFileId!==(rec?rec.id:null)) continue;
        if(arr[j].dirty){ arr[j].srcState="missing"; continue; }  /* 人工改过的保留 */
        if(!batch) batch=begin(route,rec);
        batch.ops.push({arr:name,id:arr[j].id,op:"delete",before:A.clone(arr[j])});
        arr.splice(j,1); batch.n++; del++;
      }
    }
  });
  if(ren||del){
    if(batch&&batch.ops.length) commit(batch,null,{conf:"sync"});
    else A.save();
    refreshViews();
  }
  return {ren:ren,del:del};
}

/* ---------------- 对账 ---------------- */
function audit(){
  var res={orphanFile:[],orphanRow:[],staleLink:[],dupRow:[],auto:0,manual:0,linked:0};
  var files=DB().files||[];
  var byId={};
  files.forEach(function(f){ byId[f.id]=f; });
  var routeArr={};
  Object.keys(ARR).forEach(function(r){ routeArr[r]=ARR[r]; });

  var seen={};
  Object.keys(routeArr).forEach(function(route){
    var name=routeArr[route], arr=DB()[name]||[];
    var keys={};
    arr.forEach(function(row){
      if(!row.srcFileId){
        res.manual++;
        return;
      }
      res.linked++;
      var f=byId[row.srcFileId];
      if(!f){ res.orphanRow.push({arr:name,id:row.id,label:row.name||row.title||row.month||row.no||row.id}); return; }
      if(f.srcState==="missing"&&row.srcState!=="missing")
        res.staleLink.push({arr:name,id:row.id,file:f.name,label:row.name||row.title||row.month||row.no||row.id});
      var k=name+"|"+rowKeyOf(route,row);
      if(seen[k]){
        if(!seen[k].reported){
          res.dupRow.push({arr:name,key:rowKeyOf(route,row),ids:[seen[k].id,row.id]});
          seen[k].reported=1;
        }else{
          seen[k].ids.push(row.id);
        }
      }else seen[k]={id:row.id,reported:0};
    });
  });
  files.forEach(function(f){
    var st=f.parse&&f.parse.state;
    if(st!=="ok"||!f.parse.n) return;
    var hit=false;
    Object.keys(routeArr).forEach(function(route){
      var arr=DB()[routeArr[route]]||[];
      for(var i=0;i<arr.length;i++){ if(arr[i].srcFileId===f.id){ hit=true; break; } }
    });
    if(!hit) res.orphanFile.push({file:f.name,id:f.id,n:f.parse.n});
  });
  return res;
}
function auditText(){
  var r=audit();
  var bad=r.orphanFile.length+r.orphanRow.length+r.staleLink.length+r.dupRow.length;
  var lines=[];
  lines.push("已关联台账行："+r.linked+" 条　手工行（永不自动改）："+r.manual+" 条");
  lines.push("孤儿文件（有解析结果但无派生行）："+r.orphanFile.length);
  lines.push("孤儿行（srcFileId 指向已删除文件）："+r.orphanRow.length);
  lines.push("失联行（原件缺失但行未标记）："+r.staleLink.length);
  lines.push("重复行（同业务主键出现多次）："+r.dupRow.length);
  return {res:r,pass:bad===0,text:lines.join("\n")};
}

/* ---------------- 视图刷新（不整页重绘） ---------------- */
function refreshViews(){
  var r=(location.hash||"").replace(/^#\/?/,"").split("?")[0];
  if(r==="files"&&window.__filesRepaint) { try{ window.__filesRepaint(); }catch(e){} }
  if(r==="folder"&&window.__pendRepaint) { try{ window.__pendRepaint(); }catch(e){} }
  if(window.refreshNav) window.refreshNav();
}

/* ---------------- 待处理事项：解析失败 / 扫描件 / 冲突 ---------------- */
function inboxItems(){
  var out=[], files=DB().files||[];
  files.forEach(function(f){
    var st=f.parse&&f.parse.state;
    var igN=f.ignore?Object.keys(f.ignore).length:0;
    if(st==="fail"){
      out.push({key:"impfail:"+f.id,src:"import",title:"文件解析失败："+f.name,owner:"",
        due:"",prio:"P2",route:"files",
        note:(f.parse.err||"未知原因")+"　"+(f.rel||f.path||""),
        raw:{fileId:f.id},rawId:f.id,act:{l:"重新解析",verb:"done"}});
    }else if(st==="scan"){
      var h=f.parse.hint||{};
      var pair=f.parse.pair?files.filter(function(x){ return x.id===f.parse.pair; })[0]:null;
      var note=[];
      if(h.label) note.push("按文件名判断属「"+h.label+"」");
      if(pair) note.push("可参照同目录《"+pair.name+"》补录");
      note.push(f.parse.kind==="img"?"图片无文本层，需人工录入":"无文本层，需人工录入或另存为可检索 PDF");
      out.push({key:"impscan:"+f.id,src:"import",
        title:(h.label?("待补录（"+h.label+"）："):"扫描件待补录：")+f.name,owner:"",
        due:"",prio:"P3",route:"files",
        note:note.join("；"),
        raw:{fileId:f.id},rawId:f.id,act:{l:"去补录",verb:"done"}});
    }else if(st==="preview"){
      out.push({key:"imppv:"+f.id,src:"import",title:"待采纳解析结果："+f.name,owner:"",
        due:"",prio:"P2",route:"files",
        note:(f.parse.n||0)+" 条建议待确认",
        raw:{fileId:f.id},rawId:f.id,act:{l:"去采纳",verb:"done"}});
    }else if(igN){
      out.push({key:"impig:"+f.id,src:"import",title:"已忽略部分同步："+f.name,owner:"",
        due:"",prio:"P3",route:"files",
        note:igN+" 条人工删除的记录不再自动回填，重新解析可恢复",
        raw:{fileId:f.id},rawId:f.id,act:{l:"去恢复",verb:"done"}});
    }
  });
  return out;
}
function badgeOf(f){
  var p=f&&f.parse||{};
  if(p.state==="ok") return '<span class="tag t-green">已同步'+(p.n?(" "+p.n+" 条"):"")+'</span>';
  if(p.state==="preview") return '<span class="tag t-amber">待采纳 '+(p.n||0)+'</span>';
  if(p.state==="scan"){
    var h=p.hint||{};
    return '<span class="tag t-amber">待补录'+(h.month?(" "+h.month.replace("-","/")):"")+'</span>';
  }
  if(p.state==="fail") return '<span class="tag t-red">解析失败</span>';
  if(p.state==="none") return '<span class="tag t-gray">无可入库</span>';
  if(p.state==="image") return '<span class="tag t-gray">图片</span>';
  return "";
}
function reparse(fileId){
  var rec=(DB().files||[]).filter(function(x){ return x.id===fileId; })[0];
  if(!rec) return;
  delete PEND[fileId];
  if(rec.ignore&&Object.keys(rec.ignore).length){
    /* 重新解析 = 恢复被人工删除过的记录 */
    delete rec.ignore;
    toast("已恢复此前忽略的记录，将重新写入","ok");
  }
  setParse(rec,{state:"queued",err:""});
  A.save();
  enqueue(fileId);
  toast("已重新排队解析","ok");
}

/* ---------------- 启动：补扫未解析的历史文件 ---------------- */
function bootScan(){
  var files=(DB().files||[]).slice(-60);
  var ids=[];
  files.forEach(function(f){
    if(!f.parse&&f.size&&f.size<=MAX_BYTES){
      var k=P()?P().sniff(f.name):"other";
      if(k==="table"||k==="doc"||k==="pdf"||k==="text") ids.push(f.id);
    }
  });
  if(ids.length) setTimeout(function(){ enqueue(ids); },2500);
}

window.IMPORT={
  MAX_BYTES:MAX_BYTES, AUTO_ROUTES:AUTO_ROUTES,
  afterAdd:afterAdd, afterConfirm:afterConfirm, enqueue:enqueue,
  preview:preview, pendingOf:pendOf, pendingCount:previewCount,
  undo:undo, rollback:rollback, audit:audit, auditText:auditText,
  onIndexChange:onIndexChange, inboxItems:inboxItems, badge:badgeOf,
  showSource:showSource, srcChip:srcChip, rowsOfFile:rowsOfFile,
  filenameHint:filenameHint, pairOf:pairOf,
  reparse:reparse, queueLen:queueLen, refresh:refreshViews,
  build:build, adaptGeneric:adaptGeneric, parseOne:parseOne,
  _tests:{pickTable:pickTable,dateOf:dateOf,monthKey:monthKey,matchProject:matchProject,
          applyItems:applyItems,begin:begin,commit:commit,ALIAS:ALIAS,diffOf:diffOf,
          anchorFields:anchorFields,cleanDocData:cleanDocData,DOC_LABELS:DOC_LABELS,
          textFields:textFields,pickDate:pickDate,headCount:headCount,titleFromName:titleFromName,
          adaptInspect:adaptInspect,docIssueItems:docIssueItems,locTable:locTable,locLine:locLine,normName:normName,
          seedPend:function(id,o){ PEND[id]=o; }, pend:function(){ return PEND; }}
};
(function(){
  var old=window.onBoot;
  window.onBoot=function(){
    if(old) old();
    try{
      DB().importBatches=DB().importBatches||[];
      DB().importLog=DB().importLog||[];
      Object.keys(DB()).forEach(function(k){
        var a=DB()[k];
        if(!Array.isArray(a)) return;
        a.forEach(function(r){ if(r&&r.srcFileId&&!r.srcState) r.srcState="ok"; });
      });
      setTimeout(bootScan,1200);
    }catch(e){ console.warn("同步引擎初始化失败",e); }
  };
})();
})();
