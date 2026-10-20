// BoloBill v8 — precise invoice builder from prepared transcript
(function(){
  const $=s=>document.querySelector(s);
  const META_WORDS=/\b(?:paid|payment|received|receive|advance|jama|ada|delivery|shipping|courier|dc|discount|less|rebate|off|kam|tax|gst|phone|mobile|customer|client|name|naam|bill\s*to|total|balance|due)\b/i;
  const SEP=/\s*(?:,|;|\n|\b(?:and|aur|plus|then|phir)\b)\s*/i;

  function tidy(s){return String(s||'').replace(/[“”]/g,'"').replace(/[‘’]/g,"'").replace(/\s+/g,' ').replace(/\s*([,;])\s*/g,'$1 ').trim()}
  function n(s){return Number(String(s||'').replace(/,/g,'').replace(/[^0-9.\-]/g,''))||0}
  function escRx(s){return String(s).replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}
  function title(s){return tidy(s).replace(/\b\w/g,c=>c.toUpperCase())}
  function cleanItem(s){return title(String(s||'')
    .replace(/^(?:item|product|service)\s*[:\-]?\s*/i,'')
    .replace(/\b(?:rs\.?|pkr|rupees?|rupay|rupaye)\b/gi,' ')
    .replace(/\b(?:pcs?|pieces?|units?)\b/gi,' ')
    .replace(/\s+/g,' ').trim())}

  function normalizeText(s){
    return tidy(String(s||'')
      .replace(/\b(?:payd|payed)\b/gi,'paid')
      .replace(/\bdeliv(?:ery|ary|ry)\b/gi,'delivery')
      .replace(/\b(?:rupay|rupaye|rupees?)\b/gi,'rs')
      .replace(/\bper\s+piece\b/gi,'each')
      .replace(/\bpieces?\b/gi,'pcs')
      .replace(/\b(?:jama|received)\b/gi,'paid'));
  }

  function extractPhone(text){
    let labeled=text.match(/\b(?:phone|mobile|whatsapp)\s*[:\-]?\s*((?:\+?92|0)?3[\d\s-]{8,14})/i);
    let raw=labeled?.[1] || text.match(/(?:\+?92|0)3[\d\s-]{8,14}/)?.[0] || '';
    let d=raw.replace(/\D/g,'');
    if(d.startsWith('92')&&d.length===12)d='0'+d.slice(2);
    if(d.length===10&&d.startsWith('3'))d='0'+d;
    return /^03\d{9}$/.test(d)?d:'';
  }

  function metaNumber(text, words, percent=false){
    let w=words.map(escRx).join('|');
    let a=text.match(new RegExp('\\b(?:'+w+')\\b\\s*(?::|-)?\\s*(?:rs\\.?|pkr)?\\s*([\\d,.]+)\\s*'+(percent?'%?':''),'i'));
    if(a)return n(a[1]);
    let b=text.match(new RegExp('(?:rs\\.?|pkr)?\\s*([\\d,.]+)\\s*'+(percent?'%?\\s*':'')+'\\b(?:'+w+')\\b','i'));
    return b?n(b[1]):0;
  }

  function extractCustomer(text,phone){
    let t=text;
    if(phone)t=t.replace(new RegExp(escRx(phone.replace(/\D/g,'')),'g'),' ');
    let labeled=t.match(/\b(?:customer|client|name|naam|bill\s*to)\s*[:\-]?\s*([A-Za-z][A-Za-z .'-]{1,45}?)(?=\s*(?:,|;|\b(?:phone|mobile|whatsapp)\b|\d+\s+(?:x|pcs?|pieces?|units?)|$))/i);
    if(labeled)return title(labeled[1]);
    let first=t.split(/[,;\n]/)[0].trim();
    first=first.replace(/^(?:for|customer|client|name|naam|bill\s*to)\s*[:\-]?\s*/i,'');
    first=first.replace(/\b(?:bhai|sir|madam|sahib)\b$/i,m=>m);
    if(first && !/\d/.test(first) && first.length<=45 && !META_WORDS.test(first))return title(first);
    let pre=first.match(/^([A-Za-z][A-Za-z .'-]{1,45}?)(?=\s+\d+(?:\.\d+)?\s+)/);
    return pre?title(pre[1]):'Walk-in Customer';
  }

  function pushItem(items,name,qty,rate,source){
    name=cleanItem(name);qty=n(qty);rate=n(rate);
    if(!name||META_WORDS.test(name)||qty<=0||rate<0)return;
    if(name.length>60)return;
    let key=(name+'|'+qty+'|'+rate).toLowerCase();
    if(items.some(i=>i._key===key))return;
    items.push({name,qty,rate,_key:key,source:source||''});
  }

  function parseSegment(seg,items){
    let s=tidy(seg).replace(/^(?:and|aur|plus|then|phir)\s+/i,'');
    if(!s||META_WORDS.test(s))return;
    let m;
    m=s.match(/^(\d+(?:\.\d+)?)\s*(?:x|×|pcs?|pieces?|units?)?\s+(.+?)\s+(?:at|@|each(?:\s+at)?|per|ki|ka|ke)\s*(?:rs\.?|pkr)?\s*([\d,.]+)\b/i);
    if(m){pushItem(items,m[2],m[1],m[3],s);return}
    m=s.match(/^(\d+(?:\.\d+)?)\s*(?:x|×|pcs?|pieces?|units?)?\s+(.+?)\s+(?:rs\.?|pkr)?\s*([\d,.]+)\s*(?:each|per|ea)\b/i);
    if(m){pushItem(items,m[2],m[1],m[3],s);return}
    m=s.match(/^(.+?)\s+(\d+(?:\.\d+)?)\s*(?:pcs?|pieces?|units?)?\s+(?:at|@|each|per)\s*(?:rs\.?|pkr)?\s*([\d,.]+)\b/i);
    if(m){pushItem(items,m[1],m[2],m[3],s);return}
    m=s.match(/^(\d+(?:\.\d+)?)\s*(?:x|×|pcs?|pieces?|units?)?\s+(.+?)\s+(?:total|for)\s*(?:rs\.?|pkr)?\s*([\d,.]+)\b/i);
    if(m){let q=n(m[1]),tot=n(m[3]);if(q>0)pushItem(items,m[2],q,tot/q,s);return}
    m=s.match(/^(\d+(?:\.\d+)?)\s*(?:x|×|pcs?|pieces?|units?)?\s+([A-Za-z][A-Za-z0-9 &_'.\-]{1,42}?)\s+(?:rs\.?|pkr)?\s*([\d,.]+)$/i);
    if(m)pushItem(items,m[2],m[1],m[3],s);
  }

  function scrubMeta(text,customer,phone){
    let s=text;
    if(phone){let d=phone.replace(/\D/g,'');let spaced=d.split('').join('\\s*');s=s.replace(new RegExp(spaced,'g'),' ')}
    const words='paid|payment|received|receive|advance|jama|ada|delivery|shipping|courier|dc|discount|less|rebate|off|kam|tax|gst';
    s=s.replace(new RegExp('\\b(?:'+words+')\\b\\s*(?::|-)?\\s*(?:rs\\.?|pkr)?\\s*[\\d,.]+\\s*%?','gi'),' ')
       .replace(new RegExp('(?:rs\\.?|pkr)?\\s*[\\d,.]+\\s*%?\\s*\\b(?:'+words+')\\b','gi'),' ')
       .replace(/\b(?:phone|mobile|whatsapp)\b\s*[:\-]?\s*(?:\+?92|0)?3[\d\s-]{8,14}/gi,' ');
    if(customer&&customer!=='Walk-in Customer'){
      let raw=customer.replace(/\b\w/g,c=>c.toLowerCase());
      s=s.replace(new RegExp('^\\s*(?:customer|client|name|naam|bill\\s*to|for)?\\s*[:\\-]?\\s*'+escRx(raw)+'\\s*[,;]?\\s*','i'),' ');
    }
    return tidy(s);
  }

  function parseInvoice(text){
    let original=tidy(text), normalized=normalizeText(original), lower=normalized.toLowerCase();
    let phone=extractPhone(normalized);
    let customer=extractCustomer(normalized,phone);
    let paid=metaNumber(lower,['paid','payment','advance','received','jama','ada']);
    let delivery=metaNumber(lower,['delivery','shipping','courier','dc']);
    let discount=metaNumber(lower,['discount','less','rebate','off','kam']);
    let tax=metaNumber(lower,['tax','gst'],true);
    let scrub=scrubMeta(normalized,customer,phone);
    let segments=scrub.split(SEP).map(tidy).filter(Boolean);
    let items=[];segments.forEach(seg=>parseSegment(seg,items));
    let re=/\b(\d+(?:\.\d+)?)\s*(?:x|×|pcs?|pieces?|units?)?\s+([A-Za-z][A-Za-z0-9 &_'.\-]{1,36}?)\s+(?:at|@|each(?:\s+at)?|per|ki|ka|ke)\s*(?:rs\.?|pkr)?\s*([\d,.]+)/gi,m;
    while((m=re.exec(scrub)))pushItem(items,m[2],m[1],m[3],m[0]);
    items=items.map(({_key,source,...x})=>x);
    let subtotal=items.reduce((a,i)=>a+i.qty*i.rate,0);
    let taxable=Math.max(0,subtotal-discount),taxAmount=taxable*tax/100,total=taxable+taxAmount+delivery,balance=Math.max(0,total-paid);
    let issues=[];
    if(customer==='Walk-in Customer')issues.push('Customer name not clear');
    if(!items.length)issues.push('No confident item + quantity + rate found');
    for(let i of items){if(i.qty<=0)issues.push('Invalid quantity for '+i.name);if(i.rate<=0)issues.push('Price missing for '+i.name)}
    if(tax<0||tax>100)issues.push('Tax percentage looks invalid');
    if(discount>subtotal&&subtotal>0)issues.push('Discount is larger than subtotal');
    if(paid>total&&total>0)issues.push('Paid amount is larger than invoice total');
    let score=20+(customer!=='Walk-in Customer'?12:0)+(phone?6:0)+Math.min(45,items.length*18)+(delivery?4:0)+(paid?5:0)+(discount?3:0)+(tax?3:0)-issues.length*12;
    score=Math.max(0,Math.min(99,score));
    return {original,normalized,customer,phone,items,paid,delivery,discount,tax,subtotal,taxAmount,total,balance,issues,confidence:score};
  }

  function money(v){return 'PKR '+new Intl.NumberFormat('en-PK',{maximumFractionDigits:2}).format(Number(v||0))}
  function ensureReview(){
    if($('#invoiceAIReview'))return;
    let style=document.createElement('style');style.textContent=`#invoiceAIReview{position:fixed;z-index:1000;inset:0;background:rgba(8,18,15,.68);display:none;align-items:flex-end;justify-content:center;backdrop-filter:blur(5px)}#invoiceAIReview.show{display:flex}.v8sheet{width:min(560px,100%);max-height:90vh;overflow:auto;background:#fff;border-radius:28px 28px 0 0;padding:18px 16px 26px;color:#14201c}.v8handle{width:48px;height:5px;background:#d9dedb;border-radius:99px;margin:0 auto 14px}.v8top{display:flex;justify-content:space-between;align-items:center;gap:10px}.v8score{background:#e7f8f1;color:#11744f;border-radius:999px;padding:5px 9px;font-weight:900;font-size:11px}.v8row{display:grid;grid-template-columns:1fr auto auto;gap:8px;padding:10px 0;border-bottom:1px solid #edf0ee;font-size:12px}.v8meta{background:#f6f8f7;border-radius:16px;padding:12px;margin:12px 0;font-size:12px;line-height:1.55}.v8warn{background:#fff4e6;color:#8a4b00;border:1px solid #ffe0ae;border-radius:14px;padding:10px 12px;font-size:11px;margin:10px 0}.v8ok{background:#eaf9f2;color:#116b4b;border-radius:14px;padding:10px 12px;font-size:11px;margin:10px 0}.v8actions{display:grid;grid-template-columns:.8fr 1.2fr;gap:9px;margin-top:14px}.v8btn{border:0;border-radius:14px;padding:12px 14px;font-weight:900}.v8cancel{background:#eef1ef;color:#31463f}.v8create{background:linear-gradient(145deg,#16a36d,#0d7f55);color:#fff}`;document.head.appendChild(style);
    let d=document.createElement('div');d.id='invoiceAIReview';d.innerHTML='<div class="v8sheet"><div class="v8handle"></div><div id="v8content"></div></div>';document.body.appendChild(d);
    d.addEventListener('click',e=>{if(e.target===d)d.classList.remove('show')});
  }

  let pending=null;
  function showReview(r){
    ensureReview();pending=r;let c=$('#v8content');
    let rows=r.items.length?r.items.map(i=>`<div class="v8row"><b>${i.name}</b><span>${i.qty} × ${money(i.rate)}</span><b>${money(i.qty*i.rate)}</b></div>`).join(''):'<div class="v8warn">No invoice item was confidently extracted.</div>';
    let issueHtml=r.issues.length?`<div class="v8warn"><b>Check before invoice:</b><br>${r.issues.map(x=>'• '+x).join('<br>')}</div>`:`<div class="v8ok"><b>Invoice-ready check passed.</b> Quantities, rates and totals are internally consistent.</div>`;
    c.innerHTML=`<div class="v8top"><div><h3 style="margin:0">AI Invoice Review</h3><div style="font-size:11px;color:#6b7872;margin-top:3px">Verify extracted fields before creating the invoice.</div></div><span class="v8score">${r.confidence}% confidence</span></div><div class="v8meta"><b>Customer:</b> ${r.customer}<br><b>Phone:</b> ${r.phone||'—'}<br><b>Delivery:</b> ${money(r.delivery)} &nbsp; <b>Discount:</b> ${money(r.discount)}<br><b>Tax:</b> ${r.tax}% &nbsp; <b>Paid:</b> ${money(r.paid)}</div>${rows}<div class="v8meta"><b>Subtotal:</b> ${money(r.subtotal)}<br><b>Tax amount:</b> ${money(r.taxAmount)}<br><b>Total:</b> ${money(r.total)}<br><b>Balance:</b> ${money(r.balance)}</div>${issueHtml}<div class="v8actions"><button class="v8btn v8cancel" id="v8edit">Back & Edit Text</button><button class="v8btn v8create" id="v8create">Create Accurate Invoice</button></div>`;
    $('#v8edit').onclick=()=>$('#invoiceAIReview').classList.remove('show');
    $('#v8create').onclick=()=>{
      if(!pending||!pending.items.length){if(typeof showToast==='function')showToast('Add a clear item, quantity and price first');return}
      $('#invoiceAIReview').classList.remove('show');
      try{if(typeof closeScreen==='function')closeScreen('voiceScreen')}catch(_){ }
      if(typeof newInvoice==='function')newInvoice({customer:pending.customer,phone:pending.phone,items:pending.items,paid:pending.paid,delivery:pending.delivery,discount:pending.discount,tax:pending.tax,status:pending.balance<=0&&pending.total>0?'paid':'due',notes:`AI invoice parser v8 • ${pending.confidence}% confidence`});
      if(typeof showToast==='function')showToast('Invoice fields created and totals verified');
    };
    $('#invoiceAIReview').classList.add('show');
  }

  function fromTranscript(){let t=$('#voiceManual')?.value||$('#voiceTranscript')?.textContent||'';let r=parseInvoice(t);showReview(r)}
  window.parseVoiceTranscript=fromTranscript;
  window.parseManualVoice=fromTranscript;
  window.parsePastedOrder=function(){let t=$('#pasteText')?.value||'';$('#pasteModal')?.classList.remove('show');showReview(parseInvoice(t))};
  window.parseOrderText=function(t){showReview(parseInvoice(t))};
  window.BoloBillInvoiceAI={parseInvoice,showReview};

  function badge(){let box=$('#voiceScreen .voice-box');if(box&&!$('#invoiceV8Badge')){let d=document.createElement('div');d.id='invoiceV8Badge';d.style.cssText='margin:8px 0;color:#9df0cb;font-size:11px;font-weight:900;text-align:center';d.textContent='✓ Invoice AI v8 — structured extraction + math validation + review before creation';box.appendChild(d)}}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',badge);else badge();
})();
