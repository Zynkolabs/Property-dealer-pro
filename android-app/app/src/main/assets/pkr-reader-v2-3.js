(function(){
  function cleanAmountReader(input){
    if(!input)return;
    var box=input.nextElementSibling;
    if(!box||!box.classList||!box.classList.contains('pkrReadout')){
      box=document.createElement('div');
      box.className='pkrReadout zero';
      input.insertAdjacentElement('afterend',box);
    }
    var raw=String(input.value||'').trim();
    var n=typeof num==='function'?num(raw):Number(raw||0);
    if(!raw||!n){
      box.className='pkrReadout zero';
      box.innerHTML='';
      return;
    }
    var words=typeof pkrWords==='function'?pkrWords(n):'';
    box.className='pkrReadout hasValue';
    box.innerHTML='<span class="pkrWords">'+(typeof esc==='function'?esc(words):words)+'</span>';
  }

  window.updatePKRReader=cleanAmountReader;

  function refresh(){
    document.querySelectorAll('input[placeholder]').forEach(function(input){
      if(String(input.getAttribute('placeholder')||'').trim().toLowerCase()==='enter amount') input.removeAttribute('placeholder');
    });
    document.querySelectorAll('input[data-pkr-reader]').forEach(function(input){cleanAmountReader(input);});
    document.querySelectorAll('.pkrReadout').forEach(function(box){
      if((box.textContent||'').trim().toLowerCase()==='enter amount'){
        box.textContent='';box.className='pkrReadout zero';
      }
    });
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',refresh,{once:true});
  else refresh();
  setTimeout(refresh,0);
  setTimeout(refresh,250);
})();
