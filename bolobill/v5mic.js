// BoloBill v6 — stable anti-repeat microphone capture
(function(){
let rec=null,keep=false,committed='',current='',timer=null;
const el=s=>document.querySelector(s);
const tidy=s=>String(s||'').replace(/\s+/g,' ').replace(/\s*([,;])\s*/g,'$1 ').trim();
function bestAlt(result){let best='',score=-1;for(let i=0;i<Math.min(result.length,5);i++){let t=(result[i].transcript||'').trim(),c=result[i].confidence||0,n=(t.match(/\d/g)||[]).length,k=(t.match(/\b(?:paid|delivery|discount|tax|at|each|rs|pkr|phone|mobile|customer|client)\b/gi)||[]).length,s=c*5+n+k*3+t.length*.002;if(s>score){score=s;best=t}}return tidy(best)}
function merge(base,next){base=tidy(base);next=tidy(next);if(!base)return next;if(!next)return base;let bl=base.toLowerCase(),nl=next.toLowerCase();if(bl===nl||bl.endsWith(' '+nl))return base;if(nl.startsWith(bl+' '))return next;let A=base.split(' '),B=next.split(' '),max=Math.min(A.length,B.length,24);for(let n=max;n>=1;n--){if(A.slice(-n).join(' ').toLowerCase()===B.slice(0,n).join(' ').toLowerCase())return tidy(A.concat(B.slice(n)).join(' '))}return tidy(base+' '+next)}
function render(){let text=merge(committed,current),a=el('#voiceTranscript'),m=el('#voiceManual');if(a)a.textContent=text||'Listening…';if(m)m.value=text}
async function micPermission(){try{if(!navigator.mediaDevices?.getUserMedia)return true;let s=await navigator.mediaDevices.getUserMedia({audio:true});s.getTracks().forEach(t=>t.stop());return true}catch(e){let w=el('#voiceWarning');if(w){w.textContent='Microphone permission is blocked. Open BoloBill over HTTPS and allow Microphone.';w.classList.remove('hidden')}return false}}
function setUI(on,msg){let o=el('#voiceOrb'),b=el('#listenBtn'),s=el('#voiceStatus');if(o)o.textContent=on?'◉':'🎤';if(b)b.textContent=on?'■ Stop Listening':'🎤 Start Listening';if(s)s.textContent=msg||(on?'Listening…':'Stopped')}
function commit(){if(current){committed=merge(committed,current);current='';render()}}
function launch(SR){if(!keep)return;current='';try{
 rec=new SR();rec.lang=el('#voiceLang')?.value||'en-PK';rec.interimResults=true;rec.continuous=false;rec.maxAlternatives=5;
 rec.onstart=()=>setUI(true,'Listening… speak normally');
 rec.onresult=e=>{if(!e.results||!e.results.length)return;let latest=e.results[e.results.length-1];current=bestAlt(latest);render();setUI(true,'Listening… refining the current phrase')};
 rec.onerror=e=>{if(e.error==='no-speech'||e.error==='aborted'){setUI(true,'Pause detected — continuing…');return}if(['not-allowed','service-not-allowed','audio-capture','language-not-supported'].includes(e.error)){keep=false;commit();setUI(false,'Microphone stopped: '+e.error)}};
 rec.onend=()=>{commit();if(keep){setUI(true,'Pause detected — continuing…');clearTimeout(timer);timer=setTimeout(()=>launch(SR),250)}else setUI(false,'Stopped — transcript saved')};
 rec.start();
 }catch(e){commit();if(keep){clearTimeout(timer);timer=setTimeout(()=>launch(SR),500)}else setUI(false,'Could not start microphone')}}
window.startListening=async function(){let SR=window.SpeechRecognition||window.webkitSpeechRecognition;if(!SR){setUI(false,'Voice recognition unavailable in this browser');return}if(keep){keep=false;clearTimeout(timer);try{rec&&rec.stop()}catch(_){}commit();setUI(false,'Stopped — transcript saved');return}if(!(await micPermission()))return;committed='';current='';let a=el('#voiceTranscript'),m=el('#voiceManual');if(a)a.textContent='Listening…';if(m)m.value='';keep=true;launch(SR)};
function badge(){let old=[...document.querySelectorAll('.voice-box div')].find(x=>x.textContent&&x.textContent.includes('Continuous Mic'));if(old)old.textContent='● Mic v6 — no progressive repeat, auto-continues after pauses';}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',badge);else badge();
})();