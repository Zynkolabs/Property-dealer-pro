// BoloBill v5 — continuous microphone with anti-repeat transcript merging
(function(){
let rec=null, keep=false, committed='', sessionText='', restartTimer=null;
function el(s){return document.querySelector(s)}
function tidy(s){return String(s||'').replace(/\s+/g,' ').replace(/\s*([,;])\s*/g,'$1 ').trim()}
function norm(s){return tidy(s).toLowerCase().replace(/[^a-z0-9\u0600-\u06ff ]+/g,' ').replace(/\s+/g,' ').trim()}
function toks(s){return norm(s).split(' ').filter(Boolean)}
function sameSeq(a,b){if(a.length!==b.length)return false;for(let i=0;i<a.length;i++)if(a[i]!==b[i])return false;return true}
function mergeSmart(base, add){
 base=tidy(base); add=tidy(add); if(!add)return base; if(!base)return add;
 let nb=norm(base), na=norm(add); if(!na)return base;
 if(nb===na || nb.endsWith(' '+na) || nb===na)return base;
 if(na.startsWith(nb+' ') || na===nb) return add;
 let B=toks(base), A=toks(add);
 // If the recognizer replays a phrase we already have near the end, ignore it.
 let tail=B.slice(Math.max(0,B.length-28)).join(' '), aj=A.join(' ');
 if(aj && (' '+tail+' ').includes(' '+aj+' ')) return base;
 // Collapse progressive recognition such as "Ahmad" -> "Ahmad bhai" -> "Ahmad bhai mobile".
 let maxPrefix=Math.min(B.length,A.length);
 for(let k=maxPrefix;k>=1;k--){if(sameSeq(B.slice(0,k),A.slice(0,k))){
   if(k===B.length && A.length>B.length)return add;
   break;
 }}
 // Append only words that do not overlap with the current transcript tail.
 let max=Math.min(18,B.length,A.length), overlap=0;
 for(let k=max;k>=1;k--){if(sameSeq(B.slice(B.length-k),A.slice(0,k))){overlap=k;break}}
 if(overlap)return tidy(base+' '+A.slice(overlap).join(' '));
 return tidy(base+' '+add);
}
function bestAlt(result){let best='',score=-1;for(let i=0;i<Math.min(result.length,5);i++){let t=(result[i].transcript||'').trim(),c=result[i].confidence||0,n=(t.match(/\d/g)||[]).length,k=(t.match(/\b(?:paid|delivery|discount|tax|at|each|rs|pkr|phone|mobile|customer|client)\b/gi)||[]).length,s=c*5+n+k*3+t.length*.002;if(s>score){score=s;best=t}}return best}
function buildSession(results){let out='';for(let i=0;i<results.length;i++){let t=bestAlt(results[i]);if(t)out=mergeSmart(out,t)}return out}
function display(extra=''){let text=mergeSmart(committed,extra||sessionText),a=el('#voiceTranscript'),m=el('#voiceManual');if(text){if(a)a.textContent=text;if(m)m.value=text}}
async function micPermission(){try{if(navigator.permissions?.query){try{let p=await navigator.permissions.query({name:'microphone'});if(p.state==='denied')throw new Error('denied')}catch(_){}}if(!navigator.mediaDevices?.getUserMedia)return true;let stream=await navigator.mediaDevices.getUserMedia({audio:true});stream.getTracks().forEach(t=>t.stop());return true}catch(e){let w=el('#voiceWarning');if(w){w.textContent='Microphone permission is blocked. Open BoloBill over HTTPS and allow Microphone.';w.classList.remove('hidden')}return false}}
function setUI(listening,msg){let o=el('#voiceOrb'),b=el('#listenBtn'),s=el('#voiceStatus');if(o)o.textContent=listening?'◉':'🎤';if(b)b.textContent=listening?'■ Stop Listening':'🎤 Start Listening';if(s)s.textContent=msg||(listening?'Listening…':'Stopped')}
function commitSession(){if(sessionText){committed=mergeSmart(committed,sessionText);sessionText='';display('')}}
function launch(SR){if(!keep)return;try{
 rec=new SR();rec.lang=el('#voiceLang')?.value||'en-PK';rec.interimResults=true;rec.continuous=true;rec.maxAlternatives=5;
 rec.onstart=()=>setUI(true,'Listening continuously… pauses are OK');
 rec.onresult=e=>{sessionText=buildSession(e.results);display(sessionText);let s=el('#voiceStatus');if(s)s.textContent='Listening continuously… duplicate words are filtered';};
 rec.onerror=e=>{if(e.error==='no-speech'||e.error==='aborted'){let s=el('#voiceStatus');if(s)s.textContent='Pause detected — reconnecting…';return}if(['not-allowed','service-not-allowed','audio-capture','language-not-supported'].includes(e.error)){keep=false;commitSession();setUI(false,'Microphone stopped: '+e.error);let w=el('#voiceWarning');if(w){w.textContent='Microphone error: '+e.error+'. Check browser microphone permission.';w.classList.remove('hidden')}}};
 rec.onend=()=>{commitSession();if(keep){setUI(true,'Pause detected — reconnecting…');clearTimeout(restartTimer);restartTimer=setTimeout(()=>launch(SR),420)}else setUI(false,'Stopped — tap Create Draft when ready')};
 rec.start();
 }catch(e){commitSession();if(keep){clearTimeout(restartTimer);restartTimer=setTimeout(()=>launch(SR),700)}else setUI(false,'Could not start microphone')}}
window.startListening=async function(){
 let SR=window.SpeechRecognition||window.webkitSpeechRecognition;if(!SR){setUI(false,'Voice recognition unavailable in this browser');return}
 if(keep){keep=false;clearTimeout(restartTimer);commitSession();try{rec&&rec.stop()}catch(_){}setUI(false,'Stopped — transcript saved');return}
 let ok=await micPermission();if(!ok)return;
 // Start a fresh order each time the user presses Start after a manual stop.
 committed='';sessionText='';let a=el('#voiceTranscript'),m=el('#voiceManual');if(a)a.textContent='';if(m)m.value='';
 keep=true;launch(SR);
};
function addBadge(){let old=[...document.querySelectorAll('.voice-box div')].find(x=>x.textContent&&x.textContent.includes('Continuous Mic v4'));if(old)old.textContent='● Continuous Mic v5 — anti-repeat filter + auto-reconnect';}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',addBadge);else addBadge();
})();