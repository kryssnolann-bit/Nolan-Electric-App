from pathlib import Path
p=Path('/mnt/data/v64work/app-v63.js')
s=p.read_text()

# appShell: route action page
old='''if(page.type==="customer") view=customerPage(state.customers.find(c=>c.id===page.id));\n else if(page.type==="job") view=state.selected?jobPage(state.selected):jobs();'''
new='''if(page.type==="customer") view=customerPage(state.customers.find(c=>c.id===page.id));\n else if(page.type==="job") view=state.selected?jobPage(state.selected):jobs();\n else if(page.type==="action") view=fieldActionPage(page);'''
assert old in s
s=s.replace(old,new,1)

# Insert fieldActionPage before appShell
marker='function appShell(){'
assert marker in s
func=r'''
function fieldActionPage(page){
 const action=page.action||"note";
 const job=page.jobId?state.jobs.find(j=>j.id===page.jobId):null;
 const jobs=state.jobs.filter(j=>!['closed'].includes(j.status));
 const titles={note:"Add Field Note",material:"Request Material",photo:"Add Job Photo",report:"Daily Job Report",hours:"Log Hours"};
 const subtitles={note:"Keep the office informed about what happened on the job.",material:"Tell the office exactly what material is needed.",photo:"Take a jobsite photo and attach it to this job.",report:"Record today's progress, crew, issues and next steps.",hours:"Enter time worked when you are not using the live timer."};
 const jobSelect=!job?`<div class="action-job-select"><label>Job</label><select name="job_id" required><option value="">Select a job…</option>${jobs.map(j=>`<option value="${j.id}">${esc(j.name)} · ${esc(j.job_number||"")}</option>`).join("")}</select></div>`:"";
 const jobBanner=job?`<div class="action-job-banner"><span class="eyebrow">JOB</span><b>${esc(job.name)}</b><span>${esc(job.customers?.name||"No customer")} · ${esc(job.job_number||"")}</span></div>`:"";
 let fields="";
 if(action==="note") fields=`<textarea name="message" required placeholder="What happened on the job?\n\nProgress:\nIssues / blockers:\nNext steps:"></textarea>`;
 if(action==="material") fields=`<input name="item" required placeholder="Material needed"><input name="quantity" type="number" min="0.01" step=".01" value="1" placeholder="Quantity"><textarea name="notes" placeholder="Size, brand, location, urgency, or other details…"></textarea>`;
 if(action==="photo") fields=`<label class="file-label">Take / choose photo<input name="photo_file" id="actionPhotoFile" type="file" accept="image/*" capture="environment" required></label><div id="photoPreview" class="action-photo-preview"><span>No photo selected</span></div><input name="caption" placeholder="Caption (optional)">`;
 if(action==="report") fields=`<input name="report_date" type="date" value="${new Date().toISOString().slice(0,10)}" required><input name="hours" type="number" min="0" step=".25" placeholder="Hours worked"><textarea name="notes" required placeholder="What was completed today?\n\nCrew on site:\nIssues / blockers:\nMaterials needed:\nNext steps:"></textarea>`;
 if(action==="hours") fields=`<input name="hours" type="number" min="0.01" step=".25" placeholder="Hours worked" required><textarea name="notes" placeholder="What was completed?"></textarea>`;
 return `<div class="field-action-page"><div class="page-back"><button class="btn" id="fieldActionBack">← Back</button></div><section class="card field-action-card"><div class="eyebrow">FIELD UPDATE</div><h1>${titles[action]||"Field Update"}</h1><p class="action-subtitle">${subtitles[action]||"Send an update to the office."}</p>${jobBanner}<form id="fieldActionForm" class="field-action-form">${jobSelect}${fields}<button class="btn primary action-submit" type="submit">${action==="photo"?"Upload Photo":action==="material"?"Request Material":action==="report"?"Save Daily Report":action==="hours"?"Save Hours":"Save Note"}</button></form></section></div>`;
}

'''
s=s.replace(marker,func+marker,1)

# Replace quick strip buttons and field update buttons / time buttons
s=s.replace('''<div class="field-quick-strip"><button class="btn primary" id="quickNote">✎ ADD NOTE</button><button class="btn" id="quickMaterial">▣ NEED MATERIAL</button><button class="btn" id="quickPhoto">📷 PHOTO</button></div>''','''<div class="field-quick-strip"><button class="btn primary" data-field-action="note">✎ ADD NOTE</button><button class="btn" data-field-action="material">▣ NEED MATERIAL</button><button class="btn" data-field-action="photo">📷 PHOTO</button></div>''')
s=s.replace('''<div class="field-actions"><button class="btn primary" id="addNote">ADD NOTE</button><button class="btn" id="addMaterial">NEED MATERIAL</button><button class="btn" id="addPhoto">ADD PHOTO</button></div>''','''<div class="field-actions"><button class="btn primary" data-field-action="note">ADD NOTE</button><button class="btn" data-field-action="material">NEED MATERIAL</button><button class="btn" data-field-action="photo">ADD PHOTO</button></div>''')
s=s.replace('''<button class="btn" id="addReport" style="margin-top:8px">+ Daily Report</button>''','''<button class="btn" data-field-action="report" style="margin-top:8px">+ Daily Report</button>''')
s=s.replace('''<button class="btn" id="logHours">LOG HOURS</button>''','''<button class="btn" data-field-action="hours">LOG HOURS</button>''')

# Add action click handler immediately after document click starts
needle='''document.addEventListener("click",async e=>{\n if(e.target.id==='globalSearch')'''
replacement='''document.addEventListener("click",async e=>{\n const fieldAction=e.target.closest("[data-field-action]");\n if(fieldAction){\n  const action=fieldAction.dataset.fieldAction;\n  const jobId=state.selected?.id||null;\n  navigate({type:"action",action,jobId});\n  return;\n }\n if(e.target.id==="fieldActionBack"){goBack();return}\n if(e.target.id==='globalSearch')'''
assert needle in s
s=s.replace(needle,replacement,1)

# Add form submit handler before existing keydown listener
needle='''document.addEventListener("keydown",e=>{if(e.target.id==="customerSearch"&&e.key==="Enter"){e.preventDefault();state.customerSearch=e.target.value;render();}});'''
replacement=r'''document.addEventListener("submit",async e=>{
 if(e.target.id!=="fieldActionForm") return;
 e.preventDefault();
 const form=e.target;
 const page=currentPage();
 const action=page.action;
 const jobId=page.jobId||form.get("job_id");
 if(!jobId){toast("Select a job first.");return}
 const job=state.jobs.find(j=>j.id===jobId);
 if(!job){toast("Job not found.");return}
 const button=form.querySelector(".action-submit");
 if(button){button.disabled=true;button.textContent="Saving..."}
 try{
  let r;
  if(action==="note") r=await sb.from("job_activity").insert({job_id:jobId,profile_id:session.user.id,event_type:"field_note",message:form.get("message")});
  if(action==="material"){
   r=await sb.from("material_requests").insert({job_id:jobId,requested_by:session.user.id,item:form.get("item"),quantity:Number(form.get("quantity")||1),notes:form.get("notes")});
   if(!r.error) await logJobActivity(jobId,"material_request",`Material requested: ${form.get("item")}.`);
  }
  if(action==="report"){
   r=await sb.from("daily_reports").insert({job_id:jobId,submitted_by:session.user.id,report_date:form.get("report_date"),hours:Number(form.get("hours")||0),notes:form.get("notes")});
   if(!r.error) await logJobActivity(jobId,"daily_report","Daily report added.");
  }
  if(action==="hours"){
   const hours=Number(form.get("hours")||0),now=new Date().toISOString();
   r=await sb.from("time_entries").insert({job_id:jobId,profile_id:session.user.id,started_at:now,ended_at:now,duration_minutes:Math.round(hours*60),notes:form.get("notes")});
   if(!r.error) await logJobActivity(jobId,"time_entry",`Logged ${hours.toFixed(2)} hours.`);
  }
  if(action==="photo"){
   const file=form.querySelector("#actionPhotoFile")?.files?.[0];
   if(!file){toast("Choose a photo first.");if(button){button.disabled=false;button.textContent="Upload Photo"}return}
   const path=jobId+"/"+crypto.randomUUID()+"-"+file.name.replace(/[^a-zA-Z0-9._-]/g,"_");
   const up=await sb.storage.from("job-photos").upload(path,file,{upsert:false});
   if(up.error) throw up.error;
   r=await sb.from("job_photos").insert({job_id:jobId,uploaded_by:session.user.id,storage_path:path,caption:form.get("caption")||null});
   if(!r.error) await logJobActivity(jobId,"photo_added",`Job photo added${form.get("caption")?`: ${form.get("caption")}`:"."}`);
  }
  if(r?.error) throw r.error;
  state.selected=job;
  await load();
  navigate({type:"job",id:jobId},{replace:true});
  toast(action==="photo"?"Photo uploaded.":"Saved successfully.");
 }catch(err){console.error(err);toast(err?.message||"Could not save. Please try again.");if(button){button.disabled=false;button.textContent=action==="photo"?"Upload Photo":action==="material"?"Request Material":action==="report"?"Save Daily Report":action==="hours"?"Save Hours":"Save Note"}}
});

document.addEventListener("change",e=>{
 if(e.target.id==="actionPhotoFile"){
  const file=e.target.files?.[0],preview=document.getElementById("photoPreview");
  if(!preview)return;
  if(!file){preview.innerHTML="<span>No photo selected</span>";return}
  const url=URL.createObjectURL(file);preview.innerHTML=`<img src="${url}" alt="Selected job photo"><span>${esc(file.name)}</span>`;
 }
});

document.addEventListener("keydown",e=>{if(e.target.id==="customerSearch"&&e.key==="Enter"){e.preventDefault();state.customerSearch=e.target.value;render();}});'''
assert needle in s
s=s.replace(needle,replacement,1)

p.write_text(s)
