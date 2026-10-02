const b=document.getElementById('menuBtn'),m=document.getElementById('mobileMenu');if(b&&m){b.addEventListener('click',()=>{m.hidden=!m.hidden;b.textContent=m.hidden?'Menu':'Close'});} 
