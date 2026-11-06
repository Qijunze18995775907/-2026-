# -*- coding: utf-8 -*-
"""v2.5 方案附件视觉验证页（示例附件仅注入截图页，不写入产品 HTML）"""
import io, os
BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
html = io.open(os.path.join(BASE, '质量管理台账工作台.html'), encoding='utf-8').read()

SEED = u"""<script>
(function(){
function wait(ms){return new Promise(function(r){setTimeout(r,ms);});}
(async function(){
  for(var i=0;i<120;i++){ if(window.APP&&window.ReviewAttach) break; await wait(50); }
  await wait(300);
  var DB=window.APP.db;
  /* 仅用于视觉验证的示例附件：文件名带「示例」字样，产品文件不预置任何附件 */
  DB.reviewAttachments=[
    {id:"ra1",reviewId:"r1",kind:"plan",name:"示例-施工组织设计报审版.pdf",size:842340,type:"application/pdf",date:"2026-11-06",mode:"idb",key:"ra_ra1",path:""},
    {id:"ra2",reviewId:"r1",kind:"plan",name:"示例-方案正文摘录.md",size:12480,type:"text/markdown",date:"2026-11-06",mode:"idb",key:"ra_ra2",path:""},
    {id:"ra3",reviewId:"r1",kind:"record",name:"示例-内审意见记录表.docx",size:64200,type:"application/msword",date:"2026-11-06",mode:"idb",key:"ra_ra3",path:""},
    {id:"ra4",reviewId:"r1",kind:"record",name:"示例-审查意见回复扫描件.pdf",size:7340032,type:"application/pdf",date:"2026-11-06",mode:"path",key:"",path:"E:\\\\2026质量管理台账\\\\方案内审\\\\审查意见回复扫描件.pdf"},
    {id:"ra5",reviewId:"r3",kind:"plan",name:"示例-专项施工方案.pdf",size:512000,type:"application/pdf",date:"2026-11-06",mode:"idb",key:"ra_ra5",path:""}
  ];
  location.hash="#/review";
  await wait(700);
  if(location.search.indexOf("nomodal")<0){
    window.ReviewAttach.open("r1");
    await wait(300);
  }
})();
})();
</script>
"""

for name in ['v25_table.html', 'v25_modal.html', 'v25_mobile.html']:
    io.open(os.path.join(BASE, '_tmp', name), 'w', encoding='utf-8').write(html + SEED)
print('v25 shots ok')
