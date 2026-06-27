// 玄玑·测MBTI引擎(集成版·IIFE隔离·零全局污染)·算法同 engine_mbti.js
(function(){
// ============================================================
// 玄玑 · 星盘测MBTI 引擎 (JS版·照搬Python定稿·算法一字不改)
//   底色   = engine30_truebayes.py (双似然贝叶斯·去先验)
//   工具人格 = engine27_tools.py    (天赋矿排名)
//   排盘    = computeNatalLite (复用线上 astronomy.js)
// ============================================================

// ---------- 公共常量 ----------
const SIGNS=["白羊","金牛","双子","巨蟹","狮子","处女","天秤","天蝎","射手","摩羯","水瓶","双鱼"];
const STACKS={
 INTJ:["Ni","Te","Fi","Se"],INTP:["Ti","Ne","Si","Fe"],ENTJ:["Te","Ni","Se","Fi"],ENTP:["Ne","Ti","Fe","Si"],
 INFJ:["Ni","Fe","Ti","Se"],INFP:["Fi","Ne","Si","Te"],ENFJ:["Fe","Ni","Se","Ti"],ENFP:["Ne","Fi","Te","Si"],
 ISTJ:["Si","Te","Fi","Ne"],ISFJ:["Si","Fe","Ti","Ne"],ESTJ:["Te","Si","Ne","Fi"],ESFJ:["Fe","Si","Ne","Ti"],
 ISTP:["Ti","Se","Ni","Fe"],ISFP:["Fi","Se","Ni","Te"],ESTP:["Se","Ti","Fe","Ni"],ESFP:["Se","Fi","Te","Ni"]};
const SIGN_ELEM={白羊:"火",狮子:"火",射手:"火",金牛:"土",处女:"土",摩羯:"土",双子:"风",天秤:"风",水瓶:"风",巨蟹:"水",天蝎:"水",双鱼:"水"};
const SIGN_MODE={白羊:"基本",巨蟹:"基本",天秤:"基本",摩羯:"基本",金牛:"固定",狮子:"固定",天蝎:"固定",水瓶:"固定",双子:"变动",处女:"变动",射手:"变动",双鱼:"变动"};

// ========== body_map ==========
// chart.planets:[{n,sign,deg,house,rx}]  chart.points:[{n,sign,...}]
function bodyMap(chart){
  const m={};
  (chart.planets||[]).forEach(p=>{m[p.n]=[p.sign,p.deg,p.house,p.L,p.rx||false];});
  (chart.points||[]).forEach(pt=>{m[pt.n]=[pt.sign,pt.deg,pt.house,pt.L,false];});
  return m;
}

// ============================================================
//  行星×元素 锁定功能  (planet_element_lock.py)
// ============================================================
const ELEM_FUNC={火:["Se"],土:["Si","Te"],风:["Ne","Ti"],水:["Fi","Ni"]};
// 🔴 key 用简称(同 Python planet_element_lock.py)。传全称"月亮"等 get 不到→走兜底 return cand
//    =Python 的实际行为(PLANET_NATURE.get('月亮')=None)。改全称会误激活 F 分支→算错工具人格。
const PLANET_NATURE={日:"DOM",月:"F",水:"think",金:"F",火:"act",木:"N",土:"TS"};
function lockFunction(planet,sign){
  if(["天王","海王","冥王","天","海","冥"].includes(planet)) return ["Ni"];
  const nature=PLANET_NATURE[planet];
  if(nature==="DOM") return ["DOM"];
  const elem=SIGN_ELEM[sign], cand=ELEM_FUNC[elem];
  if(nature==="F"){
    if(elem==="风")return["Fe"]; if(elem==="水")return["Fi"];
    if(elem==="土")return["Si"]; if(elem==="火")return["Fi"];
  }
  if(nature==="act") return cand.slice();
  if(nature==="think"){
    if(elem==="风")return["Ne","Ti"]; if(elem==="土")return["Si","Ti"];
    if(elem==="水")return["Fi","Ni"]; if(elem==="火")return["Ne"];
  }
  if(nature==="N") return (elem==="风"||elem==="火")?["Ne","Ni"]:(elem==="土"?["Si"]:["Ni"]);
  if(nature==="TS") return (elem==="土"||elem==="风")?["Si","Te"]:["Si"];
  return cand.slice();
}

// ============================================================
//  底色 · engine30_truebayes  (双似然贝叶斯·去先验)
// ============================================================
const PW_E={太阳:3,月亮:3,水星:2,金星:2,火星:2,木星:1,土星:1,天:.5,海:.5,冥:.5};
const FUNC_HOUSE={Ni:[12,9,8],Ne:[9,11,5],Ti:[3,8,6],Te:[10,6,2],Fi:[12,4,5],Fe:[7,11,3],Si:[2,4,6],Se:[1,5,7]};
const MERC_TF={风:1.0,火:0.6,土:0.3,水:-1.0};   // 水星落座→T倾向
const VENUS_TF={风:0.5,土:0.4,火:-0.5,水:-0.8}; // 金星落座→T倾向(辅·权重0.5)

function bAxes(m,asc){
  const e={火:0,土:0,风:0,水:0}, mo={基本:0,固定:0,变动:0};
  for(const p in PW_E){ if(m[p]){const s=m[p][0]; e[SIGN_ELEM[s]]+=PW_E[p]; mo[SIGN_MODE[s]]+=PW_E[p];} }
  e[SIGN_ELEM[asc]]+=3;
  const E=(e.火+e.风)-(e.土+e.水);
  const N=(e.风+0.5*e.火)-(e.土+0.3*e.水);
  const me=m["水星"]?SIGN_ELEM[m["水星"][0]]:"土";
  const ve=m["金星"]?SIGN_ELEM[m["金星"][0]]:"土";
  const T_raw=MERC_TF[me]*1.0 + VENUS_TF[ve]*0.5;
  const T=T_raw*2.2;
  const J=mo.固定 + 0.5*mo.基本 - mo.变动;
  return {ax:{E,N,T,J,_Traw:T_raw}, e, mo};
}
function B_raw(t,ax){
  let s=0;
  s+=ax.E*(t[0]==="E"?1:-1);
  s+=ax.N*(t[1]==="N"?1:-1);
  s+=ax.T*(t[2]==="T"?1:-1);
  s+=ax.J*(t[3]==="J"?1:-1);
  return s;
}
function chartPower(m){
  const pw={}; for(let h=1;h<=12;h++)pw[h]=0;
  const WP={太阳:3,月亮:3,水星:2,金星:2,火星:2,木星:1,土星:1,凯龙:1,北交点:1};
  for(const p in WP){ if(m[p]&&m[p][2]) pw[m[p][2]]+=WP[p]; }
  return pw;
}
function typeProj(t){
  const proj={}; for(let h=1;h<=12;h++)proj[h]=0;
  const wt=[4,3,2,1];
  STACKS[t].forEach((f,i)=>{ FUNC_HOUSE[f].forEach(h=>{proj[h]+=wt[i];}); });
  return proj;
}
function cosine(a,b){
  let dot=0,na=0,nb=0;
  for(let h=1;h<=12;h++){dot+=a[h]*b[h];na+=a[h]*a[h];nb+=b[h]*b[h];}
  return (na&&nb)?dot/(Math.sqrt(na)*Math.sqrt(nb)):0;
}
function softmax(d,temp){
  temp=temp||0.4;
  const vals=Object.values(d), mx=Math.max(...vals);
  const ex={}; let Z=0;
  for(const k in d){ex[k]=Math.exp((d[k]-mx)/temp);Z+=ex[k];}
  const out={}; for(const k in ex)out[k]=ex[k]/Z;
  return out;
}
function deriveBaseColor(chart){
  const m=bodyMap(chart);
  const asc=chart.angles.asc.sign;
  const {ax,e}=bAxes(m,asc);
  const LBin={}; for(const t in STACKS)LBin[t]=B_raw(t,ax);
  const LB=softmax(LBin);
  const cp=chartPower(m);
  const Cin={}; for(const t in STACKS)Cin[t]=cosine(typeProj(t),cp);
  const LC=softmax(Cin);
  const post={}; let Z=0;
  for(const t in STACKS){post[t]=LB[t]*LC[t];Z+=post[t];}
  for(const t in post)post[t]/=Z;
  const rank=Object.entries(post).sort((a,b)=>b[1]-a[1]);
  return {rank, ax, e};
}

// ============================================================
//  工具人格 · engine27_tools  (天赋矿排名)
// ============================================================
const W_TOOL={太阳:3,月亮:3,水星:2,金星:2,火星:2,木星:1,土星:1};
const DESIRE=new Set(["火星","金星","太阳","月亮","北交点","莉莉丝"]);
const PAIN=new Set(["凯龙","土星","冥王","南交点"]);
const HARDW={刑:1.0,冲:0.9,合:0.8,六合:0.4,拱:0.4};

function aspparse(L){
  const out=[];
  (L||[]).forEach(s=>{
    for(const w of ["六合","合","冲","刑","拱"]){
      const i=s.indexOf(w);
      if(i>=0){ out.push([s.slice(0,i),w,s.slice(i+w.length)]); break; }
    }
  });
  return out;
}
function pfunc(p,s){ return lockFunction(W_TOOL[p]!==undefined?p:"火星", s); }

function funcPower(ch,m){
  const fp={};
  for(const p in W_TOOL){
    if(m[p]){ pfunc(p,m[p][0]).forEach(f=>{fp[f]=(fp[f]||0)+W_TOOL[p];}); }
  }
  return fp;
}
function mineTension(ch,m){
  const asps=aspparse(ch.aspects), mine={};
  asps.forEach(([x,t,y])=>{
    const dx=DESIRE.has(x),dy=DESIRE.has(y),px=PAIN.has(x),py=PAIN.has(y);
    if((dx&&py)||(px&&dy)){
      const des=dx?x:y;
      if(m[des]) pfunc(des,m[des][0]).forEach(f=>{mine[f]=(mine[f]||0)+(HARDW[t]||0.3);});
    }
  });
  if(m["北交点"]) ELEM_FUNC[SIGN_ELEM[m["北交点"][0]]].forEach(f=>{mine[f]=(mine[f]||0)+0.3;});
  return mine;
}
function mineOfType(t,mine){
  const dom=STACKS[t][0],aux=STACKS[t][1];
  const cand=[[dom,mine[dom]||0],[aux,mine[aux]||0]];
  cand.sort((a,b)=>b[1]-a[1]);
  return cand[0][0];
}
function rankTools(chart){
  const m=bodyMap(chart);
  const mine=mineTension(chart,m), fp=funcPower(chart,m);
  const sc={};
  for(const t in STACKS){
    const dom=STACKS[t][0],aux=STACKS[t][1];
    let s=(mine[dom]||0)*2.0+(mine[aux]||0)*1.3;
    s+=(fp[dom]||0)*0.15+(fp[aux]||0)*0.08;
    sc[t]=s;
  }
  const rank=Object.entries(sc).sort((a,b)=>b[1]-a[1]);
  const top3=rank.slice(0,3).map(([t,s],i)=>{
    const o={type:t,score:s};
    if(i<2) o.tie=Math.abs(s-rank[0][1])<0.3;
    o.mineFunc=mineOfType(t,mine); // 每个 top3 人格都带自己的 buff 功能(原仅 i===2,卡牌每张卡需各自的)
    return o;
  });
  return {rank, top3, mine, fp};
}

// ============================================================
//  产品文案 (engine44_product_final.py)
// ============================================================
// 16型解说·每型 A戳痛 + B封神 两句·随机出一(2026-06-26 Athena 逐句拍板定稿·传播钩子)
const SOUL_LINES={
 INTJ:["你不是高冷，是这世界的运算速度，跟不上你。","棋盘早在你脑子里了，你只是在等他们，自己入局。"],
 INTP:["你不是懒得理人，是懒得跟逻辑漏洞，讲废话。","这世界对你只有一个问题——还有什么，是拆不开的？"],
 ENTJ:["你不是强势，要你眼睁睁看着事情烂下去，真比死还难受。","你走过的地方寸草不生？不，是杂草不生！"],
 ENTP:["你不是爱抬杠，是他们的‘标准答案’，漏洞百出。","规则是写给守规矩的人的——你生来就要成为赢家。"],
 INFJ:["你习惯了照亮别人，却忘了自己也怕黑。","你一眼看穿人心，只是慈悲，让你忍着不说破。"],
 INFP:["你不是软弱，是你心里那个世界，比现实干净太多。","你看着好欺负？惹毛你的人，才知道什么叫绵里藏针。"],
 ENFJ:["你总是那个最有能量的人，所以没人相信你也会没电。","你一开口，人心就跟着走——你是天生的统帅。"],
 ENFP:["你笑得那么亮，没人发现你也有撑不住、想躲起来的时候。","你一进场，全世界都被你点亮了！"],
 ISTJ:["你不是无趣，是你把‘靠谱’扛成了责任，忍着不喊累。","他们花里胡哨，塌了那天，只有你这根定海针能撑住全场。"],
 ISFJ:["你把所有人都照顾好了，可没人问过你，累不累。","你很温柔，但他们最好别误会——能护住所有人的你，可从来不是弱者。"],
 ESTJ:["你不是控制欲强，是这堆烂摊子没人扛，你不出手就得垮。","把最乱的局丢给你，十分钟后，所有人都听你指挥。"],
 ESFJ:["大家把你的好当成理所当然，却忘了你也需要被哄。","你一来，陌生人三分钟变熟人——这场子，因你才热。"],
 ISTP:["你不是冷漠，是废话和虚情假意，让你浑身难受。","越是危机，你越冷静，因为你天生就为‘出事那一刻’而生。"],
 ISFP:["你看着随和，可触到你的底线，神仙也劝不动你。","你不争不抢，但你的审美和手感，是刻进骨子里的天赋。"],
 ESTP:["你不是浮躁，是你早看透了——机会稍纵即逝，犹豫的人才输。","变局里所有人都慌，只有你眼睛发亮——那是猎人闻到了机会。"],
 ESFP:["你把快乐带给所有人，可你自己崩溃的那面，从不让人看见。","你一出现，全场的目光就挪不开了——你天生属于聚光灯。"]};
// 取一句解说(随机A戳痛/B封神二选一)
function pickLine(t){const a=SOUL_LINES[t]||[""];return a[Math.floor(Math.random()*a.length)];}
// 兼容旧引用
const BASECOLOR_SOUL=new Proxy({},{get:(_,t)=>pickLine(t)});
// 16型称号·每型两个·随机出一(2026-06-26 Athena 定稿·中二封神·传播钩子)
const SOUL_NAMES={
 INTJ:["万象棋手","暗夜军师"],   INTP:["钻头脑王","逻辑鬼才"],
 ENTJ:["掌权暴君","战神"],       ENTP:["嘴炮王者","规则黑客"],
 INFJ:["灵魂摆渡人","通灵师"],   INFP:["佛系刺客","造梦师"],
 ENFJ:["万人迷","玩转全场"],     ENFP:["行走的荷尔蒙","彩虹小狗"],
 ISTJ:["龙王本王","闷声大佬"],   ISFJ:["守门人","柔情硬汉"],
 ESTJ:["天生CEO","秩序家"],      ESFJ:["团宠祖师爷","社牛大师"],
 ISTP:["机械独狼","冷面拆弹专家"],ISFP:["佛系玩家","闷骚艺术家"],
 ESTP:["天生玩家","极品猎人"],   ESFP:["行走的多巴胺","C位巨星"]};
// 取一个称号(随机二选一)
function pickName(t){const a=SOUL_NAMES[t]||[t];return a[Math.floor(Math.random()*a.length)];}
// 兼容旧引用
const SOUL_SHORT=new Proxy({},{get:(_,t)=>pickName(t)});
const PERSONA_SCENE={
 INTJ:"谋长远、定战略时——把洞察拧成一套别人看不到的布局",
 INTP:"钻原理、拆系统时——把复杂的东西拆到底层逻辑",
 ENTJ:"带队、推进、要结果时——把目标拆成可执行的指挥",
 ENTP:"破局、找新可能时——把‘不可能’辩成一堆新路子",
 INFJ:"看人、点醒、谋深意时——一句话戳到别人没说出口的地方",
 INFP:"守初心、做真我表达时——把感受炼成有穿透力的东西",
 ENFJ:"感召、带氛围、凝聚人时——让一群人愿意跟你走",
 ENFP:"点燃、链接、造势时——把热情变成感染力",
 ISTJ:"沉淀、守规矩、稳推进时——把事情一步一个脚印做扎实",
 ISFJ:"照料、守护、做后盾时——把人和事都安顿妥帖",
 ESTJ:"立规则、抓执行、管秩序时——把混乱整理成高效系统",
 ESFJ:"维系、张罗、暖场时——把关系经营得有温度",
 ISTP:"上手解决、临场救火时——不废话直接把问题修好",
 ISFP:"审美、手感、当下体验时——把美和真实做出来",
 ESTP:"应变、谈判、抓机会时——在变局里快准狠拿下",
 ESFP:"表现、带动、活在当下时——把场子点亮"};
const FUNC_ONE={
 Ne:"发散·找可能性（把一件事想出十个版本）",Ti:"拆解·钻底层逻辑（把复杂的东西拆到原理）",
 Ni:"洞察·谋长远（一眼看到事情会走向哪）",Te:"执行·抓效率（把想法拆成能落地的步骤）",
 Fe:"感召·带人（让一群人愿意跟你走）",Fi:"守真·做自己（认准了什么就守住什么）",
 Se:"应变·抓当下（变局里快准狠出手）",Si:"沉淀·稳扎稳打（把经验变成一步一脚印的扎实）"};


window.MBTI={derive:deriveBaseColor, tools:rankTools, pickName:pickName, pickLine:pickLine, SOUL_NAMES:SOUL_NAMES, SOUL_LINES:SOUL_LINES, BASECOLOR_SOUL:BASECOLOR_SOUL, PERSONA_SCENE:PERSONA_SCENE, FUNC_ONE:FUNC_ONE};
})();