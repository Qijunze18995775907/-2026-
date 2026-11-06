(function(){
var OUT=[],PASS=0,FAIL=0;
function log(s){ OUT.push(String(s)); }
function dump(){ var p=document.getElementById("probe"); if(p) p.textContent=OUT.join("\n"); }
function ok(c,m){ if(c){PASS++;log("PASS "+m);} else {FAIL++;log("FAIL "+m);} }
function hasToast(s){ return toasts.join("|").indexOf(s)>=0; }
var A,DB,RA,S;
var seq=[],toasts=[],store={},downloads=[],copied=[];
var bak={},beforeReviews="",beforeIds={},newPlanId="";
function step(fn){ seq.push(fn); }
function runAll(){
  var i=0;
  function next(){
    if(i>=seq.length){ log("RESULT PASS="+PASS+" FAIL="+FAIL); dump(); return; }
    var fn=seq[i++];
    try{ fn(); }catch(e){ FAIL++; log("EXC "+(e&&e.message)); }
    setTimeout(next,340);
  }
  next();
}
/* headless 虚拟时间会快进 setTimeout，真实 File.arrayBuffer() 的 IO Promise 来不及
   resolve（时通时不通）。这里给出同步可解析的 arrayBuffer 桩，只消除测试环境竞态；
   产品代码在真实浏览器里走原生实现，不依赖此桩。 */
function pinAB(f,buf){
  Object.defineProperty(f,"arrayBuffer",{value:function(){return Promise.resolve(buf);},configurable:true});
  return f;
}
function mkFile(name,size,type){
  var n=size===undefined?1024:size;
  return pinAB(new File([new Uint8Array(n)],name,{type:type||"application/octet-stream"}),
               new Uint8Array(n).buffer);
}
function mkText(name,text,type){
  var u8=new TextEncoder().encode(text);
  return pinAB(new File([u8],name,{type:type||"text/plain"}),u8.buffer);
}
function mkSized(name,size){
  var f=mkFile(name,1);
  Object.defineProperty(f,"size",{value:size,configurable:true});
  return f;
}
function lastModal(){ var ms=document.querySelectorAll(".modal-mask"); return ms.length?ms[ms.length-1]:null; }
function closeAll(){
  var n=0;
  while(document.querySelector(".modal-mask")&&n<10){
    var b=document.querySelector(".modal-mask [data-close]");
    if(!b) break;
    b.click(); n++;
  }
}
function snapshot(o){ return JSON.stringify(o); }

/* ---------- A. 初始化与桩替换 ---------- */
step(function(){
  log("BOOT v2.5 施工方案内审记录附件探针");
  A=window.APP; DB=A.db; RA=window.ReviewAttach; S=window.SCHEMA;
  ok(!!RA,"A1 window.ReviewAttach 已加载");
  ok(!!(RA&&RA.open&&RA.openAll&&RA.upload&&RA.view&&RA.download&&RA.remove&&RA.list&&RA.count),
     "A2 上传/查看/下载/删除/列表/总览 API 齐全");
  ok(RA&&RA.kinds.length===2&&RA.kinds[0].k==="plan"&&RA.kinds[1].k==="record",
     "A3 两类附件分类：plan(施工方案) / record(审查记录)");
  ok(RA&&RA.limit()===20*1024*1024,"A4 附件阈值 20MB（文件中心仍 5MB）");
  ok(RA&&RA.kindLabel("plan")==="施工方案"&&RA.kindLabel("record")==="审查记录","A5 类别名称与需求一致");

  bak.toast=window.toast; bak.put=window.fileBlobPut; bak.get=window.fileBlobGet;
  bak.del=window.fileBlobDel; bak.prompt=window.prompt; bak.confirm=window.confirm;
  bak.copy=window.copyText; bak.create=URL.createObjectURL; bak.revoke=URL.revokeObjectURL;
  bak.click=HTMLAnchorElement.prototype.click;
  window.toast=function(m,t){ toasts.push(String(m)); if(bak.toast) bak.toast(m,t); };
  window.fileBlobPut=function(k,b){ store[k]=b; return Promise.resolve(true); };
  window.fileBlobGet=function(k){ return Promise.resolve(store[k]); };
  window.fileBlobDel=function(k){ delete store[k]; return Promise.resolve(true); };
  window.prompt=function(){ return "E:\\档案\\施工方案.docx"; };
  window.confirm=function(){ return true; };
  window.copyText=function(t){ copied.push(String(t)); };
  try{ URL.createObjectURL=function(){ return "blob:mock"; }; }catch(e){}
  try{ URL.revokeObjectURL=function(){}; }catch(e){}
  HTMLAnchorElement.prototype.click=function(){ if(this.download) downloads.push(this.download); };

  DB.reviewAttachments=[]; A.save();
  if(DB.ui&&DB.ui.reviewAttachLock) DB.ui.reviewAttachLock={};
  beforeReviews=snapshot(DB.reviews);
  DB.reviews.forEach(function(r){ beforeIds[r.id]=1; });
  ok(Array.isArray(DB.reviewAttachments),"A6 附件数组懒初始化（不改已有数据）");
  ok(DB.reviews.length===6,"A7 既有 6 条内审方案未被改动");
  ok(!S.reviews.readonly&&!S.reviews.beforeSave,"A8 reviews 未设只读、未新增 beforeSave 校验");
});

/* ---------- B. 页面入口（方案名称列内 + 顶部总览 + 零溢出） ---------- */
step(function(){ location.hash="#/review"; });
step(function(){
  var rows=document.querySelectorAll("#tbHost tbody tr").length;
  var links=document.querySelectorAll("#tbHost [data-ra-open]").length;
  ok(rows===6,"B1 内审记录表仍 6 行（实得 "+rows+"）");
  ok(links===6,"B2 每个方案条目都有「附件」入口（"+links+" 个）");
  ok(document.querySelectorAll("#tbHost [data-ra-open]")[0].textContent.indexOf("附件")>=0,"B3 入口文案为「附件」");
  ok(document.querySelectorAll("[data-ra-allbtn]").length===1,"B4 页面顶部有 1 个「附件总览」按钮");
  ok(document.querySelectorAll(".grid.g4 .card.kpi").length===4,"B5 原 4 张 KPI 卡片数量不变");
  var w=document.querySelector("#tbHost .table-wrap");
  var over=w?w.scrollWidth-w.clientWidth:-1;
  ok(over===0,"B6 表格无新增横向溢出（实测 "+over+"px）");
  var th=[].slice.call(document.querySelectorAll("#tbHost thead th")).map(function(x){return x.textContent.trim();}).join("|");
  ok(th.indexOf("方案名称")>=0&&th.split("|").length===9,"B7 列结构未变（仍 8 列 + 操作列）");
  var cell=document.querySelector("#tbHost [data-ra-open]").closest("td");
  ok(cell&&cell.textContent.indexOf("附件")>=0&&!!cell.querySelector(".cell-main")&&
     cell.querySelectorAll(".cell-sub").length>=2,
     "B8 入口确实位于「方案名称」列内，原方案名与项目名两行均保留");
  RA.openAll();
  var m=lastModal();
  ok(!!m&&m.textContent.indexOf("方案附件总览")>=0,"B9 总览弹窗可打开");
  ok(document.querySelectorAll("[data-ra-go]").length===6,"B10 总览按 6 个方案分组");
  ok(!!m&&m.textContent.indexOf("施工方案 0")>=0&&m.textContent.indexOf("审查记录 0")>=0,"B11 总览分别显示两类数量");
  ok(!!m&&m.textContent.indexOf("缺件提示")>=0,"B12 两类未齐时给出缺件提示");
  closeAll();
});

/* ---------- C. 弹窗：两栏分治 + 类别徽标 + 空栏提示 ---------- */
step(function(){
  RA.open("r1");
  var m=lastModal();
  ok(!!m,"C1 方案附件弹窗已打开");
  ok(!!document.querySelector(".ra-grid"),"C2 两栏网格已渲染");
  ok(document.querySelectorAll("[data-ra-up]").length===2,"C3 两类各有上传按钮");
  ok(document.querySelectorAll("[data-ra-file]").length===2,"C4 两类各有 file input");
  ok(document.querySelectorAll("[data-ra-drop]").length===2,"C5 两类各有拖拽上传区");
  ok(document.querySelectorAll("[data-ra-list]").length===2,"C6 两类各有独立附件列表");
  var hs=[].slice.call(document.querySelectorAll(".ra-grid .card-h h3")).map(function(x){return x.textContent;}).join("|");
  ok(hs.indexOf("施工方案附件")>=0&&hs.indexOf("审查记录附件")>=0,"C7 栏标题区分两类（"+hs+"）");
  ok(document.querySelectorAll(".ra-grid .empty").length===2,"C8 两个空栏均给出占位提示");
  ok(m.textContent.indexOf("暂未上传")>=0,"C9 空栏写明「暂未上传」");
  ok(m.textContent.indexOf("不会改变内审记录的任何字段")>=0,"C10 明确告知不改变内审记录");
  ok(m.textContent.indexOf("已闭环")>=0,"C11 按修改闭环状态给软提示（r1 已闭环）");
  ok(!!document.querySelector("[data-ra-lock]"),"C12 提供归档锁定开关");
  ok(m.textContent.indexOf("review_attach_md.py")>=0,"C13 说明 markitdown 离线补充路径");
  closeAll();
});

/* ---------- D. 上传：两类隔离、按 id 绑定、结果提示 ---------- */
var beforeR1="";
step(function(){
  beforeR1=snapshot(DB.reviews.filter(function(x){return x.id==="r1";})[0]);
  toasts=[];
  RA.upload("r1","plan",[mkText("方案正文.md","方案正文：抗滑桩施工工艺")]);
});
step(function(){
  var ps=RA.list("r1","plan"), rs=RA.list("r1","record");
  ok(ps.length===1,"D1 施工方案附件上传成功（"+ps.length+"）");
  ok(rs.length===0,"D2 审查记录栏未被污染（"+rs.length+"）");
  ok(RA.count("r1")===1,"D3 该方案附件总数 1");
  var r=ps[0]||{};
  ok(r.reviewId==="r1"&&r.kind==="plan","D4 记录按 reviewId 关联 + 分类正确");
  ok(r.mode==="idb"&&/^ra_/.test(r.key||"")&&!!store[r.key],"D5 小文件存入文件库，key 带 ra_ 前缀不冲突");
  ok(hasToast("已上传：方案正文.md")&&hasToast("上传完成：成功 1 个"),"D6 上传逐条 + 汇总结果提示");
  ok(hasToast("施工方案"),"D7 上传提示标明附件类别");
  ok(snapshot(DB.reviews.filter(function(x){return x.id==="r1";})[0])===beforeR1,"D8 上传前后方案对象逐字一致");
  ok(snapshot(DB.reviews.filter(function(r){return beforeIds[r.id];}))===beforeReviews,"D9 6 条既有方案整体未变");
});
step(function(){
  toasts=[];
  RA.upload("r2","record",[mkText("内审意见表.txt","第一条：补充监测点布设说明")]);
});
step(function(){
  ok(RA.list("r2","record").length===1,"D10 另一方案的审查记录附件上传成功");
  ok(RA.list("r2","plan").length===0,"D11 另一方案的施工方案栏独立为空");
  ok(RA.list("r1","record").length===0,"D12 r1 的审查记录栏不受 r2 影响（不同方案相互独立）");
  ok(RA.count("r1")===1&&RA.count("r2")===1,"D13 两方案附件各自计数，互不串账");
});

/* ---------- E. 按 id 绑定：改名不失联 + 新增方案自动覆盖 ---------- */
step(function(){
  var old=DB.reviews.filter(function(x){return x.id==="r1";})[0].title;
  DB.reviews.filter(function(x){return x.id==="r1";})[0].title="【改名测试】"+old;
  ok(RA.list("r1","plan").length===1,"E1 方案名称改动后附件仍按 id 关联，不失联");
  DB.reviews.filter(function(x){return x.id==="r1";})[0].title=old;
  ok(snapshot(DB.reviews.filter(function(r){return beforeIds[r.id];}))===beforeReviews,"E2 标题已还原，既有方案数据逐字一致");

  newPlanId=A.uid("r");
  DB.reviews.push({id:newPlanId,title:"新增方案（探针）",projectId:"p4",type:"专项施工方案",
    level:"队级",date:"2026-11-06",reviewer:"祁骏泽",count:0,conclusion:"修改后通过",closure:"未开始"});
  A.save();
  ok(DB.reviews.length===7,"E3 模拟新增方案成功（走 uid('r')）");
  toasts=[];
  RA.upload(newPlanId,"plan",[mkText("新增方案正文.txt","新增方案附件绑定测试")]);
});
step(function(){
  ok(RA.list(newPlanId,"plan").length===1,"E4 新增方案无需特判即可关联附件");
  ok(RA.count("r1")===1,"E5 新增方案的附件不影响已有方案");
});

/* ---------- F. 列表展示：名称 + 类别徽标 + 查看/下载/删除 ---------- */
step(function(){
  toasts=[];
  RA.upload("r1","record",[mkText("审查记录摘录.md","## 内审意见\n1. 补充签字手续")]);
});
step(function(){
  RA.open("r1");
  var m=lastModal();
  ok(!!m,"F1 附件弹窗重新打开");
  ok(document.querySelectorAll("[data-ra-view]").length===2,"F2 每个附件都有「查看」入口（"+document.querySelectorAll("[data-ra-view]").length+"）");
  ok(document.querySelectorAll("[data-ra-dl]").length===2,"F3 每个附件都有「下载」入口");
  ok(document.querySelectorAll("[data-ra-rm]").length===2,"F4 每个附件都有「删除」入口");
  var tags=m.textContent;
  ok(tags.indexOf("施工方案")>=0&&tags.indexOf("审查记录")>=0,"F5 列表展示两类类别标识");
  ok(tags.indexOf("方案正文.md")>=0&&tags.indexOf("审查记录摘录.md")>=0,"F6 列表展示附件名称");
  ok(m.querySelectorAll(".ra-grid .tag.t-gray").length>=1,"F7 .md 附件标记「文本摘录」");
  ok(RA.isExcerpt("审查记录摘录.md")&&!RA.isExcerpt("方案.pdf"),"F8 文本摘录识别规则正确");
  ok(m.textContent.indexOf("已存入浏览器")>=0,"F9 列表显示存放方式");
  closeAll();
});

/* ---------- G. 查看：页内文本 / 原生预览 / 异常提示 ---------- */
var gid="";
step(function(){
  gid=RA.list("r1","plan")[0].id;
  toasts=[];
  RA.view(gid);
});
step(function(){
  var m=lastModal(), rv=m?m.querySelector(".ra-view"):null;
  ok(!!m&&m.textContent.indexOf("查看附件")>=0,"G1 「查看」弹窗已打开");
  ok(!!m&&m.textContent.indexOf("附件名称")>=0&&m.textContent.indexOf("附件类别")>=0,"G2 查看弹窗展示附件名称与类别");
  ok(!!m&&m.textContent.indexOf("所属方案")>=0,"G3 查看弹窗展示关联方案");
  ok(!!rv,"G4 正文查看区已渲染");
  ok(!!rv&&rv.textContent.indexOf("抗滑桩施工工艺")>=0,"G5 Parse.parse 抽出的正文可见");
  ok(!!m&&m.querySelector("[data-ra-vdl]"),"G6 查看弹窗提供「下载原件」入口");
  ok(hasToast("已打开")&&hasToast("正文"),"G7 查看操作给出明确反馈");
  closeAll();
});
step(function(){
  var mid=RA.list("r1","record")[0].id;
  toasts=[];
  RA.view(mid);
});
step(function(){
  var m=lastModal();
  ok(!!m&&m.querySelector(".ra-view")&&m.querySelector(".ra-view").textContent.indexOf("内审意见")>=0,
     "G8 markitdown 离线转出的 .md 摘录可在页内直接阅读");
  ok(!!m&&m.textContent.indexOf("文本摘录")>=0,"G9 查看弹窗标明该附件为文本摘录");
  closeAll();
});
step(function(){
  toasts=[];
  RA.upload("r2","plan",[mkFile("现场照片.png",512,"image/png"),mkFile("方案报审版.pdf",512,"application/pdf")]);
});
step(function(){
  var img=RA.list("r2","plan").filter(function(a){return /\.png$/.test(a.name);})[0];
  var pdf=RA.list("r2","plan").filter(function(a){return /\.pdf$/.test(a.name);})[0];
  ok(!!img&&!!pdf,"G10 图片与 PDF 附件均已登记");
  toasts=[];
  RA.view(img.id);
});
step(function(){
  var m=lastModal();
  ok(!!m&&!!m.querySelector(".ra-view img"),"G11 图片走浏览器原生 <img> 预览");
  ok(hasToast("图片预览"),"G12 图片预览给出反馈");
  closeAll();
  var pdf=RA.list("r2","plan").filter(function(a){return /\.pdf$/.test(a.name);})[0];
  toasts=[];
  RA.view(pdf.id);
});
step(function(){
  var m=lastModal();
  ok(!!m&&!!m.querySelector(".ra-view iframe"),"G13 PDF 走浏览器原生 <iframe> 预览");
  ok(hasToast("PDF 预览"),"G14 PDF 预览给出反馈");
  closeAll();
});
step(function(){
  toasts=[];
  RA.upload("r2","record",[mkText("空白扫描件.txt","   \n   ")]);
});
step(function(){
  var blank=RA.list("r2","record").filter(function(a){return a.name==="空白扫描件.txt";})[0];
  ok(!!blank,"G15 无文本层附件已登记");
  toasts=[];
  RA.view(blank.id);
});
step(function(){
  var m=lastModal();
  ok(!!m&&m.textContent.indexOf("没有可提取的文字内容")>=0,"G16 无文本层明确提示（不静默）");
  ok(!!m&&m.textContent.indexOf("review_attach_md.py")>=0,"G17 无文本层指向 markitdown 离线补充方案");
  closeAll();
});
/* 损坏 / 非标准文档：解析器失败时也必须明确提示，不静默 */
step(function(){
  toasts=[];
  RA.upload("r3","plan",[mkText("损坏的文档.docx","这不是真正的 docx")]);
});
step(function(){
  var bad=RA.list("r3","plan")[0];
  ok(!!bad,"G18 非标准 docx 附件已登记");
  toasts=[];
  RA.view(bad.id);
});
step(function(){
  var m=lastModal();
  ok(!!m&&(m.textContent.indexOf("解析失败")>=0||m.textContent.indexOf("没有可提取")>=0),
     "G19 解析失败明确提示（不静默、不白屏）");
  closeAll();
});

/* ---------- H. 下载与异常反馈 ---------- */
step(function(){
  toasts=[]; downloads=[];
  RA.download(gid);
});
step(function(){
  ok(downloads.indexOf("方案正文.md")>=0,"H1 下载触发且文件名正确");
  ok(hasToast("已开始下载"),"H2 下载成功提示");
  toasts=[];
  RA.view("no_such_id");
  ok(hasToast("查看失败：附件记录不存在"),"H3 查看不存在记录明确报错");
  RA.download("no_such_id");
  ok(hasToast("下载失败：附件记录不存在"),"H4 下载不存在记录明确报错");
});
step(function(){
  toasts=[];
  RA.upload("r2","plan",[mkSized("超大扫描件.zip",21*1024*1024)]);
});
step(function(){
  var big=RA.list("r2","plan").filter(function(a){return a.name==="超大扫描件.zip";})[0];
  ok(!!big&&big.mode==="path","H5 >20MB 降级为路径索引");
  ok(hasToast("已登记路径索引"),"H6 降级给出明确提示");
  toasts=[]; copied=[];
  RA.view(big.id);
  ok(hasToast("无法在线查看")&&copied.length>0,"H7 路径索引查看失败但复制路径兜底");
  RA.download(big.id);
  ok(hasToast("无法直接下载"),"H8 路径索引下载失败明确提示");
});
step(function(){
  var rec=RA.list("r1","plan")[0];
  var saved=store[rec.key]; delete store[rec.key];
  toasts=[];
  RA.download(rec.id);
  ok(true,"H9 模拟原件丢失（删除文件库记录）");
  store[rec.key]=saved;
});
step(function(){
  ok(hasToast("下载失败")&&hasToast("找不到该文件原件"),"H10 原件丢失时下载异常提示明确");
});

/* ---------- I. 权限：readonly 与归档锁定 ---------- */
step(function(){
  toasts=[];
  S.reviews.readonly=true;
  ok(RA.canWrite("r1")===false,"I1 readonly 时禁止写入");
  RA.upload("r1","plan",[mkText("只读测试.txt","x")]);
});
step(function(){
  ok(hasToast("当前台账为只读，不能上传附件"),"I2 readonly 上传被拦并提示");
  ok(RA.list("r1","plan").length===1,"I3 readonly 未产生新附件");
  toasts=[];
  RA.download(gid);
});
step(function(){
  ok(hasToast("已开始下载"),"I4 readonly 仍可下载");
  toasts=[];
  RA.view(gid);
});
step(function(){
  ok(hasToast("已打开"),"I5 readonly 仍可查看");
  closeAll();
  S.reviews.readonly=false;
  toasts=[];
  var n0=RA.list("r1","plan").length;
  RA.setLock("r1",true);
  ok(RA.isLocked("r1")===true&&RA.canWrite("r1")===false,"I6 归档锁定生效");
  ok(!!DB.ui.reviewAttachLock["r1"],"I7 锁定状态存 DB.ui（随 JSON 备份）");
  RA.upload("r1","plan",[mkText("锁定测试.txt","x")]);
});
step(function(){
  ok(hasToast("已归档锁定，不能上传附件"),"I8 锁定后上传被拦并提示");
  ok(RA.list("r1","plan").length===1,"I9 锁定后未产生新附件");
  toasts=[];
  RA.download(gid);
});
step(function(){
  ok(hasToast("已开始下载"),"I10 锁定后仍可下载");
  RA.setLock("r1",false);
  ok(RA.isLocked("r1")===false,"I11 可解除归档锁定");
});

/* ---------- J. 同名替换与孤儿清理 ---------- */
step(function(){
  toasts=[];
  RA.upload("r1","plan",[mkText("方案正文.md","方案正文：修订版")]);
});
step(function(){
  var ps=RA.list("r1","plan");
  ok(ps.length===1,"J1 同类同名附件确认替换后仍只有 1 条");
  ok(hasToast("已替换同名旧版附件"),"J2 替换操作给出反馈");
  ok(store[ps[0].key]!==undefined,"J3 替换后新二进制已写入");
  var orphan={id:A.uid("ra"),reviewId:"已删除的方案",kind:"record",name:"孤儿记录.pdf",
    size:1024,type:"",date:A.todayStr(),mode:"idb",key:"ra_orphan",path:""};
  store[orphan.key]=mkFile("孤儿记录.pdf",256);
  DB.reviewAttachments.push(orphan); A.save();
  ok(RA.orphans().length===1,"J4 孤儿附件被识别");
  RA.openAll();
  ok(lastModal().textContent.indexOf("孤儿附件（1）")>=0,"J5 总览标出孤儿数量");
  ok(lastModal().textContent.indexOf("孤儿记录.pdf")>=0,"J6 总览列出孤儿文件名");
  closeAll();
  toasts=[];
  RA.prune();
});
step(function(){
  ok(RA.orphans().length===0,"J7 整批清理后无孤儿记录");
  ok(store["ra_orphan"]===undefined,"J8 孤儿二进制一并删除");
  ok(hasToast("已清理 1 个孤儿附件"),"J9 清理结果提示");
});

/* ---------- K. 零侵入验收 + JSON 备份 ---------- */
step(function(){
  ok(snapshot(DB.reviews.filter(function(r){return beforeIds[r.id];}))===beforeReviews,
     "K1 全流程后 6 条既有内审方案逐字一致（未改任何字段）");
  ok(!S.reviews.beforeSave,"K2 未新增 beforeSave 校验（内审流程无新关卡）");
  ok(S.reviews.cols.length===8,"K3 reviews 列定义仍为 8 列（零列宽增加）");
  ok(S.reviews.fields.length===10,"K4 reviews 表单字段仍为 10 个（未加附件字段）");
  ok(!("reviewAttachments" in (DB.reviews[0]||{})),"K5 方案记录本身不含附件字段");
  var js=JSON.stringify(DB);
  ok(js.indexOf("reviewAttachments")>=0,"K6 附件数组随 JSON 备份导出（backupJSON 用 JSON.stringify(DB())）");
  ok(!!document.querySelector("#btnAllCSV"),"K7 全量导出按钮仍在（CSV 列结构未改动）");
});

/* ---------- Z. 清理 ---------- */
step(function(){
  DB.reviewAttachments=[];
  DB.reviews=DB.reviews.filter(function(r){return beforeIds[r.id];});
  if(DB.ui&&DB.ui.reviewAttachLock) DB.ui.reviewAttachLock={};
  A.save();
  window.toast=bak.toast; window.fileBlobPut=bak.put; window.fileBlobGet=bak.get;
  window.fileBlobDel=bak.del; window.prompt=bak.prompt; window.confirm=bak.confirm;
  window.copyText=bak.copy;
  try{ URL.createObjectURL=bak.create; URL.revokeObjectURL=bak.revoke; }catch(e){}
  HTMLAnchorElement.prototype.click=bak.click;
  closeAll();
  log("Z. 探针痕迹已清理（附件清空、模拟新增方案移除、桩恢复）");
});

runAll();
})();
