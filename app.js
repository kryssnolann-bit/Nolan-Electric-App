const { createClient } = window.supabase;
const cfg=window.NOLAN_CONFIG;
const root=document.getElementById("app");
let sb=null, session=null, profile=null, state={tab:"dashboard",jobs:[],customers:[],tasks:[],selected:null,loading:false};

function esc(v){return String(v??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]))}
function money(v){return new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format(Number(v||0))}
function toast(msg){alert(msg)}
function render(){root.innerHTML=session?appShell():login();}
function login(){return `<div style="min-height:100vh;display:grid;place-items:center;padding:20px"><div class="card" style="max-width:420px;width:100%"><div class="brand">Nolan Electric</div><p>Job Command Center</p><form id="login" class="form"><input id="email" type="email" placeholder="Email" required><input id="pw" type="password" placeholder="Password" required><button class="btn primary">Sign In</button></form><p class="sub">Use the employee account created in Supabase Auth.</p></div></div>`}
function appShell(){
 const isField=profile?.role==="employee"||profile?.role==="crew_lead";
 return `<div class="top"><div class="row"><div><div class="brand">Nolan Electric</div><div class="sub">${esc(profile?.full_name||"User")} · ${esc(profile?.role||"")}</div></div><button id="logout" class="btn">Sign Out</button></div></div>
 <div class="wrap">
 <div class="nav">${(isField?["field","jobs"]:["dashboard","customers","jobs","financial"]).map(t=>`<button data-tab="${t}" class="${state.tab===t?"btn primary":"btn"}">${t==="field"?"My Day":t[0].toUpperCase()+t.slice(1)}</button>`).join("")}</div>
 ${state.tab==="dashboard"?dashboard():state.tab==="customers"?customers():state.tab==="jobs"?jobs():state.tab==="financial"?financial():field()}
 </div>${state.selected?jobModal(state.selected):""}`;
}
function dashboard(){let active=state.jobs.filter(j=>!["paid","closed"].includes(j.status));return `<div class="grid"><div class="card metric"><span>Active Jobs</span><b>${active.length}</b></div><div class="card metric"><span>Pipeline</span><b>${money(state.jobs.reduce((a,j)=>a+Number(j.contract_amount||0),0))}</b></div><div class="card metric"><span>Customers</span><b>${state.customers.length}</b></div><div class="card metric"><span>My Role</span><b style="font-size:18px">${esc(profile?.role||"")}</b></div></div><div class="card" style="margin-top:14px"><div class="row"><h2>Recent Jobs</h2><button id="newJob" class="btn primary">+ New Job</button></div>${jobList(active.slice(0,8))}</div>`}
function jobList(list){return `<div class="list">${list.length?list.map(j=>`<div class="job"><div class="row"><div><b>${esc(j.job_number)} · ${esc(j.name)}</b><div class="sub">${esc(j.customers?.name||"")} · ${esc(j.status)}</div></div><button class="btn" data-job="${j.id}">Open</button></div></div>`).join(""):`<div class="empty">No jobs yet.</div>`}</div>`}
function customers(){return `<div class="card"><div class="row"><h2>Customers</h2><button id="newCustomer" class="btn primary">+ Customer</button></div><div class="list">${state.customers.map(c=>`<div class="job"><b>${esc(c.name)}</b><div class="sub">${esc(c.company||"")} ${c.phone?"· "+esc(c.phone):""}</div><div class="sub">${esc(c.email||"")}</div></div>`).join("")||`<div class="empty">No customers.</div>`}</div></div>`}
function jobs(){return `<div class="card"><div class="row"><h2>Jobs</h2><button id="newJob" class="btn primary">+ New Job</button></div>${jobList(state.jobs)}</div>`}
function financial(){let total=state.jobs.reduce((a,j)=>a+Number(j.contract_amount||0),0);return `<div class="grid"><div class="card metric"><span>Contract Value</span><b>${money(total)}</b></div><div class="card metric"><span>Jobs</span><b>${state.jobs.length}</b></div></div><div class="card" style="margin-top:14px"><h2>Financial Center</h2><p>Live estimates, invoices, payments and actual job costs are connected to the database. Detailed financial screens are next in V4.</p></div>`}
function field(){let assigned=state.jobs;return `<div class="card"><h2>My Day</h2><p>Field operations for assigned jobs.</p><div class="field-actions"><button class="btn primary" id="quickNote">ADD NOTE</button><button class="btn" id="quickMaterial">NEED MATERIAL</button><button class="btn" id="refresh">REFRESH JOBS</button></div></div><div class="card" style="margin-top:14px"><h2>Assigned Jobs</h2>${jobList(assigned)}</div>`}
function jobModal(j){return `<div class="modal"><div class="sheet"><div class="row"><div><h2>${esc(j.job_number)} · ${esc(j.name)}</h2><div class="sub">${esc(j.customers?.name||"")} · ${esc(j.status)}</div></div><button class="btn" id="close">Close</button></div><hr><p>${esc(j.description||"No description")}</p><div class="grid"><div class="card metric"><span>Contract</span><b>${money(j.contract_amount)}</b></div><div class="card metric"><span>Est. Labor</span><b>${Number(j.estimated_labor_hours||0)}h</b></div></div><h3>Tasks</h3><div id="tasks">${state.tasks.filter(t=>t.job_id===j.id).map(t=>`<label class="job" style="display:block"><input type="checkbox" data-task="${t.id}" ${t.status==="complete"?"checked":""}> ${esc(t.title)}</label>`).join("")||"<div class='empty'>No tasks.</div>"}</div><h3>Field Update</h3><div class="field-actions"><button class="btn primary" id="addNote">ADD NOTE</button><button class="btn" id="addMaterial">NEED MATERIAL</button><button class="btn" id="addPhoto">ADD PHOTO</button></div></div></div>`}

async function load(){
 state.loading=true;
 render();
 try{
   const cr=await sb.from("customers")
     .select("id,name,company,phone,email,notes,created_at")
     .order("name");
   if(cr.error) throw new Error("Customers could not be loaded: "+cr.error.message);
   state.customers=cr.data||[];
   render();

   const jr=await sb.from("jobs")
     .select("*,customers(name)")
     .order("created_at",{ascending:false});
   if(jr.error){
     console.error("Jobs load error:",jr.error);
     state.jobs=[];
   }else{
     state.jobs=jr.data||[];
   }

   if(state.selected){
     const tr=await sb.from("job_tasks")
       .select("*")
       .eq("job_id",state.selected.id)
       .order("created_at");
     if(tr.error){
       console.error("Tasks load error:",tr.error);
       state.tasks=[];
     }else{
       state.tasks=tr.data||[];
     }
   }
 }catch(err){
   console.error(err);
   toast(err?.message||"Could not load data from Supabase.");
 }
 state.loading=false;
 render();
}

function modalForm(title,body,onSubmit){
 const wrap=document.createElement("div");wrap.className="modal";
 wrap.innerHTML=`<div class="sheet"><div class="row"><h2>${title}</h2><button class="btn" id="x">Close</button></div>${body}</div>`;
 document.body.appendChild(wrap);
 wrap.querySelector("#x").onclick=()=>wrap.remove();
 wrap.querySelector("form").onsubmit=async e=>{
   e.preventDefault();
   const form=e.target;
   const button=form.querySelector("button[type=submit],button:last-child");
   if(button){button.disabled=true;button.textContent="Saving...";}
   try{
     const result=await onSubmit(new FormData(form));
     if(result && result.error) throw result.error;
     wrap.remove();
     await load();
     toast("Saved successfully.");
   }catch(err){
     console.error(err);
     toast(err?.message||"Could not save. Please try again.");
     if(button){button.disabled=false;button.textContent=button.dataset.original||"Save";}
   }
 };
}
document.addEventListener("click",async e=>{
 const tab=e.target.closest("[data-tab]"); if(tab){state.tab=tab.dataset.tab;state.selected=null;await load();return}
 if(e.target.id==="logout"){await sb.auth.signOut();return}
 if(e.target.id==="newCustomer") modalForm("New Customer",`<form class="form"><input name="name" placeholder="Customer name" required><input name="company" placeholder="Company"><input name="phone" placeholder="Phone"><input name="email" type="email" placeholder="Email"><textarea name="notes" placeholder="Notes"></textarea><button class="btn primary">Save Customer</button></form>`,async f=>{
   const r=await sb.from("customers").insert({
     name:f.get("name"),company:f.get("company"),phone:f.get("phone"),
     email:f.get("email"),notes:f.get("notes")
   }).select("id,name,company,phone,email,notes,created_at").single();
   if(r.error) return r;
   if(r.data) state.customers=[r.data,...state.customers].sort((a,b)=>String(a.name||"").localeCompare(String(b.name||"")));
   return r;
 });
 if(e.target.id==="newJob") modalForm("New Job",`<form class="form"><input name="job_number" placeholder="Job # (e.g. 2026-001)" required><input name="name" placeholder="Job name" required><select name="customer_id">${state.customers.map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join("")}</select><select name="status"><option>lead</option><option selected>estimate</option><option>approved</option><option>scheduled</option></select><input name="contract_amount" type="number" step=".01" placeholder="Contract amount"><textarea name="description" placeholder="Scope / description"></textarea><button class="btn primary">Create Job</button></form>`,async f=>{return await sb.from("jobs").insert({job_number:f.get("job_number"),name:f.get("name"),customer_id:f.get("customer_id")||null,status:f.get("status"),contract_amount:Number(f.get("contract_amount")||0),description:f.get("description")})});
 const jb=e.target.closest("[data-job]"); if(jb){state.selected=state.jobs.find(x=>x.id===jb.dataset.job);await load();return}
 if(e.target.id==="close"){state.selected=null;render()}
 if(e.target.id==="addNote"||e.target.id==="quickNote"){if(!state.selected){toast("Open a job first.");return} modalForm("Add Field Note",`<form class="form"><textarea name="message" required placeholder="What happened on the job?"></textarea><button class="btn primary">Save Note</button></form>`,async f=>{return await sb.from("job_activity").insert({job_id:state.selected.id,profile_id:session.user.id,event_type:"field_note",message:f.get("message")})})}
 if(e.target.id==="addMaterial"||e.target.id==="quickMaterial"){if(!state.selected){toast("Open a job first.");return} modalForm("Material Request",`<form class="form"><input name="item" required placeholder="Material"><input name="quantity" type="number" step=".01" value="1"><textarea name="notes" placeholder="Notes"></textarea><button class="btn primary">Request Material</button></form>`,async f=>{return await sb.from("material_requests").insert({job_id:state.selected.id,requested_by:session.user.id,item:f.get("item"),quantity:Number(f.get("quantity")||1),notes:f.get("notes")})})}
 if(e.target.id==="addPhoto"){toast("Photo storage hookup is the next V4 step.")}
 if(e.target.id==="refresh"){await load()}
});
document.addEventListener("change",async e=>{const id=e.target.dataset.task;if(id){await sb.from("job_tasks").update({status:e.target.checked?"complete":"open",completed_at:e.target.checked?new Date().toISOString():null}).eq("id",id);await load()}})
document.addEventListener("submit",async e=>{if(e.target.id==="login"){e.preventDefault();const email=e.target.email.value,pw=e.target.pw.value;const {error}=await sb.auth.signInWithPassword({email,password:pw});if(error)toast(error.message)}});

(async()=>{if(cfg.supabaseKey.includes("PASTE_")){root.innerHTML=`<div class="wrap"><div class="card"><h2>Nolan Electric V4</h2><p>Supabase is configured by URL, but the publishable key is still missing.</p><p>Open <b>config.js</b> and paste your Supabase publishable key into <b>supabaseKey</b>.</p></div></div>`;return}
sb=createClient(cfg.supabaseUrl,cfg.supabaseKey);
const {data}=await sb.auth.getSession();session=data.session;
if(session){const {data:p}=await sb.from("profiles").select("*").eq("id",session.user.id).maybeSingle();profile=p}
render(); if(session)load();
sb.auth.onAuthStateChange(async(_e,s)=>{session=s;if(s){const {data:p}=await sb.from("profiles").select("*").eq("id",s.user.id).maybeSingle();profile=p}else profile=null;render();if(s)load()});
})();