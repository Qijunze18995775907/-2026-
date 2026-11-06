/* ===== 项目业务清单 · 一键导出 .xlsx（零依赖：内置 ZIP + OOXML 手写） =====
   版式严格对齐桌面模板「中大2026年X月所有项目业务清单.xls」：
   同一工作表名 / 19 列表头（含换行）/ 列宽 / 行高 / 字体 / 字号 / 边框 /
   合并单元格 / 冻结窗格 C3 / 缩放 70% / A4 横向、宽度 1 页。
   只把模板里的内容换成工作台台账的实际数据。 */
(function(){
"use strict";
var A=window.APP, $=A.$, esc=A.esc;
function DB(){ return A.db; }
var LSKEY="ZLGL_XLOPT_V1";

/* ---------- 1. 版式常量（逐项取自模板） ---------- */
var SHEET_NAME="Sheet1 ";          /* 模板工作表名末尾确实带一个空格 */

var HDR=[
  "序号","项目/业务名称","主要内容\n（按专业、产业）","队（院）控项目","资金\n来源",
  "合同额\n（万元）","项目地点\n（至区县）","项目状态","起止时间","承担部门\n（二级单位）",
  "联系人","联系电话","质量检查\n情况","问题整改\n情况","项目进度情况","预计完工时间",
  "是否审查","备注","延续/新建"
];

/* 模板列宽（Excel ColumnWidth 单位，取自原 .xls） */
var COLW=[8,66.125,32.125,32.125,20,20,33.125,33.125,112.4,28.125,14.125,22.75,50.75,38,77.25,25.125,41.5,36,16.625];

/* 数据行每列样式：f=字体序号 sz=字号 h=水平 w=自动换行 nf=用 0.00_ 数字格式 */
var DCOLS=[
  {f:4,sz:18,h:"center",w:1},  /* A 序号        Times New Roman 18 */
  {f:5,sz:18,h:"left",  w:1},  /* B 项目名称    仿宋 18 */
  {f:5,sz:18,h:"center",w:1},  /* C 主要内容    仿宋 18 */
  {f:5,sz:18,h:"center",w:1},  /* D 队（院）控   仿宋 18 */
  {f:5,sz:18,h:"center",w:0},  /* E 资金来源    仿宋 18 */
  {f:6,sz:18,h:"center",w:0,nf:1}, /* F 合同额    宋体 18 + 0.00_ */
  {f:6,sz:18,h:"center",w:1},  /* G 项目地点    宋体 18 */
  {f:7,sz:16,h:"center",w:0},  /* H 项目状态    宋体 16 */
  {f:5,sz:18,h:"center",w:1},  /* I 起止时间    仿宋 18 */
  {f:7,sz:16,h:"center",w:1},  /* J 承担部门    宋体 16 */
  {f:5,sz:18,h:"center",w:1},  /* K 联系人      仿宋 18 */
  {f:5,sz:18,h:"center",w:1},  /* L 联系电话    仿宋 18 */
  {f:5,sz:18,h:"left",  w:1},  /* M 质量检查    仿宋 18 */
  {f:5,sz:18,h:"center",w:1},  /* N 问题整改    仿宋 18 */
  {f:8,sz:14,h:"left",  w:1},  /* O 项目进度    宋体 14 */
  {f:5,sz:18,h:"center",w:1},  /* P 预计完工    仿宋 18 */
  {f:5,sz:18,h:"center",w:1},  /* Q 是否审查    仿宋 18 */
  {f:5,sz:18,h:"center",w:1},  /* R 备注        仿宋 18 */
  {f:5,sz:18,h:"center",w:1}   /* S 延续/新建   仿宋 18 */
];

/* ---------- 2. 字段映射规则 ---------- */
var MAJOR_OF={
  "地质灾害治理":"地质灾害环境治理工程施工",
  "排危除险":"地质灾害环境治理工程施工",
  "边坡治理":"生态保护和环境治理",
  "生态修复":"生态保护和环境治理",
  "监理服务":"其他",
  "桩基施工":"其他"
};
function pad2(n){ return n<10?"0"+n:""+n; }
function ymd(s){
  if(!s) return "";
  var m=/^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(String(s));
  if(m) return m[1]+"."+pad2(+m[2])+"."+pad2(+m[3]);
  return String(s);
}
function isFin(st){ return st==="已完工待验收"||st==="已验收"; }
function mapStatus(st){
  if(isFin(st)) return "完（竣）工";
  return st||"施工实施";
}
function numOf(v){
  if(v===null||v===undefined||v==="") return null;
  var n=Number(String(v).replace(/[^\d.\-]/g,""));
  return isFinite(n)?n:null;
}

/* 单条台账记录 → 19 列的值数组 */
function mapRow(p,i,opt){
  var fin=isFin(p.status);
  var start=ymd(p.start), end=ymd(p.end);
  return [
    i+1,
    p.name||"",
    p.major||MAJOR_OF[p.type]||"其他",
    p.dcontrol||"否",
    p.fund||"",
    numOf(p.amount),
    p.place||"",
    mapStatus(p.status),
    (start?start:"")+"～"+(fin?(end||start):"至今"),
    opt.dept||"",
    p.owner||"",
    p.phone||"",
    p.checkInfo||"",
    p.fixInfo||"",
    p.progDesc||("形象进度 "+Math.round((p.progress||0)*100)+"%"),
    fin?"已完工":(end||""),
    p.reviewed?((start?start:"")+"祁骏泽设计内审"):"",
    p.note||"",
    p.kind||""
  ];
}

/* ---------- 3. XML 工具 ---------- */
function xesc(s){
  return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;").replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g,"");
}
function colName(n){
  var s="";
  while(n>0){ var r=(n-1)%26; s=String.fromCharCode(65+r)+s; n=(n-r-1)/26; }
  return s;
}
function cell(ref,si,v,numeric){
  if(v===null||v===undefined||v==="") return '<c r="'+ref+'" s="'+si+'"/>';
  if(numeric) return '<c r="'+ref+'" s="'+si+'"><v>'+v+'</v></c>';
  return '<c r="'+ref+'" s="'+si+'" t="inlineStr"><is><t xml:space="preserve">'+xesc(v)+'</t></is></c>';
}

/* ---------- 4. styles.xml ---------- */
var FONTS=[
  '<font><sz val="11"/><name val="宋体"/><charset val="134"/></font>',                 /* 0 默认 */
  '<font><b/><sz val="36"/><name val="方正小标宋简体"/><charset val="134"/></font>',    /* 1 标题 */
  '<font><b/><sz val="18"/><name val="仿宋_GB2312"/><charset val="134"/></font>',       /* 2 抬头 */
  '<font><sz val="20"/><name val="方正小标宋简体"/><charset val="134"/></font>',        /* 3 表头 */
  '<font><sz val="18"/><name val="Times New Roman"/></font>',                           /* 4 */
  '<font><sz val="18"/><name val="仿宋"/><charset val="134"/></font>',                   /* 5 */
  '<font><sz val="18"/><name val="宋体"/><charset val="134"/></font>',                   /* 6 */
  '<font><sz val="16"/><name val="宋体"/><charset val="134"/></font>',                   /* 7 */
  '<font><sz val="14"/><name val="宋体"/><charset val="134"/></font>'                    /* 8 */
];
var _T='<color indexed="64"/>';
var BORDERS=[
  '<border><left/><right/><top/><bottom/><diagonal/></border>',                                                       /* 0 无 */
  '<border><left style="thin">'+_T+'</left><right style="thin">'+_T+'</right><top style="thin">'+_T+'</top><bottom style="thin">'+_T+'</bottom><diagonal/></border>', /* 1 四边 */
  '<border><left/><right/><top/><bottom style="thin">'+_T+'</bottom><diagonal/></border>',                              /* 2 仅下 */
  '<border><left style="thin">'+_T+'</left><right/><top/><bottom style="thin">'+_T+'</bottom><diagonal/></border>'      /* 3 左下 */
];

var XFS=[], XMAP={}, S=null;
function xf(o){
  var key=(o.font||0)+"|"+(o.border||0)+"|"+(o.num||0)+"|"+
          (o.al?(o.al.h||"")+(o.al.v||"")+(o.al.w||""):"");
  if(XMAP[key]!==undefined) return XMAP[key];
  XFS.push(o); XMAP[key]=XFS.length-1; return XMAP[key];
}
function initStyles(){
  XFS=[]; XMAP={};
  xf({font:0,border:0,num:0});
  S={};
  S.title = xf({font:1,border:1,al:{h:"center",v:"center"}});
  S.r2L   = xf({font:2,border:3,al:{h:"left",  v:"center"}});
  S.r2C   = xf({font:2,border:2,al:{h:"center",v:"center"}});
  S.r2R   = xf({font:2,border:2,al:{h:"right", v:"center"}});
  S.hdr   = xf({font:3,border:1,al:{h:"center",v:"center",w:1}});
  S.hdrF  = xf({font:3,border:1,num:164,al:{h:"center",v:"center",w:1}});
  S.data  = DCOLS.map(function(d){
    return xf({font:d.f,border:1,num:d.nf?164:0,al:{h:d.h,v:"center",w:d.w?"1":""}});
  });
  return S;
}
function buildStyles(){
  var x='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'+
    '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'+
    '<numFmts count="1"><numFmt numFmtId="164" formatCode="0.00_ "/></numFmts>'+
    '<fonts count="'+FONTS.length+'">'+FONTS.join("")+'</fonts>'+
    '<fills count="2"><fill><patternFill patternType="none"/></fill>'+
      '<fill><patternFill patternType="gray125"/></fill></fills>'+
    '<borders count="'+BORDERS.length+'">'+BORDERS.join("")+'</borders>'+
    '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'+
    '<cellXfs count="'+XFS.length+'">'+
      XFS.map(function(o){
        return '<xf numFmtId="'+(o.num||0)+'" fontId="'+(o.font||0)+'" fillId="0" borderId="'+(o.border||0)+'" xfId="0"'+
          (o.font?' applyFont="1"':'')+(o.border?' applyBorder="1"':'')+
          (o.num?' applyNumberFormat="1"':'')+(o.al?' applyAlignment="1"':'')+'>'+
          (o.al?'<alignment'+(o.al.h?' horizontal="'+o.al.h+'"':'')+' vertical="'+(o.al.v||"center")+'"'+
            (o.al.w?' wrapText="1"':'')+'/>':'')+
        '</xf>';
      }).join("")+
    '</cellXfs>'+
    '<cellStyles count="1"><cellStyle name="常规" xfId="0" builtinId="0"/></cellStyles>'+
    '<dxfs count="0"/><tableStyles count="0"/>'+
    '</styleSheet>';
  return x;
}

/* ---------- 5. 行高估算（模板行高随内容变化，这里按内容重算） ---------- */
function linesOf(s,perLine){
  var parts=String(s===null||s===undefined?"":s).split("\n"), n=0;
  for(var i=0;i<parts.length;i++){
    var p=parts[i], w=0;
    for(var j=0;j<p.length;j++) w += p.charCodeAt(j)>255 ? 1 : 0.55;
    n += Math.max(1,Math.ceil(w/perLine));
  }
  return n||1;
}
function rowHeight(vals){
  var mx=1;
  for(var i=0;i<19;i++){
    var d=DCOLS[i]; if(!d.w) continue;
    var per=COLW[i]*11/d.sz*0.55;
    var n=linesOf(vals[i],per);
    if(n>mx) mx=n;
  }
  var h=mx*18*1.30+6;
  if(h<40) h=40;
  if(h>409) h=409;
  return Math.round(h*100)/100;
}

/* ---------- 6. sheet1.xml ---------- */
function buildSheet(title,unit,clerk,cutTxt,rows){
  var last=3+rows.length;
  var x='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'+
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'+
    '<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>'+
    '<dimension ref="A1:'+colName(19)+last+'"/>'+
    '<sheetViews><sheetView zoomScale="70" zoomScaleNormal="70" workbookViewId="0">'+
      '<pane xSplit="2" ySplit="2" topLeftCell="C3" activePane="bottomRight" state="frozen"/>'+
      '<selection pane="bottomRight" activeCell="C3" sqref="C3"/>'+
    '</sheetView></sheetViews>'+
    '<sheetFormatPr defaultRowHeight="22.5"/>'+
    '<cols>'+COLW.map(function(w,i){
      /* OOXML 的 width 含左右内边距，Excel 显示值比它小 0.625，这里补回以便与模板逐列一致 */
      return '<col min="'+(i+1)+'" max="'+(i+1)+'" width="'+(w+0.625)+'" customWidth="1"/>';
    }).join("")+'</cols>'+
    '<sheetData>';

  /* 第 1 行：大标题，合并 A1:S1 */
  x+='<row r="1" ht="80.1" customHeight="1">'+
      cell("A1",S.title,title)+'</row>';

  /* 第 2 行：单位 / 统计 / 统计截止日期（A2:B2、J2:S2 合并） */
  var r2="";
  for(var i=1;i<=19;i++){
    var ref=colName(i)+"2", si=S.r2C, v="";
    if(i===1){ si=S.r2L; v=unit; }
    else if(i===5){ si=S.r2C; v=clerk; }
    else if(i===10){ si=S.r2R; v=cutTxt; }
    else if(i===2){ si=S.r2L; }
    else if(i>=10){ si=S.r2R; }
    r2+=cell(ref,si,v);
  }
  x+='<row r="2" ht="49.9" customHeight="1">'+r2+'</row>';

  /* 第 3 行：19 列表头 */
  x+='<row r="3" ht="54" customHeight="1">'+
      HDR.map(function(h,i){
        return cell(colName(i+1)+"3", i===5?S.hdrF:S.hdr, h);
      }).join("")+'</row>';

  /* 第 4 行起：业务数据 */
  rows.forEach(function(vals,idx){
    var r=4+idx, h=rowHeight(vals);
    var buf='<row r="'+r+'" ht="'+h+'" customHeight="1">';
    for(var c=0;c<19;c++){
      var isNum=(c===0||c===5) && typeof vals[c]==="number";
      buf+=cell(colName(c+1)+r, S.data[c], vals[c], isNum);
    }
    x+=buf+'</row>';
  });

  x+='</sheetData>'+
    '<mergeCells count="3"><mergeCell ref="A1:S1"/><mergeCell ref="A2:B2"/><mergeCell ref="J2:S2"/></mergeCells>'+
    '<pageMargins left="0.3937" right="0.3937" top="0.3937" bottom="0.3937" header="0.5118" footer="0.5118"/>'+
    '<pageSetup paperSize="9" orientation="landscape" fitToWidth="1" fitToHeight="0" horizontalDpi="600" verticalDpi="600"/>'+
    '</worksheet>';
  return x;
}

/* ---------- 7. 其余 OOXML 部件 ---------- */
function buildWorkbook(){
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'+
    '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" '+
      'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'+
    '<workbookPr/><bookViews><workbookView activeTab="0"/></bookViews>'+
    '<sheets><sheet name="'+xesc(SHEET_NAME)+'" sheetId="1" r:id="rId1"/></sheets>'+
    '</workbook>';
}
function buildWbRels(){
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'+
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'+
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>'+
    '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>'+
    '</Relationships>';
}
function buildRootRels(){
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'+
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'+
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>'+
    '</Relationships>';
}
function buildTypes(){
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'+
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'+
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'+
    '<Default Extension="xml" ContentType="application/xml"/>'+
    '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'+
    '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'+
    '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'+
    '</Types>';
}

/* ---------- 8. ZIP（仅存储，不压缩；xlsx 允许 method=0） ---------- */
var CRCT=(function(){
  var t=new Uint32Array(256);
  for(var n=0;n<256;n++){
    var c=n;
    for(var k=0;k<8;k++) c=(c&1)?(0xEDB88320^(c>>>1)):(c>>>1);
    t[n]=c>>>0;
  }
  return t;
})();
function crc32(u8){
  var c=0xFFFFFFFF;
  for(var i=0,n=u8.length;i<n;i++) c=CRCT[(c^u8[i])&0xFF]^(c>>>8);
  return (c^0xFFFFFFFF)>>>0;
}
function utf8(s){
  if(window.TextEncoder) return new TextEncoder().encode(s);
  var b=[],i,c;                       /* 兜底：手工 UTF-8 */
  for(i=0;i<s.length;i++){
    c=s.charCodeAt(i);
    if(c<0x80) b.push(c);
    else if(c<0x800) b.push(0xC0|(c>>6),0x80|(c&63));
    else if(c>=0xD800&&c<=0xDBFF){
      var c2=s.charCodeAt(++i);
      var cp=0x10000+((c-0xD800)<<10)+(c2-0xDC00);
      b.push(0xF0|(cp>>18),0x80|((cp>>12)&63),0x80|((cp>>6)&63),0x80|(cp&63));
    }else b.push(0xE0|(c>>12),0x80|((c>>6)&63),0x80|(c&63));
  }
  return new Uint8Array(b);
}
function dosTime(d){
  var y=d.getFullYear(); if(y<1980) y=1980;
  return {
    t:((d.getHours()<<11)|(d.getMinutes()<<5)|(d.getSeconds()>>1))&0xFFFF,
    d:(((y-1980)<<9)|((d.getMonth()+1)<<5)|d.getDate())&0xFFFF
  };
}
function zipStore(files){
  var now=dosTime(new Date()), chunks=[], central=[], off=0;
  files.forEach(function(f){
    var nm=utf8(f.name), data=f.u8, crc=crc32(data);
    var lh=new Uint8Array(30+nm.length), dv=new DataView(lh.buffer);
    dv.setUint32(0,0x04034B50,true);
    dv.setUint16(4,20,true);           /* version needed */
    dv.setUint16(6,0x0800,true);       /* UTF-8 文件名 */
    dv.setUint16(8,0,true);            /* method 0 = store */
    dv.setUint16(10,now.t,true); dv.setUint16(12,now.d,true);
    dv.setUint32(14,crc,true);
    dv.setUint32(18,data.length,true);
    dv.setUint32(22,data.length,true);
    dv.setUint16(26,nm.length,true); dv.setUint16(28,0,true);
    lh.set(nm,30);
    chunks.push(lh,data);

    var cd=new Uint8Array(46+nm.length), cv=new DataView(cd.buffer);
    cv.setUint32(0,0x02014B50,true);
    cv.setUint16(4,20,true); cv.setUint16(6,20,true);
    cv.setUint16(8,0x0800,true); cv.setUint16(10,0,true);
    cv.setUint16(12,now.t,true); cv.setUint16(14,now.d,true);
    cv.setUint32(16,crc,true);
    cv.setUint32(20,data.length,true);
    cv.setUint32(24,data.length,true);
    cv.setUint16(28,nm.length,true);
    cv.setUint16(30,0,true); cv.setUint16(32,0,true);
    cv.setUint16(34,0,true); cv.setUint16(36,0,true);
    cv.setUint32(38,0,true);
    cv.setUint32(42,off,true);
    cd.set(nm,46);
    central.push(cd);
    off += lh.length + data.length;
  });
  var cdSize=0;
  central.forEach(function(c){ cdSize+=c.length; });
  var eocd=new Uint8Array(22), ev=new DataView(eocd.buffer);
  ev.setUint32(0,0x06054B50,true);
  ev.setUint16(4,0,true); ev.setUint16(6,0,true);
  ev.setUint16(8,files.length,true); ev.setUint16(10,files.length,true);
  ev.setUint32(12,cdSize,true);
  ev.setUint32(16,off,true);
  ev.setUint16(20,0,true);

  var total=off+cdSize+22, out=new Uint8Array(total), p=0;
  chunks.concat(central,[eocd]).forEach(function(c){ out.set(c,p); p+=c.length; });
  return out;
}

/* ---------- 9. 组装整个工作簿 ---------- */
function pre(tag,s){
  s=String(s||"");
  if(!s) return "";
  return s.indexOf(tag)===0 ? s : tag+s;
}
function buildFile(opt){
  initStyles();
  var rows=opt.rows;
  var files=[
    {name:"[Content_Types].xml",        u8:utf8(buildTypes())},
    {name:"_rels/.rels",                u8:utf8(buildRootRels())},
    {name:"xl/workbook.xml",            u8:utf8(buildWorkbook())},
    {name:"xl/_rels/workbook.xml.rels", u8:utf8(buildWbRels())},
    {name:"xl/styles.xml",              u8:utf8(buildStyles())},
    {name:"xl/worksheets/sheet1.xml",   u8:utf8(buildSheet(
        opt.title,
        pre("单位：",opt.unit),
        pre("统计：",opt.clerk),
        pre("统计截止日期：",opt.cut),
        rows))}
  ];
  return zipStore(files);
}

/* ---------- 10. 导出选项（记住上次填写） ---------- */
function todayISO(){
  var d=new Date();
  return d.getFullYear()+"-"+pad2(d.getMonth()+1)+"-"+pad2(d.getDate());
}
function loadOpt(){
  var o=null;
  try{ o=JSON.parse(localStorage.getItem(LSKEY)||"null"); }catch(e){}
  o=o||{};
  var d=new Date();
  var def={
    unit:"湖北省地质局第五地质大队",
    clerk:"王亚风",
    dept:"黄石公司",
    cut:todayISO(),
    title:d.getFullYear()+"年"+(d.getMonth()+1)+"月所有项目/业务清单",
    sort:"origin",
    withDone:true
  };
  for(var k in def){ if(o[k]===undefined||o[k]===null||o[k]==="") o[k]=def[k]; }
  return o;
}
function saveOpt(o){
  try{ localStorage.setItem(LSKEY,JSON.stringify(o)); }catch(e){}
}

/* ---------- 11. 取数并排序 ---------- */
function pickRows(opt){
  var list=(DB().projects||[]).slice();
  if(!opt.withDone) list=list.filter(function(p){ return !isFin(p.status); });
  if(opt.sort==="amount") list.sort(function(a,b){ return (numOf(b.amount)||0)-(numOf(a.amount)||0); });
  else if(opt.sort==="start") list.sort(function(a,b){ return String(a.start||"")<String(b.start||"")?-1:1; });
  return list;
}

/* ---------- 12. 下载 ---------- */
function saveBlob(name,u8){
  var blob=new Blob([u8],{type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"});
  var url=URL.createObjectURL(blob);
  var a=document.createElement("a");
  a.href=url; a.download=name;
  document.body.appendChild(a); a.click();
  setTimeout(function(){ URL.revokeObjectURL(url); a.remove(); },600);
}

/* ---------- 13. 界面：导出设置弹窗 ---------- */
function openExport(){
  var pj=DB().projects||[];
  if(!pj.length){ toast("当前没有项目记录，无法导出","err"); return; }
  var o=loadOpt();
  var body=
    '<div style="margin-bottom:12px;font-size:12.5px;line-height:1.8;background:var(--panel-2);padding:10px 12px;border-radius:7px">'+
      '按桌面模板「中大…所有项目业务清单.xls」的版式导出：19 列表头、列顺序、列宽、字体字号、边框、合并单元格、冻结窗格全部保持原样，仅替换为工作台中的实际项目数据。'+
    '</div>'+
    formHTML([
      {k:"title",l:"清单标题",t:"text",full:true},
      {k:"unit",l:"单位",t:"text",full:true},
      {k:"clerk",l:"统计人",t:"text"},
      {k:"dept",l:"承担部门（二级单位）",t:"text"},
      {k:"cut",l:"统计截止日期",t:"date"},
      {k:"sort",l:"排序方式",t:"select",opts:[["origin","按台账录入顺序"],["start","按开工日期"],["amount","按合同额从高到低"]]},
      {k:"withDone",l:"包含已完工/已验收项目",t:"checkbox",full:true}
    ],o)+
    '<div id="xlsxPrev" style="margin-top:4px;font-size:12.5px;color:var(--muted)"></div>';
  var mask=openModal({
    title:"导出项目业务清单（Excel）",
    okText:"导出 .xlsx",
    body:body,
    afterRender:function(scope){
      var cnt=$("#xlsxPrev",scope);
      function refresh(){
        var cur=Object.assign({},o,readForm(scope,[
          {k:"withDone",t:"checkbox"}
        ]));
        var n=pickRows({withDone:$("#f_withDone",scope).checked}).length;
        cnt.textContent="将导出 "+n+" 条项目记录（工作表名「Sheet1 」，19 列）。";
      }
      $("#f_withDone",scope).onchange=refresh;
      refresh();
    },
    onOk:function(scope){
      var d=readForm(scope,[
        {k:"title",t:"text"},{k:"unit",t:"text"},{k:"clerk",t:"text"},
        {k:"dept",t:"text"},{k:"cut",t:"date"},{k:"sort",t:"select"},{k:"withDone",t:"checkbox"}
      ]);
      if(!d.title){ toast("请填写清单标题","err"); return false; }
      saveOpt(d);
      var list=pickRows(d);
      if(!list.length){ toast("没有符合条件的项目记录","err"); return false; }
      var rows=list.map(function(p,i){ return mapRow(p,i,d); });
      var u8;
      try{
        u8=buildFile({
          title:d.title, unit:d.unit, clerk:d.clerk,
          cut:d.cut?ymd(d.cut):"",
          rows:rows
        });
      }catch(err){
        toast("生成失败："+(err&&err.message||err),"err");
        if(window.console) console.error(err);
        return false;
      }
      var fname=("中大"+d.title).replace(/[\\/:*?"<>|]/g,"")+".xlsx";
      saveBlob(fname,u8);
      toast("已导出 "+rows.length+" 条 · "+fname,"ok");
      return true;
    }
  });
  return mask;
}

/* ---------- 14. 对外接口 ---------- */
window.exportProjectList=openExport;
window.__xlsx={
  build:buildFile,
  map:mapRow,
  pick:pickRows,
  opt:loadOpt,
  sheetXML:function(o){ initStyles(); return buildSheet(o.title,o.unit,o.clerk,o.cut,o.rows); },
  stylesXML:function(){ initStyles(); return buildStyles(); },
  crc32:crc32,
  zip:zipStore,
  utf8:utf8
};
})();
