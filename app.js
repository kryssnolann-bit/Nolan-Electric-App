const { createClient } = window.supabase;
const cfg=window.NOLAN_CONFIG;
const root=document.getElementById("app");
let sb=null, session=null, profile=null;
let state={tab:"dashboard",jobs:[],customers:[],tasks:[],members:[],profiles:[],timeEntries:[],employeeRates:{},jobCosts:[],companyTimeEntries:[],companyJobCosts:[],loading:false,selected:null};

const esc=v=>String(v??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));
const money=v=>new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format(Number(v||0));
const budgetState=(estimate,actual)=>{
 const e=Number(estimate||0), a=Number(actual||0);
 if(e<=0) return {label:"No budget",className:"",variance:a};
 const ratio=a/e;
 if(ratio>1) return {label:"Over budget",className:"over",variance:a-e};
 if(ratio>=0.85) return {label:"Near budget",className:"near",variance:a-e};
 return {label:"Under budget",className:"under",variance:a-e};
};

const dateFmt=v=>v?new Date(v).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"}):"—";
const statusLabel=v=>String(v||"").replaceAll("_"," ").replace(/\b\w/g,x=>x.toUpperCase());
function toast(msg){alert(msg)}
function isFieldUser(){return profile?.role==="employee"||profile?.role==="crew_lead"}
function normalizeTab(){if(isFieldUser() && !["field","jobs"].includes(state.tab)) state.tab="field"; if(!isFieldUser() && state.tab==="field") state.tab="dashboard"}
function render(){normalizeTab();root.innerHTML=session?appShell():login()}

function login(){return `<div style="min-height:100vh;display:grid;place-items:center;padding:20px"><div class="card" style="max-width:420px;width:100%"><div class="brand">Nolan Electric</div><p>Job Command Center</p><form id="login" class="form"><input id="email" type="email" placeholder="Email" required><input id="pw" type="password" placeholder="Password" required><button class="btn primary">Sign In</button></form><p class="sub">Use the employee account created in Supabase Auth.</p></div></div>`}

function appShell(){
 const isField=isFieldUser();
 const tabs=isField?["field","jobs"]:["dashboard","customers","jobs","schedule","team","financial"];
 // Field users must never render an admin view, even if an old browser session left the tab set to dashboard.
 const view=isField?(state.tab==="jobs"?jobs():field()):(state.tab==="dashboard"?dashboard():state.tab==="customers"?customers():state.tab==="jobs"?jobs():state.tab==="schedule"?schedule():state.tab==="team"?team():state.tab==="financial"?financial():dashboard());
 return `<div class="top"><div class="row"><div><div class="brand">Nolan Electric</div><div class="sub">${esc(profile?.full_name||"User")} · ${esc(profile?.role||"")}</div></div><button id="logout" class="btn">Sign Out</button></div></div>
 <div class="wrap"><div class="nav">${tabs.map(t=>`<button data-tab="${t}" class="${state.tab===t?"btn primary":"btn"}">${t==="field"?"My Day":t==="team"?"Team":t==="schedule"?"Schedule":t[0].toUpperCase()+t.slice(1)}</button>`).join("")}</div>
 ${view}</div>${state.selected?jobModal(state.selected):""}`;
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

function jobList(list,fieldMode=false){
 return `<div class="list">${list.length?list.map(j=>`<div class="job">
 <div class="row"><div style="min-width:0"><b>${esc(j.job_number)} · ${esc(j.name)}</b><div class="sub">${esc(j.customers?.name||"No customer")} · ${statusLabel(j.status)}</div>
 <div class="sub">${j.scheduled_start?`Scheduled ${dateFmt(j.scheduled_start)}`:"Not scheduled"}${!fieldMode && j.contract_amount!=null?" · "+money(j.contract_amount):""}</div></div><button class="btn" data-job="${j.id}">Open</button></div>
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


function schedule(){
 const days=[]; const base=new Date(); base.setHours(0,0,0,0);
 const start=new Date(base); start.setDate(base.getDate()-((base.getDay()+6)%7));
 for(let i=0;i<7;i++){const d=new Date(start);d.setDate(start.getDate()+i);days.push(d);}
 const key=d=>d.toISOString().slice(0,10), today=key(base);
 const jobsFor=k=>state.jobs.filter(j=>j.scheduled_start&&String(j.scheduled_start).slice(0,10)===k);
 return `<div class="card"><div class="row"><div><h2>Schedule</h2><div class="sub">This week's jobs and crew assignments.</div></div><button class="btn primary" id="scheduleNewJob">+ New Job</button></div>
 <div class="week-grid" style="margin-top:14px">${days.map(d=>{const k=key(d),list=jobsFor(k);return `<div class="day-card ${k===today?"today":""}"><div class="row"><b>${d.toLocaleDateString("en-US",{weekday:"short"})}</b><span class="sub">${d.toLocaleDateString("en-US",{month:"short",day:"numeric"})}</span></div><div style="margin-top:8px">${list.length?list.map(j=>`<div class="schedule-job"><button class="btn" data-job="${j.id}" style="width:100%;text-align:left"><b>${esc(j.job_number)} · ${esc(j.name)}</b><div class="sub">${esc(j.customers?.name||"No customer")} · ${statusLabel(j.status)}</div></button></div>`).join(""):`<div class="sub">No jobs</div>`}</div></div>`}).join("")}</div>
 <div class="card" style="margin-top:14px"><h3>Unscheduled Jobs</h3>${jobList(state.jobs.filter(j=>!j.scheduled_start),false)}</div></div>`;
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
 ${p?`<input name="labor_cost_rate" type="number" min="0" step="0.01" value="${Number(state.employeeRates[p.id]||0)}" placeholder="Internal labor cost / hour"><div class="sub">Internal cost only — employee will never see this rate.</div>`:""}
 ${p?`<label style="display:flex;align-items:center;gap:8px"><input name="active" type="checkbox" ${p.active?"checked":""}> Active employee</label>`:`<p class="sub">A temporary password will be generated for the employee. Give it to them securely, then have them change it after signing in.</p>`}
 <button class="btn primary" type="submit">${p?"Save Changes":"Create Employee"}</button></form>`,async f=>{
  if(p){
   const r=await sb.functions.invoke("employee-admin",{body:{action:"update",id:p.id,full_name:f.get("full_name"),phone:f.get("phone"),role:f.get("role"),active:f.get("active")==="on"}});
   if(!r.error && r.data?.error) return {error:new Error(r.data.error)};
   if(r.error) return r;
   const rate=Number(f.get("labor_cost_rate")||0);
   const rr=await sb.from("employee_labor_rates").upsert({profile_id:p.id,labor_cost_rate:rate,updated_at:new Date().toISOString()});
   if(rr.error) return rr;
   return r;
  }
  const r=await sb.functions.invoke("employee-admin",{body:{action:"create",full_name:f.get("full_name"),email:f.get("email"),phone:f.get("phone"),role:f.get("role")}});
  if(!r.error && r.data?.error) return {error:new Error(r.data.error)};
  if(!r.error && r.data?.temporary_password) toast(`Employee created.\n\nEmail: ${r.data.email}\nTemporary password: ${r.data.temporary_password}\n\nGive this to the employee securely. They should change it after signing in.`);
  return r;
 });
}

function financial(){
 const jobs=state.jobs;
 const totalContract=jobs.reduce((a,j)=>a+Number(j.contract_amount||0),0);
 const totalEstLabor=jobs.reduce((a,j)=>a+Number(j.estimated_labor_cost||0),0);
 const totalEstMat=jobs.reduce((a,j)=>a+Number(j.estimated_material_cost||0),0);
 const totalEstOther=jobs.reduce((a,j)=>a+Number(j.estimated_other_cost||0),0);
 const totalEstCost=totalEstLabor+totalEstMat+totalEstOther;
 const laborByJob={};
 (state.companyTimeEntries||[]).forEach(t=>{
  const rate=Number(state.employeeRates?.[t.profile_id]||0);
  laborByJob[t.job_id]=(laborByJob[t.job_id]||0)+(Number(t.duration_minutes||0)/60)*rate;
 });
 const costsByJob={};
 (state.companyJobCosts||[]).forEach(c=>{
  if(!costsByJob[c.job_id]) costsByJob[c.job_id]={material:0,other:0,total:0};
  const amt=Number(c.amount||0);
  costsByJob[c.job_id].total+=amt;
  if(c.cost_type==="material") costsByJob[c.job_id].material+=amt; else costsByJob[c.job_id].other+=amt;
 });
 const rows=jobs.map(j=>{
  const labor=laborByJob[j.id]||0;
  const c=costsByJob[j.id]||{material:0,other:0,total:0};
  const cost=labor+c.total;
  const est=Number(j.estimated_labor_cost||0)+Number(j.estimated_material_cost||0)+Number(j.estimated_other_cost||0);
  const profit=Number(j.contract_amount||0)-cost;
  const margin=Number(j.contract_amount||0)?profit/Number(j.contract_amount)*100:0;
  const budget=budgetState(est,cost);
  return {j,labor,material:c.material,other:c.other,cost,est,profit,margin,budget};
 }).sort((a,b)=>b.profit-a.profit);
 const actualLabor=rows.reduce((a,r)=>a+r.labor,0);
 const actualMaterials=rows.reduce((a,r)=>a+r.material,0);
 const actualOther=rows.reduce((a,r)=>a+r.other,0);
 const actualCost=actualLabor+actualMaterials+actualOther;
 const grossProfit=totalContract-actualCost;
 const margin=totalContract?grossProfit/totalContract*100:0;
 const profitable=rows.filter(r=>r.profit>=0).length;
 const budgets=rows.reduce((a,r)=>{a[r.budget.label]=(a[r.budget.label]||0)+1;return a;},{});
 return `<div class="grid">
 <div class="card metric"><span>Contract Value</span><b>${money(totalContract)}</b></div>
 <div class="card metric"><span>Est. Total Cost</span><b>${money(totalEstCost)}</b></div>
 <div class="card metric"><span>Actual Costs</span><b>${money(actualCost)}</b></div>
 <div class="card metric"><span>Gross Profit</span><b>${money(grossProfit)}</b></div>
 <div class="card metric"><span>Gross Margin</span><b>${margin.toFixed(1)}%</b></div>
 <div class="card metric"><span>Profitable Jobs</span><b>${profitable}/${rows.length}</b></div></div>
 <div class="card" style="margin-top:14px"><h3>Budget Watch</h3><div class="sub">Actual cost compared with each job's estimated total cost.</div>
 <div class="pipeline" style="margin-top:12px"><div><b>${budgets["Under budget"]||0}</b><span>Under Budget</span></div><div><b>${budgets["Near budget"]||0}</b><span>Near Budget</span></div><div><b>${budgets["Over budget"]||0}</b><span>Over Budget</span></div></div></div>
 <div class="card" style="margin-top:14px"><h2>Job Profitability</h2><div class="sub">Actual labor + material + other costs compared with contract value.</div>
 <div class="list" style="margin-top:14px">${rows.length?rows.map(r=>`<div class="job"><div class="row"><div style="min-width:0"><b>${esc(r.j.job_number)} · ${esc(r.j.name)}</b><div class="sub">${esc(r.j.customers?.name||"No customer")} · ${statusLabel(r.j.status)}</div><div class="sub">Labor ${money(r.labor)} · Materials ${money(r.material)} · Other ${money(r.other)}</div><div class="sub">Budget: ${r.est?money(r.est):"Not set"} · ${r.budget.label}${r.est?" · Variance "+money(r.budget.variance):""}</div></div><div style="text-align:right"><b>${money(r.profit)}</b><div class="sub">${r.margin.toFixed(1)}% margin</div><div class="sub">Cost ${money(r.cost)}</div></div></div></div>`).join(''):`<div class="empty">No jobs yet.</div>`}</div></div>
 <div class="card" style="margin-top:14px"><h3>Estimates vs. Actuals</h3><div class="sub">Estimated labor ${money(totalEstLabor)} · Estimated materials ${money(totalEstMat)} · Estimated other ${money(totalEstOther)} · Estimated total ${money(totalEstCost)} · Actual costs ${money(actualCost)}</div></div>`;
}
function field(){
 return `<div class="card"><h2>My Day</h2><p>Field operations for assigned jobs.</p><div class="field-actions"><button class="btn primary" id="quickNote">ADD NOTE</button><button class="btn" id="quickMaterial">NEED MATERIAL</button><button class="btn" id="refresh">REFRESH JOBS</button></div></div>
 <div class="card" style="margin-top:14px"><h2>Assigned Jobs</h2>${jobList([...state.jobs].sort((a,b)=>String(a.scheduled_start||"9999-99-99").localeCompare(String(b.scheduled_start||"9999-99-99"))),true)}</div>`;
}

function entryMinutes(x){
 if(x.duration_minutes!=null) return Number(x.duration_minutes)||0;
 if(!x.started_at) return 0;
 return Math.max(0,Math.round((new Date(x.ended_at||Date.now())-new Date(x.started_at))/60000));
}
function actualLaborCost(entries){
 return (entries||[]).reduce((sum,x)=>sum+(entryMinutes(x)/60)*Number(state.employeeRates[x.profile_id]||0),0);
}

function jobModal(j){
 const fieldUser=isFieldUser();
 const tasks=state.tasks.filter(t=>t.job_id===j.id);
 const members=state.members.filter(m=>m.job_id===j.id);
 const assignable=state.profiles.filter(p=>p.active && p.role!=="customer");
 const activeTime=fieldUser?state.timeEntries.find(x=>x.profile_id===session.user.id&&!x.ended_at):null;
 const todaySeconds=fieldUser?state.timeEntries.filter(x=>x.profile_id===session.user.id&&new Date(x.started_at).toDateString()===new Date().toDateString()).reduce((a,x)=>a+(x.duration_minutes?Number(x.duration_minutes)*60:((new Date(x.ended_at||Date.now())-new Date(x.started_at))/1000)),0):0;
 const hoursFmt=s=>{const h=Math.floor(s/3600),m=Math.floor((s%3600)/60);return `${h}h ${String(m).padStart(2,"0")}m`};
 const timePanel=fieldUser?`<div class="card" style="margin:12px 0"><div class="row"><div><b>Time</b><div class="sub">Today: ${hoursFmt(todaySeconds)}</div></div>${activeTime?`<button class="btn primary" id="stopJob">STOP JOB</button>`:`<div style="display:flex;gap:6px"><button class="btn" id="logHours">LOG HOURS</button><button class="btn primary" id="startJob">START JOB</button></div>`}</div>${activeTime?`<div class="sub" style="margin-top:8px">Started ${new Date(activeTime.started_at).toLocaleTimeString([], {hour:"numeric",minute:"2-digit"})}</div>`:""}</div>`:"";
 const actualLabor=actualLaborCost(state.timeEntries);
 const actualMaterials=state.jobCosts.filter(x=>x.cost_type==="material").reduce((a,x)=>a+Number(x.amount||0),0);
 const otherCosts=state.jobCosts.filter(x=>x.cost_type!=="material").reduce((a,x)=>a+Number(x.amount||0),0);
 const currentCost=actualLabor+actualMaterials+otherCosts;
 const grossProfit=Number(j.contract_amount||0)-currentCost;
 const estimatedLaborCost=Number(j.estimated_labor_cost||0);
 const estimatedMaterialCost=Number(j.estimated_material_cost||0);
 const estimatedOtherCost=Number(j.estimated_other_cost||0);
 const estimatedTotal=estimatedLaborCost+estimatedMaterialCost+estimatedOtherCost;
 const budget=budgetState(estimatedTotal,currentCost);
 const financial=fieldUser?"":`<div class="row" style="margin-bottom:10px"><h3 style="margin:0">Job Financials</h3><button class="btn primary" id="editEstimate">✏️ Edit Estimate</button></div><div class="grid">
 <div class="card metric"><span>Contract</span><b>${money(j.contract_amount)}</b></div>
 <div class="card metric"><span>Est. Labor</span><b>${Number(j.estimated_labor_hours||0)}h · ${money(estimatedLaborCost)}</b></div>
 <div class="card metric"><span>Est. Materials</span><b>${money(estimatedMaterialCost)}</b></div>
 <div class="card metric"><span>Est. Other</span><b>${money(estimatedOtherCost)}</b></div>
 <div class="card metric"><span>Estimated Cost</span><b>${money(estimatedTotal)}</b></div>
 <div class="card metric"><span>Actual Labor</span><b>${money(actualLabor)}</b></div>
 <div class="card metric"><span>Actual Materials</span><b>${money(actualMaterials)}</b></div>
 <div class="card metric"><span>Other Costs</span><b>${money(otherCosts)}</b></div>
 <div class="card metric"><span>Current Cost</span><b>${money(currentCost)}</b></div>
 <div class="card metric"><span>Budget Status</span><b>${budget.label}</b></div>
 <div class="card metric"><span>Cost Variance</span><b>${estimatedTotal?money(budget.variance):"—"}</b></div>
 <div class="card metric"><span>Gross Profit</span><b>${money(grossProfit)}</b></div>
 <div class="card metric"><span>Gross Margin</span><b>${Number(j.contract_amount||0)?(grossProfit/Number(j.contract_amount)*100).toFixed(1):"0.0"}%</b></div></div>
 <div class="row" style="margin-top:10px"><div class="sub">${estimatedTotal?`Budget: ${money(estimatedTotal)} · Actual: ${money(currentCost)} · ${budget.label}`:"Set an estimated cost budget to track variance."}</div></div>`;
 const schedulePanel=fieldUser?"":`<div class="card" style="margin:12px 0"><div class="row"><div><h3 style="margin:0">Schedule</h3><div class="sub">${j.scheduled_start?`Scheduled for ${dateFmt(j.scheduled_start)}`:"Not scheduled"}</div></div><button class="btn" id="editSchedule">Edit Schedule</button></div></div>`;
 const status=fieldUser?"":`<h3>Status</h3><div class="status-buttons">${["lead","estimate","approved","scheduled","in_progress","punch_list","complete","invoiced","paid"].map(s=>`<button class="pill ${j.status===s?"active":""}" data-status="${s}" data-jobstatus="${j.id}">${statusLabel(s)}</button>`).join("")}</div>`;
 const taskMarkup=tasks.map(t=>`<div class="job" style="margin-bottom:8px"><label style="display:block"><input type="checkbox" data-task="${t.id}" ${t.status==="complete"?"checked":""}> ${esc(t.title)}</label><div class="sub">${t.description?esc(t.description)+" · ":""}${t.assigned_to?"Assigned to "+esc(state.profiles.find(p=>p.id===t.assigned_to)?.full_name||"team member"):"Unassigned"}</div>${fieldUser?"":`<select class="task-assignee" data-task-assignee="${t.id}" style="margin-top:7px"><option value="">Unassigned</option>${assignable.map(p=>`<option value="${p.id}" ${t.assigned_to===p.id?"selected":""}>${esc(p.full_name)} · ${esc(p.role)}</option>`).join("")}</select>`}</div>`).join("")||"<div class='empty'>No tasks yet.</div>";
 const taskHeader=fieldUser?`<h3>My Tasks</h3>`:`<h3>Tasks <button id="addTask" class="btn" style="float:right">+ Task</button></h3>`;
 const crew=fieldUser?"":`<h3>Crew <button id="assignCrew" class="btn" style="float:right">+ Assign Crew</button></h3><div class="list">${members.map(m=>`<div class="job"><div class="row"><div><b>${esc(m.profiles?.full_name||"Crew member")}</b><div class="sub">${esc(m.profiles?.role||"")}</div></div><button class="btn" data-remove-crew="${m.profile_id}">Remove</button></div></div>`).join("")||"<div class='empty'>No crew assigned yet.</div>"}</div>`;
 return `<div class="modal"><div class="sheet"><div class="row"><div><h2>${esc(j.job_number)} · ${esc(j.name)}</h2><div class="sub">${esc(j.customers?.name||"No customer")} · ${statusLabel(j.status)}</div></div><button class="btn" id="close">Close</button></div><hr>
 ${financial}${schedulePanel}
 ${timePanel}
 <div class="job-detail"><b>Customer:</b> ${esc(j.customers?.name||"—")} &nbsp; <b>Type:</b> ${statusLabel(j.job_type||"—")} &nbsp; <b>Schedule:</b> ${dateFmt(j.scheduled_start)}</div>
 <p>${esc(j.description||"No scope/description entered.")}</p>
 ${status}
 ${taskHeader}<div id="tasks">${taskMarkup}</div>
 ${crew}
 ${fieldUser?"":`<h3>Actual Job Costs <button id="addCost" class="btn" style="float:right">+ Cost</button></h3><div class="list">${state.jobCosts.map(c=>`<div class="job"><div class="row"><div><b>${esc(c.description||statusLabel(c.cost_type))}</b><div class="sub">${statusLabel(c.cost_type)} · ${c.quantity?esc(c.quantity):"1"} unit${Number(c.quantity||1)===1?"":"s"}</div></div><b>${money(c.amount)}</b></div></div>`).join("")||`<div class="empty">No actual costs entered yet.</div>`}</div>`}
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
  state.employeeRates={};
  if(!isFieldUser()){
   const er=await sb.from("employee_labor_rates").select("profile_id,labor_cost_rate");
   if(er.error)throw new Error("Labor rates could not be loaded: "+er.error.message);
   (er.data||[]).forEach(x=>state.employeeRates[x.profile_id]=Number(x.labor_cost_rate||0));
  }
  if(!isFieldUser()){
   const ct=await sb.from("time_entries").select("job_id,profile_id,duration_minutes");
   if(ct.error)throw new Error("Company time could not be loaded: "+ct.error.message);
   state.companyTimeEntries=ct.data||[];
   const cc=await sb.from("job_costs").select("job_id,cost_type,amount");
   if(cc.error)throw new Error("Company costs could not be loaded: "+cc.error.message);
   state.companyJobCosts=cc.data||[];
  }else{state.companyTimeEntries=[];state.companyJobCosts=[];}
  const jr=await sb.from("jobs").select("*,customers(name)").order("created_at",{ascending:false});
  if(jr.error)throw new Error("Jobs could not be loaded: "+jr.error.message);
  const allJobs=jr.data||[];
  if(isFieldUser()){
   const me=await sb.from("job_members").select("job_id").eq("profile_id",session.user.id);
   if(me.error)throw new Error("Assigned jobs could not be loaded: "+me.error.message);
   const ids=new Set((me.data||[]).map(x=>x.job_id));
   state.jobs=allJobs.filter(j=>ids.has(j.id));
  }else state.jobs=allJobs;
  if(state.selected){
   const tr=await sb.from("job_tasks").select("*").eq("job_id",state.selected.id).order("created_at");
   state.tasks=tr.error?[]:(tr.data||[]);
   const mr=await sb.from("job_members").select("job_id,profile_id,profiles(full_name,role)").eq("job_id",state.selected.id);
   state.members=mr.error?[]:(mr.data||[]);
   const te=await sb.from("time_entries").select("*").eq("job_id",state.selected.id).order("started_at",{ascending:false});
   state.timeEntries=te.error?[]:(te.data||[]);
   if(!isFieldUser()){
    const jc=await sb.from("job_costs").select("*").eq("job_id",state.selected.id).order("cost_date",{ascending:false}).order("created_at",{ascending:false});
    state.jobCosts=jc.error?[]:(jc.data||[]);
   }else state.jobCosts=[];
  }else{state.tasks=[];state.members=[];state.timeEntries=[];state.jobCosts=[];}
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
 <input name="estimated_other_cost" type="number" step=".01" placeholder="Estimated other costs">
 <input name="scheduled_start" type="date">
 <textarea name="description" placeholder="Scope of work"></textarea>
 <button class="btn primary" type="submit">Create Job</button></form>`,async f=>{
  const r=await sb.from("jobs").insert({
   job_number:f.get("job_number"),name:f.get("name"),customer_id:f.get("customer_id"),
   job_type:f.get("job_type"),status:f.get("status"),contract_amount:Number(f.get("contract_amount")||0),
   estimated_labor_hours:Number(f.get("estimated_labor_hours")||0),estimated_labor_cost:Number(f.get("estimated_labor_cost")||0),
   estimated_material_cost:Number(f.get("estimated_material_cost")||0),
   estimated_other_cost:Number(f.get("estimated_other_cost")||0),
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
 if(e.target.id==="addTask"){if(!state.selected)return;const assignable=state.profiles.filter(p=>p.active&&p.role!=="customer");modalForm("Add Task",`<form class="form"><input name="title" placeholder="Task" required><textarea name="description" placeholder="Task details"></textarea><select name="assigned_to"><option value="">Unassigned</option>${assignable.map(p=>`<option value="${p.id}">${esc(p.full_name)} · ${esc(p.role)}</option>`).join("")}</select><button class="btn primary" type="submit">Add Task</button></form>`,async f=>sb.from("job_tasks").insert({job_id:state.selected.id,title:f.get("title"),description:f.get("description"),assigned_to:f.get("assigned_to")||null,status:"open"}));return}
 if(e.target.id==="editSchedule"){if(!state.selected||isFieldUser())return;const j=state.selected;modalForm("Schedule Job",`<form class="form"><input name="scheduled_start" type="date" value="${j.scheduled_start?String(j.scheduled_start).slice(0,10):""}" required><select name="status"><option value="approved" ${j.status==="approved"?"selected":""}>Approved</option><option value="scheduled" ${j.status==="scheduled"?"selected":""}>Scheduled</option><option value="in_progress" ${j.status==="in_progress"?"selected":""}>In Progress</option></select><p class="sub">Choose the work date. Crew assignments stay attached to the job.</p><button class="btn primary" type="submit">Save Schedule</button></form>`,async f=>sb.from("jobs").update({scheduled_start:f.get("scheduled_start")||null,status:f.get("status")||j.status}).eq("id",j.id));return}
 if(e.target.id==="editEstimate"){if(!state.selected||isFieldUser())return;const j=state.selected;modalForm("Edit Estimate",`<form class="form"><input name="contract_amount" type="number" step=".01" value="${Number(j.contract_amount||0)}" placeholder="Contract / estimate amount"><input name="estimated_labor_hours" type="number" step=".25" value="${Number(j.estimated_labor_hours||0)}" placeholder="Estimated labor hours"><input name="estimated_labor_cost" type="number" step=".01" value="${Number(j.estimated_labor_cost||0)}" placeholder="Estimated labor cost"><input name="estimated_material_cost" type="number" step=".01" value="${Number(j.estimated_material_cost||0)}" placeholder="Estimated material cost"><input name="estimated_other_cost" type="number" step=".01" value="${Number(j.estimated_other_cost||0)}" placeholder="Estimated other costs"><p class="sub">Use your expected internal cost, not the customer-facing markup. This stays on the admin side.</p><button class="btn primary" type="submit">Save Estimate</button></form>`,async f=>sb.from("jobs").update({contract_amount:Number(f.get("contract_amount")||0),estimated_labor_hours:Number(f.get("estimated_labor_hours")||0),estimated_labor_cost:Number(f.get("estimated_labor_cost")||0),estimated_material_cost:Number(f.get("estimated_material_cost")||0),estimated_other_cost:Number(f.get("estimated_other_cost")||0)}).eq("id",j.id));return}
 if(e.target.id==="addCost"){if(!state.selected||isFieldUser())return;modalForm("Add Job Cost",`<form class="form"><select name="cost_type"><option value="material">Material</option><option value="permit">Permit</option><option value="equipment">Equipment Rental</option><option value="subcontractor">Subcontractor</option><option value="other">Other</option></select><input name="description" placeholder="What was purchased / spent?" required><input name="quantity" type="number" min="0.01" step="0.01" value="1" placeholder="Quantity"><input name="amount" type="number" min="0" step="0.01" placeholder="Total actual cost" required><input name="cost_date" type="date" value="${new Date().toISOString().slice(0,10)}"><button class="btn primary" type="submit">Save Cost</button></form>`,async f=>sb.from("job_costs").insert({job_id:state.selected.id,cost_type:f.get("cost_type"),description:f.get("description"),quantity:Number(f.get("quantity")||1),amount:Number(f.get("amount")||0),cost_date:f.get("cost_date"),entered_by:session.user.id}));return}
 if(e.target.id==="assignCrew"){if(!state.selected)return;const assigned=new Set(state.members.map(m=>m.profile_id));const available=state.profiles.filter(p=>p.active&&p.role!=="customer"&&!assigned.has(p.id));if(!available.length){toast("Everyone is already assigned to this job.");return}modalForm("Assign Crew",`<form class="form"><select name="profile_id">${available.map(p=>`<option value="${p.id}">${esc(p.full_name)} · ${esc(p.role)}</option>`).join("")}</select><button class="btn primary" type="submit">Assign to Job</button></form>`,async f=>sb.from("job_members").insert({job_id:state.selected.id,profile_id:f.get("profile_id")}));return}
 const rm=e.target.closest("[data-remove-crew]");if(rm){if(!state.selected)return;const r=await sb.from("job_members").delete().eq("job_id",state.selected.id).eq("profile_id",rm.dataset.removeCrew);if(r.error)toast(r.error.message);else await load();return}
 if(e.target.id==="addNote"||e.target.id==="quickNote"){if(!state.selected){toast("Open a job first.");return}modalForm("Add Field Note",`<form class="form"><textarea name="message" required placeholder="What happened on the job?"></textarea><button class="btn primary" type="submit">Save Note</button></form>`,async f=>sb.from("job_activity").insert({job_id:state.selected.id,profile_id:session.user.id,event_type:"field_note",message:f.get("message")}));return}
 if(e.target.id==="addMaterial"||e.target.id==="quickMaterial"){if(!state.selected){toast("Open a job first.");return}modalForm("Material Request",`<form class="form"><input name="item" required placeholder="Material"><input name="quantity" type="number" step=".01" value="1"><textarea name="notes" placeholder="Notes"></textarea><button class="btn primary" type="submit">Request Material</button></form>`,async f=>sb.from("material_requests").insert({job_id:state.selected.id,requested_by:session.user.id,item:f.get("item"),quantity:Number(f.get("quantity")||1),notes:f.get("notes")}));return}
 if(e.target.id==="startJob"){if(!state.selected)return;const existing=state.timeEntries.find(x=>x.profile_id===session.user.id&&!x.ended_at);if(existing){toast("You already have a job running.");return}const r=await sb.from("time_entries").insert({job_id:state.selected.id,profile_id:session.user.id,started_at:new Date().toISOString()}).select().single();if(r.error)toast(r.error.message);else await load();return}
 if(e.target.id==="stopJob"){if(!state.selected)return;const active=state.timeEntries.find(x=>x.profile_id===session.user.id&&!x.ended_at);if(!active){toast("No active timer for this job.");return}const ended=new Date(); const mins=Math.max(1,Math.round((ended-new Date(active.started_at))/60000)); const r=await sb.from("time_entries").update({ended_at:ended.toISOString(),duration_minutes:mins}).eq("id",active.id);if(r.error)toast(r.error.message);else await load();return}
 if(e.target.id==="logHours"){if(!state.selected)return;modalForm("Log Hours",`<form class="form"><input name="hours" type="number" min="0.01" step="0.25" placeholder="Hours worked" required><textarea name="notes" placeholder="What was completed?"></textarea><button class="btn primary" type="submit">Save Hours</button></form>`,async f=>{const hours=Number(f.get("hours")||0);const now=new Date().toISOString();return sb.from("time_entries").insert({job_id:state.selected.id,profile_id:session.user.id,started_at:now,ended_at:now,duration_minutes:Math.round(hours*60),notes:f.get("notes")})});return}
 if(e.target.id==="addPhoto"){toast("Photo storage is the next field feature.")}
 if(e.target.id==="refresh"){await load();return}
 const filter=e.target.closest("[data-filter]");if(filter){document.querySelectorAll("[data-filter]").forEach(x=>x.classList.remove("active"));filter.classList.add("active");const s=filter.dataset.filter;document.getElementById("jobResults").innerHTML=jobList(state.jobs.filter(j=>j.status===s));return}
});

document.addEventListener("change",async e=>{
 const id=e.target.dataset.task;if(id){const r=await sb.from("job_tasks").update({status:e.target.checked?"complete":"open",completed_at:e.target.checked?new Date().toISOString():null}).eq("id",id);if(r.error)toast(r.error.message);await load();return}
 const taskId=e.target.dataset.taskAssignee;if(taskId){const assigned=e.target.value||null;const r=await sb.from("job_tasks").update({assigned_to:assigned}).eq("id",taskId);if(r.error)toast(r.error.message);else await load()}
});

document.addEventListener("submit",async e=>{
 if(e.target.id==="login"){e.preventDefault();const {error}=await sb.auth.signInWithPassword({email:e.target.email.value,password:e.target.pw.value});if(error)toast(error.message)}
});

(async()=>{
 if(cfg.supabaseKey.includes("PASTE_")){root.innerHTML=`<div class="wrap"><div class="card"><h2>Nolan Electric</h2><p>Supabase publishable key is missing from config.js.</p></div></div>`;return}
 sb=createClient(cfg.supabaseUrl,cfg.supabaseKey);
 const {data}=await sb.auth.getSession();session=data.session;
 if(session){const {data:p}=await sb.from("profiles").select("*").eq("id",session.user.id).maybeSingle();profile=p;normalizeTab()}
 render();if(session)load();
 sb.auth.onAuthStateChange(async(_e,s)=>{session=s;if(s){const {data:p}=await sb.from("profiles").select("*").eq("id",s.user.id).maybeSingle();profile=p;normalizeTab()}else{profile=null;state.tab="dashboard"}render();if(s)load()});
})();
