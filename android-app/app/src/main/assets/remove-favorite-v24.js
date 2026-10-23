/* Property Dealer Pro v2.4 — remove Favorite/star UI while preserving existing records */
(function(){
  try{
    if(typeof propertyCard==='function'){
      const originalPropertyCard=propertyCard;
      propertyCard=function(p){
        const html=originalPropertyCard(Object.assign({},p,{favorite:false}));
        return html.replace(/<button class="btn light tiny" onclick="toggleFavorite\('[^']+'\)">[★☆]<\/button>/g,'');
      };
    }
    if(typeof renderPropertyFilters==='function'){
      renderPropertyFilters=function(){
        const opts=['All','Available','Sale','Rent','Sold/Rented'];
        const box=document.getElementById('propertyFilters');
        if(box) box.innerHTML=opts.map(x=>`<button class="pill ${propertyFilter===x?'active':''}" onclick="propertyFilter='${x}';renderProperties()">${x}</button>`).join('');
      };
    }
    if(typeof propertyFilter!=='undefined'&&propertyFilter==='Favorite') propertyFilter='All';
    if(typeof renderProperties==='function') renderProperties();
  }catch(e){console.warn('v2.4 favorite UI patch',e)}
})();