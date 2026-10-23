(function(){
  function fallbackPremiumAlert(message){
    try{
      var w=document.createElement('div');
      w.className='premiumPrompt';
      w.innerHTML='<div class="premiumPromptCard"><div class="promptIcon">✨</div><h3>Property Dealer Pro</h3><p></p><div class="promptActions one"><button class="btn primary" data-ok>OK</button></div></div>';
      w.querySelector('p').textContent=String(message||'');
      document.body.appendChild(w);
      document.body.style.overflow='hidden';
      var done=function(){w.classList.add('closing');setTimeout(function(){w.remove();document.body.style.overflow='';},150)};
      w.querySelector('[data-ok]').onclick=done;
      w.onclick=function(e){if(e.target===w)done();};
    }catch(e){}
  }
  window.alert=function(message){
    try{
      if(typeof window.premiumAlert==='function'){
        window.premiumAlert(String(message||''),'Property Dealer Pro','✨');
        return;
      }
    }catch(e){}
    fallbackPremiumAlert(message);
  };
})();
