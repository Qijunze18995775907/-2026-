/* ===== 种子数据：来源于 E:\workbuddy 缓存\workbuddy\总工作台\raw\a资源\2026公司质量管理台账（259 份文件 / 15 个编号目录）===== */
window.SEED = {
meta:{company:"湖北省中大地质基础工程勘察有限公司",shortName:"中大公司",year:2026,dept:"工程技术部",leader:"代小俊",tech:"祁骏泽"},

/* ---------- 计划表与进度看板 ---------- */
tasks:[
{id:"t01",title:"工程项目一次验收合格率 100%",level:"year",period:"2026",owner:"代小俊",dept:"工程技术部",priority:"P0",status:"doing",due:"2026-12-31",weight:5,source:"公司年度要点",note:"质量工作要点第 1 条硬指标"},
{id:"t02",title:"地质技术服务项目成果合格率 100%",level:"year",period:"2026",owner:"祁骏泽",dept:"工程技术部",priority:"P0",status:"doing",due:"2026-12-31",weight:5,source:"公司年度要点"},
{id:"t03",title:"评定等级项目优良率≥95%、优秀率≥40%",level:"year",period:"2026",owner:"祁骏泽",dept:"工程技术部",priority:"P1",status:"doing",due:"2026-12-31",weight:4,source:"公司年度要点"},
{id:"t04",title:"产品质量监督抽查合格率 100%",level:"year",period:"2026",owner:"马锐",dept:"各项目部",priority:"P1",status:"doing",due:"2026-12-31",weight:3,source:"公司年度要点"},
{id:"t05",title:"服务对象满意度不低于 90%",level:"year",period:"2026",owner:"马锐",dept:"市场经营部",priority:"P1",status:"todo",due:"2026-12-31",weight:3,source:"公司年度要点",note:"需开展满意度调查并回收问卷"},
{id:"t06",title:"年度无严重质量失信和各类质量事故发生",level:"year",period:"2026",owner:"代小俊",dept:"公司领导",priority:"P0",status:"doing",due:"2026-12-31",weight:5,source:"公司年度要点"},
{id:"t07",title:"争取获得省、局、大队或全国性质量奖项",level:"year",period:"2026",owner:"代小俊",dept:"公司领导",priority:"P2",status:"todo",due:"2026-12-31",weight:2,source:"公司年度要点"},

{id:"t08",title:"组织 11 月质量工作会议暨《建筑边坡工程技术规范》宣贯",level:"month",period:"2026-11",parent:"t06",owner:"代小俊",dept:"工程技术部",priority:"P0",status:"doing",due:"2026-11-28",weight:5,source:"局/大队要求",note:"每月至少一次质量工作会议，做好会议记录与签到表"},
{id:"t09",title:"完成第四季度在建项目质量检查（覆盖 8 个项目）",level:"month",period:"2026-11",parent:"t01",owner:"祁骏泽",dept:"工程技术部",priority:"P0",status:"doing",due:"2026-11-30",weight:5,source:"局/大队要求",note:"每季度至少一次到在建项目检查、调研、指导"},
{id:"t10",title:"更新 11 月在建筑项目业务清单与质量活动统计表",level:"month",period:"2026-11",parent:"t01",owner:"王亚风",dept:"工程技术部",priority:"P1",status:"doing",due:"2026-11-30",weight:3,source:"局/大队要求"},
{id:"t11",title:"完成 2026 年度 QC 课题成果报告",level:"month",period:"2026-11",parent:"t07",owner:"代小俊",dept:"工程技术部",priority:"P0",status:"doing",due:"2026-11-30",weight:4,source:"公司年度要点",note:"课题：降低松散地层人工挖孔桩孔壁塌孔发生率"},
{id:"t12",title:"补齐西塞山、马鞍山项目内审记录与整改闭环",level:"month",period:"2026-11",parent:"t01",owner:"祁骏泽",dept:"各项目部",priority:"P1",status:"doing",due:"2026-11-20",weight:3,source:"项目实际",projectId:"p7"},
{id:"t13",title:"罗田项目整改回复单闭环归档",level:"month",period:"2026-11",parent:"t01",owner:"张江南",dept:"各项目部",priority:"P1",status:"doing",due:"2026-11-15",weight:3,source:"项目实际",projectId:"p2",note:"问题 5 个已整改，缺盖章扫描件"},
{id:"t14",title:"新开工项目质量目标管理责任书签订",level:"month",period:"2026-11",parent:"t01",owner:"马锐",dept:"各项目部",priority:"P2",status:"todo",due:"2026-11-25",weight:2,source:"公司年度要点",projectId:"p8"},
{id:"t15",title:"第四季度质量培训（锚杆施工规范宣贯）",level:"month",period:"2026-11",parent:"t01",owner:"代小俊",dept:"工程技术部",priority:"P2",status:"todo",due:"2026-11-18",weight:2,source:"公司年度要点",note:"参考 GB/T 1355 锚杆施工规范，含现场实操"},

{id:"t16",title:"汇总 10 月质量活动统计数据并上报大队",level:"week",period:"2026-W45",parent:"t10",owner:"王亚风",dept:"工程技术部",priority:"P0",status:"doing",due:"2026-11-06",weight:4,source:"局/大队要求"},
{id:"t17",title:"铁山项目抗滑桩桩间挡土板逆作法方案复核",level:"week",period:"2026-W45",parent:"t09",owner:"祁骏泽",dept:"工程技术部",priority:"P1",status:"doing",due:"2026-11-07",weight:4,source:"项目实际",projectId:"p6",note:"重点核验逆作法分段开挖步距与挡土板受力转换"},
{id:"t18",title:"西塞山项目公司级技术交底",level:"week",period:"2026-W44",parent:"t01",owner:"王立军",dept:"各项目部",priority:"P0",status:"todo",due:"2026-10-30",weight:4,source:"项目实际",projectId:"p8",note:"新开工项目开工前必须完成三级交底"},
{id:"t19",title:"整理马鞍山项目内审意见整改回复",level:"week",period:"2026-W45",parent:"t12",owner:"黄志成",dept:"各项目部",priority:"P1",status:"doing",due:"2026-11-08",weight:3,source:"项目实际",projectId:"p7"},
{id:"t20",title:"更新作业指导书清单与版本号",level:"week",period:"2026-W45",parent:"t01",owner:"祁骏泽",dept:"工程技术部",priority:"P2",status:"todo",due:"2026-11-08",weight:2,source:"公司年度要点",note:"地灾监理作业指导书仍为初稿，需定稿"},
{id:"t21",title:"QC 小组第 4 次活动（对策实施阶段数据整理）",level:"week",period:"2026-W45",parent:"t11",owner:"代小俊",dept:"工程技术部",priority:"P1",status:"doing",due:"2026-11-06",weight:3,source:"公司年度要点"},

{id:"t22",title:"催收罗田项目整改回复单盖章扫描件",level:"day",period:"2026-11-05",parent:"t13",owner:"张江南",dept:"各项目部",priority:"P0",status:"doing",due:"2026-11-05",weight:3,source:"项目实际",projectId:"p2"},
{id:"t23",title:"核对 11 月项目清单中的联系人变更",level:"day",period:"2026-11-05",parent:"t10",owner:"王亚风",dept:"工程技术部",priority:"P2",status:"done",due:"2026-11-05",weight:2,source:"临时任务"},
{id:"t24",title:"准备 11 月质量工作会议议程与签到表",level:"day",period:"2026-11-06",parent:"t08",owner:"代小俊",dept:"工程技术部",priority:"P1",status:"todo",due:"2026-11-06",weight:3,source:"局/大队要求"},
{id:"t25",title:"核查铁山项目锚杆抗拔力检测报告",level:"day",period:"2026-11-04",parent:"t09",owner:"王丰",dept:"各项目部",priority:"P1",status:"todo",due:"2026-11-04",weight:3,source:"项目实际",projectId:"p6",note:"检测批次不齐，需补做"},
{id:"t26",title:"整理 5 月质量活动统计表归档",level:"day",period:"2026-10-31",parent:"t10",owner:"王亚风",dept:"工程技术部",priority:"P2",status:"todo",due:"2026-10-31",weight:1,source:"临时任务"}
],

/* ---------- 在建项目业务清单 ---------- */
projects:[
{id:"p1",name:"铜绿山矿南沿采空区治理工程监理服务",type:"监理服务",fund:"市场",amount:3,place:"湖北省黄石市大冶市",status:"施工实施",start:"2025-10-03",end:"2026-07-20",owner:"王立军",phone:"15826956388",progress:0.65,reviewed:false,kind:"延续",checkInfo:"充填钻孔共设计 7 个，其中 A1、A2 已完工",fixInfo:"—",major:"其他",dcontrol:"否",progDesc:"过水通道治理充填项目\n1646米 已完成1300米\n充填注浆30000立方 已完成3000立方\n预计三个月完成",note:"监理项目，以项目施工监督指导、内业资料整理为主"},
{id:"p2",name:"罗田县地质灾害综合治理工程补助资金治理项目（罗田天堂寨景区崩塌治理）",type:"地质灾害治理",fund:"市县财政",amount:15.89,place:"湖北省黄冈市罗田县",status:"已完工待验收",start:"2025-10-05",end:"2026-03-31",owner:"张江南",phone:"15172058257",progress:0.9,reviewed:true,kind:"延续",checkInfo:"2025.12.25 张细香等质量检查",fixInfo:"问题 5 个，已整改 5 个",major:"其他",dcontrol:"否",progDesc:"已完工，待验收",note:"预应力锚索、被动防护网、截排水；整改回复单待盖章扫描件"},
{id:"p3",name:"稻花香万吨馫香型白酒智能化酿造基地边坡治理工程",type:"边坡治理",fund:"市县财政",amount:1340,place:"湖北省宜昌市夷陵区",status:"施工实施",start:"2025-11-24",end:"2026-06-17",owner:"马锐",phone:"18571081830",progress:0.75,reviewed:true,kind:"延续",checkInfo:"2025.11.18 刘富华、赵东质量检查",fixInfo:"问题 2 个改 2 个；3 个改 3 个；6 个改 6 个",major:"生态保护和环境治理",dcontrol:"否",progDesc:"项目目前已完工，进行内业资料整理，准备验收",note:"削方+喷锚+格构锚杆，西侧边坡已进入面层施工"},
{id:"p4",name:"阳新县龙港镇岩泉村柏树下组后山崩塌防治及石角村凤仙洞不稳定斜坡治理工程",type:"地质灾害治理",fund:"市县财政",amount:142.3,place:"湖北省黄石市阳新县",status:"已完工待验收",start:"2026-01-11",end:"2026-03-31",owner:"赖晓佩",phone:"13659845608",progress:0.95,reviewed:true,kind:"延续",checkInfo:"2026.3.5 刘富华、赵东质量检查",fixInfo:"问题 1 个，已整改 1 个",major:"生态保护和环境治理",dcontrol:"否",progDesc:"已完工，待验收",note:"已完成主体工程，等待验收"},
{id:"p5",name:"恩施州建始县长梁镇天生桥社区 5 组滑坡防治工程",type:"地质灾害治理",fund:"市县财政",amount:213,place:"湖北省恩施州建始县",status:"已完工待验收",start:"2026-03-26",end:"2026-06-30",owner:"丁勇",phone:"15007169427",progress:0.95,reviewed:true,kind:"延续",checkInfo:"2026.4.15 质量检查",fixInfo:"问题 4 个，已整改 4 个",major:"生态保护和环境治理",dcontrol:"否",progDesc:"已完工，待验收",note:"抗滑桩+截排水沟+监测工程，截至 2026.6.19 已全部完工"},
{id:"p6",name:"铁山区新能源电动汽车零部件产业园建设项目北侧边坡治理工程",type:"边坡治理",fund:"市场",amount:442.8,place:"湖北省黄石市铁山区",status:"施工实施",start:"2026-04-01",end:"2026-07-23",owner:"王丰",phone:"18271673605",progress:0.8,reviewed:true,kind:"新建",checkInfo:"2026.5.9 代小俊质量检查；5.2 另有一次",fixInfo:"问题 4 个，已整改 4 个",major:"生态保护和环境治理",dcontrol:"否",progDesc:"铁山区新能源电动汽车零部件产业园建设项目北侧边坡治理工程项目主要内容：抗滑桩+桩间板+喷坡绿化+排水沟，目前已经完成抗滑桩施工，施工桩间板\n由于设计变更，本月施工进度较少施工方案变更月底才完成。截至今日已完成工作量的80%",note:"抗滑桩桩间挡土板采用逆作法施工，QC 课题依托项目"},
{id:"p7",name:"鄂州市鄂城区马鞍山路不稳定斜坡治理工程",type:"地质灾害治理",fund:"市县财政",amount:154,place:"湖北省鄂州市鄂城区",status:"施工实施",start:"2026-05-22",end:"2026-07-28",owner:"黄志成",phone:"18163072529",progress:0.35,reviewed:true,kind:"新建",checkInfo:"2026.5.25 代小俊、马锐质量检查",fixInfo:"问题 2 个，已整改 2 个",major:"地质灾害环境治理工程施工",dcontrol:"否",progDesc:"挡土墙+格构+坡面整形，马鞍山路一号点目前已完成挡土墙和截水沟施工，二号点已完成施工。泽林点目前已完成挡土墙、格构、截水沟的修建，剩余植草砖铺设",note:"挡土墙+格构+坡面整形，一号点已完成主体"},
{id:"p8",name:"黄石市西塞山北侧崩塌等 4 处地质灾害点排危除险工程",type:"排危除险",fund:"市县财政",amount:9,place:"湖北省黄石市西塞山区",status:"施工实施",start:"2026-05-28",end:"2026-10-28",owner:"王立军",phone:"15826956388",progress:0.2,reviewed:false,kind:"新建",checkInfo:"临时防护围挡已完成，正进行坡面清理",fixInfo:"—",major:"其他",dcontrol:"否",progDesc:"1、马家嘴小学治理点已经完成。2、马家嘴后山治理点已经完成。3、西塞山景区治理点目前正在进行主动防护网锚索成孔施工。4、桐梓堡治理点已经完成土石方开挖，及挡墙基础浇筑施工。",note:"需补签质量目标管理责任书、开展公司级技术交底"}
],

/* ---------- 每月质量会议 ---------- */
meetings:[
{id:"m1",title:"2026 年一月份质量工作会议暨质量专题培训",date:"2026-01-30",form:"线上+线下",level:"公司级",place:"三楼会议室",host:"代小俊",people:30,content:"学习国务院《质量强国建设纲要》；学习《建筑边坡技术规范》；部署年度质量目标",decision:"成立质量管理领导小组，明确 7 项硬指标",status:"已归档"},
{id:"m2",title:"中大质量标准培训会（锚杆施工规范）",date:"2026-02-25",form:"线上+线下",level:"公司级",place:"三楼会议室",host:"祁骏泽",people:19,content:"学习《锚杆施工规范 GB/T 1355》，指导现场施工要点",decision:"各项目按规范复核锚杆参数",status:"已归档"},
{id:"m3",title:"2026 年三月质量工作会",date:"2026-03-26",form:"线上+线下",level:"公司级",place:"三楼会议室",host:"代小俊",people:20,content:"总结 2025 年质量工作，部署 2026 年质量工作",decision:"签订质量目标责任书",status:"已归档"},
{id:"m4",title:"中大质量标准培训会（建筑地基处理技术规范）",date:"2026-04-18",form:"线上+线下",level:"公司级",place:"三楼会议室",host:"祁骏泽",people:18,content:"学习《建筑地基处理技术规范》（JGJ 79-2012）",decision:"—",status:"已归档"},
{id:"m5",title:"2026 年五月质量工作会",date:"2026-05-22",form:"线上",level:"公司级",place:"线上会议",host:"代小俊",people:15,content:"项目经理汇报项目施工进度以及遇到的技术问题，领导给予指导意见",decision:"各项目按季度完成质量自查；内审记录限期闭环",status:"已归档"}
],

/* ---------- 质量培训 ---------- */
trainings:[
{id:"tr1",title:"《质量强国建设纲要》与建筑边坡技术规范宣贯",date:"2026-01-30",form:"集中授课",teacher:"代小俊",hours:2,people:30,cover:"全体项目部",assess:"现场提问",status:"已归档"},
{id:"tr2",title:"锚杆施工规范 GB/T 1355 专题培训",date:"2026-02-25",form:"集中授课",teacher:"祁骏泽",hours:2,people:19,cover:"铁山、稻花香",assess:"笔试",status:"已归档"},
{id:"tr3",title:"2026 年质量工作要点与台账填写规范",date:"2026-03-26",form:"集中授课",teacher:"祁骏泽",hours:2,people:20,cover:"全体项目部",assess:"台账抽查",status:"已归档"},
{id:"tr4",title:"建筑地基处理技术规范 JGJ 79-2012 培训",date:"2026-04-18",form:"集中授课",teacher:"祁骏泽",hours:2,people:18,cover:"全体项目部",assess:"现场提问",status:"已归档"},
{id:"tr5",title:"第四季度质量培训（锚杆施工规范现场实操）",date:"2026-11-18",form:"现场实操",teacher:"代小俊",hours:4,people:0,cover:"铁山、马鞍山、西塞山",assess:"现场提问 + 实操考核",status:"待开展"}
],

/* ---------- 质量活动统计（局 16 项口径）---------- */
stats:[
{id:"s1",month:"2026 年 1 月",cutoff:"2026-01-31",doneProj:0,acceptProj:0,training:1,trainPeople:30,qc:0,review:0,check:1,issues:3,fixed:3,other:0,note:""},
{id:"s2",month:"2026 年 2 月",cutoff:"2026-02-28",doneProj:0,acceptProj:0,training:1,trainPeople:19,qc:0,review:0,check:0,issues:0,fixed:0,other:0,note:""},
{id:"s3",month:"2026 年 3 月",cutoff:"2026-03-31",doneProj:0,acceptProj:0,training:1,trainPeople:20,qc:1,review:2,check:0,issues:0,fixed:0,other:0,note:"3.20 召开 QC 课题讨论会"},
{id:"s4",month:"2026 年 4 月",cutoff:"2026-04-30",doneProj:0,acceptProj:0,training:1,trainPeople:18,qc:0,review:2,check:2,issues:10,fixed:10,other:0,note:""},
{id:"s5",month:"2026 年 5 月",cutoff:"2026-05-31",doneProj:0,acceptProj:0,training:1,trainPeople:15,qc:0,review:1,check:1,issues:3,fixed:3,other:0,note:"数据来源：2026年5月质量活动统计表（中大）"}
],

/* ---------- QC 质量活动 ---------- */
qcs:[
{id:"q1",title:"降低松散地层人工挖孔桩孔壁塌孔发生率",group:"中大公司 QC 小组",type:"现场型",leader:"代小俊",members:"马锐、祁骏泽、王丰、王强、周家俊",regDate:"2026-03-30",target:"塌孔发生率由 18% 降至 5% 以下",stage:"对策实施",rate:0.7,status:"活动中",result:"拟 11 月底完成成果报告，报大队评审",note:"依托铁山项目松散地层人工挖孔桩施工"}
],

/* ---------- 质量检查 ---------- */
inspections:[
{id:"i1",no:"ZLJC-2026-001",kind:"质量问题整改通知单",date:"2025-12-25",projectId:"p2",toOrg:"队技术质量科",fixUnit:"项目部",checker:"张细香、刘富华",sendDate:"2025-12-25",receiver:"张江南",recvDate:"2025-12-26",deadline:"2026-01-06",fixOwner:"张江南",reportDate:"2026-01-06",content:"外业施工质量与内业资料完整性",conclusion:"基本合格",issueCount:5,fixedCount:5,fixStatus:"已闭环",reviewer:"祁骏泽",reviewDate:"2026-01-08",verifyResult:"已按要求整改",photos:"附整改前后对比照片 10 张",note:"整改回复单已归档"},
{id:"i2",no:"ZLJC-2025-018",kind:"质量问题整改通知单",date:"2025-11-18",projectId:"p3",toOrg:"队技术质量科",fixUnit:"项目部",checker:"刘富华、赵东",sendDate:"2025-11-18",receiver:"马锐",recvDate:"2025-11-19",deadline:"2025-12-03",fixOwner:"马锐",reportDate:"2025-12-03",content:"削方、喷锚、格构锚杆施工质量",conclusion:"基本合格",issueCount:11,fixedCount:11,fixStatus:"已闭环",reviewer:"祁骏泽",reviewDate:"2025-12-05",verifyResult:"已按要求整改",photos:"附整改前后对比照片",note:""},
{id:"i3",no:"ZLJC-2026-004",kind:"质量检查记录表",date:"2026-03-05",projectId:"p4",toOrg:"队技术质量科",fixUnit:"项目部",checker:"刘富华、赵东",sendDate:"2026-03-05",receiver:"赖晓佩",recvDate:"2026-03-06",deadline:"2026-03-18",fixOwner:"赖晓佩",reportDate:"2026-03-18",content:"崩塌防治与不稳定斜坡治理实体质量",conclusion:"合格",issueCount:1,fixedCount:1,fixStatus:"已闭环",reviewer:"祁骏泽",reviewDate:"2026-03-20",verifyResult:"已按要求整改",photos:"附整改照片",note:""},
{id:"i4",no:"ZLJC-2026-007",kind:"质量问题整改通知单",date:"2026-04-15",projectId:"p5",toOrg:"队技术质量科",fixUnit:"项目部",checker:"祁骏泽、童筱",sendDate:"2026-04-15",receiver:"丁勇",recvDate:"2026-04-16",deadline:"2026-04-26",fixOwner:"丁勇",reportDate:"2026-04-26",content:"抗滑桩、截排水沟、监测工程",conclusion:"基本合格",issueCount:4,fixedCount:4,fixStatus:"已闭环",reviewer:"代小俊",reviewDate:"2026-04-28",verifyResult:"已按要求整改",photos:"附整改前后对比照片",note:""},
{id:"i5",no:"ZLJC-2026-011",kind:"质量问题整改通知单",date:"2026-05-09",projectId:"p6",toOrg:"队技术质量科",fixUnit:"项目部",checker:"代小俊",sendDate:"2026-05-09",receiver:"王丰",recvDate:"2026-05-10",deadline:"2026-05-18",fixOwner:"王丰",reportDate:"2026-05-18",content:"抗滑桩成孔、钢筋笼制安、桩间挡土板逆作法",conclusion:"基本合格",issueCount:4,fixedCount:4,fixStatus:"已闭环",reviewer:"祁骏泽",reviewDate:"2026-05-20",verifyResult:"已按要求整改",photos:"附整改前后对比照片",note:"2026.5.2 另有一次检查，已合并归档"},
{id:"i6",no:"ZLJC-2026-014",kind:"质量问题整改通知单",date:"2026-10-20",projectId:"p7",toOrg:"队技术质量科",fixUnit:"项目部",checker:"代小俊、马锐",sendDate:"2026-10-20",receiver:"黄志成",recvDate:"2026-10-21",deadline:"2026-11-03",fixOwner:"黄志成",reportDate:"2026-11-02",content:"挡土墙砌筑、格构梁、坡面整形",conclusion:"基本合格",issueCount:2,fixedCount:1,fixStatus:"已回复待复核",reviewer:"",reviewDate:"",verifyResult:"待复核",photos:"附整改前后对比照片 6 张",note:"回复单已报送，复核时间待定"}
],

/* ---------- 检查问题 ---------- */
issues:[
{id:"w1",no:"WT-2026-001",inspectionId:"i1",projectId:"p2",desc:"预应力锚索张拉记录不完整，缺少分级张拉台账",cat:"内业资料",level:"一般",requirement:"补齐分级张拉记录与监理签证",measure:"按张拉批次回溯补齐记录，监理复核签认",deadline:"2026-01-05",finishDate:"2026-01-04",status:"已闭环",owner:"张江南"},
{id:"w2",no:"WT-2026-002",inspectionId:"i1",projectId:"p2",desc:"截排水沟局部砂浆不饱满、勾缝开裂",cat:"实体质量",level:"一般",requirement:"剔除重砌并重新勾缝",measure:"拆除开裂段 12m 重砌，勾缝养护 7 天",deadline:"2026-01-08",finishDate:"2026-01-07",status:"已闭环",owner:"张江南"},
{id:"w3",no:"WT-2025-011",inspectionId:"i2",projectId:"p3",desc:"格构梁钢筋保护层厚度不足，局部露筋",cat:"实体质量",level:"较重",requirement:"加密垫块，凿除重浇保护层",measure:"保护层不足部位凿除后采用高一等级砂浆修补",deadline:"2025-12-10",finishDate:"2025-12-08",status:"已闭环",owner:"马锐"},
{id:"w4",no:"WT-2025-012",inspectionId:"i2",projectId:"p3",desc:"喷锚面层局部厚度不达设计要求",cat:"实体质量",level:"一般",requirement:"补喷至设计厚度并插针检查",measure:"按 2m×2m 网格插针检测，不足处补喷",deadline:"2025-12-15",finishDate:"2025-12-14",status:"已闭环",owner:"马锐"},
{id:"w5",no:"WT-2025-013",inspectionId:"i2",projectId:"p3",desc:"隐蔽工程验收资料签字缺失",cat:"内业资料",level:"一般",requirement:"补齐三方签字",measure:"补签隐蔽验收记录 6 份",deadline:"2025-12-20",finishDate:"2025-12-18",status:"已闭环",owner:"马锐"},
{id:"w6",no:"WT-2026-021",inspectionId:"i3",projectId:"p4",desc:"被动防护网锚杆外露长度不一致",cat:"实体质量",level:"一般",requirement:"统一外露长度并补做防锈处理",measure:"按 100mm 统一切割，端头涂防锈漆",deadline:"2026-03-25",finishDate:"2026-03-22",status:"已闭环",owner:"赖晓佩"},
{id:"w7",no:"WT-2026-031",inspectionId:"i4",projectId:"p5",desc:"抗滑桩桩身混凝土养护记录缺失",cat:"内业资料",level:"一般",requirement:"按施工日志回溯补全养护记录",measure:"补全 24 根桩养护记录并附温湿度记录",deadline:"2026-04-30",finishDate:"2026-04-29",status:"已闭环",owner:"丁勇"},
{id:"w8",no:"WT-2026-032",inspectionId:"i4",projectId:"p5",desc:"桩间挡土板接缝渗水",cat:"实体质量",level:"较重",requirement:"接缝凿槽后用聚合物砂浆封填",measure:"凿槽 20mm 深，清洗后用聚合物砂浆封填并设泄水孔",deadline:"2026-05-05",finishDate:"2026-05-03",status:"已闭环",owner:"丁勇"},
{id:"w9",no:"WT-2026-041",inspectionId:"i5",projectId:"p6",desc:"松散地层人工挖孔桩孔壁局部塌孔",cat:"实体质量",level:"较重",requirement:"缩短单次开挖进尺，及时护壁",measure:"单次进尺控在 0.5m，护壁混凝土强度达 70% 后拆模，塌孔段回填后重挖",deadline:"2026-05-30",finishDate:"2026-05-28",status:"已闭环",owner:"王丰",note:"对应 QC 课题"},
{id:"w10",no:"WT-2026-042",inspectionId:"i5",projectId:"p6",desc:"钢筋笼主筋间距偏差超规范允许值",cat:"实体质量",level:"较重",requirement:"加设定位架并重新绑扎报验",measure:"增设 3 道定位架，间距复核合格后报验",deadline:"2026-05-30",finishDate:"2026-05-27",status:"已闭环",owner:"王丰"},
{id:"w11",no:"WT-2026-043",inspectionId:"i5",projectId:"p6",desc:"桩间挡土板逆作法分段开挖步距超出专项方案规定",cat:"方案编制",level:"较重",requirement:"严格按方案分段开挖",measure:"超步距部位回填后分层施工，现场设步距标识",deadline:"2026-06-05",finishDate:"2026-06-02",status:"已闭环",owner:"王丰"},
{id:"w12",no:"WT-2026-044",inspectionId:"i5",projectId:"p6",desc:"锚杆抗拔力检测批次不齐，部分批次未送检",cat:"材料设备",level:"较重",requirement:"按批次补做抗拔力检测并出具报告",measure:"补做 3 组抗拔力检测，委托第三方出具报告",deadline:"2026-11-10",finishDate:"",status:"整改中",owner:"王丰"},
{id:"w13",no:"WT-2026-051",seq:"问题一",inspectionId:"i6",projectId:"p7",desc:"挡土墙泄水孔堵塞、间距不均",cat:"实体质量",level:"一般",requirement:"疏通泄水孔并按设计间距补设",measure:"疏通 28 处，按 2m 间距补设 6 处",deadline:"2026-11-03",finishDate:"2026-10-28",status:"已闭环",owner:"黄志成",photo:"附整改前后对比照片",verifyResult:"已按要求整改"},
{id:"w14",no:"WT-2026-052",seq:"问题二",inspectionId:"i6",projectId:"p7",desc:"坡面整形局部不平整，超挖回填未夯实",cat:"实体质量",level:"一般",requirement:"重新整形并分层夯实",measure:"分层回填 300mm 夯实，压实度检测合格",deadline:"2026-11-03",finishDate:"2026-11-02",status:"已回复待复核",owner:"黄志成",photo:"附整改照片",verifyResult:"待复核"}
],

/* ---------- 施工方案内审记录 ---------- */
reviews:[
{id:"r1",title:"阳新县龙港镇岩泉村柏树下组后山崩塌防治及石角村凤仙洞不稳定斜坡治理工程施工组织设计",projectId:"p4",type:"施工组织设计",level:"队级",date:"2026-01-11",reviewer:"祁骏泽",count:3,conclusion:"通过",closure:"已闭环",note:"重点：抗滑桩与锚索工序衔接、截排水体系完整性"},
{id:"r2",title:"恩施州建始县长梁镇天生桥社区 5 组滑坡防治工程施工组织设计",projectId:"p5",type:"施工组织设计",level:"队级",date:"2026-04-01",reviewer:"祁骏泽",count:5,conclusion:"修改后通过",closure:"已闭环",note:"重点：抗滑桩成孔工艺、截排水沟布置、监测点布设"},
{id:"r3",title:"铁山区新能源电动汽车零部件产业园北侧边坡治理工程施工组织设计",projectId:"p6",type:"施工组织设计",level:"队级",date:"2026-04-01",reviewer:"祁骏泽",count:6,conclusion:"修改后通过",closure:"已闭环",note:"重点：人工挖孔桩护壁、桩间挡土板逆作法步距"},
{id:"r4",title:"鄂州市鄂城区马鞍山路不稳定斜坡治理工程施工组织设计",projectId:"p7",type:"施工组织设计",level:"队级",date:"2026-05-22",reviewer:"祁骏泽",count:4,conclusion:"修改后通过",closure:"整改中",note:"需补齐审查意见回复表"},
{id:"r5",title:"黄石市西塞山北侧崩塌等 4 处地质灾害点排危除险工程专项施工方案",projectId:"p8",type:"专项施工方案",level:"公司级",date:"2026-06-05",reviewer:"待指定",count:0,conclusion:"修改后通过",closure:"未开始",note:"专项方案尚未正式报审，台账提前登记"},
{id:"r6",title:"稻花香万吨馫香型白酒智能化酿造基地边坡治理工程设计成果",projectId:"p3",type:"设计成果",level:"队级",date:"2025-11-24",reviewer:"祁骏泽",count:4,conclusion:"修改后通过",closure:"已闭环",note:"重点校核削方量与支挡结构选型"}
],

/* ---------- 技术交底 ---------- */
briefings:[
{id:"b1",title:"恩施天生桥滑坡防治工程公司级开工前交底",projectId:"p5",level:"公司级",date:"2026-03-30",briefer:"祁骏泽",auditor:"代小俊",people:14,points:"抗滑桩成孔质量控制、截排水沟砌筑工艺、监测点保护",status:"已归档"},
{id:"b2",title:"铁山人工挖孔桩公司级技术交底",projectId:"p6",level:"公司级",date:"2026-04-05",briefer:"祁骏泽",auditor:"代小俊",people:18,points:"护壁混凝土强度与拆模时间、单次开挖进尺控制、孔内排水与通风",status:"已归档"},
{id:"b3",title:"阳新龙港崩塌防治工程公司级技术交底",projectId:"p4",level:"公司级",date:"2026-01-15",briefer:"祁骏泽",auditor:"代小俊",people:12,points:"锚索钻孔角度、张拉分级与锁定、防护网安装偏差控制",status:"已归档"},
{id:"b4",title:"西塞山排危除险工程公司级开工前交底",projectId:"p8",level:"公司级",date:"2026-11-08",briefer:"待指定",auditor:"代小俊",people:0,points:"坡面清理安全控制、临时防护围挡、危岩体清理工艺",status:"待交底",note:"原定 10.30 完成，已逾期，需尽快补做"}
],

/* ---------- 风险识别 ---------- */
risks:[
{id:"k1",title:"松散地层人工挖孔桩孔壁塌孔",projectId:"p6",cat:"施工工艺",level:"高",date:"2026-04-10",owner:"王丰",measure:"单次开挖进尺控在 0.5m，护壁混凝土强度达 70% 后拆模，塌孔段回填后重挖",status:"监控中",note:"已立项 QC 课题专项攻关"},
{id:"k2",title:"桩间挡土板逆作法接缝渗水",projectId:"p6",cat:"结构安全",level:"中",date:"2026-05-10",owner:"王丰",measure:"接缝凿槽后聚合物砂浆封填，背后设反滤层与泄水孔",status:"已受控",note:""},
{id:"k3",title:"锚杆抗拔力不足",projectId:"p3",cat:"材料质量",level:"中",date:"2026-03-15",owner:"马锐",measure:"按批次送检，注浆压力与水泥浆配比双控",status:"已受控",note:""},
{id:"k4",title:"雨季坡面溜坍与临时边坡失稳",projectId:"p7",cat:"环境因素",level:"高",date:"2026-05-25",owner:"黄志成",measure:"雨季前完成截水沟，边坡覆盖彩条布，设变形监测点每日观测",status:"监控中",note:""},
{id:"k5",title:"排危除险高处危岩体清理坠落",projectId:"p8",cat:"结构安全",level:"高",date:"2026-05-28",owner:"王立军",measure:"自上而下清除，设警戒区与专职监护，严禁上下交叉作业",status:"未受控",note:"需先完成三级交底后方可作业"}
],

/* ---------- 质量管理机构 ---------- */
orgs:[
{id:"o1",name:"王盼",post:"主任",org:"质量管理委员会",duty:"全面负责公司质量管理工作",since:"2025-04-22",phone:"",note:""},
{id:"o2",name:"吴勇",post:"副主任",org:"质量管理委员会",duty:"协助主任分管质量体系运行",since:"2025-04-22",phone:"",note:""},
{id:"o3",name:"张细香",post:"委员",org:"质量管理委员会",duty:"质量检查与考核",since:"2025-04-22",phone:"",note:""},
{id:"o4",name:"刘富华",post:"委员",org:"质量管理委员会",duty:"项目质量检查与整改复核",since:"2025-04-22",phone:"",note:""},
{id:"o5",name:"马锐",post:"委员",org:"质量管理委员会",duty:"市场经营与满意度调查",since:"2025-04-22",phone:"18571081830",note:""},
{id:"o6",name:"张学莲",post:"委员",org:"质量管理委员会",duty:"质量信用记录管理",since:"2025-04-22",phone:"",note:""},
{id:"o7",name:"游佳琪",post:"委员",org:"质量管理委员会",duty:"质量台账与统计报表",since:"2025-04-22",phone:"",note:""},
{id:"o8",name:"赵东",post:"委员",org:"质量管理委员会",duty:"项目质量检查",since:"2025-04-22",phone:"",note:""},
{id:"o9",name:"童筱",post:"委员",org:"质量管理委员会",duty:"质量资料归档与台账整理",since:"2025-04-22",phone:"",note:""},
{id:"o10",name:"代小俊",post:"组长 / 总经理",org:"QC小组",duty:"活动策划与组织",since:"2026-03-30",phone:"15680081687",note:"质量管理分管领导"},
{id:"o11",name:"马锐",post:"经理助理",org:"QC小组",duty:"具体策划、实施；参与调查数据分析",since:"2026-03-30",phone:"",note:""},
{id:"o12",name:"祁骏泽",post:"工程师",org:"QC小组",duty:"具体策划、实施；参与调查数据分析；方案内审",since:"2026-03-30",phone:"",note:""},
{id:"o13",name:"王丰",post:"助理工程师",org:"QC小组",duty:"具体策划、实施；参与调查数据分析",since:"2026-03-30",phone:"",note:""},
{id:"o14",name:"王强",post:"助理工程师",org:"QC小组",duty:"现场数据采集与记录",since:"2026-03-30",phone:"",note:""},
{id:"o15",name:"周家俊",post:"助理工程师",org:"QC小组",duty:"现场数据采集与记录",since:"2026-03-30",phone:"",note:""}
],

/* ---------- 作业指导书 ---------- */
guides:[
{id:"g1",title:"作业指导书（地质灾害施工）",major:"地质灾害施工",version:"现行",editor:"祁骏泽",date:"2025-11-20",status:"有效",path:"E:\\workbuddy 缓存\\workbuddy\\总工作台\\raw\\a资源\\2026公司质量管理台账\\14、作业指导书\\作业指导书(地质灾害施工）.docx",note:"铁山项目已有定稿版"},
{id:"g2",title:"地质灾害治理工程监理作业指导书",major:"地质灾害监理",version:"初稿（11月16日）",editor:"祁骏泽",date:"2025-11-16",status:"修订中",path:"E:\\workbuddy 缓存\\workbuddy\\总工作台\\raw\\a资源\\2026公司质量管理台账\\14、作业指导书\\01地质治理工程监理作业指导书（初稿11月16日）.docx",note:"尚未定稿，需本周完成"},
{id:"g3",title:"作业指导书（基坑监测）",major:"基坑监测",version:"现行",editor:"祁骏泽",date:"2025-11-20",status:"有效",path:"E:\\workbuddy 缓存\\workbuddy\\总工作台\\raw\\a资源\\2026公司质量管理台账\\14、作业指导书\\作业指导书(基坑监测）.docx",note:""},
{id:"g4",title:"作业指导书（基础施工）",major:"基础施工",version:"现行",editor:"祁骏泽",date:"2025-11-20",status:"有效",path:"E:\\workbuddy 缓存\\workbuddy\\总工作台\\raw\\a资源\\2026公司质量管理台账\\14、作业指导书\\作业指导书(基础施工） .docx",note:""},
{id:"g5",title:"作业指导书（岩土工程勘察）",major:"岩土工程勘察",version:"现行",editor:"祁骏泽",date:"2025-11-20",status:"有效",path:"E:\\workbuddy 缓存\\workbuddy\\总工作台\\raw\\a资源\\2026公司质量管理台账\\14、作业指导书\\作业指导书(岩土工程勘察）.docx",note:""}
],

/* ---------- 质量管理办法及制度 ---------- */
policies:[
{id:"y1",title:"2026 年度质量工作要点",docNo:"中大〔2026〕1 号",issuer:"湖北省中大地质基础工程勘察有限公司",pubDate:"2026-04-01",implDate:"2026-04-01",scope:"公司各部门、各项目部",status:"现行",path:"E:\\workbuddy 缓存\\workbuddy\\总工作台\\raw\\a资源\\2026公司质量管理台账\\15、质量管理办法、制度\\关于印发《湖北省中大地质基础工程勘察有限公司2026年度质量工作要点》的通知.docx",note:"7 项硬指标"},
{id:"y2",title:"2026 年质量工作任务分解清单（附件 1-4）",docNo:"",issuer:"工程技术部",pubDate:"2026-04-01",implDate:"2026-04-01",scope:"公司各部门、各项目部",status:"现行",path:"E:\\workbuddy 缓存\\workbuddy\\总工作台\\raw\\a资源\\2026公司质量管理台账\\15、质量管理办法、制度\\2026年质量工作任务分解清单.docx",note:"四个季度表，季度考核依据"},
{id:"y3",title:"首席执行官管理制度",docNo:"",issuer:"湖北省中大地质基础工程勘察有限公司",pubDate:"2025-01-01",implDate:"2025-01-01",scope:"公司全体",status:"现行",path:"E:\\workbuddy 缓存\\workbuddy\\总工作台\\raw\\a资源\\2026公司质量管理台账\\15、质量管理办法、制度\\首席执行官管理制度.docx",note:""},
{id:"y4",title:"地质五大队质量工作管理办法（2026）",docNo:"",issuer:"湖北省地质局第五地质大队",pubDate:"2026-01-01",implDate:"2026-01-01",scope:"队属各单位",status:"现行",path:"",note:"原件未随台账迁入新目录，待补充"},
{id:"y5",title:"2026 年标准落地年质量专项活动方案",docNo:"",issuer:"湖北省中大地质基础工程勘察有限公司",pubDate:"2026-03-01",implDate:"2026-03-01",scope:"公司各部门、各项目部",status:"现行",path:"E:\\workbuddy 缓存\\workbuddy\\总工作台\\raw\\a资源\\2026公司质量管理台账\\15、质量管理办法、制度\\2026年 标准落地年质量专项活动方案.docx",note:""},
{id:"y6",title:"湖北省地质局项目质量管理标准台账（暂行）",docNo:"",issuer:"湖北省地质局",pubDate:"2025-06-01",implDate:"2025-06-01",scope:"局属各项目",status:"现行",path:"",note:"项目级台账模板，共 18 类表式；原件未随台账迁入新目录，待补充"}
],

/* ---------- 待处理事项（手工登记；其余由各台账自动归集）---------- */
inbox:[],
inboxIgnore:[],

/* ---------- 文件中心（元数据，二进制存 IndexedDB）---------- */
files:[]
};

/* ---------- v2.1 兼容补齐 ----------
   「问题序号 / 整改佐证照片 / 复核结论」是依据《整改通知单》《整改回复单》
   新增的字段，v2.0 及更早的数据里没有。这里按现有状态补默认值，
   只填空值、不覆盖已有值，老数据无需迁移即可正常展示与打印。 */
(function(){
  var S=window.SEED||{};
  var CN=["一","二","三","四","五","六","七","八","九","十"];
  var cnt={};
  (S.issues||[]).forEach(function(w){
    cnt[w.inspectionId]=(cnt[w.inspectionId]||0)+1;
    if(!w.seq) w.seq="问题"+(CN[cnt[w.inspectionId]-1]||cnt[w.inspectionId]);
    if(!w.photo) w.photo=(w.status==="已闭环")?"附整改前后对比照片":"未附";
    if(!w.verifyResult) w.verifyResult=(w.status==="已闭环")?"已按要求整改":"待复核";
  });
  (S.inspections||[]).forEach(function(i){
    if(!i.kind) i.kind="质量问题整改通知单";
    if(!i.toOrg) i.toOrg="队技术质量科";
    if(!i.fixUnit) i.fixUnit="项目部";
    if(!i.sendDate) i.sendDate=i.date;
    if(!i.fixOwner) i.fixOwner=i.receiver||"";
    if(!i.verifyResult) i.verifyResult=(i.fixStatus==="已闭环")?"已按要求整改":"待复核";
    if(!i.photos) i.photos=(i.fixStatus==="已闭环")?"附整改前后对比照片":"未附";
  });
})();
