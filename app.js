const $=id=>document.getElementById(id);
const a=$('a');
let tracks=[],cur=-1,shuffle=false,bag=[],hist=[];
function render(){
  $('list').innerHTML=tracks.map((t,i)=>`<li class="${i===cur?'on':''}" data-i="${i}">${t.name}</li>`).join('');
}
function load(i){
  cur=i;a.src=tracks[i].url;a.play();
  $('title').textContent=tracks[i].name;$('play').textContent='⏸';render();
}
function refill(){
  bag=tracks.map((_,i)=>i).filter(i=>i!==cur);
  for(let i=bag.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[bag[i],bag[j]]=[bag[j],bag[i]];}
}
function next(){
  if(!tracks.length)return;
  if(shuffle){
    if(!bag.length)refill();
    if(!bag.length)return load(0);
    if(cur>=0)hist.push(cur);
    load(bag.pop());
  }else load((cur+1)%tracks.length);
}
function prev(){
  if(!tracks.length)return;
  if(a.currentTime>3){a.currentTime=0;return;}
  if(shuffle){if(hist.length)load(hist.pop());}
  else load((cur-1+tracks.length)%tracks.length);
}
$('files').onchange=e=>{
  for(const f of e.target.files)tracks.push({name:f.name.replace(/\.[^.]+$/,''),url:URL.createObjectURL(f)});
  if(shuffle)refill();
  render();if(cur<0&&tracks.length)load(0);
};
$('list').onclick=e=>{const li=e.target.closest('li');if(li)load(+li.dataset.i);};
$('play').onclick=()=>{
  if(!tracks.length)return;
  if(a.paused){a.play();$('play').textContent='⏸';}else{a.pause();$('play').textContent='▶';}
};
$('next').onclick=next;$('prev').onclick=prev;
$('shuf').onclick=()=>{shuffle=!shuffle;hist=[];if(shuffle)refill();$('shuf').classList.toggle('act',shuffle);};
a.onended=next;
a.ontimeupdate=()=>{if(a.duration)$('seek').value=a.currentTime/a.duration*100;};
$('seek').oninput=e=>{if(a.duration)a.currentTime=e.target.value/100*a.duration;};
