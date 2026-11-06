/* ===== 图片预览：本地文件夹 / 文件中心 共用同一个弹层 ===== */
(function(){
"use strict";
var A=window.APP, esc=A.esc;

/* 单例：同一时刻只允许一个预览，保证只有一个 objectURL 存活 */
var cur=null;

/* ---------- 失败分类 ---------- */
var T={
  NO_HANDLE:{t:"该文件夹尚未授权",d:"浏览器没有保存这个文件夹的访问句柄。点「重试」会重新发起一次授权。"},
  BAD_PATH:{t:"文件路径无效",d:"索引里的相对路径为空，请回文件夹视图刷新后重试。"},
  NO_ROUTE:{t:"找不到文件所在的文件夹",d:"这条记录只登记了路径，且该路径不在任何已绑定入口下。请先到「本地文件夹」绑定所在目录。"},
  NEED_PERM:{t:"已定位到文件夹，但尚未授权",d:"点「重试」重新授权该文件夹即可预览。"},
  NOT_FOUND:{t:"文件已不存在",d:"可能被删除、改名或移动。请回「本地文件夹」刷新索引后再试。"},
  DENIED:{t:"浏览器收回了读取权限",d:"这是浏览器安全策略，需要你亲手点一次授权。"},
  UNREADABLE:{t:"文件无法读取",d:"可能正被其他程序占用，或 U 盘、网络盘已断开。"},
  TYPE_MISMATCH:{t:"目标不是文件",d:"该路径被同名文件夹占用。"},
  DECODE:{t:"浏览器无法显示这张图",d:"文件可能已损坏，或内容与扩展名不符（例如把 tif 改名成 png）。"},
  EMPTY:{t:"文件是空的",d:"0 字节，没有可显示的内容。"},
  NO_BLOB:{t:"浏览器文件库里找不到该文件",d:"可能清理过浏览器缓存或换了浏览器，需要重新上传。"},
  NO_IDB:{t:"本地文件库不可用",d:"浏览器禁用了 IndexedDB，或该库被其他标签页占用。"},
  UNKNOWN:{t:"预览失败",d:"发生了未预期的错误。"}
};

function mkErr(code){ var e=new Error(code); e.code=code; return e; }

function classify(e){
  var c=(e&&e.code)||"", n=(e&&e.name)||"", m=(e&&e.message)||String(e||"");
  if(c&&T[c]) return T[c];
  if(m==="NO_HANDLE") return T.NO_HANDLE;
  if(m==="BAD_PATH") return T.BAD_PATH;
  if(m==="NO_ROUTE") return T.NO_ROUTE;
  if(m==="NEED_PERM") return T.NEED_PERM;
  if(m==="NO_BLOB") return T.NO_BLOB;
  if(m==="NO_IDB") return T.NO_IDB;
  if(m==="DENIED"||m==="NO_PERM_API") return T.DENIED;
  if(n==="NotFoundError"||/NotFoundError/.test(m)) return T.NOT_FOUND;
  if(n==="NotAllowedError"||n==="SecurityError"||/NotAllowedError|SecurityError/.test(m)) return T.DENIED;
  if(n==="NotReadableError"||n==="InvalidStateError"||/NotReadableError|InvalidStateError/.test(m)) return T.UNREADABLE;
  if(n==="TypeMismatchError") return T.TYPE_MISMATCH;
  return {t:T.UNKNOWN.t,d:"原始错误："+(n||m||"未知")};
}

/* Windows 缺 .svg/.avif/.ico 的 MIME 映射时 File.type 为空，
   而 SVG 的 Content-Type 不对就不会渲染，这里按扩展名补齐 */
function fixType(blob,name){
  var m=/\.([a-z0-9]+)$/i.exec(name||"");
  var ext=m?m[1].toLowerCase():"";
  var want=(window.QD&&window.QD.IMG_MIME&&window.QD.IMG_MIME[ext])||"";
  if(!want) return blob;
  if(blob.type===want) return blob;
  if(blob.type&&/^image\//.test(blob.type)) return blob;
  try{ return new Blob([blob],{type:want}); }catch(e){ return blob; }
}

/* ---------- 主入口 ---------- */
function open(opt){
  opt=opt||{};
  if(!opt.getBlob){ return null; }
  if(cur) cur.close();

  var mask=document.createElement("div");
  mask.className="iv-mask";
  mask.innerHTML='<div class="iv-load">正在读取图片…</div>';
  document.body.appendChild(mask);

  var url=null, imgEl=null, alive=true, busy=false;
  var prevOv=document.body.style.overflow;
  document.body.style.overflow="hidden";

  function clearImg(){
    if(imgEl){
      imgEl.onload=null; imgEl.onerror=null;
      try{ imgEl.removeAttribute("src"); }catch(e){}
      imgEl=null;
    }
    if(url){ try{ URL.revokeObjectURL(url); }catch(e){} url=null; }
  }

  function dispose(){
    if(!alive) return;
    alive=false;
    clearImg();
    document.removeEventListener("keydown",onKey,true);
    window.removeEventListener("hashchange",dispose);
    window.removeEventListener("pagehide",dispose);
    document.body.style.overflow=prevOv;
    if(mask.parentNode) mask.parentNode.removeChild(mask);
    if(cur===ctl) cur=null;
  }

  function onKey(e){
    if(e.key!=="Escape"&&e.keyCode!==27) return;
    e.preventDefault();
    e.stopPropagation();
    dispose();
  }

  mask.addEventListener("click",function(e){
    var t=e.target;
    if(t&&t.nodeType===1&&(t.closest("[data-iv-act]")||t.closest(".iv-panel"))) return;
    dispose();
  });
  document.addEventListener("keydown",onKey,true);
  window.addEventListener("hashchange",dispose);
  window.addEventListener("pagehide",dispose);

  function paintImg(){
    mask.innerHTML="";
    mask.appendChild(imgEl);
  }

  function paintFail(info){
    var extra="";
    if(opt.size) extra=" · "+window.QD.fmtSize(opt.size);
    mask.innerHTML=
      '<div class="iv-panel">'+
        '<div class="iv-ic">!</div>'+
        '<div class="iv-t">'+esc(info.t)+'</div>'+
        '<div class="iv-d">'+esc(info.d)+
          (opt.path?'<br><span class="iv-p">'+esc(opt.path)+'</span>'+(extra?esc(extra):''):"")+
        '</div>'+
        '<div class="iv-acts">'+
          '<button class="btn primary" data-iv-act="retry">重试</button>'+
          '<button class="btn" data-iv-act="copy">复制路径</button>'+
          '<button class="btn" data-iv-act="detail">详情</button>'+
        '</div>'+
      '</div>';
    var r=mask.querySelector('[data-iv-act="retry"]');
    var c=mask.querySelector('[data-iv-act="copy"]');
    var d=mask.querySelector('[data-iv-act="detail"]');
    if(!opt.path) c.disabled=true;
    if(!opt.onDetail) d.disabled=true;
    r.onclick=function(ev){ ev.stopPropagation(); load(true); };
    c.onclick=function(ev){
      ev.stopPropagation();
      if(window.copyText) window.copyText(opt.path);
      else if(window.toast) window.toast(opt.path,"ok");
      if(window.toast) window.toast("路径已复制","ok");
    };
    d.onclick=function(ev){
      ev.stopPropagation();
      var fn=opt.onDetail;
      dispose();
      setTimeout(function(){ try{ fn(); }catch(e){ console.warn(e); } },0);
    };
  }

  function fail(e){
    busy=false;
    clearImg();
    paintFail(classify(e));
  }

  function load(escalate){
    if(!alive) return;
    busy=true;
    clearImg();
    mask.innerHTML='<div class="iv-load">正在读取图片…</div>';

    Promise.resolve().then(function(){
      return opt.getBlob(!!escalate);
    }).then(function(blob){
      if(!alive) return;
      if(!blob||!blob.size) throw mkErr("EMPTY");
      url=URL.createObjectURL(fixType(blob,opt.name));
      imgEl=new Image();
      imgEl.className="iv-img";
      imgEl.alt=opt.name||"";
      imgEl.onload=function(){
        if(!alive) return;
        busy=false;
        paintImg();
      };
      imgEl.onerror=function(){
        if(!alive) return;
        fail(mkErr("DECODE"));
      };
      imgEl.src=url;
    }).catch(function(e){
      if(alive) fail(e);
    });
  }

  var ctl={el:mask, close:dispose, retry:function(){ load(true); }};
  cur=ctl;
  load(false);
  return ctl;
}

function close(){ if(cur) cur.close(); }

window.ImgView={
  open:open, close:close,
  isOpen:function(){ return !!cur; },
  _classify:classify, _fixType:fixType, _T:T
};
})();
