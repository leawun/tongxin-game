(function(){
"use strict";
var KEYS=["A","B","C","D"];
var BANK=[
  {q:"客戶在交件前一天臨時改需求，我們團隊第一個反應應該是？",o:["先答應，大家加班趕出來","先評估影響，跟客戶談取捨","依合約婉拒，下次再改","先問主管怎麼決定"]},
  {q:"專案出包了，檢討會上第一件要談的事是？",o:["誰該負責","怎麼補救","流程哪裡出問題","怎麼跟客戶交代"]},
  {off:true,q:"會議上發現同事報告有明顯錯誤，主管還沒注意到，你會？",o:["當場直接指出","會後私下告訴同事","會後告訴主管","不說，不是我的事"]},
  {off:true,q:"新進同事第三次問同一個問題，團隊應該？",o:["再耐心教一次","請他自己查文件","一起把答案整理成文件","請主管安排訓練"]}
];
var PREFIX="tongxin-game-";
function popts(){var o={debug:0};var x=window.PEER_OPTS;if(x)for(var k in x)o[k]=x[k];return o;}
var app=document.getElementById("app");
var params=new URLSearchParams(location.search);
var joinId=params.get("join");
var MYV=((document.currentScript&&document.currentScript.src||"").match(/[?&]v=([^&]+)/)||[])[1]||"";

/* ---------- 共用 ---------- */
function el(tag,attrs,kids){var n=document.createElement(tag);attrs=attrs||{};
  for(var k in attrs){if(k==="text")n.textContent=attrs[k];else if(k.slice(0,2)==="on")n.addEventListener(k.slice(2),attrs[k]);else n.setAttribute(k,attrs[k]);}
  (kids||[]).forEach(function(c){if(c!=null&&c!==false)n.appendChild(typeof c==="string"?document.createTextNode(c):c)});return n;}
function fmt(s){s=Math.max(0,Math.ceil(s));return Math.floor(s/60)+":"+String(s%60).padStart(2,"0")}
function header(step){return el("div",{class:"top"},[el("div",{class:"brand"},[el("span",{class:"rings"}),"同心指數"]),step?el("span",{class:"step",text:step}):null]);}
var ac=null;
function tone(freqs,dur){try{if(!ac){var C=window.AudioContext||window.webkitAudioContext;if(!C)return;ac=new C();}
  var t=ac.currentTime;freqs.forEach(function(f,i){var o=ac.createOscillator(),g=ac.createGain();o.type="triangle";o.frequency.value=f;
  g.gain.setValueAtTime(0.0001,t+i*dur);g.gain.exponentialRampToValueAtTime(0.22,t+i*dur+0.02);g.gain.exponentialRampToValueAtTime(0.0001,t+(i+1)*dur);
  o.connect(g);g.connect(ac.destination);o.start(t+i*dur);o.stop(t+(i+1)*dur+0.05);});}catch(e){}}
function sBeep(){tone([660],0.12)} function sReveal(){tone([392,523,659,784],0.12)} function sEnd(){tone([440,330,262],0.22)} function sPop(){tone([880],0.06)}
function rand(n){var c="abcdefghjkmnpqrstuvwxyz23456789",s="";for(var i=0;i<n;i++)s+=c[Math.floor(Math.random()*c.length)];return s;}

function qImg(src,cls){var i=el("img",{class:cls||"qimg",alt:"題目圖片"});i.src=src;return i;}

if(joinId){player(joinId);}else{host();}

/* ================= 主持人 ================= */
function host(){
var STORE="tongxin-game-bank-v1";
function loadBank(){try{var s=localStorage.getItem(STORE);if(s){var b=JSON.parse(s);if(Array.isArray(b)&&b.length>=1)return b;}}catch(e){}return JSON.parse(JSON.stringify(BANK));}
function saveBank(){try{localStorage.setItem(STORE,JSON.stringify(S.bank));return true;}catch(e){return false;}}
function shrink(file,cb){var r=new FileReader();r.onload=function(){var im=new Image();im.onload=function(){var m=1200,w=im.width,h=im.height,k=Math.min(1,m/Math.max(w,h));
  var c=document.createElement("canvas");c.width=Math.round(w*k);c.height=Math.round(h*k);var x=c.getContext("2d");x.fillStyle="#fff";x.fillRect(0,0,c.width,c.height);x.drawImage(im,0,0,c.width,c.height);
  cb(c.toDataURL("image/jpeg",0.8));};im.onerror=function(){cb(null)};im.src=r.result;};r.onerror=function(){cb(null)};r.readAsDataURL(file);}
var S={view:"setup",bank:loadBank(),pick:[],qi:0,round:1,counts:[0,0,0,0],res:[],tick:null,open:false,key:"",net:"connecting",manual:false};
var conns={},votes={},peer=null,roomId=null,onLive=null;

function joinUrl(){return location.origin+location.pathname+"?join="+roomId;}
function people(){return Object.keys(conns).length;}
function voted(){return Object.keys(votes).length;}
function tallyFromVotes(){var c=[0,0,0,0];for(var k in votes)c[votes[k]]++;return c;}
function stateMsg(){var q=curQ();return {t:"state",open:S.open,left:(S.open&&S.deadline)?Math.max(0,S.deadline-Date.now()):0,key:S.key,q:q?q.q:"",o:q?q.o:[],img:q&&q.img||"",ans:(!S.open&&S.view==="reveal"&&hasAns(q))?q.ans:-1,label:"第 "+(S.qi+1)+" 題．"+(S.round===1?"第一次作答":"討論後再答"),done:S.view==="result",wait:S.view==="setup"};}
function broadcast(){var m=stateMsg();for(var id in conns){try{if(conns[id].open)conns[id].send(m);}catch(e){}}}
function live(){if(onLive)onLive();}

function startPeer(){
  if(typeof Peer==="undefined"){S.net="failed";live();return;}
  roomId=rand(6);
  try{peer=new Peer(PREFIX+roomId,popts());}catch(e){S.net="failed";live();return;}
  peer.on("open",function(){S.net="ok";live();});
  peer.on("connection",function(c){
    c.on("open",function(){conns[c.peer]=c;sPop();try{c.send(stateMsg());}catch(e){}live();});
    c.on("data",function(d){if(!d||d.t!=="vote")return;
      if(votingOpen()&&d.key===S.key&&d.c>=0&&d.c<4){votes[c.peer]=d.c;if(!S.manual)S.counts=tallyFromVotes();live();}});
    c.on("close",function(){delete conns[c.peer];live();});
    c.on("error",function(){delete conns[c.peer];live();});
  });
  peer.on("disconnected",function(){try{peer.reconnect();}catch(e){}});
  peer.on("error",function(e){if(e&&e.type==="unavailable-id"){try{peer.destroy();}catch(_){}startPeer();return;}
    if(S.net!=="ok"){S.net="failed";live();}});
}

/* 版本檢查：主持人頁面開著時有新版，就提示或自動更新 */
var verBar=null;
function checkVer(){if(!MYV||!window.fetch)return;fetch("./?vc="+Date.now(),{cache:"no-store"}).then(function(r){return r.text()}).then(function(h){var m=h.match(/game\.js\?v=([^"'&]+)/);if(!m||m[1]===MYV)return;
  if(S.view==="setup"&&people()===0){location.reload();return;}
  if(verBar)return;verBar=el("div",{class:"verbar",role:"status"},["遊戲有新版本。這一輪玩完後按「重新整理」更新（玩家需要重新掃碼）。",el("button",{text:"現在重新整理",onclick:function(){location.reload();}})]);document.body.appendChild(verBar);}).catch(function(){});}
checkVer();setInterval(checkVer,60000);
function go(v){clearInterval(S.tick);onLive=null;S.view=v;app.replaceChildren();V[v]();window.scrollTo(0,0);var f=app.querySelector("[autofocus]");if(f)f.focus();broadcast();}
function picks(){return S.bank.map(function(q,i){return q.off?-1:i}).filter(function(i){return i>=0});}
function nextQ(){if(S.qi<S.pick.length-1){S.qi++;S.round=1;openVoting();go("ask");}else go("result");}
function curQ(){return S.bank[S.pick[S.qi]];}
function indexOf(c){var t=c.reduce(function(a,b){return a+b},0);return t?Math.round(Math.max.apply(null,c)/t*100):0;}
function countdown(sec,node,done,lowAt){var st=Date.now(),last=-1;S.tick=setInterval(function(){var l=sec-(Date.now()-st)/1000;node.textContent=fmt(l);
  if(lowAt!=null)node.classList.toggle("low",l<=lowAt);var c=Math.ceil(l);if(c!==last&&c<=3&&c>0)sBeep();last=c;if(l<=0){clearInterval(S.tick);done&&done();}},200);}
function optionList(q){return el("div",{class:"opts"},q.o.map(function(t,i){return el("div",{class:"opt"},[el("span",{class:"k",text:KEYS[i]}),el("span",{text:t})])}));}
function distBlock(q,c){var max=Math.max.apply(null,c),tot=c.reduce(function(a,b){return a+b},0)||1;
  var d=el("div",{class:"dist"},q.o.map(function(t,i){var ok=hasAns(q)&&q.ans===i;return el("div",{class:"drow"+(c[i]===max&&max>0?" top":"")+(ok?" correct":"")},[el("span",{class:"k",text:ok?"✓":KEYS[i]}),
    el("div",{},[el("div",{class:"txt"},[t,ok?el("span",{class:"anstag",text:"正確答案"}):null]),el("div",{class:"track"},[el("i",{style:"width:0%","data-w":(c[i]/tot*100)})])]),el("span",{class:"n",text:String(c[i])})])}));
  requestAnimationFrame(function(){requestAnimationFrame(function(){d.querySelectorAll("i[data-w]").forEach(function(i){i.style.width=i.getAttribute("data-w")+"%"})})});return d;}
function hasAns(q){return q&&typeof q.ans==="number"&&q.ans>=0&&q.ans<4;}
function rightRate(q,c){var t=c.reduce(function(a,b){return a+b},0);return t?Math.round(c[q.ans]/t*100):0;}
function distTable(q,r){
  var cols=[{name:r.skipped||!r.second?"作答":"討論前",c:r.first}];if(!r.skipped&&r.second)cols.push({name:"討論後",c:r.second});
  cols.forEach(function(col){col.t=col.c.reduce(function(a,b){return a+b},0);col.max=Math.max.apply(null,col.c);});
  var head=el("tr",{},[el("th",{text:"選項"})].concat(cols.map(function(col){return el("th",{class:"num",text:col.name+"（"+col.t+" 人）"})})));
  var body=q.o.map(function(t,i){var ok=r.ans===i;
    return el("tr",{class:ok?"correct":""},[el("td",{},[el("span",{class:"k",text:KEYS[i]}),el("span",{class:"opt-t",text:t}),ok?el("span",{class:"anstag",text:"正確答案"}):null])].concat(cols.map(function(col){
      var n=col.c[i],pc=col.t?Math.round(n/col.t*100):0;
      return el("td",{class:"num"+(n===col.max&&n>0?" hi":"")},[el("span",{class:"cnt",text:n+" 人"}),el("span",{class:"pct",text:pc+"%"}),el("span",{class:"mini"},[el("i",{style:"width:"+pc+"%"})])]);})));});
  return el("div",{class:"tbl-wrap"},[el("table",{class:"dtab"},[el("thead",{},[head]),el("tbody",{},body)])]);}
function vsBlock(a,b){return el("div",{class:"vs"},[el("div",{},[el("div",{class:"num before",text:String(a)}),el("span",{class:"note",text:"討論前"})]),el("span",{class:"arrow",text:"→"}),
  el("div",{},[el("div",{class:"num after",text:String(b)}),el("span",{class:"note",text:"討論後"})])]);}
function votingOpen(){return S.open&&S.deadline&&Date.now()<S.deadline+300;}
function openVoting(){S.open=true;S.deadline=0;S.key=S.qi+"-"+S.round+"-"+Date.now();votes={};S.counts=[0,0,0,0];S.manual=false;}

var V={
setup:function(){
  var qrBox=el("div",{class:"qr"}),url=el("p",{class:"url"}),stat=el("p",{class:"status"}),cnt=el("span",{class:"live",text:"0"});
  var copyBtn=el("button",{text:"複製連結",onclick:function(){var u=joinUrl();if(navigator.clipboard)navigator.clipboard.writeText(u).then(function(){copyBtn.textContent="已複製"},function(){});}});
  var drawn=false;
  onLive=function(){cnt.textContent=String(people());
    if(S.net==="ok"){stat.className="status";stat.textContent="連線正常，等大家加入。";url.textContent=joinUrl();
      if(!drawn&&typeof QRCode!=="undefined"){drawn=true;new QRCode(qrBox,{text:joinUrl(),width:200,height:200,correctLevel:QRCode.CorrectLevel.M});}}
    else if(S.net==="failed"){stat.className="status bad";stat.textContent="手機連線失敗（可能是公司網路擋住了）。仍可改用「比手指」方式，由主持人手動輸入人數。";}
    else{stat.className="status";stat.textContent="正在建立連線…";}};
  onLive();
  var msg=el("p",{class:"note",role:"status"}),eds=el("div",{}),cnt2=el("span",{class:"tag"});
  var lead=el("p",{class:"lead"});
  function upCount(){var n=picks().length;cnt2.textContent="目前會玩 "+n+" 題";lead.replaceChildren("總共有"+n+"題，每題作答時間為15秒，有些題目有正確答案，有些則沒有。",el("br"),el("strong",{class:"hl",text:"請根據你的直覺及認知作答。"}));}
  function drawEditor(){eds.replaceChildren();upCount();
  S.bank.forEach(function(q,qi){
    var cb=el("input",{type:"checkbox",id:"use"+qi,"aria-label":"使用第 "+(qi+1)+" 題"});cb.checked=!q.off;
    cb.addEventListener("change",function(){if(cb.checked)delete q.off;else q.off=true;saveBank();upCount();msg.textContent="";});
    var del=el("button",{class:"del",onclick:function(){if(S.bank.length<=1){msg.textContent="至少要保留 1 題。";return;}
      if(!window.confirm("確定刪除第 "+(qi+1)+" 題嗎？刪除後無法復原。"))return;S.bank.splice(qi,1);saveBank();drawEditor();},text:"刪除這題"});
    var qt=el("textarea",{id:"q"+qi,rows:"2"});qt.value=q.q;qt.addEventListener("input",function(){q.q=qt.value;saveBank()});
    var og=el("div",{class:"optgrid"},q.o.map(function(t,oi){var inp=el("input",{id:"q"+qi+"o"+oi});inp.value=t;
      inp.addEventListener("input",function(){q.o[oi]=inp.value;saveBank()});return el("label",{for:"q"+qi+"o"+oi},["選項 "+KEYS[oi],inp]);}));
    var as=el("select",{id:"ans"+qi});[["-1","沒有正確答案（看共識）"],["0","A"],["1","B"],["2","C"],["3","D"]].forEach(function(x){var o=el("option",{value:x[0],text:x[1]});if(String(hasAns(q)?q.ans:-1)===x[0])o.selected=true;as.append(o);});
    as.addEventListener("change",function(){var v=+as.value;if(v>=0)q.ans=v;else delete q.ans;saveBank();});
    var prev=el("div",{class:"imgedit"}),imsg=el("p",{class:"note",role:"status"});
    var fi=el("input",{type:"file",accept:"image/*",id:"img"+qi});
    function drawPrev(){prev.replaceChildren();if(q.img){prev.append(qImg(q.img,"thumb"),el("button",{onclick:function(){delete q.img;saveBank();drawPrev();},text:"移除圖片"}));}}
    fi.addEventListener("change",function(){var f=fi.files&&fi.files[0];if(!f)return;imsg.textContent="處理中…";
      shrink(f,function(d){fi.value="";if(!d){imsg.textContent="這個檔案無法讀取，請換一張 JPG 或 PNG。";return;}
        var old=q.img;q.img=d;if(!saveBank()){q.img=old;imsg.textContent="圖片太大，瀏覽器存不下。請換小一點的圖，或先移除其他題目的圖片。";return;}
        imsg.textContent="";drawPrev();});});
    drawPrev();
    eds.append(el("div",{class:"qedit"},[el("div",{class:"head"},[cb,el("label",{for:"use"+qi,class:"label",style:"flex-direction:row;color:var(--accent)",text:"第 "+(qi+1)+" 題（勾選＝要玩）"}),el("span",{style:"flex:1"}),del]),qt,
      el("label",{for:"img"+qi},["題目圖片（選填）",fi]),prev,imsg,og,el("label",{for:"ans"+qi},["正確答案（選填）",as])]));
  });}
  drawEditor();
  var editor=el("div",{class:"panel"},[el("div",{class:"row"},[el("span",{class:"label",text:"題庫（勾選要玩的題目，依順序出題）"}),cnt2]),eds,
    el("div",{class:"row"},[el("button",{class:"primary",onclick:function(){S.bank.push({q:"",o:["","","",""]});saveBank();drawEditor();var t=document.getElementById("q"+(S.bank.length-1));if(t){t.focus();t.scrollIntoView({block:"center"});}},text:"＋ 新增題目"}),
      el("button",{onclick:function(){if(!window.confirm("確定還原成預設題目嗎？你新增或修改的題目都會被清除。"))return;S.bank=JSON.parse(JSON.stringify(BANK));saveBank();drawEditor();},text:"還原預設題目"})]),
    el("p",{class:"note",text:"修改會記在這台電腦的瀏覽器裡。"})]);
  editor.hidden=true;
  app.append(header("主持人．準備"),
    el("h1",{text:"我們想的，一樣嗎？"}),
    lead,
    el("div",{class:"panel"},[el("span",{class:"label",text:"用手機掃描加入"}),
      el("div",{class:"join"},[qrBox,el("div",{class:"row",style:"flex-direction:column;align-items:flex-start;gap:10px;min-width:0"},[
        el("div",{class:"row"},[el("span",{text:"已加入"}),cnt,el("span",{text:"人"})]),url,copyBtn,stat,
        el("p",{class:"note",text:"也可以把連結貼到會議聊天室。每個人的答案只會被計入人數，看不到是誰選的。"})])])]),
    el("div",{class:"row"},[el("button",{class:"primary",autofocus:"",onclick:function(){var pk=picks();if(!pk.length){editor.hidden=false;var eb=document.getElementById("editBtn");if(eb)eb.textContent="收起題目";msg.scrollIntoView({block:"center"});msg.textContent="請在題庫裡至少勾選 1 題。";return;}
      var bad=pk.filter(function(i){var q=S.bank[i];return !q.q.trim()||q.o.some(function(o){return !o.trim()})});
      if(bad.length){editor.hidden=false;var eb=document.getElementById("editBtn");if(eb)eb.textContent="收起題目";msg.scrollIntoView({block:"center"});msg.textContent="第 "+bad.map(function(i){return i+1}).join("、")+" 題的題目或選項還有空白，請填完或取消勾選。";return;}
      S.pick=pk;S.qi=0;S.res=[];S.round=1;openVoting();go("ask")},text:"大家都加入了，開始第 1 題"}),
      el("button",{id:"editBtn",onclick:function(){editor.hidden=!editor.hidden;this.textContent=editor.hidden?"編輯題目":"收起題目";if(!editor.hidden)editor.scrollIntoView({behavior:"smooth",block:"start"});},text:"編輯題目"})]),msg,editor);
},
ask:function(){
  var q=curQ(),tot=el("span",{text:"/ "+people()+" 人"}),timer=el("div",{class:"timer",text:"0:15"}),done=el("span",{class:"live",text:"0"}),warn=el("p",{class:"note",role:"status"});
  var manualBox=el("div",{class:"tally"}),manualWrap=el("div",{class:"panel"},[el("span",{class:"label",text:"手動輸入各選項人數"}),manualBox]);manualWrap.hidden=true;
  function drawManual(){manualBox.replaceChildren();q.o.forEach(function(t,i){var out=el("output",{text:String(S.counts[i])});
    function set(d){S.manual=true;S.counts[i]=Math.max(0,S.counts[i]+d);out.textContent=String(S.counts[i]);}
    manualBox.append(el("div",{class:"trow"},[el("span",{class:"k",text:KEYS[i]}),el("span",{text:t}),
      el("div",{class:"stepper"},[el("button",{"aria-label":KEYS[i]+" 減 1",onclick:function(){set(-1)},text:"−"}),out,el("button",{"aria-label":KEYS[i]+" 加 1",onclick:function(){set(1)},text:"+"})])]));});}
  onLive=function(){done.textContent=String(voted());tot.textContent="/ "+people()+" 人";if(!manualWrap.hidden&&!S.manual)drawManual();};
  var reveal=el("button",{class:"primary",onclick:function(){if(!S.counts.some(Boolean)){warn.textContent="還沒有人作答。手機連不上時，可以按「手動輸入人數」。";return;}
    S.open=false;sReveal();go("reveal");},text:"公布結果"});
  app.append(header("主持人．第 "+(S.qi+1)+" 題 / "+S.pick.length+"．"+(S.round===1?"第一次作答":"討論後再答")),
    el("div",{class:"lockstage"},[
      el("div",{class:"panel"},[el("span",{class:"label",text:S.round===1?"情境 "+(S.qi+1):"討論後，再答一次"}),q.img?qImg(q.img):null,el("p",{class:"q",text:q.q}),optionList(q)]),
      el("div",{class:"panel"},[el("span",{class:"label",text:"請在手機上作答"}),timer,
        el("div",{class:"row"},[el("span",{text:"已作答"}),done,tot]),reveal,
        el("button",{onclick:function(){manualWrap.hidden=!manualWrap.hidden;drawManual();},text:"手動輸入人數"}),warn])
    ]),manualWrap);
  S.deadline=Date.now()+15000;broadcast();
  countdown(15,timer,function(){sEnd();timer.textContent="時間到";S.open=false;broadcast();},3);
},
reveal:function(){
  var q=curQ(),c=S.counts.slice(),idx=indexOf(c);
  if(S.round===1){S.res[S.qi]={first:c,firstIdx:idx};}else{S.res[S.qi].second=c;S.res[S.qi].secondIdx=idx;}
  if(hasAns(q)){S.res[S.qi].ans=q.ans;if(S.round===1)S.res[S.qi].firstRight=rightRate(q,c);else S.res[S.qi].secondRight=rightRate(q,c);}
  var r=S.res[S.qi],side;
  if(S.round===1){
    var A=hasAns(q),rr=A?rightRate(q,c):0,topWrong=A&&idx>=60&&c[q.ans]<Math.max.apply(null,c);
    side=el("div",{class:"panel"},[el("span",{class:"label",text:"同心指數"}),el("div",{class:"index"},[el("b",{text:String(idx)}),el("span",{text:"/ 100"})]),
      A?el("span",{class:"label",text:"答對率"}):null,A?el("div",{class:"index"},[el("b",{class:"okc",text:rr+"%"}),el("span",{text:"正確答案是 "+KEYS[q.ans]})]):null,
      el("p",{class:"note",text:topWrong?"大家很一致，但多數人選的不是正確答案。一致不等於正確，討論看看是哪裡想偏了。":A?(rr>=80?"大部分人都答對了。討論看看，大家的理由一樣嗎？":"答案有落差。接下來討論 1 分鐘，再答一次。"):(idx>=80?"大家想法很接近。討論看看，大家選的理由也一樣嗎？":"想法分散，這很正常。接下來討論 1 分鐘。")}),
      el("button",{class:"primary",autofocus:"",onclick:function(){go("discuss")},text:"開始討論"}),
      el("button",{onclick:function(){S.res[S.qi].skipped=true;nextQ();},text:S.qi<S.pick.length-1?"跳過，直接到第 "+(S.qi+2)+" 題":"跳過，直接看總結果"})]);
  }else{
    side=el("div",{class:"panel"},[el("span",{class:"label",text:"同心指數．討論前後"}),vsBlock(r.firstIdx,r.secondIdx),
      r.ans!=null?el("span",{class:"label",text:"答對率．討論前後（正確答案 "+KEYS[r.ans]+"）"}):null,r.ans!=null?vsBlock(r.firstRight+"%",r.secondRight+"%"):null,
      el("p",{class:"note",text:r.secondIdx>r.firstIdx?"討論後更一致了。":"指數沒有上升，這正是復盤時值得聊的地方。"}),
      el("button",{class:"primary",autofocus:"",onclick:function(){nextQ();},text:S.qi<S.pick.length-1?"第 "+(S.qi+2)+" 題":"看總結果"})]);
  }
  app.append(header("主持人．第 "+(S.qi+1)+" 題．"+(S.round===1?"第一次結果":"討論後結果")),
    el("div",{class:"lockstage"},[el("div",{class:"panel"},[el("span",{class:"label",text:"作答分佈（匿名）"}),el("p",{class:"lead",text:q.q}),distBlock(q,c)]),side]));
},
discuss:function(){
  var timer=el("div",{class:"timer",text:"1:00"});
  app.append(header("主持人．第 "+(S.qi+1)+" 題．討論"),
    el("div",{class:"lockstage"},[
      el("div",{class:"panel"},[el("span",{class:"label",text:"討論 1 分鐘"}),el("p",{class:"q",text:"選不同答案的人，願意的話各說一句你的理由。"}),
        el("p",{class:"lead",text:"目標不是說服別人，而是找出「我們團隊」最認同的做法。"})]),
      el("div",{class:"panel"},[el("span",{class:"label",text:"倒數"}),timer,
        el("button",{class:"primary",onclick:function(){S.round=2;openVoting();go("ask")},text:"再答一次"})])
    ]));
  countdown(60,timer,sEnd,10);
},
result:function(){
  var both=S.res.filter(function(r){return !r.skipped&&r.secondIdx!=null});
  var avg=function(k){return both.length?Math.round(both.reduce(function(a,r){return a+r[k]},0)/both.length):0};
  var diff=avg("secondIdx")-avg("firstIdx");
  var head=diff>0?el("h1",{},["一分鐘的對話，同心指數提高了 ",el("span",{class:"headline-num",text:diff+" 分"})]):el("h1",{text:S.res.length+" 題的同心指數"});
  var rows=S.res.map(function(r,i){var q=S.bank[S.pick[i]];return el("div",{class:"panel"},[el("span",{class:"label",text:"第 "+(i+1)+" 題"}),el("p",{text:q.q}),
    el("span",{class:"label",text:"同心指數"}),
    r.skipped?el("div",{},[el("div",{class:"index"},[el("b",{text:String(r.firstIdx)}),el("span",{text:"/ 100"})]),el("p",{class:"note",text:"這題跳過了討論，只作答一次。"})]):vsBlock(r.firstIdx,r.secondIdx),
    r.ans!=null?el("span",{class:"label",text:"答對率（正確答案 "+KEYS[r.ans]+"）"}):null,
    r.ans!=null?(r.skipped?el("div",{class:"index"},[el("b",{class:"okc",text:r.firstRight+"%"})]):vsBlock(r.firstRight+"%",r.secondRight+"%")):null,
    el("span",{class:"label",text:"各選項人數"}),distTable(q,r)]);});
  app.append(header("主持人．結果與復盤"),head,el("div",{class:"stack"},rows),
    el("div",{class:"row"},[el("button",{onclick:function(){go("setup")},text:"重新開始"})]));
}
};
startPeer();
go("setup");
}

/* ================= 玩家手機 ================= */
function player(id){
  var P={st:null,choice:-1,key:"",net:"connecting",tries:0,lockAt:0,iv:null},peer=null,conn=null;
  function isOpen(){return P.st&&P.st.open&&P.lockAt&&Date.now()<P.lockAt;}
  function render(){
    clearInterval(P.iv);app.replaceChildren();var box=el("div",{class:"player wrap"});app.append(box);function add(){for(var k=0;k<arguments.length;k++){if(arguments[k])box.append(arguments[k]);}}add(header("匿名作答"));
    if(P.net!=="ok"){add(el("p",{class:"wait",text:P.net==="failed"?"連不上主持人":"正在連線…"}),
      el("p",{class:"note",text:P.net==="failed"?"請確認主持人的畫面還開著，或改用公司以外的網路（例如手機行動網路）再試一次。":"請稍等幾秒。"}),
      P.net==="failed"?el("button",{class:"primary",onclick:function(){P.tries=0;connect();},text:"重新連線"}):null);return;}
    var st=P.st;
    if(st&&st.wait)P.played=false;
    if(st&&!st.done&&st.open&&st.key&&P.lockAt&&Date.now()<P.lockAt)P.seen=st.key;
    var mine=st&&!st.done&&st.key&&P.seen===st.key;
    if(!st||st.wait||(st.done&&!P.played)||(!st.done&&!mine)){P.key="";P.choice=-1;add(el("p",{class:"wait",text:"成功加入，請等待主持人開始遊戲。"}));return;}
    if(st.done){add(el("p",{class:"wait",text:"遊戲結束，謝謝參與！"}));return;}
    P.played=true;
    if(st.key!==P.key){P.key=st.key;P.choice=-1;}
    if(!isOpen()){add(el("p",{class:"wait",text:P.choice>=0?"時間到，你選的是 "+KEYS[P.choice]:"時間到，你這題沒有作答"}),
      P.choice>=0?el("p",{class:"note",text:KEYS[P.choice]+"．"+(st.o[P.choice]||"")}):null,
      el("p",{class:"note",text:"請看主持人畫面。"}),
      st.ans>=0?el("p",{class:"q",style:"font-size:22px",text:"正確答案是 "+KEYS[st.ans]+(P.choice>=0?(P.choice===st.ans?"，你答對了！":"，這次沒答對。"):"")}):null);return;}
    var cd=el("span",{class:"tag",text:"剩 "+Math.ceil((P.lockAt-Date.now())/1000)+" 秒"});
    P.iv=setInterval(function(){var l=P.lockAt-Date.now();if(l<=0){render();return;}cd.textContent="剩 "+Math.ceil(l/1000)+" 秒";},250);
    add(el("div",{class:"row"},[el("span",{class:"label",text:st.label}),cd]),st.img?qImg(st.img):null,el("p",{class:"q",style:"font-size:24px",text:st.q}),
      el("div",{class:"vote"},st.o.map(function(t,i){var bt=el("button",{class:P.choice===i?"sel":"",onclick:function(){vote(i)}},[el("span",{class:"k",text:KEYS[i]}),el("span",{text:t})]);return bt;})),
      el("p",{class:"note",text:P.choice>=0?"已送出。時間到之前都可以改選。":"時間到之前都可以改答案，以最後一次選擇為準。答案只會被計入人數，沒有人看得到是誰選的。"}));
  }
  function vote(i){if(!isOpen())return;P.choice=i;try{conn.send({t:"vote",key:P.key,c:i});}catch(e){}render();}
  function connect(){
    if(typeof Peer==="undefined"){P.net="failed";render();return;}
    P.net="connecting";render();
    try{if(peer)peer.destroy();}catch(e){}
    peer=new Peer(popts());
    peer.on("open",function(){conn=peer.connect(PREFIX+id,{reliable:true});
      var t=setTimeout(function(){if(P.net!=="ok")retry();},10000);
      conn.on("open",function(){clearTimeout(t);P.net="ok";P.tries=0;render();});
      conn.on("data",function(d){if(d&&d.t==="state"){if(d.key!==P.key||!d.open)P.lockAt=0;if(d.open&&d.left>0&&(!P.lockAt||d.key!==(P.st&&P.st.key)))P.lockAt=Date.now()+d.left;if(!d.open)P.lockAt=0;P.st=d;render();}});
      conn.on("close",function(){P.net="connecting";render();retry();});
    });
    peer.on("error",function(){retry();});
  }
  function retry(){P.tries++;if(P.tries>3){P.net="failed";render();return;}setTimeout(connect,1500*P.tries);}
  connect();
  if(MYV&&window.fetch)fetch("./?vc="+Date.now(),{cache:"no-store"}).then(function(r){return r.text()}).then(function(h){var m=h.match(/game\.js\?v=([^"'&]+)/);if(!m||m[1]===MYV)return;
    var k="tongxin-reload-"+m[1];try{if(sessionStorage.getItem(k))return;sessionStorage.setItem(k,"1");}catch(e){}
    var u=new URL(location.href);u.searchParams.set("r",Date.now());location.replace(u.toString());}).catch(function(){});
}
})();
