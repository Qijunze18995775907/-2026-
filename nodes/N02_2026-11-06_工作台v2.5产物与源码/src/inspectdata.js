/* ===== 单据核定数据：「质量检查整改回复」模块 =====
   唯一依据：该模块已上传的三份单据（不含空模板《质量检查整改回复台账.xlsx》）。
   原则：逐条照录原文；原文没有的字段一律留空，由界面显示「未提供」，
        绝不写入推断值、不引用模块外资料。
   核定日期：2026-11-05
   ① 7、质量检查、整改回复/00公司整改回复/整改通知单/2026上半年公司质量检查整改回复.docx
   ② 7、质量检查、整改回复/06罗田生态恢复项目/整改通知单/罗田县生态恢复项目项目整改 回复单01.doc
   ③ 7、质量检查、整改回复/07宜昌稻花香边坡治理工程项目/质量整改回复单260922(1).docx
   srcLoc 取值：L{n} = 该文件提取正文的第 n 行，可逐条回原文核对。
*/
window.INSPECT_DOC = {
  verifiedAt:"2026-11-05",
  sources:[
    {id:"d1", label:"公司质量检查整改回复", rel:"7、质量检查、整改回复/00公司整改回复/整改通知单/2026上半年公司质量检查整改回复.docx"},
    {id:"d2", label:"罗田生态恢复项目 回复单01", rel:"7、质量检查、整改回复/06罗田生态恢复项目/整改通知单/罗田县生态恢复项目项目整改 回复单01.doc"},
    {id:"d3", label:"宜昌稻花香 质量整改回复单260922", rel:"7、质量检查、整改回复/07宜昌稻花香边坡治理工程项目/质量整改回复单260922(1).docx"}
  ],

  /* ---------- 3 份单据对应的检查单（只填原文写明的值）---------- */
  sheets:[
    {id:"idx1",no:"公司-2026-0727",kind:"质量问题整改通知单",date:"2026-07-27",
     projectId:"",fixUnit:"中大公司",toOrg:"队技术质量科",checker:"",
     sendDate:"",recvDate:"2026-07-27",deadline:"",
     issueCount:4,fixedCount:4,fixOwner:"",reportDate:"2026-07-30",
     reviewer:"",reviewDate:"",verifyResult:"待复核",
     photos:"附整改前后对比图片 4 组",
     fixStatus:"已回复待复核",conclusion:"",
     content:"（一）存在的问题 1. 完善施工方案内审记录签字程序，部分存在漏签情况 2. 部分整改记录存在漏签字情况 3. 项目质量责任书应加盖公章，包括会议通知 4. 进一步加大智慧质监的应用（二）整改情况 1. 已补充完善施工方案内审签字 2. 已补充完善整改记录签字 3. 项目质量责任书以及会议通知已加盖公章 4. 将新建项目纳入智慧质监",
     note:"原文未署检查人、问题整改责任人、验收人；报告时间 2026.7.30"},

    {id:"idx2",no:"罗田-0719",kind:"质量检查记录表",date:"",
     projectId:"",fixUnit:"",toOrg:"",checker:"",
     sendDate:"",recvDate:"",deadline:"",
     issueCount:7,fixedCount:7,fixOwner:"",reportDate:"2026-07-19",
     reviewer:"",reviewDate:"",verifyResult:"已按要求整改",
     photos:"整改的佐证材料作为附件",
     fixStatus:"已闭环",conclusion:"",
     content:"整改记录：1、项目部组建文件已补充 2、项目目标管理责任书已签字盖章 3、分包单位资信文件已完善 4、质量风险识别、关键工序质量控制表已签字 5、开复工验收、技术交底已完善签字手续 6、施工组织设计签字已完善 7、交桩记录已签字并报监理及设计复核签字、盖章流程",
     note:'原文标题为「整改 回复单01」；复核记录「已按照要求进行整改」；整改人、复核人签字栏为空；注：此表为通用检查表，正反面打印'},

    {id:"idx3",no:"宜昌-260922",kind:"质量问题整改通知单",date:"",
     projectId:"",fixUnit:"湖北中大",toOrg:"",checker:"",
     sendDate:"",recvDate:"",deadline:"",
     issueCount:7,fixedCount:7,fixOwner:"",reportDate:"",
     reviewer:"",reviewDate:"",verifyResult:"待复核",
     photos:"附整改照片 7 组",
     fixStatus:"已回复待复核",conclusion:"",
     content:"整改内容及要求：工程评定文件进行补充完善。补充材料台账。施工总结报告增加备注栏。修改施工记录文件中参数错误部分。增加施工安全措施方案。根据现场实际情况修改单位工程分部分项划分表。增加施工大事记。",
     note:"项目名称：万吨馫香型白酒智能化酿造基地项目边坡治理工程；整改单位：湖北中大；限期整改时间、接收人签字、整改人、责任人、日期栏均为空白"}
  ],

  /* ---------- 18 条问题（去重后无完全重复项，按 4 类归并）----------
     desc 为空 = 原文没有「存在的问题」，只有整改记录（罗田单），界面显示「未提供」。
     罗田单的原文整改记录放在 measure，界面在描述下方以「原文整改记录：」展示，不作推断。 */
  rows:[
    /* ① 公司单：（一）存在的问题 1—4 */
    {id:"wi01",no:"公司-1",seq:"1",inspectionId:"idx1",srcRel:"7、质量检查、整改回复/00公司整改回复/整改通知单/2026上半年公司质量检查整改回复.docx",srcLoc:"L1",
     desc:"完善施工方案内审记录签字程序，部分存在漏签情况",requirement:"完善施工方案内审记录签字程序",measure:"已补充完善施工方案内审签字",
     cat:"签认手续不全",deadline:"",finishDate:"",owner:"",photo:"附整改前后对比照片",verifyResult:"待复核",status:"已回复待复核",note:""},
    {id:"wi02",no:"公司-2",seq:"2",inspectionId:"idx1",srcRel:"7、质量检查、整改回复/00公司整改回复/整改通知单/2026上半年公司质量检查整改回复.docx",srcLoc:"L1",
     desc:"部分整改记录存在漏签字情况",requirement:"补齐整改记录签字",measure:"已补充完善整改记录签字",
     cat:"签认手续不全",deadline:"",finishDate:"",owner:"",photo:"附整改前后对比照片",verifyResult:"待复核",status:"已回复待复核",note:""},
    {id:"wi03",no:"公司-3",seq:"3",inspectionId:"idx1",srcRel:"7、质量检查、整改回复/00公司整改回复/整改通知单/2026上半年公司质量检查整改回复.docx",srcLoc:"L1",
     desc:"项目质量责任书应加盖公章，包括会议通知",requirement:"项目质量责任书、会议通知加盖公章",measure:"项目质量责任书以及会议通知已加盖公章",
     cat:"签认手续不全",deadline:"",finishDate:"",owner:"",photo:"附整改前后对比照片",verifyResult:"待复核",status:"已回复待复核",note:""},
    {id:"wi04",no:"公司-4",seq:"4",inspectionId:"idx1",srcRel:"7、质量检查、整改回复/00公司整改回复/整改通知单/2026上半年公司质量检查整改回复.docx",srcLoc:"L1",
     desc:"进一步加大智慧质监的应用",requirement:"进一步加大智慧质监的应用",measure:"将新建项目纳入智慧质监",
     cat:"信息化应用",deadline:"",finishDate:"",owner:"",photo:"附整改前后对比照片",verifyResult:"待复核",status:"已回复待复核",note:""},

    /* ② 罗田单：原文只有「整改记录 1—7」，未写问题 → desc 留空 */
    {id:"wi05",no:"罗田-1",seq:"1",inspectionId:"idx2",srcRel:"7、质量检查、整改回复/06罗田生态恢复项目/整改通知单/罗田县生态恢复项目项目整改 回复单01.doc",srcLoc:"L3",
     desc:"",requirement:"",measure:"项目部组建文件已补充",
     cat:"资料记录缺失",deadline:"",finishDate:"",owner:"",photo:"整改的佐证材料作为附件",verifyResult:"已按要求整改",status:"已闭环",note:"原文仅记整改记录"},
    {id:"wi06",no:"罗田-2",seq:"2",inspectionId:"idx2",srcRel:"7、质量检查、整改回复/06罗田生态恢复项目/整改通知单/罗田县生态恢复项目项目整改 回复单01.doc",srcLoc:"L5",
     desc:"",requirement:"",measure:"项目目标管理责任书已签字盖章",
     cat:"签认手续不全",deadline:"",finishDate:"",owner:"",photo:"整改的佐证材料作为附件",verifyResult:"已按要求整改",status:"已闭环",note:"原文仅记整改记录"},
    {id:"wi07",no:"罗田-3",seq:"3",inspectionId:"idx2",srcRel:"7、质量检查、整改回复/06罗田生态恢复项目/整改通知单/罗田县生态恢复项目项目整改 回复单01.doc",srcLoc:"L7",
     desc:"",requirement:"",measure:"分包单位资信文件已完善",
     cat:"资料记录缺失",deadline:"",finishDate:"",owner:"",photo:"整改的佐证材料作为附件",verifyResult:"已按要求整改",status:"已闭环",note:"原文仅记整改记录"},
    {id:"wi08",no:"罗田-4",seq:"4",inspectionId:"idx2",srcRel:"7、质量检查、整改回复/06罗田生态恢复项目/整改通知单/罗田县生态恢复项目项目整改 回复单01.doc",srcLoc:"L9",
     desc:"",requirement:"",measure:"质量风险识别、关键工序质量控制表已签字",
     cat:"签认手续不全",deadline:"",finishDate:"",owner:"",photo:"整改的佐证材料作为附件",verifyResult:"已按要求整改",status:"已闭环",note:"原文仅记整改记录"},
    {id:"wi09",no:"罗田-5",seq:"5",inspectionId:"idx2",srcRel:"7、质量检查、整改回复/06罗田生态恢复项目/整改通知单/罗田县生态恢复项目项目整改 回复单01.doc",srcLoc:"L11",
     desc:"",requirement:"",measure:"开复工验收、技术交底已完善签字手续",
     cat:"签认手续不全",deadline:"",finishDate:"",owner:"",photo:"整改的佐证材料作为附件",verifyResult:"已按要求整改",status:"已闭环",note:"原文仅记整改记录"},
    {id:"wi10",no:"罗田-6",seq:"6",inspectionId:"idx2",srcRel:"7、质量检查、整改回复/06罗田生态恢复项目/整改通知单/罗田县生态恢复项目项目整改 回复单01.doc",srcLoc:"L13",
     desc:"",requirement:"",measure:"施工组织设计签字已完善",
     cat:"签认手续不全",deadline:"",finishDate:"",owner:"",photo:"整改的佐证材料作为附件",verifyResult:"已按要求整改",status:"已闭环",note:"原文仅记整改记录"},
    {id:"wi11",no:"罗田-7",seq:"7",inspectionId:"idx2",srcRel:"7、质量检查、整改回复/06罗田生态恢复项目/整改通知单/罗田县生态恢复项目项目整改 回复单01.doc",srcLoc:"L16",
     desc:"",requirement:"",measure:"交桩记录已签字并报监理及设计复核签字、盖章流程",
     cat:"签认手续不全",deadline:"",finishDate:"",owner:"",photo:"整改的佐证材料作为附件",verifyResult:"已按要求整改",status:"已闭环",note:"原文仅记整改记录"},

    /* ③ 宜昌单：原文「问题一—七」写在「整改内容及要求」下，措辞为要求动作，照录 */
    {id:"wi12",no:"宜昌-1",seq:"问题一",inspectionId:"idx3",srcRel:"7、质量检查、整改回复/07宜昌稻花香边坡治理工程项目/质量整改回复单260922(1).docx",srcLoc:"L8",
     desc:"工程评定文件进行补充完善",requirement:"工程评定文件进行补充完善",measure:"对工程评定文件进行补充完善",
     cat:"资料记录缺失",deadline:"",finishDate:"",owner:"",photo:"附整改照片",verifyResult:"待复核",status:"已回复待复核",note:""},
    {id:"wi13",no:"宜昌-2",seq:"问题二",inspectionId:"idx3",srcRel:"7、质量检查、整改回复/07宜昌稻花香边坡治理工程项目/质量整改回复单260922(1).docx",srcLoc:"L13",
     desc:"补充材料台账",requirement:"补充材料台账",measure:"材料台账已完善",
     cat:"资料记录缺失",deadline:"",finishDate:"",owner:"",photo:"附整改照片",verifyResult:"待复核",status:"已回复待复核",note:""},
    {id:"wi14",no:"宜昌-3",seq:"问题三",inspectionId:"idx3",srcRel:"7、质量检查、整改回复/07宜昌稻花香边坡治理工程项目/质量整改回复单260922(1).docx",srcLoc:"L19",
     desc:"施工总结报告增加备注栏",requirement:"施工总结报告增加备注栏",measure:"施工总结报告增加备注栏已完成",
     cat:"资料记录缺失",deadline:"",finishDate:"",owner:"",photo:"附整改照片",verifyResult:"待复核",status:"已回复待复核",note:""},
    {id:"wi15",no:"宜昌-4",seq:"问题四",inspectionId:"idx3",srcRel:"7、质量检查、整改回复/07宜昌稻花香边坡治理工程项目/质量整改回复单260922(1).docx",srcLoc:"L24",
     desc:"修改施工记录文件中参数错误部分",requirement:"修改施工记录文件中参数错误部分",measure:"已更正施工记录文件中参数错误部分",
     cat:"资料记录缺失",deadline:"",finishDate:"",owner:"",photo:"附整改照片",verifyResult:"待复核",status:"已回复待复核",note:""},
    {id:"wi16",no:"宜昌-5",seq:"问题五",inspectionId:"idx3",srcRel:"7、质量检查、整改回复/07宜昌稻花香边坡治理工程项目/质量整改回复单260922(1).docx",srcLoc:"L28",
     desc:"增加施工安全措施方案",requirement:"增加施工安全措施方案",measure:"已补充增加施工安全措施方案",
     cat:"方案与制度完善",deadline:"",finishDate:"",owner:"",photo:"附整改照片",verifyResult:"待复核",status:"已回复待复核",note:""},
    {id:"wi17",no:"宜昌-6",seq:"问题六",inspectionId:"idx3",srcRel:"7、质量检查、整改回复/07宜昌稻花香边坡治理工程项目/质量整改回复单260922(1).docx",srcLoc:"L32",
     desc:"根据现场实际情况修改单位工程分部分项划分表",requirement:"根据现场实际情况修改单位工程分部分项划分表",measure:"已根据现场实际情况修改单位工程分部分项划分表",
     cat:"方案与制度完善",deadline:"",finishDate:"",owner:"",photo:"附整改照片",verifyResult:"待复核",status:"已回复待复核",note:""},
    {id:"wi18",no:"宜昌-7",seq:"问题七",inspectionId:"idx3",srcRel:"7、质量检查、整改回复/07宜昌稻花香边坡治理工程项目/质量整改回复单260922(1).docx",srcLoc:"L37",
     desc:"增加施工大事记",requirement:"增加施工大事记",measure:"已增加施工大事记",
     cat:"资料记录缺失",deadline:"",finishDate:"",owner:"",photo:"附整改照片",verifyResult:"待复核",status:"已回复待复核",note:""}
  ]
};
