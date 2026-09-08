const modal=document.getElementById('modal'),gameArea=document.getElementById('gameArea'),modalTitle=document.getElementById('modalTitle'),modalText=document.getElementById('modalText');
const openModal=()=>{modal.classList.add('open');modal.setAttribute('aria-hidden','false')};
const closeModal=()=>{modal.classList.remove('open');modal.setAttribute('aria-hidden','true');gameArea.innerHTML=''};
document.getElementById('closeModal').onclick=closeModal;
modal.addEventListener('click',e=>{if(e.target===modal)closeModal()});

document.querySelectorAll('[data-game]').forEach(card=>card.addEventListener('click',()=>launch(card.dataset.game)));
['heroPlay','quickPlay','ctaPlay'].forEach(id=>document.getElementById(id).addEventListener('click',()=>launch('typing')));
document.getElementById('reactionBtn').addEventListener('click',()=>launch('focus'));
document.getElementById('demoProgress').addEventListener('click',()=>document.querySelector('.skill-panel').scrollIntoView({behavior:'smooth',block:'center'}));

function launch(type){openModal();if(type==='typing')typing();if(type==='memory')memory();if(type==='math')math();if(type==='focus')focus()}

function typing(){
  modalTitle.textContent='Typing Rush';
  modalText.textContent='Pop the bubbles by typing their letters. Clear the board before they reach the top!';
  const letters='ASDFJKLQWERTYUIOPZXCVBNM';
  const bubbles=[];let score=0,misses=0,streak=0,started=performance.now(),running=true;
  gameArea.innerHTML=`<div class="typing-hud"><span>Score <b id="tScore">0</b></span><span>Streak <b id="tStreak">0</b> 🔥</span><span>Best <b id="tBest">0</b></span></div><div class="bubble-board" id="bubbleBoard"></div><div class="typing-input-row"><input class="type-input" id="typeInput" autocomplete="off" maxlength="1" placeholder="Type a letter…" aria-label="Type bubble letter"><button class="card-btn" id="restartTyping">Restart</button></div><div class="type-result" id="typeResult">Speed: 0 WPM • Accuracy: 100%</div>`;
  const board=document.getElementById('bubbleBoard'),input=document.getElementById('typeInput'),result=document.getElementById('typeResult');
  let best=Number(localStorage.getItem('popmastery-typing-best')||0);document.getElementById('tBest').textContent=best;
  function spawn(){if(!running)return;const b=document.createElement('button');b.className='type-bubble';b.textContent=letters[Math.floor(Math.random()*letters.length)];b.dataset.letter=b.textContent;b.style.left=(5+Math.random()*84)+'%';b.style.bottom='-55px';const duration=4200+Math.random()*2200;b.style.animationDuration=duration+'ms';board.appendChild(b);bubbles.push(b);setTimeout(()=>{if(!b.isConnected)return;b.remove();misses++;streak=0;update()},duration)}
  function update(){document.getElementById('tScore').textContent=score;document.getElementById('tStreak').textContent=streak;const elapsed=(performance.now()-started)/60000;const wpm=Math.round((score/5)/Math.max(elapsed,1/60));const accuracy=Math.max(0,Math.round((score/Math.max(1,score+misses))*100));result.textContent=`Speed: ${wpm} WPM • Accuracy: ${accuracy}%`}
  function hit(){const key=input.value.trim().toUpperCase();input.value='';if(!key)return;const match=bubbles.find(b=>b.isConnected&&b.dataset.letter===key);if(match){match.remove();score+=10+Math.min(streak,10)*2;streak++;if(score>best){best=score;localStorage.setItem('popmastery-typing-best',best);document.getElementById('tBest').textContent=best}update()}else{streak=0;update()}}
  input.addEventListener('input',hit);input.addEventListener('keydown',e=>{if(e.key==='Escape')closeModal()});
  document.getElementById('restartTyping').onclick=()=>{bubbles.splice(0).forEach(b=>b.remove());score=0;misses=0;streak=0;started=performance.now();running=true;update();input.focus()};
  const timer=setInterval(()=>{if(!document.body.contains(board)){clearInterval(timer);running=false}},500);const spawner=setInterval(spawn,650);for(let i=0;i<4;i++)setTimeout(spawn,i*260);input.focus();update();
}

function memory(){
  modalTitle.textContent='Memory Flip';modalText.textContent='Find the matching pairs. Take your time — accuracy first.';
  const symbols=['◆','◆','●','●','▲','▲','★','★'];symbols.sort(()=>Math.random()-.5);
  gameArea.innerHTML='<div class="memory-grid">'+symbols.map((s,i)=>`<button class="memory-card" data-i="${i}" data-s="${s}">${s}</button>`).join('')+'</div><div class="type-result" id="memResult">0 pairs found</div>';
  let open=[],pairs=0,locked=false;const cards=[...gameArea.querySelectorAll('.memory-card')];cards.forEach(c=>c.onclick=()=>{if(locked||c.classList.contains('flipped'))return;c.classList.add('flipped');open.push(c);if(open.length===2){locked=true;if(open[0].dataset.s===open[1].dataset.s){pairs++;open=[];locked=false;document.getElementById('memResult').textContent=`${pairs}/4 pairs found`;if(pairs===4)document.getElementById('memResult').textContent='Perfect! Memory master 🧠'}else setTimeout(()=>{open.forEach(x=>x.classList.remove('flipped'));open=[];locked=false},550)}})
}

function math(){modalTitle.textContent='Math Sprint';modalText.textContent='Choose the correct answer. New question every round.';newMath()}
function newMath(){const a=Math.floor(Math.random()*20)+5,b=Math.floor(Math.random()*15)+2,ans=a+b;const options=[ans,ans+2,ans-3,ans+5].sort(()=>Math.random()-.5);gameArea.innerHTML=`<div class="math-q">${a} + ${b} = ?</div><div class="choices">${options.map(x=>`<button class="choice" data-a="${x}">${x}</button>`).join('')}</div><div class="type-result" id="mathResult">Get it right to continue.</div>`;gameArea.querySelectorAll('.choice').forEach(x=>x.onclick=()=>{const r=document.getElementById('mathResult');if(+x.dataset.a===ans){r.textContent='Correct! ⚡';setTimeout(newMath,450)}else r.textContent='Not quite — try again.'})}

function focus(){modalTitle.textContent='Focus Hunt';modalText.textContent='Click the target as soon as it appears. Beat your reaction time.';gameArea.innerHTML='<div class="focus-board" id="focusBoard"></div><div class="focus-score" id="focusScore">Get ready…</div>';const board=document.getElementById('focusBoard'),score=document.getElementById('focusScore');let start;function spawn(){board.innerHTML='<button class="focus-dot" aria-label="target"></button>';const dot=board.firstChild;dot.style.left=(Math.random()*84+6)+'%';dot.style.top=(Math.random()*78+8)+'%';start=performance.now();dot.onclick=()=>{const ms=Math.round(performance.now()-start);score.textContent=`${ms} ms — ${ms<300?'Lightning fast! 🔥':'Nice! Try to beat it.'}`;setTimeout(spawn,650)}}setTimeout(spawn,700)}
