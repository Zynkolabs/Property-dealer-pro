// BoloBill v7 — precision microphone engine for invoice dictation
(function(){
  let rec=null, keep=false, committed='', current='', restartTimer=null;
  let lastHyp='', stableHits=0, bestConfidence=0;
  const el=s=>document.querySelector(s);
  const INVOICE_WORDS=/\b(?:paid|payment|received|jama|advance|delivery|shipping|discount|tax|gst|at|each|per|piece|pcs|qty|quantity|rs|pkr|rupees?|rupay|rupaye|phone|mobile|customer|client|name|naam|total|balance|due|shirt|shirts|jeans|cap|caps|box|boxes|item|items)\b/gi;
  const HARD_SIGNALS=/\b(?:paid|delivery|discount|tax|gst|phone|mobile|customer|client|total|balance|due)\b/gi;
  const BIAS_PHRASES=['customer','client','mobile','phone','paid','payment','delivery','shipping','discount','tax','GST','total','balance','due','quantity','each','per piece','PKR','rupees','jama','advance','shirt','shirts','jeans','caps','pieces'];

  function tidy(s){return String(s||'').replace(/[“”]/g,'"').replace(/[‘’]/g,"'").replace(/\s+/g,' ').replace(/\s*([,;])\s*/g,'$1 ').trim()}
  function norm(s){return tidy(s).toLowerCase().replace(/[^a-z0-9\u0600-\u06ff ]+/g,' ').replace(/\s+/g,' ').trim()}
  function tokens(s){return norm(s).split(' ').filter(Boolean)}
  function repeatedPenalty(t){let a=tokens(t); if(a.length<5)return 0; let seen=new Map(),rep=0; for(let i=0;i<a.length-1;i++){let bg=a[i]+' '+a[i+1];let n=(seen.get(bg)||0)+1;seen.set(bg,n);if(n>1)rep++} return rep*2.5}
  function phoneWordToDigit(w){w=w.toLowerCase();return ({zero:'0',oh:'0',o:'0',one:'1',two:'2',three:'3',four:'4',five:'5',six:'6',seven:'7',eight:'8',nine:'9'})[w]??null}
  function normalizePhoneWords(s){
    return s.replace(/\b(phone|mobile)\b([^,;]*)/ig,(all,label,tail)=>{
      let words=tail.trim().split(/\s+/),out=[],digits=0;
      for(let w of words){let d=phoneWordToDigit(w.replace(/[^a-z]/ig,''));if(d!==null){out.push(d);digits++;continue}if(/^\d+$/.test(w)){out.push(w);digits+=w.length;continue}out.push(w)}
      let joined=out.join(' ').replace(/(?<=\d)\s+(?=\d)/g,'');
      return label+' '+joined;
    })
  }
  function cleanHyp(s){
    s=tidy(s)
      .replace(/\b(?:payd|payed)\b/gi,'paid')
      .replace(/\bdeliv(?:ery|ary|ry)\b/gi,'delivery')
      .replace(/\b(?:rupees?|rupay|rupaye)\b/gi,'rs')
      .replace(/\bper\s+piece\b/gi,'each')
      .replace(/\bpieces?\b/gi,'pcs');
    return tidy(normalizePhoneWords(s));
  }
  function scoreAlt(alt){
    let t=cleanHyp(alt.transcript||''),c=Number(alt.confidence||0),digits=(t.match(/\d/g)||[]).length;
    let inv=(t.match(INVOICE_WORDS)||[]).length,hard=(t.match(HARD_SIGNALS)||[]).length;
    let score=c*12 + Math.min(digits,14)*0.8 + inv*2.2 + hard*2.8 + Math.min(t.length,120)*0.01;
    if(/(?:\+?92|0)3[\d\s-]{8,13}/.test(t))score+=8;
    if(/\b\d+(?:\.\d+)?\s+[^,;]{1,30}\s+(?:at|@|each|per)\s+(?:rs\s*)?\d+/i.test(t))score+=9;
    if(/\b(?:paid|delivery|discount|tax)\s+(?:rs\s*)?\d+/i.test(t))score+=6;
    score-=repeatedPenalty(t);
    return {text:t,score,confidence:c};
  }
  function bestAlt(result){let best={text:'',score:-Infinity,confidence:0};for(let i=0;i<Math.min(result.length,10);i++){let x=scoreAlt(result[i]);if(x.score>best.score)best=x}bestConfidence=best.confidence;return best.text}
  function merge(base,next){
    base=tidy(base);next=tidy(next);if(!base)return next;if(!next)return base;
    let bn=norm(base),nn=norm(next);if(!nn||bn===nn)return base;
    if(bn.endsWith(' '+nn)||bn===nn)return base;
    if(nn.startsWith(bn+' ')||nn===bn)return next;
    if((' '+bn+' ').includes(' '+nn+' ') && tokens(nn).length>=3)return base;
    let A=tokens(base),B=tokens(next),max=Math.min(A.length,B.length,30);
    for(let n=max;n>=1;n--){if(A.slice(-n).join(' ')===B.slice(0,n).join(' '))return tidy(base+' '+B.slice(n).join(' '))}
    return tidy(base+' '+next);
  }
  function confidencePct(text){
    let inv=(text.match(INVOICE_WORDS)||[]).length, digits=(text.match(/\d/g)||[]).length;
    let pct=Math.round(Math.max(45,Math.min(99,(bestConfidence||0.55)*65 + Math.min(inv,8)*3 + Math.min(digits,10)*1.2)));
    return pct;
  }
  function render(){
    let text=merge(committed,current),a=el('#voiceTranscript'),m=el('#voiceManual');
    if(a)a.textContent=text||'Listening…';if(m)m.value=text;
    let r=el('#aiResult');if(r&&text){r.classList.remove('hidden');r.innerHTML='<b>Precision capture</b><span class="score">'+confidencePct(text)+'%</span><br>Live hypothesis is stabilized before it is committed.'}
  }
  async function micPermission(){try{if(!navigator.mediaDevices?.getUserMedia)return true;let s=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true}});s.getTracks().forEach(t=>t.stop());return true}catch(e){let w=el('#voiceWarning');if(w){w.textContent='Microphone permission is blocked. Open BoloBill over HTTPS and allow Microphone.';w.classList.remove('hidden')}return false}}
  function setUI(on,msg){let o=el('#voiceOrb'),b=el('#listenBtn'),s=el('#voiceStatus');if(o)o.textContent=on?'◉':'🎤';if(b)b.textContent=on?'■ Stop Listening':'🎤 Start Listening';if(s)s.textContent=msg||(on?'Listening…':'Stopped')}
  function commitCurrent(force=false){
    if(!current)return;
    if(force||stableHits>=1||tokens(current).length>=2){committed=merge(committed,current)}
    current='';lastHyp='';stableHits=0;render();
  }
  function applyBias(recognition){
    try{
      if('phrases' in recognition && window.SpeechRecognitionPhrase){
        recognition.phrases=BIAS_PHRASES.map(p=>new SpeechRecognitionPhrase(p,5.0));
      }
    }catch(_){ }
  }
  function launch(SR){
    if(!keep)return;current='';lastHyp='';stableHits=0;
    try{
      rec=new SR();rec.lang=el('#voiceLang')?.value||'en-PK';rec.interimResults=true;rec.continuous=false;rec.maxAlternatives=10;applyBias(rec);
      rec.onstart=()=>setUI(true,'Precision listening… speak naturally, one order at a time');
      rec.onresult=e=>{
        if(!e.results||!e.results.length)return;
        let result=e.results[e.results.length-1],hyp=bestAlt(result);if(!hyp)return;
        let nh=norm(hyp),lh=norm(lastHyp);
        if(nh===lh)stableHits++;else if(lh&&(nh.startsWith(lh+' ')||lh.startsWith(nh+' ')))stableHits=Math.max(stableHits,1);else stableHits=0;
        lastHyp=hyp;current=hyp;render();
        if(result.isFinal){commitCurrent(true);setUI(true,'Phrase captured accurately — continue speaking')}
        else setUI(true,stableHits>=1?'Phrase stabilized…':'Listening… refining the best wording');
      };
      rec.onerror=e=>{
        if(e.error==='no-speech'||e.error==='aborted'){setUI(true,'Pause detected — keeping your order and continuing');return}
        if(['not-allowed','service-not-allowed','audio-capture','language-not-supported'].includes(e.error)){keep=false;commitCurrent(true);setUI(false,'Microphone stopped: '+e.error);let w=el('#voiceWarning');if(w){w.textContent='Microphone error: '+e.error+'. Check browser microphone permission.';w.classList.remove('hidden')}}
      };
      rec.onend=()=>{
        commitCurrent(true);
        if(keep){setUI(true,'Pause detected — continuing without repeating');clearTimeout(restartTimer);restartTimer=setTimeout(()=>launch(SR),300)}
        else setUI(false,'Stopped — precise transcript saved');
      };
      rec.start();
    }catch(e){commitCurrent(true);if(keep){clearTimeout(restartTimer);restartTimer=setTimeout(()=>launch(SR),650)}else setUI(false,'Could not start microphone')}
  }
  window.startListening=async function(){
    let SR=window.SpeechRecognition||window.webkitSpeechRecognition;
    if(!SR){setUI(false,'Voice recognition unavailable in this browser');return}
    if(keep){keep=false;clearTimeout(restartTimer);try{rec&&rec.stop()}catch(_){}commitCurrent(true);setUI(false,'Stopped — precise transcript saved');return}
    if(!(await micPermission()))return;
    committed='';current='';lastHyp='';stableHits=0;bestConfidence=0;
    let a=el('#voiceTranscript'),m=el('#voiceManual'),r=el('#aiResult');if(a)a.textContent='Listening…';if(m)m.value='';if(r)r.classList.add('hidden');
    keep=true;launch(SR);
  };
  function badge(){
    let old=[...document.querySelectorAll('.voice-box div')].find(x=>x.textContent&&/Mic v|Continuous Mic/.test(x.textContent));
    if(old)old.textContent='● Deep AI Mic v7 — 10 alternatives + invoice bias + stabilization + anti-repeat';
    let p=el('#voiceScreen .voice-box p');if(p)p.textContent='Speak naturally. Deep AI Mic ranks up to 10 recognition alternatives, favors invoice words/numbers, stabilizes the phrase, removes repeats, and keeps the cleanest transcript.';
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',badge);else badge();
})();