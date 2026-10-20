// BoloBill v4 — continuous microphone mode for Android/Chrome
(function(){
let rec=null, keep=false, finalText='', timer=null;
function el(s){return document.querySelector(s)}
function tidy(s){return String(s||'').replace(/\s+/g,' ').replace(/\s*([,;])\s*/g,'$1 ').trim()}
function bestAlt(result){let best='',score=-1;for(let i=0;i<Math.min(result.length,5);i++){let t=(result[i].transcript||'').trim(),c=result[i].confidence||0;let n=(t.match(/\d/g)||[]).length;let k=(t.match(/\b(?:paid|delivery|discount|tax|at|each|rs|pkr|phone|mobile)\b/gi)||[]).length;let s=c*5+n+k*3+t.length*.002;if(s>score){score=s;best=t}}return best}
async function micPermission(){try{if(typeof requestMicPermission==='function')return await requestMicPermission();if(!navigator.mediaDevices?.getUserMedia)return true;let stream=await navigator.mediaDevices.getUserMedia({audio:true});stream.getTracks().forEach(t=>t.stop());return true}catch(e){let w=el('#voiceWarning');if(w){w.textContent='Microphone permission is blocked. Open BoloBill in Chrome over HTTPS and allow Microphone.';w.classList.remove('hidden')}return false}}
function setStopped(msg){let o=el('#voiceOrb'),b=el('#listenBtn'),s=el('#voiceStatus');if(o)o.textContent='🎤';if(b)b.textContent='🎤 Start Listening';if(s)s.textContent=msg||'Stopped'}
function syncText(interim){let t=tidy((finalText+' '+(interim||'')).trim()),a=el('#voiceTranscript'),m=el('#voiceManual');if(t){if(a)a.textContent=t;if(m)m.value=t}}
function launch(SR){if(!keep)return;try{
 rec=new SR();rec.lang=el('#voiceLang')?.value||'en-PK';rec.interimResults=true;rec.continuous=true;rec.maxAlternatives=5;
 rec.onstart=()=>{let o=el('#voiceOrb'),b=el('#listenBtn'),s=el('#voiceStatus');if(o)o.textContent='◉';if(b)b.textContent='■ Stop Listening';if(s)s.textContent='Listening continuously… pauses are OK';};
 rec.onresult=e=>{let interim='';for(let i=e.resultIndex;i<e.results.length;i++){let t=bestAlt(e.results[i]);if(e.results[i].isFinal)finalText+=t+' ';else interim+=t+' '}syncText(interim);let s=el('#voiceStatus');if(s)s.textContent='Listening continuously… full order is being kept';};
 rec.onerror=e=>{if(e.error==='no-speech'||e.error==='aborted'){let s=el('#voiceStatus');if(s)s.textContent='Pause detected — reconnecting…';return}if(['not-allowed','service-not-allowed','audio-capture','language-not-supported'].includes(e.error)){keep=false;setStopped('Microphone stopped: '+e.error);let w=el('#voiceWarning');if(w){w.textContent='Microphone error: '+e.error+'. Check Chrome microphone permission.';w.classList.remove('hidden')}}};
 rec.onend=()=>{syncText('');if(keep){let s=el('#voiceStatus');if(s)s.textContent='Pause detected — microphone reconnecting…';clearTimeout(timer);timer=setTimeout(()=>launch(SR),350)}else setStopped('Stopped — tap Create Draft when ready')};
 rec.start();
 }catch(e){if(keep){clearTimeout(timer);timer=setTimeout(()=>launch(SR),700)}else setStopped('Could not start microphone')}}
window.startListening=async function(){
 if(typeof isPro==='function'&&!isPro()){if(typeof showToast==='function')showToast('Pro feature');return}
 let SR=window.SpeechRecognition||window.webkitSpeechRecognition;if(!SR){let s=el('#voiceStatus');if(s)s.textContent='Voice recognition unavailable in this browser';return}
 if(keep){keep=false;clearTimeout(timer);try{rec&&rec.stop()}catch(e){}syncText('');setStopped('Stopped — tap Create Draft when ready');return}
 if(!(await micPermission()))return;
 keep=true;finalText='';let a=el('#voiceTranscript');if(a)a.textContent='Listening…';let m=el('#voiceManual');if(m)m.value='';launch(SR);
};
function badge(){let h=el('.voice-help');if(h&&!el('#continuousMicBadge')){let d=document.createElement('div');d.id='continuousMicBadge';d.style.cssText='margin-top:8px;color:#9df0cb;font-size:11px;font-weight:800';d.textContent='● Continuous Mic v4 — auto-restarts after Chrome silence timeouts';h.after(d)}}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',badge);else badge();
})();