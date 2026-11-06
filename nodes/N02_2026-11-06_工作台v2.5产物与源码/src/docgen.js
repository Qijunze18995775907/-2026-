/* ===== 文档生成：打印版 / CSV / 月报 / 备份恢复 ===== */
(function(){
"use strict";
var A=window.APP, $=A.$, esc=A.esc;
function DB(){return A.db;}
var CO={company:"湖北省中大地质基础工程勘察有限公司",title:"2026 年度质量管理台账"};

function dl(filename,content,mime){
  var blob=new Blob([content],{type:mime||"text/plain;charset=utf-8"});
  var url=URL.createObjectURL(blob);
  var a=document.createElement("a");
  a.href=url; a.download=filename;
  document.body.appendChild(a); a.click();
  setTimeout(function(){ URL.revokeObjectURL(url); a.remove(); },400);
}
function csvCell(v){
  if(v===null||v===undefined) return "";
  var s=String(v).replace(/"/g,'""');
  return /[",\n\r]/.test(s)?'"'+s+'"':s;
}
function rowsToCSV(headers,rows){
  var out=headers.map(function(h){return csvCell(h.l);}).join(",")+"\r\n";
  rows.forEach(function(r){
    out+=headers.map(function(h){
      var v = h.get?h.get(r):r[h.k];
      return csvCell(v);
    }).join(",")+"\r\n";
  });
  return out;
}

/* ---------- 单表 CSV ---------- */
window.exportCSV=function(key,def,rows){
  var cols=def.cols.filter(function(c){return c.k.charAt(0)!=="_";});
  var headers=cols.map(function(c){return {l:c.l,get:function(r){
    if(c.csv) return c.csv(r[c.k],r);
    if(c.k==="projectId"){ var p=DB().projects.filter(function(x){return x.id===r.projectId;})[0]; return p?p.name:""; }
    if(c.k==="inspectionId"){ return r.inspectionId||""; }
    return r[c.k];
  }};});
  var csv="\ufeff"+rowsToCSV(headers,rows);
  dl(def.title+"_"+A.todayStr()+".csv",csv,"text/csv;charset=utf-8");
  toast("已导出 "+rows.length+" 条记录","ok");
};

/* ---------- 全量 CSV ---------- */
window.exportAllCSV=function(){
  var db=DB();
  var map=[
    ["tasks","质量任务"],["projects","在建项目"],["meetings","质量会议"],["trainings","质量培训"],
    ["stats","质量活动统计"],["qcs","QC质量活动"],["inspections","质量检查"],["issues","检查问题"],
    ["reviews","施工方案内审"],["briefings","技术交底"],["risks","风险识别"],["orgs","质量管理机构"],
    ["guides","作业指导书"],["policies","质量管理办法及制度"],["inbox","待处理事项"]
  ];
  var out="\ufeff";
  map.forEach(function(m){
    var arr=db[m[0]]||[];
    out+="# "+m[1]+"（"+arr.length+" 条）\r\n";
    if(!arr.length){ out+="（无记录）\r\n\r\n"; return; }
    var keys=Object.keys(arr[0]).filter(function(k){return k!=="log";});
    out+=keys.join(",")+"\r\n";
    arr.forEach(function(r){
      out+=keys.map(function(k){
        var v=r[k];
        if(k==="projectId"){ var p=db.projects.filter(function(x){return x.id===v;})[0]; return csvCell(p?p.name:v); }
        if(Array.isArray(v)) v=v.length+" 项";
        if(typeof v==="object"&&v!==null) v=JSON.stringify(v);
        return csvCell(v);
      }).join(",")+"\r\n";
    });
    out+="\r\n";
  });
  dl("质量管理台账_全量_"+A.todayStr()+".csv",out,"text/csv;charset=utf-8");
  toast("已导出全部 15 类台账","ok");
};

/* ---------- 打印工具 ----------
   所有标签一律用 L+"..." 拼接：源码中不得出现文档类型声明与脚本标签的字面量，
   否则浏览器的 HTML 解析器会提前截断这段内嵌脚本。 */
function printHTML(title,bodyHTML,subtitle){
  var w=window.open("","_blank");
  if(!w){ toast("浏览器拦截了打印窗口，请允许弹窗","err"); return; }
  var L="<";
  var h=L+'!DOCTYPE html>'+L+'html lang="zh-CN">'+L+'head>'+L+'meta charset="utf-8">'+
  L+'title>'+esc(title)+L+'/title>'+L+'style>'+
  '@page{size:A4 landscape;margin:14mm 12mm}'+
  'body{font-family:"SimSun","宋体","Microsoft YaHei",serif;color:#000;font-size:10.5pt;line-height:1.6;margin:0}'+
  '.hd{text-align:center;margin-bottom:10px}'+
  '.hd .co{font-size:12pt;font-weight:700;letter-spacing:2px}'+
  '.hd h1{font-size:16pt;margin:6px 0 2px;font-weight:700}'+
  '.hd .sub{font-size:9pt;color:#444}'+
  'table{width:100%;border-collapse:collapse;font-size:9pt;margin-top:8px}'+
  'th,td{border:1px solid #333;padding:4px 6px;vertical-align:top;word-break:break-word}'+
  'th{background:#eee;font-weight:700;text-align:center}'+
  'td.c{text-align:center}'+
  '.ft{margin-top:14px;font-size:9pt;display:flex;justify-content:space-between}'+
  '.note{margin-top:8px;font-size:9pt;color:#333}'+
  '@media print{body{print-color-adjust:exact;-webkit-print-color-adjust:exact}}'+
  L+'/style>'+L+'/head>'+L+'body>'+
  L+'div class="hd">'+L+'div class="co">'+esc(CO.company)+L+'/div>'+L+'h1>'+esc(title)+L+'/h1>'+
  L+'div class="sub">'+esc(subtitle||CO.title)+'　制表日期：'+A.todayStr()+L+'/div>'+L+'/div>'+
  bodyHTML+
  L+'div class="ft">'+L+'span>制表：质量管理部'+L+'/span>'+L+'span>审核：'+esc(DB().meta.tech||"")+L+'/span>'+
  L+'span>批准：'+esc(DB().meta.leader||"")+L+'/span>'+L+'/div>'+
  L+'script>window.onload=function(){setTimeout(function(){window.print();},300);};'+L+'/script>'+
  L+'/body>'+L+'/html>';
  w.document.open();
  w.document.write(h);
  w.document.close();
}

window.printHTML=printHTML;

window.printTable=function(key,def,rows){
  var cols=def.cols.filter(function(c){return c.k.charAt(0)!=="_";});
  var body='<table><thead><tr>'+cols.map(function(c){return '<th>'+esc(c.l)+'</th>';}).join("")+'</tr></thead><tbody>';
  if(!rows.length) body+='<tr><td colspan="'+cols.length+'" class="c">暂无记录</td></tr>';
  rows.forEach(function(r){
    body+='<tr>'+cols.map(function(c){
      var v;
      if(c.print) v=c.print(r[c.k],r);
      else if(c.k==="projectId"){ var p=DB().projects.filter(function(x){return x.id===r.projectId;})[0]; v=p?p.name:""; }
      else v=r[c.k];
      if(typeof v==="object"&&v!==null) v="";
      return '<td'+(c.num?' class="c"':'')+'>'+esc(v==null?"":v)+'</td>';
    }).join("")+'</tr>';
  });
  body+='</tbody></table>';
  body+='<div class="note">共 '+rows.length+' 条记录。</div>';
  printHTML(def.title+"台账",body);
};

/* ---------- 质量月报 ---------- */
window.printMonthlyReport=function(){
  var db=DB();
  var mo=(function(){ var d=new Date(); return d.getFullYear()+"-"+(d.getMonth()+1<10?"0":"")+(d.getMonth()+1); })();
  var today=A.todayStr();

  var mTasks=db.tasks.filter(function(t){return t.level==="month"&&t.period===mo;});
  var wTasks=db.tasks.filter(function(t){return t.level==="week"&&String(t.due).slice(0,7)===mo;});
  var dTasks=db.tasks.filter(function(t){return t.level==="day"&&String(t.due).slice(0,7)===mo;});
  function rate(arr){ var tw=0,dw=0; arr.forEach(function(t){var w=t.weight||1;tw+=w;if(t.status==="done")dw+=w;}); return tw?Math.round(dw/tw*1000)/10:0; }

  var mChecks=db.inspections.filter(function(i){return String(i.date).slice(0,7)===mo;});
  var mMeetings=db.meetings.filter(function(m){return String(m.date).slice(0,7)===mo;});
  var mTrain=db.trainings.filter(function(t){return String(t.date).slice(0,7)===mo;});
  var openIss=db.issues.filter(function(i){return i.status!=="已闭环";});

  var body='<h2 style="font-size:13pt;margin:14px 0 6px">一、本月质量工作完成情况</h2>'+
    '<table><thead><tr><th style="width:22%">指标</th><th style="width:14%">数量</th><th>说明</th></tr></thead><tbody>'+
    '<tr><td>月度目标</td><td class="c">'+mTasks.length+' 项</td><td>完成 '+mTasks.filter(function(t){return t.status==="done";}).length+' 项，加权完成率 '+rate(mTasks)+'%</td></tr>'+
    '<tr><td>周任务</td><td class="c">'+wTasks.length+' 项</td><td>完成 '+wTasks.filter(function(t){return t.status==="done";}).length+' 项，完成率 '+rate(wTasks)+'%</td></tr>'+
    '<tr><td>日待办</td><td class="c">'+dTasks.length+' 项</td><td>完成 '+dTasks.filter(function(t){return t.status==="done";}).length+' 项</td></tr>'+
    '<tr><td>质量检查</td><td class="c">'+mChecks.length+' 次</td><td>覆盖项目 '+(new Set(mChecks.map(function(i){return i.projectId;})).size)+' 个</td></tr>'+
    '<tr><td>质量会议</td><td class="c">'+mMeetings.length+' 场</td><td>参会 '+mMeetings.reduce(function(s,m){return s+(m.people||0);},0)+' 人次</td></tr>'+
    '<tr><td>质量培训</td><td class="c">'+mTrain.length+' 场</td><td>参训 '+mTrain.reduce(function(s,t){return s+(t.people||0);},0)+' 人次</td></tr>'+
    '</tbody></table>';

  body+='<h2 style="font-size:13pt;margin:14px 0 6px">二、未闭环问题清单</h2>'+
    '<table><thead><tr><th>编号</th><th style="width:26%">项目</th><th style="width:34%">问题描述</th><th>严重程度</th><th>期限</th><th>责任人</th></tr></thead><tbody>';
  if(!openIss.length) body+='<tr><td colspan="6" class="c">本月无未闭环问题</td></tr>';
  openIss.forEach(function(i){
    var p=db.projects.filter(function(x){return x.id===i.projectId;})[0];
    body+='<tr><td class="c">'+esc(i.no)+'</td><td>'+esc(p?p.name:"")+'</td><td>'+esc(i.desc)+'</td>'+
      '<td class="c">'+esc(i.level)+'</td><td class="c">'+esc(i.deadline||"")+'</td><td class="c">'+esc(i.owner||"")+'</td></tr>';
  });
  body+='</tbody></table>';

  body+='<h2 style="font-size:13pt;margin:14px 0 6px">三、在建项目质量状态</h2>'+
    '<table><thead><tr><th style="width:34%">项目名称</th><th>负责人</th><th>形象进度</th><th>检查情况</th><th>整改情况</th></tr></thead><tbody>';
  db.projects.forEach(function(p){
    body+='<tr><td>'+esc(p.name)+'</td><td class="c">'+esc(p.owner)+'</td><td class="c">'+Math.round((p.progress||0)*100)+'%</td>'+
      '<td>'+esc(p.checkInfo||"")+'</td><td>'+esc(p.fixInfo||"")+'</td></tr>';
  });
  body+='</tbody></table>';

  body+='<h2 style="font-size:13pt;margin:14px 0 6px">四、下月工作重点</h2>'+
    '<table><thead><tr><th style="width:6%">序号</th><th>工作内容</th><th style="width:14%">负责人</th><th style="width:14%">完成时限</th></tr></thead><tbody>';
  var next=db.tasks.filter(function(t){return t.status!=="done"&&(t.level==="month"||t.level==="week");}).slice(0,8);
  if(!next.length) body+='<tr><td colspan="4" class="c">—</td></tr>';
  next.forEach(function(t,i){
    body+='<tr><td class="c">'+(i+1)+'</td><td>'+esc(t.title)+'</td><td class="c">'+esc(t.owner||"")+'</td><td class="c">'+esc(t.due||"")+'</td></tr>';
  });
  body+='</tbody></table>';

  printHTML(mo.replace("-"," 年 ")+" 月质量工作月报",body,"2026 年度质量管理台账 · 月度汇总");
};

/* ---------- 检查记录单 / 整改回复单 ---------- */
window.printInspection=function(id){
  var db=DB();
  var i=db.inspections.filter(function(x){return x.id===id;})[0]; if(!i) return;
  var p=db.projects.filter(function(x){return x.id===i.projectId;})[0]||{};
  var iss=db.issues.filter(function(x){return x.inspectionId===id;});
  var body='<table><tbody>'+
    '<tr><th style="width:15%">项目名称</th><td style="width:38%">'+esc(p.name||"")+'</td>'+
        '<th style="width:15%">整改单位</th><td>'+esc(i.fixUnit||"")+'</td></tr>'+
    '<tr><th>检查编号</th><td>'+esc(i.no)+'</td><th>单据类型</th><td>'+esc(i.kind||"质量问题整改通知单")+'</td></tr>'+
    '<tr><th>致送对象</th><td>'+esc(i.toOrg||"队技术质量科")+'</td><th>检查人</th><td>'+esc(i.checker||"")+'</td></tr>'+
    '<tr><th>检查日期</th><td>'+esc(i.date||"")+'</td><th>下发日期</th><td>'+esc(i.sendDate||"")+'</td></tr>'+
    '<tr><th>接收人</th><td>'+esc(i.receiver||"")+'</td><th>接收日期</th><td>'+esc(i.recvDate||"")+'</td></tr>'+
    '<tr><th>限期整改时间</th><td>'+esc(i.deadline||"")+'</td><th>整改报告时间</th><td>'+esc(i.reportDate||"")+'</td></tr>'+
    '</tbody></table>'+
    '<h2 style="font-size:12pt;margin:12px 0 6px">一、存在的问题</h2>'+
    '<div style="border:1px solid #999;padding:8px 10px;font-size:10pt;line-height:1.7;min-height:42px">'+
      esc(i.content||"（检查内容未填写）").replace(/\n/g,"<br>")+'</div>'+
    '<h2 style="font-size:12pt;margin:12px 0 6px">二、整改情况</h2>'+
    '<table><thead><tr><th style="width:7%">序号</th><th style="width:26%">问题描述</th><th style="width:22%">整改内容及要求</th>'+
      '<th style="width:25%">整改措施</th><th style="width:10%">完成日期</th><th style="width:10%">状态</th></tr></thead><tbody>';
  if(!iss.length) body+='<tr><td colspan="6" class="c">本次检查未登记问题项</td></tr>';
  iss.forEach(function(x,n){
    body+='<tr><td class="c">'+esc(x.seq||String(n+1))+'</td>'+
      '<td>'+esc(x.desc)+'</td>'+
      '<td>'+esc(x.requirement||"")+'</td>'+
      '<td>'+esc(x.measure||"")+'</td>'+
      '<td class="c">'+esc(x.finishDate||"")+'</td>'+
      '<td class="c">'+esc(x.status||"")+'</td></tr>';
  });
  body+='</tbody></table>'+
    '<h2 style="font-size:12pt;margin:12px 0 6px">三、复核验证</h2>'+
    '<table><tbody>'+
    '<tr><th style="width:15%">复核人</th><td style="width:38%">'+esc(i.reviewer||"")+'</td>'+
        '<th style="width:15%">复核日期</th><td>'+esc(i.reviewDate||"")+'</td></tr>'+
    '<tr><th>复核结论</th><td>'+esc(i.verifyResult||"待复核")+'</td>'+
        '<th>整改状态</th><td>'+esc(i.fixStatus||"")+'</td></tr>'+
    '<tr><th>整改佐证</th><td colspan="3">'+esc(i.photos||"未附")+'</td></tr>'+
    '<tr><th>备注</th><td colspan="3">'+esc(i.note||"")+'</td></tr>'+
    '</tbody></table>'+
    '<div style="margin-top:22px;display:flex;justify-content:space-between;font-size:10pt">'+
      '<span>问题整改责任人（签字）：____________</span>'+
      '<span>验收人（签字）：____________</span>'+
      '<span>报告时间：'+esc(i.reportDate||"____________")+'</span></div>';
  /* v2.4：附件清单（仅本单确有附件时追加，不影响原有打印版式） */
  if(window.InspAttach&&window.InspAttach.list){
    var ns=window.InspAttach.list(id,"notice"), rs=window.InspAttach.list(id,"reply");
    if(ns.length||rs.length){
      var fsz=window.fileFmtSize||function(n){return (n||0)+" B";};
      body+='<h2 style="font-size:12pt;margin:12px 0 6px">四、附件清单</h2>'+
        '<table><thead><tr><th style="width:18%">类别</th><th style="width:52%">文件名</th>'+
        '<th style="width:14%">大小</th><th style="width:16%">存放方式</th></tr></thead><tbody>';
      [["整改通知单附件",ns],["整改回复单附件",rs]].forEach(function(pair){
        pair[1].forEach(function(a){
          body+='<tr><td class="c">'+pair[0]+'</td><td>'+esc(a.name||"")+'</td>'+
            '<td class="c">'+esc(fsz(a.size))+'</td>'+
            '<td class="c">'+(a.mode==="path"?"路径索引":"已存入浏览器")+'</td></tr>';
        });
      });
      body+='</tbody></table>';
    }
  }
  printHTML("质量问题整改回复单",body,"编号 "+i.no);
};

/* ---------- 备份 / 恢复 ---------- */
window.backupJSON=function(){
  dl("质量管理台账_备份_"+A.todayStr()+".json",JSON.stringify(DB(),null,1),"application/json");
  toast("备份已导出","ok");
};
window.restoreJSON=function(){
  var inp=document.createElement("input");
  inp.type="file"; inp.accept=".json,application/json";
  inp.onchange=function(){
    var f=inp.files[0]; if(!f) return;
    var rd=new FileReader();
    rd.onload=function(){
      try{
        var d=JSON.parse(rd.result);
        if(!d.tasks||!d.projects) throw new Error("文件格式不正确");
        if(!confirm("将用备份文件覆盖当前全部数据，确定继续？")) return;
        localStorage.setItem("ZLGL_DB_V1",JSON.stringify(d));
        toast("已恢复，正在重新加载…","ok");
        setTimeout(function(){ location.reload(); },600);
      }catch(e){ toast("恢复失败："+e.message,"err"); }
    };
    rd.readAsText(f);
  };
  inp.click();
};
})();
