// BoloBill Deep AI v3 patch
(function(){
const style=document.createElement('style');style.textContent=`.ai-badge{display:inline-flex;align-items:center;gap:5px;background:rgba(157,240,203,.14);border:1px solid rgba(157,240,203,.2);color:#9df0cb;border-radius:999px;padding:5px 8px;font-size:9px;font-weight:900;margin:0 auto 10px}.ai-result{margin-top:10px;border-radius:14px;background:#f4faf7;border:1px solid #dcefe6;padding:10px 12px;color:#234238;font-size:11px;line-height:1.45}.ai-result b{color:#0f6d4b}.ai-result .score{float:right;background:#e3f7ec;color:#11744f;border-radius:999px;padding:2px 7px;font-weight:900}.ai-result.hidden{display:none!important}`;document.head.appendChild(style);
function enhanceUI(){let orb=document.querySelector('#voiceOrb');if(orb&&!document.querySelector('.ai-badge')){let wrap=document.createElement('div');wrap.style.textAlign='center';wrap.innerHTML='<span class="ai-badge">✦ DEEP AI FILTER</span>';orb.after(wrap)}let warn=document.querySelector('#voiceWarning');if(warn&&!document.querySelector('#aiResult')){let d=document.createElement('div');d.id='aiResult';d.className='ai-result hidden';warn.after(d)}let p=document.querySelector('#voiceScreen .voice-box p');if(p)p.textContent='Example: “Ali, 3 shirts at 2500 and 2 jeans at 4500, delivery 250, paid 3000.” Deep AI filters speech and extracts multiple items, names, phone, paid, delivery, discount and tax.'}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',enhanceUI);else enhanceUI();
let voiceFinalText='';
function transcriptScore(s){s=String(s||'').toLowerCase();let score=0;score+=(s.match(/\d/g)||[]).length*1.3;score+=(s.match(/\b(?:rs|pkr|rupees?|paid|payment|received|jama|advance|delivery|shipping|discount|tax|gst|at|each|per|qty|quantity|phone|mobile|customer|client|naam|ki|ka|ke)\b/g)||[]).length*4;if(/\b\d+(?:\.\d+)?\s+[^,;]+?\s+(?:at|@|each|per|ki|ka|ke)\s+(?:rs\.?|pkr)?\s*\d+/i.test(s))score+=12;if(/(?:\+?92|0)3[\d\s-]{9,12}/.test(s))score+=6;return score+s.length*.01}
function chooseBestAlternative(result){let best='';let bestScore=-1;for(let i=0;i<Math.min(result.length,5);i++){let t=result[i].transcript||'';let s=transcriptScore(t)+(result[i].confidence||0)*5;if(s>bestScore){bestScore=s;best=t}}return best.trim()}
function cleanSpeechText(s){return convertNumberWords(String(s||'').replace(/[“”]/g,'"').replace(/[‘’]/g,"'").replace(/\b(?:rupees?|rupay|rupaye|rs\.?|pkr)\b/gi,' rs ').replace(/\b(?:payd|payed)\b/gi,'paid').replace(/\bdeliv(?:ery|ary)\b/gi,'delivery').replace(/\s+/g,' ').replace(/\s*([,;])\s*/g,'$1 ').trim())}
async function startListening(){
  if(!isPro()){showToast('Pro feature');return}
  hideVoiceWarning();
  let SR=window.SpeechRecognition||window.webkitSpeechRecognition;
  if(!SR){$('#voiceStatus').textContent='Voice recognition unavailable here';showVoiceWarning('This browser does not support speech recognition. Open the HTTPS BoloBill link in Google Chrome. Typed / pasted Deep AI parsing still works.');return}
  if(listening&&recognition){recognition.stop();return}
  const ok=await requestMicPermission();if(!ok)return;
  try{
    voiceFinalText='';
    recognition=new SR();
    recognition.lang=$('#voiceLang')?.value||'en-PK';
    recognition.interimResults=true;
    recognition.continuous=true;
    recognition.maxAlternatives=5;
    recognition.onstart=()=>{listening=true;$('#voiceStatus').textContent='Listening… Deep AI is filtering alternatives';$('#voiceOrb').textContent='◉';$('#listenBtn').textContent='■ Stop Listening';$('#aiResult')?.classList.add('hidden')};
    recognition.onresult=e=>{let interim='';for(let i=e.resultIndex;i<e.results.length;i++){let best=chooseBestAlternative(e.results[i]);if(e.results[i].isFinal)voiceFinalText+=(best+' ');else interim+=(best+' ')}let text=cleanSpeechText((voiceFinalText+' '+interim).trim());if(text){$('#voiceTranscript').textContent=text;$('#voiceManual').value=text;$('#voiceStatus').textContent='Listening… best text selected from speech alternatives'}};
    recognition.onerror=e=>{let msg=friendlySpeechError(e.error);$('#voiceStatus').textContent=msg;showVoiceWarning(msg);showToast(msg)};
    recognition.onend=()=>{listening=false;$('#voiceOrb').textContent='🎤';$('#listenBtn').textContent='🎤 Start Listening';let final=cleanSpeechText(voiceFinalText||$('#voiceTranscript').textContent);if(final&&!final.startsWith('Your speech')){$('#voiceTranscript').textContent=final;$('#voiceManual').value=final}if($('#voiceStatus').textContent.startsWith('Listening'))$('#voiceStatus').textContent='Finished — tap Create Draft to run Deep AI extraction'};
    recognition.start();
  }catch(e){$('#voiceStatus').textContent='Could not start microphone';showVoiceWarning('Microphone could not start. Open the HTTPS BoloBill link in Chrome and allow Microphone permission.')}
}
function parseVoiceTranscript(){let text=$('#voiceTranscript').textContent;if(text.startsWith('Your speech'))text=$('#voiceManual').value;parseOrderText(text)}
function parseManualVoice(){parseOrderText($('#voiceManual').value)}
function parsePastedOrder(){$('#pasteModal').classList.remove('show');parseOrderText($('#pasteText').value)}
const EN_NUM={zero:0,one:1,two:2,threez