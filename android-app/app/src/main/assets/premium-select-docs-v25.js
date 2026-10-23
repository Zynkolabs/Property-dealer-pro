(function(){
'use strict';
const MAX_FILE=6*1024*1024,MAX_TOTAL=20*1024*1024;
let docAttachmentsDraft=[];

function fileIcon(mime,name){
  const n=String(name||'').toLowerCase(),m=String(mime||'');
  if(m.startsWith('image/'))return '🖼️';
  if(m==='application/pdf'||n.endsWith('.pdf'))return '📕';
  if(/word|document/.test(m)||/\.docx?$/.test(n))return '📝';
  if(/excel|spreadsheet/.test(m)||/\.xlsx?$/.test(n))return '📊';
  if(/zip|compressed/.test(m)||/\.zip$/.test(n))return '🗜️';
  return '📎';
}
function humanSize(n){n=Number(n||0);if(n>=1048576)return (n/1048576).toFixed(n>=10485760?0:1)+' MB';if(n>=1024)return Math.round(n/1024)+' KB';return n+' B'}
function cloneAttachments(a){return Array.isArray(a)?a.map(x=>({...x})):[]}
function totalDraftBytes(){return docAttachmentsDraft.reduce((s,x)=>s+Number(x.size||0),0)}
function fileToDataURL(file){return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result||''));r.onerror=()=>reject(r.error||new Error('Could not read file'));r.readAsDataURL(file)})}
function imagePreview(a){return String(a.type||'').startsWith('image/')&&a.data?`<img src="${a.data}" alt="">`:fileIcon(a.type,a.name)}
function renderDocAttachmentDraft(){
  const host=document.getElementById('doc_attachment_list');if(!host)return;
  host.innerHTML=docAttachmentsDraft.length?docAttachmentsDraft.map((a,i)=>`<div class="docAttachmentItem"><button type="button" class="docAttachmentThumb" onclick="previewDocumentAttachment(${i})">${imagePreview(a)}</button><div class="docAttachmentMeta"><b>${esc(a.name||'Attachment')}</b><span>${esc(humanSize(a.size))} • ${esc(a.type||'file')}</span></div><button type="button" class="docAttachmentRemove" onclick="removeDocumentAttachment(${i})" aria-label="Remove">×</button></div>`).join(''):'<div class="docUploadHint">No files attached yet.</div>';
}
window.handleDocumentFiles=async function(files){
  const list=Array.from(files||[]);if(!list.length)return;
  let added=0;
  for(const file of list){
    if(file.size>MAX_FILE){await premiumAlert(`${file.name} is larger than 6 MB. Choose a smaller file.`,'File too large','📎');continue}
    if(totalDraftBytes()+file.size>MAX_TOTAL){await premiumAlert('Document attachments are limited to 20 MB total so backup and restore stay reliable.','Attachment limit','🛡️');break}
    try{const data=await fileToDataURL(file);docAttachmentsDraft.push({id:uid(),name:file.name||'Attachment',type:file.type||'application/octet-stream',size:file.size||0,data,addedAt:new Date().toISOString()});added++}catch(e){await premiumAlert(`Could not read ${file.name}.`,'File error','⚠️')}
  }
  const input=document.getElementById('doc_files');if(input)input.value='';renderDocAttachmentDraft();if(added)toast(added===1?'Attachment added':added+' attachments added')
};
window.removeDocumentAttachment=function(i){docAttachmentsDraft.splice(Number(i),1);renderDocAttachmentDraft()};
window.previewDocumentAttachment=function(i){const a=docAttachmentsDraft[Number(i)];if(!a)return;if(!String(a.type||'').startsWith('image/')){premiumAlert(`${a.name}\n${humanSize(a.size)}\nSaved inside this document record.`,'Attachment saved',fileIcon(a.type,a.name));return}const wrap=document.createElement('div');wrap.className='docPreviewOverlay';wrap.innerHTML=`<div class="docPreviewCard"><img src="${a.data}" alt=""><div class="docPreviewBar"><b>${esc(a.name)}</b><button type="button">Close</button></div></div>`;document.body.appendChild(wrap);wrap.querySelector('button').onclick=()=>wrap.remove();wrap.onclick=e=>{if(e.target===wrap)wrap.remove()}};

window.openDocument=function(id){
  const d=id?state.documents.find(x=>x.id===id):{id:uid(),name:'',type:'Property File',reference:'',related:'',expiry:'',notes:'',attachments:[]};if(!d)return;
  docAttachmentsDraft=cloneAttachments(d.attachments);
  openModal(`<h3>${id?'Edit':'Add'} Document Tracker</h3><label>Document name</label><input id="doc_name" value="${esc(d.name)}" placeholder="Sale deed, CNIC copy, NOC..."><div class="grid2"><div><label>Type</label><select id="doc_type" data-picker-title="Document type">${['Property File','CNIC','NOC','Sale Agreement','Rent Agreement','Token Receipt','Authority Letter','Other'].map(x=>`<option ${x===d.type?'selected':''}>${x}</option>`).join('')}</select></div><div><label>Reference no.</label><input id="doc_ref" value="${esc(d.reference)}"></div></div><div class="grid2"><div><label>Related to</label><input id="doc_related" value="${esc(d.related)}" placeholder="Property / client"></div><div><label>Expiry / due date</label><input id="doc_exp" type="date" value="${esc(d.expiry)}"></div></div><label>Photos / PDF / Files</label><div class="docUploadZone"><input id="doc_files" type="file" multiple accept="image/*,application/pdf,.pdf,.doc,.docx,.xls,.xlsx,.txt,.zip" style="display:none" onchange="handleDocumentFiles(this.files)"><button type="button" class="docUploadBtn" onclick="document.getElementById('doc_files').click()">📎 Add Photos, PDF or File</button><div class="docUploadHint">Choose from your phone. Up to 6 MB per file • 20 MB per document.</div><div id="doc_attachment_list" class="docAttachmentList"></div></div><label>Notes / storage location</label><textarea id="doc_notes">${esc(d.notes)}</textarea><div class="actions"><button class="btn light" onclick="closeModal()">Cancel</button><button class="btn primary" onclick="saveDocument('${d.id}',${!!id})">Save Document</button></div>`);
  renderDocAttachmentDraft();
};
window.saveDocument=function(id,isEdit){
  const old=isEdit?state.documents.find(x=>x.id===id):null;
  const d={id,name:$('doc_name').value.trim(),type:$('doc_type').value,reference:$('doc_ref').value.trim(),related:$('doc_related').value.trim(),expiry:$('doc_exp').value,notes:$('doc_notes').value.trim(),attachments:cloneAttachments(docAttachmentsDraft),createdAt:old&&old.createdAt?old.createdAt:new Date().toISOString()};
  if(!d.name){premiumAlert('Enter a document name before saving.','Document name required','📄');return}
  if(isEdit)state.documents=state.documents.map(x=>x.id===id?d:x);else state.documents.unshift(d);closeModal();saveState('Document saved')
};
window.renderDocuments=function(){
  $('documentList').innerHTML=state.documents.length?state.documents.map(d=>{const dd=daysFrom(d.expiry),warn=dd!==null&&dd<=30,files=Array.isArray(d.attachments)?d.attachments:[],imgs=files.filter(a=>String(a.type||'').startsWith('image/')).slice(0,3);return `<div class="card listCard"><div class="rowTop"><div><div class="rowTitle">📄 ${esc(d.name)}</div><div class="rowMeta">${esc(d.type)} • ${esc(d.related||'Unlinked')}${d.reference?' • Ref '+esc(d.reference):''}</div></div>${d.expiry?`<span class="tag ${warn?'warn':''}">${warn?'Due ':'Expiry '}${esc(d.expiry)}</span>`:''}</div>${d.notes?`<div class="rowMeta">${esc(d.notes)}</div>`:''}${files.length?`<div class="docCardFiles"><span class="docFileBadge">📎 ${files.length} ${files.length===1?'file':'files'} saved</span></div>`:''}${imgs.length?`<div class="docCardThumbs">${imgs.map(a=>`<img src="${a.data}" alt="${esc(a.name)}">`).join('')}</div>`:''}<div class="actions"><button class="btn primary tiny" onclick="openDocument('${d.id}')">Edit</button><button class="btn danger tiny" onclick="removeItem('documents','${d.id}')">Delete</button></div></div>`}).join(''):`<div class="card empty">No documents tracked yet.</div>`
};

function closePicker(wrap){if(!wrap)return;wrap.remove();document.body.style.overflow=$('modal')&&!$('modal').classList.contains('hidden')?'hidden':''}
function openPremiumPicker(select,trigger){
  const opts=Array.from(select.options);const wrap=document.createElement('div');wrap.className='pdpPickerOverlay';const title=select.dataset.pickerTitle||select.closest('div')?.querySelector('label')?.textContent||'Choose option';
  wrap.innerHTML=`<div class="pdpPickerCard"><div class="pdpPickerHead"><strong>${esc(title)}</strong><button type="button" class="pdpPickerClose">×</button></div><div class="pdpPickerList">${opts.map((o,i)=>`<button type="button" class="pdpPickerOption ${o.selected?'selected':''}" data-i="${i}"><span class="pdpPickerRadio"></span><span>${esc(o.textContent)}</span></button>`).join('')}</div></div>`;
  document.body.appendChild(wrap);document.body.style.overflow='hidden';wrap.querySelector('.pdpPickerClose').onclick=()=>closePicker(wrap);wrap.onclick=e=>{if(e.target===wrap)closePicker(wrap)};wrap.querySelectorAll('.pdpPickerOption').forEach(b=>b.onclick=()=>{select.selectedIndex=Number(b.dataset.i);select.dispatchEvent(new Event('change',{bubbles:true}));trigger.textContent=select.options[select.selectedIndex]?.textContent||'';closePicker(wrap)})
}
function enhanceSelects(root=document){
  root.querySelectorAll('select:not([data-pdp-premium])').forEach(select=>{select.dataset.pdpPremium='1';select.classList.add('pdpSelectNative');const b=document.createElement('button');b.type='button';b.className='pdpSelectTrigger';b.textContent=select.options[select.selectedIndex]?.textContent||'Choose';b.onclick=()=>openPremiumPicker(select,b);select.insertAdjacentElement('afterend',b);select.addEventListener('change',()=>{b.textContent=select.options[select.selectedIndex]?.textContent||'Choose'})})
}
const oldOpenModal=window.openModal;window.openModal=function(html){oldOpenModal(html);requestAnimationFrame(()=>enhanceSelects(document.getElementById('sheet')||document))};
requestAnimationFrame(()=>enhanceSelects(document));
})();
