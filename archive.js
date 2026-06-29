// ============================================================
// 玄玑 · 我的档案库（客户档案）
// 登录后存"测过的各种人"，点一个人 → 详情页编辑 → 用TA信息照见(免手填)。
// 依赖 index.html 已有的全局：sb(supabase) / _curUser / runChartFromInp(inp)
//   / window.MBTI(称号 pickName) / makeCityPicker / window.CITY_DATA
// 未命名档案统一显示"觉醒者"。
// ============================================================
(function(){
  const REL_OPTS=["本人","恋人","暧昧","家人","朋友","同事","客户","其他"];
  const AVA_COLORS=[['#ff9ec7','#ff6fae'],['#a8c8ff','#6f9eff'],['#ffd6a8','#ffae6f'],['#c8a8ff','#9e6fff'],['#a8ffd6','#6fffae']];
  const TZ_LIST=[["8","[东8] 中国"],["9","[东9] 东京/首尔"],["7","[东7] 曼谷/河内"],["0","[零时区] 伦敦"],["1","[东1] 巴黎/柏林"],["-5","[西5] 美东"],["-8","[西8] 美西"]];

  // ── DOM骨架 ──────────────────────────────────────────────
  function ensureDom(){
    if(document.getElementById("archiveOverlay")) return;
    const wrap=document.createElement("div");
    wrap.id="archiveOverlay";
    wrap.innerHTML=`
      <div class="arc-mask"></div>
      <div class="arc-panel" id="arcPanel">
        <!-- 列表视图 -->
        <div id="arcListView">
          <div class="arc-top">
            <span class="arc-back" id="arcClose">‹</span>
            <span class="arc-ttl">我 的 档 案 库</span>
            <span class="arc-mgmt-btn" id="arcMgmtBtn">管理</span>
          </div>
          <div class="arc-sub">玄玑为你照见过的每一个人，都在这里 · 点 TA 即查看档案</div>
          <div class="arc-list" id="arcList"></div>
          <!-- 管理模式底栏 -->
          <div class="arc-mgmt-bar" id="arcMgmtBar" style="display:none">
            <button class="arc-mgmt-all" id="arcSelectAll">全 选</button>
            <button class="arc-mgmt-del" id="arcDelSelected">删除所选</button>
          </div>
        </div>

        <!-- 详情视图 -->
        <div id="arcDetailView" style="display:none;flex-direction:column;height:100%">
          <div class="arc-top">
            <span class="arc-back" id="arcDetailBack">‹</span>
            <span class="arc-ttl" id="arcDetailTitle">档 案 详 情</span>
          </div>
          <div class="arc-detail-body" id="arcDetailBody">
            <!-- 头像+名字+关系行 -->
            <div class="arc-d-head">
              <div class="arc-d-ava" id="arcDAva"></div>
              <div class="arc-d-namerel">
                <input class="arc-d-input" id="arcDNick" placeholder="给 TA 起个名号" maxlength="12">
                <div class="arc-rels arc-d-rels" id="arcDRels"></div>
              </div>
            </div>

            <!-- 性别 -->
            <div class="arc-d-row">
              <label class="arc-d-lbl">性别</label>
              <div class="arc-d-sexbtns" id="arcDSex">
                <button class="arc-d-sex" data-v="M">♂ 男</button>
                <button class="arc-d-sex" data-v="F">♀ 女</button>
              </div>
            </div>

            <!-- 出生日期时间（滚轮，复用 makeDatePicker） -->
            <div class="arc-d-row">
              <label class="arc-d-lbl">出生时间</label>
              <div class="arc-d-citypill" id="arcDDtPill">
                <span id="arcDDtVal" class="ph">请选择出生日期时间</span>
                <span class="chev">▾</span>
              </div>
            </div>
            <!-- 日期时间浮层（详情页专用） -->
            <div class="arc-d-city-mask" id="arcDDtMask"></div>
            <div class="arc-d-city-sheet" id="arcDDtSheet">
              <div class="arc-d-city-hd">
                <button id="arcDDtCancel">取消</button>
                <span>出生日期时间</span>
                <button id="arcDDtOk">确定</button>
              </div>
              <div class="arc-d-dt-wheels" id="arcDDtWheels">
                <div class="dt-col" data-k="y"></div>
                <div class="dt-col" data-k="m"></div>
                <div class="dt-col" data-k="d"></div>
                <div class="dt-col" data-k="h"></div>
                <div class="dt-col" data-k="mi"></div>
              </div>
            </div>

            <!-- 出生地 (复用makeCityPicker，独立DOM) -->
            <div class="arc-d-row">
              <label class="arc-d-lbl">出生地</label>
              <div class="arc-d-citypill" id="arcDLocPill">
                <span id="arcDLocVal" class="ph">请选择出生地</span>
                <span class="chev">▾</span>
              </div>
            </div>
            <!-- 城市选择器浮层(详情页专用，不共享主表单) -->
            <div class="arc-d-city-mask" id="arcDLocMask"></div>
            <div class="arc-d-city-sheet" id="arcDLocSheet">
              <div class="arc-d-city-hd">
                <button id="arcDLocCancel">取消</button>
                <span>出生地</span>
                <button id="arcDLocOk">确定</button>
              </div>
              <div class="arc-d-city-wheels" id="arcDLocWheels">
                <div class="dt-col" data-k="prov"></div>
                <div class="dt-col" data-k="city"></div>
                <div class="dt-col" data-k="dist"></div>
              </div>
            </div>
            <!-- 隐藏存储 -->
            <input type="hidden" id="arcDProv"><input type="hidden" id="arcDCity"><input type="hidden" id="arcDDist">

            <!-- 时区 -->
            <div class="arc-d-row">
              <label class="arc-d-lbl">时区</label>
              <select class="arc-d-select" id="arcDTz">
                ${TZ_LIST.map(([v,t])=>`<option value="${v}">${t}</option>`).join("")}
              </select>
            </div>

            <!-- mbti显示(只读，来自星盘算出) -->
            <div class="arc-d-row arc-d-mbtirow" id="arcDMbtiRow" style="display:none">
              <label class="arc-d-lbl">底色型号</label>
              <span class="arc-d-mbti" id="arcDMbtiVal"></span>
            </div>
          </div>

          <!-- 底部操作区 -->
          <div class="arc-d-footer">
            <button class="arc-d-del" id="arcDDel">🗑 删除</button>
            <button class="arc-d-calc" id="arcDCalc">✨ 用TA信息照见</button>
          </div>
        </div>
      </div>

      <!-- 赐名弹窗(列表用，详情页改走详情编辑) -->
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

    // 绑定列表视图关闭
    document.getElementById("arcClose").onclick=closeOverlay;
    wrap.querySelector(".arc-mask").onclick=closeOverlay;

    // 关系选项(赐名弹窗)
    const rels=document.getElementById("arcRels");
    rels.innerHTML=REL_OPTS.map(r=>`<span class="arc-r">${r}</span>`).join("");
    rels.addEventListener("click",e=>{
      if(!e.target.classList.contains("arc-r"))return;
      rels.querySelectorAll(".arc-r").forEach(x=>x.classList.remove("on"));
      e.target.classList.add("on");
    });
    document.getElementById("arcNameCancel").onclick=()=>document.getElementById("arcNameMask").classList.remove("on");

    // 管理模式
    document.getElementById("arcMgmtBtn").onclick=toggleMgmt;
    document.getElementById("arcSelectAll").onclick=()=>{
      const checks=document.querySelectorAll(".arc-check");
      const allOn=[...checks].every(c=>c.classList.contains("on"));
      checks.forEach(c=>c.classList.toggle("on",!allOn));
      document.getElementById("arcSelectAll").textContent=allOn?"全 选":"取消全选";
    };
    document.getElementById("arcDelSelected").onclick=async()=>{
      const ids=[...document.querySelectorAll(".arc-check.on")].map(c=>c.dataset.id);
      if(!ids.length){alert("请先选择要删除的档案");return;}
      if(!confirm(`删除选中的 ${ids.length} 个档案？`))return;
      try{
        await sb.from("charts").update({deleted_at:new Date().toISOString()}).in("id",ids);
      }catch(_){}
      exitMgmt();
      load();
    };

    // 详情页返回
    document.getElementById("arcDetailBack").onclick=backToList;

    // 详情页关系选项
    const drels=document.getElementById("arcDRels");
    drels.innerHTML=REL_OPTS.map(r=>`<span class="arc-r">${r}</span>`).join("");
    drels.addEventListener("click",e=>{
      if(!e.target.classList.contains("arc-r"))return;
      drels.querySelectorAll(".arc-r").forEach(x=>x.classList.remove("on"));
      e.target.classList.add("on");
    });

    // 详情页性别
    document.getElementById("arcDSex").addEventListener("click",e=>{
      if(!e.target.classList.contains("arc-d-sex"))return;
      document.querySelectorAll(".arc-d-sex").forEach(b=>b.classList.remove("on"));
      e.target.classList.add("on");
    });

    // 详情页城市选择器(独立，不污染主表单)
    _arcLocSel={prov:"",city:"",dist:""};
    if(typeof makeCityPicker==="function"){
      makeCityPicker({
        wheels:"arcDLocWheels",mask:"arcDLocMask",sheet:"arcDLocSheet",
        pill:"arcDLocPill",cancel:"arcDLocCancel",ok:"arcDLocOk",val:"arcDLocVal",
        placeholder:"请选择出生地",ids:["arcDProv","arcDCity","arcDDist"],
        sel:_arcLocSel,onpick:function(v){ _arcLocPicked=v; }
      });
    }
    if(typeof makeDatePicker==="function"){
      makeDatePicker({
        wheels:"arcDDtWheels",mask:"arcDDtMask",sheet:"arcDDtSheet",
        pill:"arcDDtPill",cancel:"arcDDtCancel",ok:"arcDDtOk",val:"arcDDtVal",
        sel:_arcDtSel,
        getProg:()=>_arcDtProg, setProg:v=>{_arcDtProg=v;},
        onpick:()=>{ _arcDtPicked=true; }
      });
    }
  }

  let _mgmtMode=false;

  function toggleMgmt(){
    _mgmtMode=!_mgmtMode;
    document.getElementById("arcMgmtBtn").textContent=_mgmtMode?"完成":"管理";
    document.getElementById("arcMgmtBar").style.display=_mgmtMode?"flex":"none";
    document.querySelectorAll(".arc-check").forEach(c=>c.classList.remove("on"));
    document.getElementById("arcSelectAll").textContent="全 选";
    // 显示/隐藏复选框
    document.querySelectorAll(".arc-card-wrap").forEach(w=>{
      w.classList.toggle("mgmt",_mgmtMode);
    });
  }
  function exitMgmt(){
    _mgmtMode=false;
    const btn=document.getElementById("arcMgmtBtn"); if(btn) btn.textContent="管理";
    const bar=document.getElementById("arcMgmtBar"); if(bar) bar.style.display="none";
  }

  let _arcLocSel={prov:"",city:"",dist:""};
  let _arcLocPicked=false;
  let _arcDtSel={y:1995,m:1,d:1,h:12,mi:0};
  let _arcDtProg=false;
  let _arcDtPicked=false;

  function closeOverlay(){
    const o=document.getElementById("archiveOverlay");
    if(o) o.classList.remove("on");
  }

  function backToList(){
    document.getElementById("arcListView").style.display="flex";
    document.getElementById("arcDetailView").style.display="none";
    load();
  }

  // birth_meta → computeNatal 要的 inp
  function metaToInp(m){
    return { y:m.y, mo:m.mo, d:m.d, h:m.h, mi:m.mi, tz:m.tz, lat:m.lat, lon:m.lon,
             city:m.city||`${m.lat},${m.lon}`, sex:m.sex };
  }

  // ── 列表 ──────────────────────────────────────────────────
  async function load(){
    ensureDom();
    document.getElementById("archiveOverlay").classList.add("on");
    document.getElementById("arcListView").style.display="flex";
    document.getElementById("arcDetailView").style.display="none";
    const listEl=document.getElementById("arcList");
    listEl.innerHTML='<div class="arc-empty">正在唤回你的档案……</div>';
    if(typeof sb==="undefined"||!sb||!_curUser){ listEl.innerHTML='<div class="arc-empty">请先登入。</div>'; return; }
    let rows=[];
    try{
      const {data}=await sb.from("charts")
        .select("id,nickname,relation,mbti,sun,asc_sign,moon,birth_meta,created_at")
        .is("deleted_at",null)
        .order("created_at",{ascending:false});
      rows=data||[];
    }catch(_){ listEl.innerHTML='<div class="arc-empty">档案暂时唤不回，稍后再试。</div>'; return; }
    if(!rows.length){ listEl.innerHTML='<div class="arc-empty">还没有档案。去照见第一个人吧 ✦</div>'; return; }
    listEl.innerHTML="";
    const cards=[];
    rows.forEach((d,i)=>{ const w=renderCard(d,i); cards.push(w); listEl.appendChild(w); });
    // 点别处收回已展开的卡片
    listEl.addEventListener("touchstart",()=>{ cards.forEach(w=>w._closeSwipe&&w._closeSwipe()); },{passive:true,once:false});
  }

  function signLine(d){
    const parts=[];
    if(d.sun) parts.push("太阳"+d.sun);
    if(d.asc_sign) parts.push("上升"+d.asc_sign);
    if(d.moon) parts.push("月亮"+d.moon);
    return parts.join(" · ");
  }
  function titleOf(mbti){
    try{ return (window.MBTI&&window.MBTI.pickName)?window.MBTI.pickName(mbti):""; }catch(_){ return ""; }
  }

  function renderCard(d,i){
    const c=AVA_COLORS[i%AVA_COLORS.length];
    const named=!!(d.nickname&&d.nickname.trim());
    const showName=named?d.nickname:"觉醒者";
    const avaChar=named?d.nickname.trim()[0]:"觉";
    const typeTitle=(d.mbti?d.mbti:"")+(titleOf(d.mbti)?(" · "+titleOf(d.mbti)):"");
    const tag=named?`<span class="arc-rel">${d.relation||"未定"}</span>`
                    :`<button class="arc-name-btn">✨ 赐名</button>`;

    // wrapper = 左滑容器
    const wrap=document.createElement("div");
    wrap.className="arc-card-wrap";

    const el=document.createElement("div");
    el.className="arc-card";
    el.innerHTML=`
      <div class="arc-ava" style="background:linear-gradient(135deg,${c[0]},${c[1]})">${avaChar}</div>
      <div class="arc-meta">
        <div class="arc-nm ${named?'':'awoke'}">${showName} ${tag}</div>
        <div class="arc-type">${typeTitle||"&nbsp;"}</div>
        <div class="arc-sign">${signLine(d)}</div>
      </div>
      <span class="arc-arrow">›</span>`;

    const delBtn=document.createElement("button");
    delBtn.className="arc-swipe-del";
    delBtn.textContent="删除";

    // 复选框（管理模式才显示）
    const chk=document.createElement("div");
    chk.className="arc-check";
    chk.dataset.id=d.id;
    wrap.appendChild(chk);
    wrap.appendChild(el);
    wrap.appendChild(delBtn);

    // 左滑逻辑
    const DEL_W=72;
    let startX=0,curX=0,swiping=false,opened=false;
    let startY=0;
    el.addEventListener("touchstart",e=>{
      startX=e.touches[0].clientX;
      startY=e.touches[0].clientY;
      swiping=true;curX=0;
    },{passive:true});
    el.addEventListener("touchmove",e=>{
      if(!swiping)return;
      const dx=e.touches[0].clientX-startX;
      const dy=e.touches[0].clientY-startY;
      // 横向幅度大于纵向才认定为左滑，阻止页面滚动
      if(Math.abs(dx)>Math.abs(dy)&&dx<0){
        e.preventDefault();
        curX=dx;
        el.style.transition="none";
        el.style.transform=`translateX(${Math.max(curX,-DEL_W)}px)`;
      }
    },{passive:false});
    el.addEventListener("touchend",()=>{
      swiping=false;
      el.style.transition="transform .22s ease";
      if(curX<-DEL_W/2){ el.style.transform=`translateX(-${DEL_W}px)`; opened=true; }
      else { el.style.transform="translateX(0)"; opened=false; }
    });

    // 点卡片：管理模式→勾选；已展开→收回；否则→详情页
    el.onclick=()=>{
      if(_mgmtMode){ chk.classList.toggle("on"); return; }
      if(opened){ el.style.transform="translateX(0)"; opened=false; return; }
      openDetail(d,i);
    };

    // 赐名(觉醒者才有)
    const nb=el.querySelector(".arc-name-btn");
    if(nb) nb.onclick=e=>{ e.stopPropagation(); openName(d); };

    // 删除按钮
    delBtn.onclick=async()=>{
      if(!confirm(`删除「${showName}」的档案？`)) return;
      try{ await sb.from("charts").update({deleted_at:new Date().toISOString()}).eq("id",d.id); load(); }catch(_){}
    };

    // 点列表其他地方收回
    wrap._closeSwipe=()=>{ el.style.transition="transform .22s ease"; el.style.transform="translateX(0)"; opened=false; };

    return wrap;
  }

  // ── 详情页 ────────────────────────────────────────────────
  let _detailData=null;

  function openDetail(d,idx){
    _detailData=d;
    const lv=document.getElementById("arcListView");
    const dv=document.getElementById("arcDetailView");
    lv.style.display="none";
    dv.style.display="flex";

    // 头像颜色
    const c=AVA_COLORS[(idx||0)%AVA_COLORS.length];
    const named=!!(d.nickname&&d.nickname.trim());
    const avaChar=named?d.nickname.trim()[0]:"觉";
    const ava=document.getElementById("arcDAva");
    ava.style.background=`linear-gradient(135deg,${c[0]},${c[1]})`;
    ava.textContent=avaChar;

    // 名字
    document.getElementById("arcDNick").value=d.nickname||"";

    // 关系
    const drels=document.getElementById("arcDRels");
    drels.querySelectorAll(".arc-r").forEach(x=>x.classList.toggle("on",x.textContent===(d.relation||"")));

    // 解析 birth_meta
    const m=d.birth_meta||{};

    // 性别
    document.querySelectorAll(".arc-d-sex").forEach(b=>{
      b.classList.toggle("on",b.dataset.v===(m.sex||"M"));
    });

    // 日期+时间 → 填入 arcDtSel 并回显
    if(m.y&&m.mo&&m.d){
      _arcDtSel.y=m.y; _arcDtSel.m=m.mo; _arcDtSel.d=m.d;
      _arcDtSel.h=m.h||12; _arcDtSel.mi=m.mi||0;
      _arcDtPicked=true;
      const p=n=>String(n).padStart(2,"0");
      const valEl=document.getElementById("arcDDtVal");
      if(valEl){ valEl.textContent=`${m.y}年${p(m.mo)}月${p(m.d)}日 ${p(m.h||12)}:${p(m.mi||0)}`; valEl.classList.remove("ph"); }
    } else {
      _arcDtSel.y=1995;_arcDtSel.m=1;_arcDtSel.d=1;_arcDtSel.h=12;_arcDtSel.mi=0;
      _arcDtPicked=false;
      const valEl=document.getElementById("arcDDtVal");
      if(valEl){ valEl.textContent="请选择出生日期时间"; valEl.classList.add("ph"); }
    }

    // 城市：预填 arcLocSel + 显示文字
    if(m.city){
      document.getElementById("arcDLocVal").textContent=m.city;
      document.getElementById("arcDLocVal").classList.remove("ph");
      // 尝试拆开回填 prov/city/dist
      const parts=m.city.split(/\s|(?=[市区县])/);
      _arcLocSel.prov=m.prov||"";
      _arcLocSel.city=m.cityDisp||"";
      _arcLocSel.dist=m.dist||"";
      document.getElementById("arcDProv").value=m.prov||"";
      document.getElementById("arcDCity").value=m.cityDisp||"";
      document.getElementById("arcDDist").value=m.dist||"";
      _arcLocPicked=!!(m.lat&&m.lon);
    } else {
      document.getElementById("arcDLocVal").textContent="请选择出生地";
      document.getElementById("arcDLocVal").classList.add("ph");
      _arcLocPicked=false;
    }

    // 时区
    const tzSel=document.getElementById("arcDTz");
    tzSel.value=String(m.tz||8);

    // 星盘型号(只读)
    const mbtiRow=document.getElementById("arcDMbtiRow");
    if(d.mbti){
      mbtiRow.style.display="flex";
      document.getElementById("arcDMbtiVal").textContent=`${d.mbti}${titleOf(d.mbti)?" · "+titleOf(d.mbti):""}`;
    } else { mbtiRow.style.display="none"; }

    // 删除
    document.getElementById("arcDDel").onclick=async()=>{
      const showName=d.nickname||"觉醒者";
      if(!confirm(`删除「${showName}」的档案？`)) return;
      try{ await sb.from("charts").update({deleted_at:new Date().toISOString()}).eq("id",d.id); }catch(_){}
      backToList();
    };

    // 保存并照见
    document.getElementById("arcDCalc").onclick=async()=>{
      await saveDetailAndCalc();
    };
  }

  async function saveDetailAndCalc(){
    const d=_detailData; if(!d) return;
    const nick=document.getElementById("arcDNick").value.trim();
    const relEl=document.getElementById("arcDRels").querySelector(".arc-r.on");
    const rel=relEl?relEl.textContent:"";
    const sexEl=document.querySelector(".arc-d-sex.on");
    const sex=sexEl?sexEl.dataset.v:"M";

    // 日期时间（来自滚轮 _arcDtSel）
    if(!_arcDtPicked||!_arcDtSel.y){ alert("请选择出生日期时间"); return; }
    const yy=_arcDtSel.y, mmo=_arcDtSel.m, dd=_arcDtSel.d;
    const hh=_arcDtSel.h, mmi=_arcDtSel.mi;
    const tz=parseFloat(document.getElementById("arcDTz").value)||8;

    // 城市→经纬度
    const D=window.CITY_DATA||{};
    const prov=document.getElementById("arcDProv").value;
    const city=document.getElementById("arcDCity").value;
    const dist=document.getElementById("arcDDist").value;
    let lat,lon,cityName="";
    if(prov&&city&&dist&&D[prov]&&D[prov][city]&&D[prov][city][dist]){
      [lat,lon]=D[prov][city][dist];
      cityName=`${prov}${city}${dist}`;
    } else if(d.birth_meta&&d.birth_meta.lat){
      // 用户没改城市，沿用存好的经纬度
      lat=d.birth_meta.lat; lon=d.birth_meta.lon;
      cityName=d.birth_meta.city||`${lat},${lon}`;
    } else {
      alert("请选择出生地"); return;
    }

    // 存档案更新(名字/关系/性别/日期/城市)
    try{
      const upd={};
      if(nick) upd.nickname=nick;
      if(rel) upd.relation=rel;
      const newMeta=Object.assign({},d.birth_meta||{},{
        sex,y:yy,mo:mmo,d:dd,h:hh,mi:mmi,tz,lat,lon,city:cityName
      });
      upd.birth_meta=newMeta;
      await sb.from("charts").update(upd).eq("id",d.id);
    }catch(_){}

    // 关闭覆盖层，跑照见
    closeOverlay();
    const inp={y:yy,mo:mmo,d:dd,h:hh,mi:mmi,tz,lat,lon,city:cityName,sex};
    try{ runChartFromInp(inp); }catch(_){}
  }

  // ── 赐名弹窗(列表页) ──────────────────────────────────────
  let _editId=null;
  function openName(d){
    _editId=d.id;
    document.getElementById("arcNick").value=d.nickname||"";
    const rels=document.getElementById("arcRels");
    rels.querySelectorAll(".arc-r").forEach(x=>x.classList.toggle("on",x.textContent===(d.relation||"恋人")));
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

  // ── 绑定入口 ──────────────────────────────────────────────
  function bind(){
    const ab=document.getElementById("archiveBtn");
    if(ab) ab.onclick=load;
  }
  if(document.readyState!=="loading") bind(); else document.addEventListener("DOMContentLoaded",bind);
  window.openArchive=load;
})();
