const { createClient } = window.supabase;
const cfg=window.NOLAN_CONFIG;
const root=document.getElementById("app");
let sb=null, session=null, profile=null;
let state={tab:"dashboard",jobs:[],customers:[],tasks:[],members:[],profiles:[],selected:null,loading:false};

const esc=v=>String(v??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));
const money=v=>new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format(Number(v||0));
const dateFmt=v=>v?new Date(v).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"}):"—";
const statusLabel=v=>String(v||"").replaceAll("_"," ").replace(/\b\w/g,x=>x.toUpperCase());
function toast(msg){alert(msg)}
function isFieldUser(){return profile?.role==="employee"||profile?.role==="crew_lead"}
function normalizeTab(){if(isFieldUser() && !["field","jobs"].includes(state.tab)) state.tab="field"; if(!isFieldUser() && state.tab==="field") state.tab="dashboard"}
function render(){normalizeTab();root.innerHTML=session?appShell():login()}

function login(){return `<div style="min-height:100vh;display:grid;place-items:center;padding:20px"><div class="card" style="max-width:420px;width:100%"><div class="brand">Nolan Electric</div><p>Job Command Center</p><form id="login" class="form"><input id="email" type="email" placeholder="Email" required><input id="pw" type="password" placeholder="Password" required><button class="btn primary">Sign In</button></form><p class="sub">Use the employee account created in Supabase Auth.</p></div></div>`}

function appShell(){
 const isField=isFieldUser();
 const tabs=isField?["field","jobs"]:["dashboard","customers","jobs","team","financial"];
 return `<div class="top"><div class="row"><div><div class="brand">Nolan Electric</div><div class="sub">${esc(profile?.full_name||"User")} · ${esc(profile?.role||"")}</div></div><button id="logout" class="btn">Sign Out</button></div></div>
 <div class="wrap"><div class="nav">${tabs.map(t=>`<button data-tab="${t}" class="${state.tab===t?"btn primary":"btn"}">${t==="field"?"My Day":t==="team"?"Team":t[0].toUpperCase()+t.slice(1)}</button>`).join("")}</div>
 ${state.tab==="dashboard"?dashboard():state.tab==="customers"?customers():state.tab==="jobs"?jobs():state.tab==="team"?team():state.tab==="financial"?financial():field()}</div>${state.selected?jobModal(state.selected):""}`;
}

function dashboard(){
 const active=state.jobs.filter(j=>!["paid","closed","complete"].includes(j.status));
 const scheduled=state.jobs.filter(j=>j.status==="scheduled");
 return `<div class="grid">
 <div class="card metric"><span>Active Jobs</span><b>${active.length}</b></div>
 <div class="card metric"><span>Pipeline</span><b>${money(state.jobs.reduce((a,j)=>a+Number(j.contract_amount||0),0))}</b></div>
 <div class="card metric"><span>Customers</span><b>${state.customers.length}</b></div>
 <div class="card metric"><span>Scheduled</span><b>${scheduled.length}</b></div></div>
 <div class="card" style="margin-top:14px"><div class="row"><div><h2>Job Command Center</h2><div class="sub">Every job, crew task, material request and financial number in one place.</div></div><button id="newJob" class="btn primary">+ New Job</button></div>
 <div class="pipeline">${["lead","estimate","approved","scheduled","in_progress","punch_list","complete","invoiced","paid"].map(s=>`<div><b>${state.jobs.filter(j=>j.status===s).length}</b><span>${statusLabel(s)}</span></div>`).join("")}</div>
 <h3>Recent Jobs</h3>${jobList(active.slice(0,8))}</div>`;
}

function jobList(list){
 return `<div class="list">${list.length?list.map(j=>`<div class="job">
 <div class="row"><div style="min-width:0"><b>${esc(j.job_number)} · ${esc(j.name)}</b><div class="sub">${esc(j.customers?.name||"No customer")} · ${statusLabel(j.status)}</div>
 <div class="sub">${j.scheduled_start?`Scheduled ${dateFmt(j.scheduled_start)}`:"Not scheduled"}${j.contract_amount!=null?" · "+money(j.contract_amount):""}</div></div><button class="btn" data-job="${j.id}">Open</button></div>
 </div>`).join(""):`<div class="empty">No jobs yet.</div>`}</div>`;
}

function customers(){
 return `<div class="card"><div class="row"><h2>Customers</h2><button id="newCustomer" class="btn primary">+ Customer</button></div>
 <div class="list">${state.customers.map(c=>`<div class="job"><b>${esc(c.name)}</b><div class="sub">${esc(c.company||"")} ${c.phone?"· "+esc(c.phone):""}</div><div class="sub">${esc(c.email||"")}</div></div>`).join("")||`<div class="empty">No customers.</div>`}</div></div>`;
}

function jobs(){
 const groups=["lead","estimate","approved","scheduled","in_progress","punch_list","complete","invoiced","paid","closed"];
 return `<div class="card"><div class="row"><div><h2>Jobs</h2><div class="sub">${state.jobs.length} total jobs</div></div><button id="newJob" class="btn primary">+ New Job</button></div>
 <div class="job-filters">${groups.map(s=>`<button class="pill ${state.jobs.some(j=>j.status===s)?"active":""}" data-filter="${s}">${statusLabel(s)} (${state.jobs.filter(j=>j.status===s).length})</button>`).join("")}</div>
 <div id="jobResults">${jobList(state.jobs)}</div></div>`;
}

function team(){
 const active=state.profiles.filter(p=>p.active).length;
 return `<div class="card"><div class="row"><div><h2>Team</h2><div class="sub">${active} active · ${state.profiles.length} total employees</div></div><button id="newEmployee" class="btn primary">+ Employee</button></div>
 <div class="list" style="margin-top:14px">${state.profiles.map(p=>`<div class="job"><div class="row"><div><b>${esc(p.full_name)}</b><div class="sub">${esc(p.role||"employee")} ${p.email?"· "+esc(p.email):""}</div>${p.phone?`<div class="sub">${esc(p.phone)}</div>`:""}</div><div style="text-align:right"><span class="pill ${p.active?"active":""}">${p.active?"Active":"Inactive"}</span><button class="btn" data-employee="${p.id}" style="margin-left:6px">Manage</button></div></div></div>`).join("")||`<div class="empty">No employees yet.</div>`}</div></div>
 <div class="card" style="margin-top:14px"><h3>Employee access</h3><p class="sub">New employees get a Nolan Electric login. The app never stores employee passwords in the database.</p></div>`;
}

function employeeForm(p){
 const roles=["employee","crew_lead","manager","admin"];
 modalForm(p?"Manage Employee":"Add Employee",`<form class="form">
 <input name="full_name" value="${esc(p?.full_name||"")}" placeholder="Full name" required>
 <input name="email" type="email" value="${esc(p?.email||"")}" placeholder="Email address" ${p?"readonly":"required"}>
 <input name="phone" value="${esc(p?.phone||"")}" placeholder="Phone">
 <select name="role">${roles.map(r=>`<option value="${r}" ${p?.role===r?"selected":""}>${statusLabel(r)}</option>`).join("")}</select>
 ${p?`<label style="display:flex;align-items:center;gap:8px"><input name="active" type="checkbox" ${p.active?"checked":""}> Active employee</label>`:`<p class="sub">A temporary password will be generated for the employee. Give it to them securely, then have them change it after signing in.</p>`}
 <button class="btn primary" type="submit">${p?"Save Changes":"Create Employee"}</button></form>`,async f=>{
  if(p){
   const r=await sb.functions.invoke("employee-admin",{body:{action:"update",id:p.id,full_name:f.get("full_name"),phone:f.get("phone"),role:f.get("role"),active:f.get("active")==="on"}});
   if(!r.error && r.data?.error) return {error:new Error(r.data.error)};
   return r;
  }
  const r=await sb.functions.invoke("employee-admin",{body:{action:"create",full_name:f.get("full_name"),email:f.get("email"),phone:f.get("phone"),role:f.get("role")}});
  if(!r.error && r.data?.error) return {error:new Error(r.data.error)};
  if(!r.error && r.data?.temporary_password) toast(`Employee created.\n\nEmail: ${r.data.email}\nTemporary password: ${r.data.temporary_password}\n\nGive this to the employee securely. They should change it after signing in.`);
  return r;
 });
}

function financial(){
 const total=state.jobs.reduce((a,j)=>a+Number(j.contract_amount||0),0);
 const estLabor=state.jobs.reduce((a,j)=>a+Number(j.estimated_labor_cost||0),0);
 const estMat=state.jobs.reduce((a,j)=>a+Number(j.estimated_material_cost||0),0);
 return `<div class="grid"><div class="card metric"><span>Contract Value</span><b>${money(total)}</b></div><div class="card metric"><span>Estimated Labor</span><b>${money(estLabor)}</b></div><div class="card metric"><span>Estimated Materials</span><b>${money(estMat)}</b></div><div class="card metric"><span>Jobs</span><b>${state.jobs.length}</b></div></div>
 <div class="card" style="margin-top:14px"><h2>Financial Center</h2><p>Job-level contract value and estimating fields are live. Actual costs, invoices, payments and gross margin will be expanded here next.</p></div>`;
}

function field(){
 return `<div class="card"><h2>My Day</h2><p>Field operations for assigned jobs.</p><div class="field-actions"><button class="btn primary" id="quickNote">ADD NOTE</button><button class="btn" id="quickMaterial">NEED MATERIAL</button><button class="btn" id="refresh">REFRESH JOBS</button></div></div>
 <div class="card" style="margin-top:14px"><h2>Assigned Jobs</h2>${jobList(state.jobs)}</div>`;
}

function jobModal(j){
 const tasks=state.tasks.filter(t=>t.job_id===j.id);
 const members=state.members.filter(m=>m.job_id===j.id);
 return `<div class="modal"><div class="sheet"><div class="row"><div><h2>${esc(j.job_number)} · ${esc(j.name)}</h2><div class="sub">${esc(j.customers?.name||"No customer")} · ${statusLabel(j.status)}</div></div><button class="btn" id="close">Close</button></div><hr>
 <div class="grid">
 <div class="card metric"><span>Contract</span><b>${money(j.contract_amount)}</b></div>
 <div class="card metric"><span>Est. Labor</span><b>${Number(j.estimated_labor_hours||0)}h</b></div>
 <div class="card metric"><span>Labor Cost</span><b>${money(j.estimated_labor_cost)}</b></div>
 <div class="card metric"><span>Materials</span><b>${money(j.estimated_material_cost)}</b></div></div>
 <div class="job-detail"><b>Customer:</b> ${esc(j.customers?.name||"—")} &nbsp; <b>Type:</b> ${statusLabel(j.job_type||"—")} &nbsp; <b>Schedule:</b> ${dateFmt(j.scheduled_start)}</div>
 <p>${esc(j.description||"No scope/description entered.")}</p>
 <h3>Status</h3><div class="status-buttons">${["lead","estimate","approved","scheduled","in_progress","punch_list","complete","invoiced","paid"].map(s=>`<button class="pill ${j.status===s?"active":""}" data-status="${s}" data-jobstatus="${j.id}">${statusLabel(s)}</button>`).join("")}</div>
 <h3>Tasks <button id="addTask" class="btn" style="float:right">+ Task</button></h3>
 <div id="tasks">${tasks.map(t=>`<label class="job" style="display:block;margin-bottom:8px"><input type="checkbox" data-task="${t.id}" ${t.status==="complete"?"checked":""}> ${esc(t.title)}${t.description?`<div class="sub">${esc(t.description)}</div>`:""}</label>`).join("")||"<div class='empty'>No tasks yet. Add the first task.</div>"}</div>
 <h3>Crew</h3><div class="list">${members.map(m=>`<div class="job"><b>${esc(m.profiles?.full_name||"Crew member")}</b><div class="sub">${esc(m.profiles?.role||"")}</div></div>`).join("")||"<div class='empty'>No crew assigned yet.</div>"}</div>
 <h3>Field Updates</h3><div class="field-actions"><button class="btn primary" id="addNote">ADD NOTE</button><button class="btn" id="addMaterial">NEED MATERIAL</button><button class="btn" id="addPhoto">ADD PHOTO</button></div>
 </div></div>`;
}

async function load(){
 state.loading=true; render();
 try{
  const cr=await sb.from("customers").select("id,name,company,phone,email,notes,created_at").order("name");
  if(cr.error)throw new Error("Customers could not be loaded: "+cr.error.message);
  state.customers=cr.data||[];
  const pr=await sb.from("profiles").select("*").order("created_at");
  if(pr.error)throw new Error("Team could not be loaded: "+pr.error.message);
  state.profiles=pr.data||[];
  const jr=await sb.from("jobs").select("*,customers(name)").order("created_at",{ascending:false});
  if(jr.error)throw new Error("Jobs could not be loaded: "+jr.error.message);
  state.jobs=jr.data||[];
  if(state.selected){
   const tr=await sb.from("job_tasks").select("*").eq("job_id",state.selected.id).order("created_at");
   state.tasks=tr.error?[]:(tr.data||[]);
   const mr=await sb.from("job_members").select("job_id,profile_id,profiles(full_name,role)").eq("job_id",state.selected.id);
   state.members=mr.error?[]:(mr.data||[]);
  }
 }catch(err){console.error(err);toast(err?.message||"Could not load data from Supabase.")}
 state.loading=false;render();
}

function modalForm(title,body,onSubmit){
 const wrap=document.createElement("div");wrap.className="modal";
 wrap.innerHTML=`<div class="sheet"><div class="row"><h2>${title}</h2><button class="btn" id="x">Close</button></div>${body}</div>`;
 document.body.appendChild(wrap);wrap.querySelector("#x").onclick=()=>wrap.remove();
 const form=wrap.querySelector("form");
 form.onsubmit=async e=>{
  e.preventDefault();const button=form.querySelector("button[type=submit],button:last-child");
  if(button){button.disabled=true;button.textContent="Saving..."}
  try{const result=await onSubmit(new FormData(form));if(result?.error)throw result.error;wrap.remove();await load();toast("Saved successfully.")}catch(err){console.error(err);toast(err?.message||"Could not save. Please try again.");if(button){button.disabled=false;button.textContent="Save"}}
 };
}

async function openNewJob(){
 if(!state.customers.length){toast("Add a customer first.");return}
 const next=String(new Date().getFullYear())+"-"+String(state.jobs.length+1).padStart(3,"0");
 modalForm("New Job",`<form class="form">
 <input name="job_number" value="${next}" placeholder="Job #" required>
 <input name="name" placeholder="Job name" required>
 <select name="customer_id">${state.customers.map(c=>`<option value="${c.id}">${esc(c.name)}${c.company?" — "+esc(c.company):""}</option>`).join("")}</select>
 <select name="job_type"><option value="new_construction">New Construction</option><option value="service">Service Call</option><option value="remodel">Remodel</option><option value="inspection_deficiency">Inspection / Deficiency</option><option value="other">Other</option></select>
 <select name="status"><option>lead</option><option selected>estimate</option><option>approved</option><option>scheduled</option></select>
 <input name="contract_amount" type="number" step=".01" placeholder="Contract / estimate amount">
 <input name="estimated_labor_hours" type="number" step=".25" placeholder="Estimated labor hours">
 <input name="estimated_labor_cost" type="number" step=".01" placeholder="Estimated labor cost">
 <input name="estimated_material_cost" type="number" step=".01" placeholder="Estimated material cost">
 <input name="scheduled_start" type="date">
 <textarea name="description" placeholder="Scope of work"></textarea>
 <button class="btn primary" type="submit">Create Job</button></form>`,async f=>{
  const r=await sb.from("jobs").insert({
   job_number:f.get("job_number"),name:f.get("name"),customer_id:f.get("customer_id"),
   job_type:f.get("job_type"),status:f.get("status"),contract_amount:Number(f.get("contract_amount")||0),
   estimated_labor_hours:Number(f.get("estimated_labor_hours")||0),estimated_labor_cost:Number(f.get("estimated_labor_cost")||0),
   estimated_material_cost:Number(f.get("estimated_material_cost")||0),
   scheduled_start:f.get("scheduled_start")||null,description:f.get("description")
  }).select("id").single();
  if(!r.error && r.data?.id){
   const templates={
    new_construction:["Layout / rough-in","Service / panel","Trim-out","Fixtures / devices","Final testing / punch list"],
    service:["Diagnose issue","Complete repair","Test system","Customer walkthrough"],
    remodel:["Demo / existing conditions","Rough-in","Trim-out","Test / punch list"],
    inspection_deficiency:["Review deficiency report","Correct deficiencies","Test / verify","Document completion"],
    other:["Scope review","Perform electrical work","Test / verify","Complete punch list"]
   };
   await sb.from("job_tasks").insert((templates[f.get("job_type")]||templates.other).map(title=>({job_id:r.data.id,title,status:"open"})));
  }
  return r;
 });
}

document.addEventListener("click",async e=>{
 const tab=e.target.closest("[data-tab]");if(tab){state.tab=tab.dataset.tab;state.selected=null;await load();return}
 if(e.target.id==="logout"){await sb.auth.signOut();return}
 if(e.target.id==="newEmployee"){employeeForm();return}
 const emp=e.target.closest("[data-employee]");if(emp){const p=state.profiles.find(x=>x.id===emp.dataset.employee);if(p)employeeForm(p);return}
 if(e.target.id==="newCustomer")modalForm("New Customer",`<form class="form"><input name="name" placeholder="Customer name" required><input name="company" placeholder="Company"><input name="phone" placeholder="Phone"><input name="email" type="email" placeholder="Email"><textarea name="notes" placeholder="Notes"></textarea><button class="btn primary" type="submit">Save Customer</button></form>`,async f=>sb.from("customers").insert({name:f.get("name"),company:f.get("company"),phone:f.get("phone"),email:f.get("email"),notes:f.get("notes")}));
 if(e.target.id==="newJob")return openNewJob();
 const jb=e.target.closest("[data-job]");if(jb){state.selected=state.jobs.find(x=>x.id===jb.dataset.job);await load();return}
 if(e.target.id==="close"){state.selected=null;render();return}
 const st=e.target.closest("[data-jobstatus]");if(st){const id=st.dataset.jobstatus,s=st.dataset.status;const r=await sb.from("jobs").update({status:s}).eq("id",id);if(r.error)toast(r.error.message);else{state.selected={...state.selected,status:s};await load()}return}
 if(e.target.id==="addTask"){if(!state.selected)return;modalForm("Add Task",`<form class="form"><input name="title" placeholder="Task" required><textarea name="description" placeholder="Task details"></textarea><button class="btn primary" type="submit">Add Task</button></form>`,async f=>sb.from("job_tasks").insert({job_id:state.selected.id,title:f.get("title"),description:f.get("description"),status:"open"}));return}
 if(e.target.id==="addNote"||e.target.id==="quickNote"){if(!state.selected){toast("Open a job first.");return}modalForm("Add Field Note",`<form class="form"><textarea name="message" required placeholder="What happened on the job?"></textarea><button class="btn primary" type="submit">Save Note</button></form>`,async f=>sb.from("job_activity").insert({job_id:state.selected.id,profile_id:session.user.id,event_type:"field_note",message:f.get("message")}));return}
 if(e.target.id==="addMaterial"||e.target.id==="quickMaterial"){if(!state.selected){toast("Open a job first.");return}modalForm("Material Request",`<form class="form"><input name="item" required placeholder="Material"><input name="quantity" type="number" step=".01" value="1"><textarea name="notes" placeholder="Notes"></textarea><button class="btn primary" type="submit">Request Material</button></form>`,async f=>sb.from("material_requests").insert({job_id:state.selected.id,requested_by:session.user.id,item:f.get("item"),quantity:Number(f.get("quantity")||1),notes:f.get("notes")}));return}
 if(e.target.id==="addPhoto"){toast("Photo storage is the next field feature.")}
 if(e.target.id==="refresh"){await load();return}
 const filter=e.target.closest("[data-filter]");if(filter){document.querySelectorAll("[data-filter]").forEach(x=>x.classList.remove("active"));filter.classList.add("active");const s=filter.dataset.filter;document.getElementById("jobResults").innerHTML=jobList(state.jobs.filter(j=>j.status===s));return}
});

document.addEventListener("change",async e=>{
 const id=e.target.dataset.task;if(id){const r=await sb.from("job_tasks").update({status:e.target.checked?"complete":"open",completed_at:e.target.checked?new Date().toISOString():null}).eq("id",id);if(r.error)toast(r.error.message);await load()}
});

document.addEventListener("submit",async e=>{
 if(e.target.id==="login"){e.preventDefault();const {error}=await sb.auth.signInWithPassword({email:e.target.email.value,password:e.target.pw.value});if(error)toast(error.message)}
});

(async()=>{
 if(cfg.supabaseKey.includes("PASTE_")){root.innerHTML=`<div class="wrap"><div class="card"><h2>Nolan Electric</h2><p>Supabase publishable key is missing from config.js.</p></div></div>`;return}
 sb=createClient(cfg.supabaseUrl,cfg.supabaseKey);
 const {data}=await sb.auth.getSession();session=data.session;
 if(session){const {data:p}=await sb.from("profiles").select("*").eq("id",session.user.id).maybeSingle();profile=p}
 render();if(session)load();
 sb.auth.onAuthStateChange(async(_e,s)=>{session=s;if(s){const {data:p}=await sb.from("profiles").select("*").eq("id",s.user.id).maybeSingle();profile=p;normalizeTab()}else{profile=null;state.tab="dashboard"}render();if(s)load()});
})();
