/* ===== 解析层（v1.9）：ZIP / inflate / xlsx / xls(BIFF8) / docx / pdf / 文本 =====
   零依赖实现，可在浏览器（file://）与 node 下运行（便于交叉验证）。
   出口：Parse.sniff / Parse.parse / Parse.xlDate / Parse.inflateRaw / Parse.unzip */
(function(){
"use strict";
var G = (typeof window!=="undefined") ? window : global;

/* ---------------- inflate：raw deflate 解压 ---------------- */
function inflateRaw(u8, hint){
  var src=u8, pos=0, n=u8.length;
  var out=new Uint8Array(hint>0?hint:Math.max(2048,(n*4)|0)), olen=0;
  function ensure(need){
    if(olen+need<=out.length) return;
    var cap=out.length*2; while(cap<olen+need) cap*=2;
    var nb=new Uint8Array(cap); nb.set(out.subarray(0,olen)); out=nb;
  }
  var bitbuf=0, bitcnt=0;
  function getbit(){
    if(bitcnt===0){ if(pos>=n) throw new Error("INFLATE_EOF"); bitbuf=src[pos++]; bitcnt=8; }
    var b=bitbuf&1; bitbuf>>>=1; bitcnt--; return b;
  }
  function getbits(k){ var v=0,i; for(i=0;i<k;i++) v|=getbit()<<i; return v; }
  function huff(lengths){
    var MAXB=15, count=new Array(MAXB+1), i;
    for(i=0;i<=MAXB;i++) count[i]=0;
    for(i=0;i<lengths.length;i++){ if(lengths[i]>MAXB) throw new Error("INFLATE_LEN"); count[lengths[i]]++; }
    count[0]=0;
    var offs=new Array(MAXB+2), s=0;
    for(i=1;i<=MAXB;i++){ offs[i]=s; s+=count[i]; }
    var symbol=new Array(s||1);
    for(i=0;i<lengths.length;i++){ if(lengths[i]) symbol[offs[lengths[i]]++]=i; }
    return {count:count,symbol:symbol};
  }
  function dec(h){
    var code=0, first=0, index=0, len, cnt;
    for(len=1;len<=15;len++){
      code|=getbit(); cnt=h.count[len];
      if(code-cnt<first) return h.symbol[index+(code-first)];
      index+=cnt; first+=cnt; first<<=1; code<<=1;
    }
    throw new Error("INFLATE_CODE");
  }
  var LBASE=[3,4,5,6,7,8,9,10,11,13,15,17,19,23,27,31,35,43,51,59,67,83,99,115,131,163,195,227,258];
  var LEXT=[0,0,0,0,0,0,0,0,1,1,1,1,2,2,2,2,3,3,3,3,4,4,4,4,5,5,5,5,0];
  var DBASE=[1,2,3,4,5,7,9,13,17,25,33,49,65,97,129,193,257,385,513,769,1025,1537,2049,3073,4097,6145,8193,12289,16385,24577];
  var DEXT=[0,0,0,0,1,1,2,2,3,3,4,4,5,5,6,6,7,7,8,8,9,9,10,10,11,11,12,12,13,13];
  var CLORDER=[16,17,18,0,8,7,9,6,10,5,11,4,12,3,13,2,14,1,15];
  function block(lh,dh){
    for(;;){
      var sym=dec(lh);
      if(sym<256){ ensure(1); out[olen++]=sym; }
      else if(sym===256) return;
      else{
        sym-=257;
        var len=LBASE[sym]+getbits(LEXT[sym]);
        var ds=dec(dh);
        var dist=DBASE[ds]+getbits(DEXT[ds]);
        if(!dist||dist>olen) throw new Error("INFLATE_DIST");
        ensure(len);
        for(var k=0;k<len;k++){ out[olen]=out[olen-dist]; olen++; }
      }
    }
  }
  var last=0;
  while(!last){
    last=getbit();
    var type=getbits(2), i2;
    if(type===0){
      bitbuf=0; bitcnt=0;
      if(pos+4>n) throw new Error("INFLATE_EOF");
      var len2=src[pos]|(src[pos+1]<<8); pos+=4;
      if(pos+len2>n) throw new Error("INFLATE_EOF");
      ensure(len2); out.set(src.subarray(pos,pos+len2),olen); olen+=len2; pos+=len2;
    }else if(type===1){
      var ll=new Array(288);
      for(i2=0;i2<144;i2++) ll[i2]=8;
      for(;i2<256;i2++) ll[i2]=9;
      for(;i2<280;i2++) ll[i2]=7;
      for(;i2<288;i2++) ll[i2]=8;
      var dl=new Array(30); for(i2=0;i2<30;i2++) dl[i2]=5;
      block(huff(ll),huff(dl));
    }else if(type===2){
      var hlit=getbits(5)+257, hdist=getbits(5)+1, hclen=getbits(4)+4, j;
      var cl=new Array(19); for(j=0;j<19;j++) cl[j]=0;
      for(j=0;j<hclen;j++) cl[CLORDER[j]]=getbits(3);
      var clh=huff(cl), lens=[];
      while(lens.length<hlit+hdist){
        var s=dec(clh);
        if(s<16) lens.push(s);
        else if(s===16){ var r=3+getbits(2), v=lens.length?lens[lens.length-1]:0; while(r--) lens.push(v); }
        else if(s===17){ var r2=3+getbits(3); while(r2--) lens.push(0); }
        else { var r3=11+getbits(7); while(r3--) lens.push(0); }
      }
      block(huff(lens.slice(0,hlit)), huff(lens.slice(hlit)));
    }else throw new Error("INFLATE_TYPE");
  }
  return out.subarray(0,olen);
}
/* zlib 包装（PDF FlateDecode） */
function inflateZlib(u8){
  if(u8.length<2) return u8;
  if((u8[0]&0x0f)===8) return inflateRaw(u8.subarray(2));
  return inflateRaw(u8);
}

/* ---------------- ZIP 读取 ---------------- */
function unzip(buf){
  var u = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  var dv = new DataView(u.buffer, u.byteOffset, u.byteLength);
  var eocd=-1, lo=Math.max(0,u.length-66000), i;
  for(i=u.length-22;i>=lo;i--){ if(dv.getUint32(i,true)===0x06054b50){ eocd=i; break; } }
  if(eocd<0) throw new Error("ZIP_EOCD");
  var n=dv.getUint16(eocd+10,true), cd=dv.getUint32(eocd+16,true);
  var out={}, p=cd, k;
  for(k=0;k<n;k++){
    if(p+46>u.length||dv.getUint32(p,true)!==0x02014b50) break;
    var method=dv.getUint16(p+10,true);
    var csize=dv.getUint32(p+20,true), usize=dv.getUint32(p+24,true);
    var nlen=dv.getUint16(p+28,true), elen=dv.getUint16(p+30,true), clen=dv.getUint16(p+32,true);
    var lho=dv.getUint32(p+42,true);
    var name=new TextDecoder("utf-8").decode(u.subarray(p+46,p+46+nlen));
    var ln=dv.getUint16(lho+26,true), le=dv.getUint16(lho+28,true);
    var st=lho+30+ln+le;
    var raw=u.subarray(st,st+csize);
    try{ out[name]= method===0 ? raw : inflateRaw(raw, usize); }catch(e){ out[name]=new Uint8Array(0); }
    p+=46+nlen+elen+clen;
  }
  return out;
}
function u8str(u8){
  if(!u8) return "";
  try{ return new TextDecoder("utf-8").decode(u8); }
  catch(e){ return ""; }
}
var ENT={amp:"&",lt:"<",gt:">",quot:'"',apos:"'",nbsp:" "};
function unesc(s){
  return String(s||"").replace(/&(#x?[0-9a-fA-F]+|[a-z]+);/g,function(m,g){
    if(g.charAt(0)==="#"){ var c=g.charAt(1)==="x"||g.charAt(1)==="X"?parseInt(g.slice(2),16):parseInt(g.slice(1),10); return isNaN(c)?"":String.fromCharCode(c); }
    var v=ENT[g]; return v===undefined?m:v;
  });
}
function tagText(xml, tag){
  var re=new RegExp("<"+tag+"(?:\\s[^>]*)?>([\\s\\S]*?)<\\/"+tag+">","g"), m, out=[];
  while((m=re.exec(xml))) out.push(unesc(m[1]));
  return out;
}

/* ---------------- xlsx ---------------- */
function colOf(ref){
  var m=/^([A-Z]+)/.exec(String(ref||"")); if(!m) return 0;
  var s=m[1], n=0, i;
  for(i=0;i<s.length;i++) n=n*26+(s.charCodeAt(i)-64);
  return n-1;
}
function parseXlsx(buf){
  var z=unzip(buf);
  var wbXml=u8str(z["xl/workbook.xml"]);
  var relXml=u8str(z["xl/_rels/workbook.xml.rels"]);
  var ssXml=u8str(z["xl/sharedStrings.xml"]);
  var ss=[];
  if(ssXml){
    var si=tagText(ssXml,"si");
    for(var a=0;a<si.length;a++){
      var parts=tagText(si[a],"t");
      ss.push(parts.join(""));
    }
  }
  var relMap={};
  (relXml.match(/<Relationship\b[^>]*>/g)||[]).forEach(function(t){
    var id=(/Id="([^"]+)"/.exec(t)||[])[1], tg=(/Target="([^"]+)"/.exec(t)||[])[1];
    if(id&&tg) relMap[id]=tg.replace(/^\/?xl\//,"").replace(/^\//,"");
  });
  var sheets=[];
  var shTags=wbXml.match(/<sheet\b[^>]*>/g)||[];
  shTags.forEach(function(t){
    var nm=unesc((/name="([^"]*)"/.exec(t)||[])[1]||"");
    var rid=(/r:id="([^"]+)"/.exec(t)||[])[1]||"";
    sheets.push({name:nm, path:relMap[rid]||""});
  });
  var out=[];
  sheets.forEach(function(s){
    var key="xl/"+s.path;
    var xml=u8str(z[key]) || u8str(z[s.path]);
    if(!xml) return;
    var rows=[];
    var rowRe=/<row\b([^>]*)>([\s\S]*?)<\/row>/g, rm;
    while((rm=rowRe.exec(xml))){
      var rAttr=rm[1], body=rm[2];
      var rIdx=+(/r="(\d+)"/.exec(rAttr)||[])[1]||rows.length+1;
      var cells=[];
      var cRe=/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g, cm;
      while((cm=cRe.exec(body))){
        var attr=cm[1], inner=cm[2]||"";
        var ref=(/r="([A-Z]+\d+)"/.exec(attr)||[])[1]||"";
        var ti=(/t="([^"]+)"/.exec(attr)||[])[1]||"";
        var ci=ref?colOf(ref):cells.length;
        var val=null;
        if(ti==="s"){ var vi=+/<v>([\s\S]*?)<\/v>/.exec(inner)?.[1]; val=ss[vi]; if(val===undefined) val=""; }
        else if(ti==="inlineStr"){ val=tagText(inner,"t").join(""); }
        else if(ti==="str"){ val=unesc((/<v>([\s\S]*?)<\/v>/.exec(inner)||[])[1]||""); }
        else if(ti==="b"){ val=(/<v>([\s\S]*?)<\/v>/.exec(inner)||[])[1]==="1"; }
        else{
          var vm=/<v>([\s\S]*?)<\/v>/.exec(inner);
          if(vm){ var num=parseFloat(vm[1]); val=isNaN(num)?unesc(vm[1]):num; }
        }
        if(val===null||val==="") { cells[ci]=cells[ci]||""; continue; }
        cells[ci]=val;
      }
      rows[rIdx-1]=cells;
    }
    for(var i=0;i<rows.length;i++) if(!rows[i]) rows[i]=[];
    var merges=(xml.match(/<mergeCell\b[^>]*ref="([^"]+)"/g)||[]).map(function(t){
      return (/ref="([^"]+)"/.exec(t)||[])[1];
    });
    out.push({name:s.name, rows:rows, merges:merges});
  });
  return {type:"xlsx", sheets:out};
}

/* ---------------- xls（BIFF8 / OLE2） ---------------- */
function oleStream(buf, want){
  var u = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  var dv = new DataView(u.buffer, u.byteOffset, u.byteLength);
  if(u.length<512 || dv.getUint32(0,true)!==0xE011CFD0) throw new Error("OLE_MAGIC");
  var ssz=1<<dv.getUint16(30,true), mssz=1<<dv.getUint16(32,true);
  var nFat=dv.getUint32(44,true), dirStart=dv.getUint32(48,true);
  var miniCut=dv.getUint32(56,true), miniFatStart=dv.getUint32(60,true);
  var difStart=dv.getUint32(68,true), difN=dv.getUint32(72,true);
  function off(sec){ return (sec+1)*ssz; }
  function u32(o){ return (o>=0 && o+4<=u.length) ? dv.getUint32(o,true) : 0xFFFFFFFF; }
  var END=0xFFFFFFFE, FREE=0xFFFFFFFF;
  var fatSecs=[], i;
  for(i=0;i<109;i++){
    var s=u32(76+i*4);
    if(s===FREE||s===END) break;
    fatSecs.push(s);
  }
  (function(){
    var cur=difStart, guard=0;
    while(cur!==FREE && cur!==END && guard++<10000){
      var base=off(cur);
      if(base+4>u.length) break;
      var per=(ssz/4)-1, j;
      for(j=0;j<per;j++){
        var v=u32(base+j*4);
        if(v===FREE||v===END) break;
        fatSecs.push(v);
      }
      cur=u32(base+per*4);
    }
  })();
  var fat=[];
  fatSecs.forEach(function(sec){
    var base=off(sec), j;
    if(base+ssz>u.length) return;
    for(j=0;j<ssz/4;j++) fat.push(dv.getUint32(base+j*4,true));
  });
  function chain(start){
    var out=[], cur=start, guard=0;
    while(cur!==0xFFFFFFFE && cur!==0xFFFFFFFF && guard++<200000){
      out.push(cur);
      cur=fat[cur];
      if(cur===undefined) break;
    }
    return out;
  }
  function readChain(start,size){
    var secs=chain(start), out=new Uint8Array(secs.length*ssz);
    for(var k=0;k<secs.length;k++){
      var b=off(secs[k]);
      out.set(u.subarray(b,Math.min(b+ssz,u.length)),k*ssz);
    }
    return size?out.subarray(0,size):out;
  }
  var dirBuf=readChain(dirStart);
  var entries=[], p=0;
  while(p+128<=dirBuf.length){
    var nlen=dirBuf[p+64]|(dirBuf[p+65]<<8);
    var name="";
    if(nlen>2&&nlen<=64){
      var arr=[];
      for(var c=0;c<nlen-2;c+=2) arr.push(dirBuf[p+c]|(dirBuf[p+c+1]<<8));
      name=String.fromCharCode.apply(null,arr);
    }
    var type=dirBuf[p+66];
    var start=dirBuf[p+116]|(dirBuf[p+117]<<8)|(dirBuf[p+118]<<16)|(dirBuf[p+119]<<24);
    var size=dirBuf[p+120]|(dirBuf[p+121]<<8)|(dirBuf[p+122]<<16)|(dirBuf[p+123]<<24);
    entries.push({name:name,type:type,start:start,size:size>>>0});
    p+=128;
  }
  var root=entries.filter(function(e){return e.type===5;})[0];
  /* 严格按名匹配：之前"找不到就退回第一个流"会让调用方拿到无关数据（如把
     SummaryInformation 当成 1Table），症状是文本全乱码且极难定位 */
  var lw=String(want||"").toLowerCase();
  var target=entries.filter(function(e){return e.type===2&&e.name.toLowerCase()===lw;})[0];
  if(!target) return null;
  if(target.size<miniCut && root){
    var mini=readChain(root.start, 0);
    var mfat=[];
    var msecs=chain(miniFatStart);
    for(var mi=0;mi<msecs.length;mi++){
      var mb=off(msecs[mi]), mj;
      if(mb+ssz>u.length) continue;
      for(mj=0;mj<ssz/4;mj++) mfat.push(dv.getUint32(mb+mj*4,true));
    }
    var outM=new Uint8Array(target.size), curM=target.start, oM=0, g=0;
    while(curM!==0xFFFFFFFE && curM!==0xFFFFFFFF && g++<200000){
      var src=curM*mssz;
      if(src>=mini.length) break;
      var take=Math.min(mssz, target.size-oM);
      outM.set(mini.subarray(src,src+take),oM);
      oM+=take;
      curM=mfat[curM];
      if(curM===undefined) break;
    }
    return outM;
  }
  return readChain(target.start, target.size);
}
function rkNum(v){
  /* bit0=fX100（除以 100），bit1=fInt（整数，值=rk>>2）；两位都为 0 时为浮点 */
  var d;
  if(v&2) d=(v>>2);
  else{
    var hi=(v&0xFFFFFFFC)>>>0;
    var b=new Uint8Array(8), dv2=new DataView(b.buffer);
    dv2.setUint32(0,0,true);
    dv2.setUint32(4,hi,true);
    d=dv2.getFloat64(0,true);
  }
  return (v&1) ? d/100 : d;
}
function parseXls(buf){
  /* Excel 97 起叫 Workbook，Excel 5.0/95 叫 Book */
  var wb=oleStream(buf,"Workbook")||oleStream(buf,"Book");
  if(!wb) throw new Error("XLS_NOWB");
  var dv=new DataView(wb.buffer,wb.byteOffset,wb.byteLength);
  var pos=0, sheets=[], cur=null, sst=[], pendingSST=null, sstBoundary=[];
  var names=[];

  function records(){
    while(pos+4<=wb.length){
      var type=dv.getUint16(pos,true), len=dv.getUint16(pos+2,true);
      var body=wb.subarray(pos+4, pos+4+len);
      yieldRec(type, body);
      pos += 4+len;
    }
  }
  function yieldRec(type, body){
    if(type===0x0809 && body.length>=4){
      var dt=(body[2]|(body[3]<<8));
      if(dt===0x0010){
        cur={name:"", rows:[]};
        sheets.push(cur);
      }
    }else if(type===0x0085){
      /* lbPlyPos(4) + grbit(2) 之后才是 ShortXLUnicodeString */
      var cch=body[6], fl=body[7], nm="", i;
      /* grbit bit0 = fHighByte：1 表示 UTF-16，0 表示单字节 */
      if(fl&1){
        var arr=[];
        for(i=0;i<cch;i++) arr.push(body[8+i*2]|(body[9+i*2]<<8));
        nm=String.fromCharCode.apply(null,arr);
      }else{
        nm=new TextDecoder("latin1").decode(body.subarray(8,8+cch));
      }
      names.push(nm);
    }else if(type===0x00FC){
      pendingSST={chunks:[body.slice()], bounds:[], done:false};
      sstBoundary=[];
    }else if(type===0x003C && pendingSST){
      sstBoundary.push(pendingSST.chunks.reduce(function(s,c){return s+c.length;},0));
      pendingSST.chunks.push(body.slice());
    }else if(type===0x000A && pendingSST && !pendingSST.done){
      try{ sst=parseSST(pendingSST.chunks, sstBoundary); }catch(e){ sst=[]; }
      pendingSST.done=true;
    }else if(cur){
      var r=null, c=0, val=null;
      if(type===0x00FD && body.length>=10){
        r=dvU16(body,0); c=dvU16(body,2);
        var isst=dvU32(body,6);
        val=sst[isst]!==undefined?sst[isst]:"";
      }else if(type===0x0203 && body.length>=14){
        r=dvU16(body,0); c=dvU16(body,2);
        val=dvF64(body,6);
      }else if(type===0x027E && body.length>=10){
        r=dvU16(body,0); c=dvU16(body,2);
        val=rkNum(dvU32(body,6));
      }else if(type===0x00BD && body.length>=6){
        r=dvU16(body,0);
        var n=(body.length-6)/6;
        for(var k=0;k<n;k++){
          var cc=dvU16(body,2+k*6);
          setCell(cur, r, cc, rkNum(dvU32(body,4+k*6)));
        }
        return;
      }else if(type===0x0204 && body.length>=8){
        r=dvU16(body,0); c=dvU16(body,2);
        var l=body[6], fl2=body[7];
        if(fl2&1) val=new TextDecoder("latin1").decode(body.subarray(8,8+l));
        else{
          var ar=[];
          for(var q=0;q<l;q++) ar.push(body[8+q*2]|(body[9+q*2]<<8));
          val=String.fromCharCode.apply(null,ar);
        }
      }else if(type===0x0006 && body.length>=20){
        r=dvU16(body,0); c=dvU16(body,2);
        var fv=dvF64(body,6);
        if(!isNaN(fv)) val=fv;
      }
      if(r!==null && val!==null) setCell(cur,r,c,val);
    }
  }
  function dvU16(b,o){ return b[o]|(b[o+1]<<8); }
  function dvU32(b,o){ return (b[o]|(b[o+1]<<8)|(b[o+2]<<16)|(b[o+3]<<24))>>>0; }
  function dvF64(b,o){ var t=new Uint8Array(8); t.set(b.subarray(o,o+8)); return new DataView(t.buffer).getFloat64(0,true); }
  function setCell(sh,r,c,v){
    if(!sh.rows[r]) sh.rows[r]=[];
    sh.rows[r][c]=v;
  }
  records();
  for(var i=0;i<sheets.length;i++){
    sheets[i].name=names[i]||("Sheet"+(i+1));
    var rows=sheets[i].rows;
    for(var j=0;j<rows.length;j++) if(!rows[j]) rows[j]=[];
    sheets[i].merges=[];
  }
  return {type:"xls", sheets:sheets};
}
/* SST 跨 CONTINUE 解析（按 POI 规则：跨记录时读 1 字节 grbit） */
function parseSST(chunks, bounds){
  var buf=new Uint8Array(chunks.reduce(function(s,c){return s+c.length;},0));
  var o=0;
  chunks.forEach(function(c){ buf.set(c,o); o+=c.length; });
  var dv=new DataView(buf.buffer,buf.byteOffset,buf.byteLength);
  var total=dv.getUint32(0,true), uniq=dv.getUint32(4,true);
  var p=8, out=[], bi=0;
  function nextBoundary(){
    while(bi<bounds.length && bounds[bi]<=p) bi++;
    return bi<bounds.length?bounds[bi]:Infinity;
  }
  function readU8(){ return buf[p++]; }
  function readU16(){ var v=buf[p]|(buf[p+1]<<8); p+=2; return v; }
  function readU32(){ var v=(buf[p]|(buf[p+1]<<8)|(buf[p+2]<<16)|(buf[p+3]<<24))>>>0; p+=4; return v; }
  for(var s=0;s<uniq && p<buf.length;s++){
    var cch=readU16(), fl=readU8();
    /* grbit bit0 = fHighByte：0 表示单字节压缩，1 表示 UTF-16 */
    var rich=(fl&8)?1:0, fe=(fl&4)?1:0, comp=(fl&1)?0:1;
    var cRun=rich?readU16():0;
    var cbExt=fe?readU32():0;
    var str="", left=cch, need=comp?1:2;
    while(left>0){
      var bd=nextBoundary();
      var avail = comp ? Math.floor((bd-p)/1) : Math.floor((bd-p)/2);
      if(avail<=0){
        /* 跨到下一个 CONTINUE：读新 grbit */
        if(bi>=bounds.length) break;
        bi++;
        var nf=readU8();
        comp=(nf&1)?0:1;
        continue;
      }
      var take=Math.min(left,avail), i;
      if(comp){
        for(i=0;i<take;i++) str+=String.fromCharCode(buf[p+i]);
        p+=take;
      }else{
        for(i=0;i<take;i++) str+=String.fromCharCode(buf[p+i*2]|(buf[p+i*2+1]<<8));
        p+=take*2;
      }
      left-=take;
    }
    if(cRun) p+=cRun*4;
    if(cbExt) p+=cbExt;
    out.push(str);
  }
  return out;
}

/* ---------------- docx ---------------- */
function parseDocx(buf){
  var z=unzip(buf);
  var xml=u8str(z["word/document.xml"]);
  if(!xml) throw new Error("DOCX_NODOC");
  xml=xml.replace(/<w:tab\b[^>]*\/>/g,"\t").replace(/<w:br\b[^>]*\/>/g,"\n");
  var blocks=[], re=/<w:tbl\b[\s\S]*?<\/w:tbl>|<w:p\b[\s\S]*?<\/w:p>/g, m;
  while((m=re.exec(xml))){
    var seg=m[0];
    if(seg.indexOf("<w:tbl")===0){
      var rows=[];
      (seg.match(/<w:tr\b[\s\S]*?<\/w:tr>/g)||[]).forEach(function(tr){
        var cells=[];
        (tr.match(/<w:tc\b[\s\S]*?<\/w:tc>/g)||[]).forEach(function(tc){
          cells.push(tagText(tc,"w:t").join(""));
        });
        rows.push(cells);
      });
      blocks.push({t:"tbl", rows:rows});
    }else{
      var txt=tagText(seg,"w:t").join("");
      if(seg.indexOf("<w:tab")<0 && seg.indexOf("\t")<0){}
      blocks.push({t:"p", text:txt});
    }
  }
  var text=blocks.map(function(b){ return b.t==="p"?b.text:b.rows.map(function(r){return r.join("\t");}).join("\n"); }).join("\n");
  return {type:"docx", blocks:blocks, text:text};
}

/* ---------------- Word 97-2003 (.doc，OLE2 二进制) ----------------
   只取正文文本：表格结构需要 PAPX/TCG 解析，成本过高且收益有限，
   会议记录/整改回复这类文件靠正文即可支撑要素抽取。 */
function u16le(u,o){ return (u[o]|(u[o+1]<<8))&0xFFFF; }
function u32le(u,o){ return (u[o]|(u[o+1]<<8)|(u[o+2]<<16)|(u[o+3]<<24))>>>0; }
function cpDecode(u8){
  try{ return new TextDecoder("gbk").decode(u8); }
  catch(e){ try{ return new TextDecoder("utf-8").decode(u8); }catch(e2){ return latin1(u8); } }
}
function stripCtl(t){
  return String(t||"")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g,"")
    .replace(/\r\n?/g,"\n").replace(/\n{3,}/g,"\n\n");
}
/* CLX → 片段表（fComplex 文档的正文分散在多个片段里） */
function wordPieces(wd,tbl){
  if(!tbl||wd.length<0x1AA) return "";
  var fcClx=u32le(wd,0x01A2), lcbClx=u32le(wd,0x01A6);
  if(!lcbClx||fcClx+lcbClx>tbl.length) return "";
  var clx=tbl.subarray(fcClx,fcClx+lcbClx), i=0, guard=0;
  while(i<clx.length&&guard++<64){
    if(clx[i]===0x01){ var cbp=u16le(clx,i+1); i+=3+cbp; continue; }
    if(clx[i]!==0x02) break;
    var lcb=u32le(clx,i+1);
    if(!lcb||i+5+lcb>clx.length+1) break;
    var plc=clx.subarray(i+5,i+5+lcb);
    var n=Math.floor((lcb-4)/12);
    if(n<=0||plc.length<4*(n+1)+8*n) break;
    var out=[];
    for(var k=0;k<n;k++){
      var cpS=u32le(plc,k*4), cpE=u32le(plc,(k+1)*4);
      var pcdAt=4*(n+1)+k*8;
      var fc=u32le(plc,pcdAt+2);
      var comp=!!(fc&0x40000000);
      var off=(fc&0x3FFFFFFF)>>>0;
      var len=cpE-cpS;
      if(len<=0||len>40000000) continue;
      if(comp){
        off=off>>>1;
        if(off+len<=wd.length) out.push(cpDecode(wd.subarray(off,off+len)));
      }else{
        if(off+len*2<=wd.length){
          try{ out.push(new TextDecoder("utf-16le").decode(wd.subarray(off,off+len*2))); }catch(e){}
        }
      }
    }
    return out.join("");
  }
  return "";
}
/* 正文编码自判：ANSI(cp936) 与 UTF-16LE 都可能出现，按"常用汉字占比"择优 */
function cjkScore(t){
  if(!t) return -1;
  var n=Math.min(t.length,3000), good=0, i, c;
  for(i=0;i<n;i++){
    c=t.charCodeAt(i);
    if((c>=0x4E00&&c<=0x9FFF)||(c>=0x3000&&c<=0x303F)||(c>=0xFF00&&c<=0xFF65)) good++;
    else if(c>=0x20&&c<0x7F) good+=0.6;
    else if(c===0xFFFD||(c>=0xE000&&c<=0xF8FF)) good-=1;
  }
  return good/n;
}
function guessDecode(u8){
  if(!u8||!u8.length) return "";
  var a=cpDecode(u8), b="";
  try{ b=new TextDecoder("utf-16le").decode(u8); }catch(e){ b=""; }
  return cjkScore(b)>cjkScore(a)?b:a;
}
/* RTF（常见于伪装成 .doc 的导出件）轻量取文：足够支撑要素抽取 */
function rtfText(u){
  var s=latin1(u), out=[], bytes=[], i=0, depth=0, skip=-1;
  function flush(){
    if(!bytes.length) return;
    out.push(cpDecode(new Uint8Array(bytes)));
    bytes=[];
  }
  var SKIP={fonttbl:1,colortbl:1,stylesheet:1,info:1,pict:1,object:1,header:1,footer:1,
            fldinst:1,listtable:1,listoverridetable:1,rsidtbl:1,generator:1,themedata:1,
            datastore:1,latentstyles:1,xmlnstbl:1};
  while(i<s.length){
    var c=s.charAt(i);
    if(c==="{"){
      depth++;
      if(skip<0&&s.slice(i,i+3)==="{\\*"){ skip=depth; }
      i++; continue;
    }
    if(c==="}"){
      depth--;
      if(skip>=0&&depth<skip) skip=-1;   /* 退出被跳过的组 */
      i++; continue;
    }
    if(c==="\\"){
      var hm=i+3<s.length?s.substr(i,4):"";
      if(hm.charAt(1)==="'"&&/^[0-9a-fA-F]{2}$/.test(hm.substr(2,2))){
        if(skip<0) bytes.push(parseInt(hm.substr(2,2),16));
        i+=4; continue;
      }
      var m=/^\\([a-zA-Z]+)(-?\d+)?/.exec(s.slice(i,i+32));
      if(!m){ i+=2; continue; }
      var w=m[1];
      if(SKIP[w]){ if(skip<0) skip=depth; i+=m[0].length; continue; }
      if(skip<0){
        if(w==="par"||w==="row"||w==="sect"||w==="page"||w==="line"){ flush(); out.push("\n"); }
        else if(w==="tab"||w==="cell"){ flush(); out.push("\t"); }
        else if(w==="u"&&m[2]!==undefined){
          flush();
          var cp=+m[2]; if(cp<0) cp+=65536;
          out.push(String.fromCharCode(cp));
          i+=m[0].length;
          if(s.charAt(i)==="?") i++;      /* \uN 后跟一个替代字符 */
          continue;
        }
      }
      i+=m[0].length; continue;
    }
    if(c==="\r"||c==="\n"){ i++; continue; }
    if(skip<0){ flush(); out.push(c); }
    i++;
  }
  flush();
  return out.join("");
}
function parseDoc(buf){
  var u = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  /* 伪 .doc：内容是 RTF 的情况在实际台账里很常见 */
  if(u.length>8&&u[0]===0x7B&&u[1]===0x5C&&u[2]===0x72&&u[3]===0x74){
    var rt=stripCtl(rtfText(u));
    if(!rt) throw new Error("RTF_NOTEXT");
    return {type:"doc", text:rt, rtf:true, complex:false};
  }
  if(u.length<512||u[0]!==0xD0||u[1]!==0xCF) throw new Error("NOT_OLE");
  var wd=oleStream(u,"WordDocument");
  if(!wd||wd.length<0x200) throw new Error("DOC_NOWD");
  var flags=u16le(wd,0x0A);
  var fComplex=!!(flags&0x0004);
  var text="";
  if(fComplex){
    /* flags bit9 = fWhichTblStm，决定正文片段表放在 1Table 还是 0Table */
    var want=(flags&0x0200)?"1Table":"0Table";
    var tbl=oleStream(u,want)||oleStream(u,want==="1Table"?"0Table":"1Table");
    try{ text=wordPieces(wd,tbl); }catch(e){ text=""; }
  }
  /* 片段表失败或解出来"不像中文"时，退到 fcMin..fcMac 再试一次并择优 */
  if(!text || cjkScore(text)<0.15){
    var fcMin=u32le(wd,0x18), fcMac=u32le(wd,0x1C);
    if(fcMac>fcMin&&fcMac<=wd.length){
      var alt=guessDecode(wd.subarray(fcMin,fcMac));
      if(cjkScore(alt)>cjkScore(text)) text=alt;
    }
  }
  text=stripCtl(text);
  if(!text) throw new Error("DOC_NOTEXT");
  return {type:"doc", text:text, complex:fComplex};
}

/* ---------------- PDF 文本 ---------------- */
function latin1(u8){ return new TextDecoder("latin1").decode(u8); }
function strBytes(t){
  var a=new Uint8Array(t.length);
  for(var i=0;i<t.length;i++) a[i]=t.charCodeAt(i)&255;
  return a;
}
/* PDF 字面串的转义还原：\n \r \t \b \f \( \) \\ 与 \ooo 八进制，以及续行 */
function pdfLit(bytes){
  if(!bytes||!bytes.length) return bytes||new Uint8Array(0);
  var out=new Uint8Array(bytes.length), n=0, i=0;
  var ESC={0x6E:0x0A,0x72:0x0D,0x74:0x09,0x62:0x08,0x66:0x0C,
           0x28:0x28,0x29:0x29,0x5C:0x5C};
  while(i<bytes.length){
    var b=bytes[i];
    if(b!==0x5C||i+1>=bytes.length){ out[n++]=b; i++; continue; }
    var c=bytes[i+1];
    if(c>=0x30&&c<=0x37){
      var v=0,k=0;
      while(k<3&&i+1+k<bytes.length){
        var d=bytes[i+1+k];
        if(d<0x30||d>0x37) break;
        v=v*8+(d-0x30); k++;
      }
      out[n++]=v&0xFF; i+=1+k; continue;
    }
    if(ESC[c]!==undefined){ out[n++]=ESC[c]; i+=2; continue; }
    if(c===0x0D){ i+=2; if(i<bytes.length&&bytes[i]===0x0A) i++; continue; }
    if(c===0x0A){ i+=2; continue; }
    out[n++]=c; i+=2;
  }
  return out.subarray(0,n);
}
/* 对象表：num -> {a,b} 绝对偏移，或 {seg}（对象流展开后的正文） */
function pdfObjects(u,s){
  var map={}, re=/(\d+)\s+0\s+obj\b/g, m, nums=[];
  while((m=re.exec(s))){
    var a=m.index+m[0].length;
    var b=s.indexOf("endobj",a);
    if(b<0) b=Math.min(s.length,a+4000000);
    map[+m[1]]={a:a,b:b}; nums.push(+m[1]);
  }
  nums.forEach(function(num){
    var o=map[num]; if(!o||o.a===undefined) return;
    var dict=s.slice(o.a,Math.min(o.b,o.a+4000));
    if(dict.indexOf("/ObjStm")<0) return;
    var st=s.indexOf("stream",o.a);
    if(st<0||st>o.b) return;
    var bs=st+6;
    while(bs<o.b&&(s.charAt(bs)==="\r"||s.charAt(bs)==="\n")) bs++;
    var en=s.indexOf("endstream",bs);
    if(en<0) return;
    var text="";
    try{ text=/FlateDecode/.test(dict)?latin1(inflateZlib(u.subarray(bs,en))):s.slice(bs,en); }catch(e){ return; }
    var n=+(/\/N\s+(\d+)/.exec(dict)||[])[1]||0;
    var first=+(/\/First\s+(\d+)/.exec(dict)||[])[1]||0;
    if(!n) return;
    var head=text.slice(0,first).trim().split(/\s+/);
    for(var i=0;i<n;i++){
      var on=+head[i*2], off=+head[i*2+1];
      var next=(i+1<n)?+head[(i+1)*2+1]:(text.length-first);
      if(isNaN(on)||isNaN(off)||isNaN(next)) break;
      if(!map[on]) map[on]={seg:text.slice(first+off,first+next)};
    }
  });
  return map;
}
/* 取对象正文：字典 + 已解压流 */
function objBody(u,s,o){
  if(!o) return "";
  if(o.seg!==undefined) return o.seg;
  var st=s.indexOf("stream",o.a);
  if(st<0||st>o.b) return s.slice(o.a,o.b);
  var dict=s.slice(o.a,st);
  var bs=st+6;
  while(bs<o.b&&(s.charAt(bs)==="\r"||s.charAt(bs)==="\n")) bs++;
  var en=s.indexOf("endstream",bs);
  if(en<0) return dict;
  try{ return /FlateDecode/.test(dict)?latin1(inflateZlib(u.subarray(bs,en))):s.slice(bs,en); }
  catch(e){ return ""; }
}
function cmapParse(text){
  var map={};
  if(!text) return map;
  var bf=/beginbfchar([\s\S]*?)endbfchar/g, mm;
  while((mm=bf.exec(text))){
    var re=/<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]*)>/g, pm;
    while((pm=re.exec(mm[1]))){
      var src=parseInt(pm[1],16), dst=pm[2], str="";
      for(var i=0;i<dst.length;i+=4){
        var cp=parseInt(dst.substr(i,4),16);
        if(!isNaN(cp)&&cp) str+=String.fromCharCode(cp);
      }
      if(!isNaN(src)&&str) map[src]=str;
    }
  }
  var br=/beginbfrange([\s\S]*?)endbfrange/g, mr;
  while((mr=br.exec(text))){
    var trip=/<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>/g, tm;
    while((tm=trip.exec(mr[1]))){
      var A=parseInt(tm[1],16), B=parseInt(tm[2],16), C=parseInt(tm[3],16);
      if(isNaN(A)||isNaN(B)||isNaN(C)||B<A||B-A>8192) continue;
      for(var q=A;q<=B;q++) map[q]=String.fromCharCode(C+(q-A));
    }
  }
  return map;
}
/* 资源名（/F1）→ ToUnicode 码表 */
function pdfFonts(u,s,objs){
  var n2o={}, re=/\/Font\s*<<([\s\S]{0,3000}?)>>/g, m;
  while((m=re.exec(s))){
    var pr=/\/([A-Za-z0-9#]+)\s+(\d+)\s+0\s+R/g, pm;
    while((pm=pr.exec(m[1]))) n2o[pm[1]]=+pm[2];
  }
  var out={};
  Object.keys(n2o).forEach(function(nm){
    var o=objs[n2o[nm]]; if(!o) return;
    var dict=objBody(u,s,o)||"";
    var tu=/\/ToUnicode\s+(\d+)\s+0\s+R/.exec(dict);
    if(!tu) return;
    var mp=cmapParse(objBody(u,s,objs[+tu[1]]));
    if(Object.keys(mp).length) out[nm]=mp;
  });
  return out;
}
function hexBytes(h){
  h=String(h||"").replace(/[^0-9a-fA-F]/g,"");
  if(h.length%2) h+="0";
  var out=new Uint8Array(h.length/2);
  for(var i=0;i<out.length;i++) out[i]=parseInt(h.substr(i*2,2),16)||0;
  return out;
}
function pdfDecode(bytes,map){
  var i,n=(bytes.length/2)|0,hit=0;
  if(map&&n>0){
    for(i=0;i<n;i++) if(map[(bytes[i*2]<<8)|bytes[i*2+1]]!==undefined) hit++;
    if(hit>=Math.max(1,Math.ceil(n*0.5))){
      var o="";
      for(i=0;i<n;i++){ var c=map[(bytes[i*2]<<8)|bytes[i*2+1]]; o+=c===undefined?"":c; }
      return o;
    }
  }
  var o2="",h1=0;
  for(i=0;i<bytes.length;i++) if(map&&map[bytes[i]]!==undefined) h1++;
  if(bytes.length&&map&&h1>=Math.ceil(bytes.length*0.5)){
    for(i=0;i<bytes.length;i++){ var c2=map[bytes[i]]; o2+=c2===undefined?"":c2; }
    return o2;
  }
  /* 无可用码表：控制字符占比过高说明是 CID 双字节，宁缺毋滥 */
  var bad=0;
  for(i=0;i<bytes.length;i++){ var b=bytes[i]; if(b<0x20&&b!==0x0A&&b!==0x0D&&b!==0x09) bad++; }
  if(bytes.length&&bad/bytes.length>0.3) return "";
  return latin1(bytes);
}
function litEnd(t,at){
  var i=at+1,depth=0;
  while(i<t.length){
    var c=t.charAt(i);
    if(c==="\\"){ i+=2; continue; }
    if(c==="(") depth++;
    else if(c===")"){ depth--; if(depth===0) return i; }
    i++;
  }
  return -1;
}
function tjArray(seg,map){
  var out="",i=0;
  while(i<seg.length){
    var c=seg.charAt(i);
    if(c==="("){
      var e=litEnd(seg,i); if(e<0) break;
      out+=pdfDecode(pdfLit(strBytes(seg.slice(i+1,e))),map);
      i=e+1;
    }else if(c==="<"){
      var e2=seg.indexOf(">",i); if(e2<0) break;
      out+=pdfDecode(hexBytes(seg.slice(i+1,e2)),map);
      i=e2+1;
    }else i++;
  }
  return out;
}
function pdfText(content,fonts){
  var out="", cur=null;
  var re=/\/([A-Za-z0-9#]+)\s+[-\d.]+\s+Tf|\(((?:\\.|[^\\()])*)\)\s*(?:Tj|'|")|<([0-9a-fA-F\s]*)>\s*Tj|\[((?:[^\[\]\\]|\\.)*)\]\s*TJ/g, m;
  while((m=re.exec(content))){
    if(m[1]!==undefined){ cur=fonts[m[1]]||null; }
    else if(m[2]!==undefined){ out+=pdfDecode(pdfLit(strBytes(m[2])),cur); }
    else if(m[4]!==undefined){ out+=pdfDecode(hexBytes(m[4]),cur); }
    else if(m[5]!==undefined){
      var seg=m[5], after=content.charAt(re.lastIndex-2);
      out+=tjArray(seg,cur);
      if(after==="'") out+="\n";
    }
  }
  return out;
}
function parsePdf(buf){
  var u = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  var s = latin1(u);
  var res={type:"pdf",text:"",pages:0,fonts:0,images:0,scan:true,err:""};
  if(s.indexOf("%PDF")<0){ res.err="NOT_PDF"; return res; }
  res.pages=(s.match(/\/Type\s*\/Page[^s]/g)||[]).length;
  res.images=(s.match(/\/Subtype\s*\/Image/g)||[]).length;
  var objs={}, fonts={};
  try{ objs=pdfObjects(u,s); fonts=pdfFonts(u,s,objs); }catch(e){}
  res.fonts=Object.keys(fonts).length;
  var chunks=[], i=0, guard=0;
  while((i=s.indexOf("stream",i))>=0 && guard++<6000){
    var objAt=s.lastIndexOf(" obj",i);
    var dict=objAt>=0?s.slice(objAt,i):s.slice(Math.max(0,i-400),i);
    var st=i+6;
    if(s.charAt(st)==="\r") st++;
    if(s.charAt(st)==="\n") st++;
    var e=s.indexOf("endstream",st);
    if(e<0) break;
    if(!/\/Image|DCTDecode|JPXDecode|CCITTFaxDecode|JBIG2Decode/.test(dict)){
      var out=null;
      try{ out=/FlateDecode/.test(dict)?inflateZlib(u.subarray(st,e)):u.subarray(st,e); }catch(err){ out=null; }
      if(out&&out.length){
        var t=latin1(out);
        if(t.indexOf("BT")>=0&&(t.indexOf("TJ")>=0||t.indexOf("Tj")>=0)) chunks.push(t);
      }
    }
    i=e+9;
  }
  var text=chunks.map(function(t){ return pdfText(t,fonts); }).join("\n");
  /* 未映射字体产生的控制字符直接剔除，避免污染字段 */
  text=text.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFD]/g,"")
           .replace(/[ \t]{2,}/g," ").replace(/\n{3,}/g,"\n\n").trim();
  res.text=text;
  var cjk=(text.match(/[\u4e00-\u9fa5]/g)||[]).length;
  res.cjk=cjk;
  res.scan = cjk<8;
  if(res.scan) res.err="NO_TEXT_LAYER";
  return res;
}

/* ---------------- 入口 ---------------- */
var EXT={
  xlsx:"table", xls:"table", csv:"table", tsv:"table",
  docx:"doc", doc:"doc", pdf:"pdf",
  txt:"text", md:"text", json:"text", log:"text",
  jpg:"img", jpeg:"img", png:"img", gif:"img", bmp:"img", webp:"img", tif:"img", tiff:"img", heic:"img",
  zip:"other", rar:"other", "7z":"other", lnk:"other", db:"other"
};
function extOf(name){ var m=/\.([a-z0-9]+)$/i.exec(String(name||"")); return m?m[1].toLowerCase():""; }
function sniff(name){ return EXT[extOf(name)]||"other"; }
function decodeText(u8){
  var u=u8;
  if(u.length>=3&&u[0]===0xEF&&u[1]===0xBB&&u[2]===0xBF){ try{ return new TextDecoder("utf-8").decode(u.subarray(3)); }catch(e){} }
  try{ return new TextDecoder("utf-8",{fatal:true}).decode(u); }
  catch(e){
    try{ return new TextDecoder("gbk").decode(u); }catch(e2){ return new TextDecoder("utf-8").decode(u); }
  }
}
function parseCsv(text){
  var rows=[], row=[], cell="", q=false, i=0;
  for(;i<text.length;i++){
    var c=text.charAt(i);
    if(q){
      if(c==='"'){ if(text.charAt(i+1)==='"'){ cell+='"'; i++; } else q=false; }
      else cell+=c;
    }else{
      if(c==='"') q=true;
      else if(c===","||c==="\t"){ row.push(cell); cell=""; }
      else if(c==="\n"){ row.push(cell); rows.push(row); row=[]; cell=""; }
      else if(c==="\r"){}
      else cell+=c;
    }
  }
  if(cell!==""||row.length){ row.push(cell); rows.push(row); }
  return {type:"csv", sheets:[{name:"CSV", rows:rows.map(function(r){
    return r.map(function(v){ var n=parseFloat(v); return (v!==""&&!isNaN(n)&&/^-?\d+(\.\d+)?$/.test(v))?n:v; });
  }), merges:[]}]};
}
/* Excel 序列号 → YYYY-MM-DD */
function xlDate(v){
  var n=+v; if(isNaN(n)||n<20000||n>80000) return "";
  var d=new Date(Date.UTC(1899,11,30)+n*86400000);
  if(isNaN(d.getTime())) return "";
  var p=function(x){return x<10?"0"+x:""+x;};
  return d.getUTCFullYear()+"-"+p(d.getUTCMonth()+1)+"-"+p(d.getUTCDate());
}
function parse(name, buf){
  var kind=sniff(name);
  var e=extOf(name);
  /* Word/Excel 打开时生成的 ~$ 锁文件不是正文，直接跳过 */
  if(/^~\$/.test(String(name||""))) return {type:"temp", text:""};
  try{
    if(kind==="table"){
      if(e==="xlsx") return parseXlsx(buf);
      if(e==="xls") return parseXls(buf);
      return parseCsv(decodeText(buf instanceof Uint8Array?buf:new Uint8Array(buf)));
    }
    if(kind==="doc") return e==="doc"?parseDoc(buf):parseDocx(buf);
    if(kind==="pdf") return parsePdf(buf);
    if(kind==="text") return {type:"text", text:decodeText(buf instanceof Uint8Array?buf:new Uint8Array(buf))};
    return {type:"other", text:""};
  }catch(err){
    return {type:"err", err:(err&&err.message)||String(err), text:""};
  }
}

G.Parse={
  inflateRaw:inflateRaw, inflateZlib:inflateZlib, unzip:unzip, unesc:unesc,
  parseXlsx:parseXlsx, parseXls:parseXls, parseDocx:parseDocx, parseDoc:parseDoc,
  parsePdf:parsePdf, parseCsv:parseCsv, decodeText:decodeText, sniff:sniff, extOf:extOf,
  xlDate:xlDate, parse:parse, oleStream:oleStream
};
if(typeof module!=="undefined"&&module.exports) module.exports=G.Parse;
})();
