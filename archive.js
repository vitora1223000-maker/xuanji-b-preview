// ============================================================
// 玄玑 · 我的档案库（客户档案）
// 登录后存"测过的各种人"，点一个人 → 直接用 TA 的信息照见(免手填)。
// 依赖 index.html 已有的全局：sb(supabase) / _curUser / runChartFromInp(inp)
//   / window.MBTI(称号 pickName)。未命名档案统一显示"觉醒者"。
// 回看不在这里做——以后接"命书卷轴存图"，点档案调那张图(见记忆决策)。
// ============================================================
(function(){
  const REL_OPTS=["本人","恋人","暧昧","家人","朋友","同事","客户","其他"];
  const AVA_COLORS=[['#ff9ec7','#ff6fae'],['#a8c8ff','#6f9eff'],['#ffd6a8','#ffae6f'],['#c8a8ff','#9e6fff'],['#a8ffd6','#6fffae']];

  // 注入浮层骨架(只注入一次)
  function ensureDom(){
    if(document.getElementById("archiveOverlay")) return;
    const wrap=document.createElement("div");
    wrap.id="archiveOverlay";
    wrap.innerHTML=`
      <div class="arc-mask"></div>
      <div class="arc-panel">
        <div class="arc-top">
          <span class="arc-back" id="arcClose">‹</span>
          <span class="arc-ttl">我 的 档 案 库</span>
        </div>
        <div class="arc-sub">玄玑为你照见过的每一个人，都在这里 · 点 TA 即用其信息重新照见</div>
        <div class="arc-list" id="arcList"></div>
      </div>
      <div class="arc-name-mask" id="arcNameMask">
        <div class="arc-dlg">
          <h3>✦ 为 TA 赐名 ✦</h3>
          <div class="arc-tip">赐下名号、定个关系，收入你的档案库。</div>
          <div class="arc-fld"><label>名号</label><input id="arcNick" placeholder="给 TA 起个名" maxlength="12"></div>
          <div class="arc-fld"><label>关系</label><div class="arc-rels" id="arcRels"></div></div>
          <div class="arc-dlg-ops"><button id="arcNameCancel">稍后</button><button class="save" id="arcNameSave">赐 名</button></div>
        </div>
      </div>`;
    document.body.appendChild(wrap);
    document.getElementById("arcClose").onclick=close;
    wrap.querySelector(".arc-mask").onclick=close;
    // 关系选项
    const rels=document.getElementById("arcRels");
    rels.innerHTML=REL_OPTS.map(r=>`<span class="arc-r">${r}</span>`).join("");
    rels.addEventListener("click",e=>{
      if(!e.target.classList.contains("arc-r"))return;
      rels.querySelectorAll(".arc-r").forEach(x=>x.classList.remove("on"));
      e.target.classList.add("on");
    });
    document.getElementById("arcNameCancel").onclick=()=>document.getElementById("arcNameMask").classList.remove("on");
  }

  function close(){ const o=document.getElementById("archiveOverlay"); if(o) o.classList.remove("on"); }

  // birth_meta → computeNatal 要的 inp
  function metaToInp(m){
    return { y:m.y, mo:m.mo, d:m.d, h:m.h, mi:m.mi, tz:m.tz, lat:m.lat, lon:m.lon,
             city:m.city||`${m.lat},${m.lon}`, sex:m.sex };
  }

  // 拉本账号所有档案并渲染
  async function load(){
    ensureDom();
    document.getElementById("archiveOverlay").classList.add("on");
    const listEl=document.getElementById("arcList");
    listEl.innerHTML='<div class="arc-empty">正在唤回你的档案……</div>';
    if(typeof sb==="undefined" || !sb || !_curUser){ listEl.innerHTML='<div class="arc-empty">请先登入。</div>'; return; }
    let rows=[];
    try{
      const {data}=await sb.from("charts")
        .select("id,nickname,relation,mbti,sun,asc_sign,moon,birth_meta,created_at")
        .order("created_at",{ascending:false});
      rows=data||[];
    }catch(_){ listEl.innerHTML='<div class="arc-empty">档案暂时唤不回，稍后再试。</div>'; return; }
    if(!rows.length){ listEl.innerHTML='<div class="arc-empty">还没有档案。去照见第一个人吧 ✦</div>'; return; }
    listEl.innerHTML="";
    rows.forEach((d,i)=>listEl.appendChild(renderCard(d,i)));
  }

  function signLine(d){
    const parts=[];
    if(d.sun) parts.push("太阳"+d.sun);
    if(d.asc_sign) parts.push("上升"+d.asc_sign);
    if(d.moon) parts.push("月亮"+d.moon);
    return parts.join(" · ");
  }
  function title(mbti){
    try{ return (window.MBTI&&window.MBTI.pickName)?window.MBTI.pickName(mbti):""; }catch(_){ return ""; }
  }

  function renderCard(d,i){
    const c=AVA_COLORS[i%AVA_COLORS.length];
    const named=!!(d.nickname&&d.nickname.trim());
    const showName=named?d.nickname:"觉醒者";
    const avaChar=named?d.nickname.trim()[0]:"觉";
    const typeTitle=(d.mbti?d.mbti:"")+(title(d.mbti)?(" · "+title(d.mbti)):"");
    const el=document.createElement("div");
    el.className="arc-card";
    const tag = named ? `<span class="arc-rel">${d.relation||"未定"}</span>`
                      : `<button class="arc-name-btn">✨ 赐名</button>`;
    el.innerHTML=`
      <div class="arc-ava" style="background:linear-gradient(135deg,${c[0]},${c[1]})">${avaChar}</div>
      <div class="arc-meta">
        <div class="arc-nm ${named?'':'awoke'}">${showName} ${tag}</div>
        <div class="arc-type">${typeTitle||"&nbsp;"}</div>
        <div class="arc-sign">${signLine(d)}</div>
      </div>
      <button class="arc-del" title="删除">🗑</button>`;
    // 点卡片主体 = 直接用 TA 信息照见
    el.onclick=()=>{
      try{ runChartFromInp(metaToInp(d.birth_meta||{})); }catch(_){ }
    };
    // 赐名按钮(觉醒者才有)
    const nb=el.querySelector(".arc-name-btn");
    if(nb) nb.onclick=e=>{ e.stopPropagation(); openName(d); };
    // 删除
    el.querySelector(".arc-del").onclick=async e=>{
      e.stopPropagation();
      if(!confirm(`删除「${showName}」的档案？`)) return;
      try{ await sb.from("charts").delete().eq("id",d.id); load(); }catch(_){}
    };
    return el;
  }

  // 赐名弹窗
  let _editId=null;
  function openName(d){
    _editId=d.id;
    document.getElementById("arcNick").value=d.nickname||"";
    const rels=document.getElementById("arcRels");
    rels.querySelectorAll(".arc-r").forEach(x=>x.classList.toggle("on", x.textContent===(d.relation||"恋人")));
    document.getElementById("arcNameMask").classList.add("on");
    document.getElementById("arcNameSave").onclick=async()=>{
      const nick=document.getElementById("arcNick").value.trim();
      const on=rels.querySelector(".arc-r.on");
      const rel=on?on.textContent:"";
      if(!nick){ document.getElementById("arcNick").focus(); return; }
      try{ await sb.from("charts").update({nickname:nick,relation:rel}).eq("id",_editId); }catch(_){}
      document.getElementById("arcNameMask").classList.remove("on");
      load();
    };
  }

  // 绑定右上角 📁
  function bind(){
    const ab=document.getElementById("archiveBtn");
    if(ab) ab.onclick=load;
  }
  if(document.readyState!=="loading") bind(); else document.addEventListener("DOMContentLoaded",bind);
  window.openArchive=load; // 备用入口
})();
