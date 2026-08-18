const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
let applications = [];
const formatMoney = number => `${Number(number).toLocaleString('ar-IQ')} د.ع`;
const escapeHtml = text => String(text ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
function toast(message){const el=$('#toast');el.textContent=message;el.classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.classList.remove('show'),2600)}

async function checkOwner(){
  const auth=await (await fetch('/api/auth/me')).json();
  const isOwner=auth.authenticated && auth.user.role==='admin';
  $('#ownerLogin').hidden=isOwner; $('#ownerShell').hidden=!isOwner;
  if(isOwner){$('#ownerName').textContent=auth.user.name;loadAll()}
}
$('#ownerLoginForm').addEventListener('submit',async event=>{
  event.preventDefault();const form=event.currentTarget,button=form.querySelector('button');button.disabled=true;
  try{const response=await fetch('/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(Object.fromEntries(new FormData(form)))});const result=await response.json();if(!response.ok)throw new Error(result.error);if(result.user.role!=='admin'){await fetch('/api/auth/logout',{method:'POST'});throw new Error('هذا الحساب ليس حساب إدارة');}await checkOwner()}catch(error){toast(error.message)}finally{button.disabled=false}
});
$('#ownerLogout').addEventListener('click',async()=>{await fetch('/api/auth/logout',{method:'POST'});location.reload()});

const viewLabels={overview:['نظرة عامة','أهلاً بك 👋'],applications:['طلبات السائقين','تدقيق السائقين'],rides:['جميع الرحلات','سجل الرحلات']};
function switchView(name){
  $$('.owner-sidebar nav button').forEach(b=>b.classList.toggle('active',b.dataset.ownerView===name));
  $$('.owner-view').forEach(v=>v.classList.remove('active'));$(`#${name}OwnerView`).classList.add('active');
  $('#pageCrumb').textContent=viewLabels[name][0];$('#pageTitle').textContent=viewLabels[name][1];
  if(name==='applications')renderApplications();if(name==='rides')loadRides();
}
$$('[data-owner-view]').forEach(button=>button.addEventListener('click',()=>switchView(button.dataset.ownerView)));
$$('[data-go]').forEach(button=>button.addEventListener('click',()=>switchView(button.dataset.go)));

async function loadAll(){await Promise.all([loadStats(),loadApplications(),loadRides()])}
const shortMoney=number=>{const value=Number(number);if(value>=1000000)return`${(value/1000000).toFixed(1)} م`;if(value>=1000)return`${Math.round(value/1000)} ألف`;return`${value}`};
async function loadStats(){
  const response=await fetch('/api/stats');if(response.status===401||response.status===403)return location.reload();
  const stats=await response.json();$('#ownerStatTotal').textContent=stats.total_rides||0;$('#ownerStatCompleted').textContent=stats.completed||0;$('#ownerStatActive').textContent=stats.active||0;$('#ownerStatDrivers').textContent=stats.online_drivers||0;$('#ownerStatRevenue').textContent=formatMoney(stats.revenue||0);$('#ownerStatCustomers').textContent=stats.total_customers||0;
  const maxRides=Math.max(1,...(stats.weekly||[]).map(day=>day.rides||0));
  $('#ownerWeeklyChart').innerHTML=(stats.weekly||[]).map(day=>{const height=Math.max(4,Math.round(((day.rides||0)/maxRides)*100));const label=new Intl.DateTimeFormat('ar-IQ',{weekday:'short'}).format(new Date(day.date+'T12:00:00'));return`<div class="chart-bar"><small>${shortMoney(day.revenue)}</small><i style="height:${height}%" title="${day.rides} رحلة · ${formatMoney(day.revenue)}"></i><b>${label}</b></div>`}).join('');
  $('#ownerTopDrivers').innerHTML=(stats.top_drivers||[]).length?stats.top_drivers.map((driver,index)=>`<div class="top-driver"><span class="rank rank-${index+1}">${index+1}</span><div><b>${escapeHtml(driver.name)}</b><small>${driver.completed_rides||0} رحلة · ${escapeHtml(driver.car||'')}</small></div><span class="top-driver-rating">★ ${Number(driver.rating||5).toFixed(1)}</span></div>`).join(''):'<div class="empty-state"><span>🏁</span><b>ماكو رحلات بعد</b></div>';
}
async function loadApplications(){
  const response=await fetch('/api/admin/driver-applications');applications=await response.json();
  const pending=applications.filter(item=>item.status==='pending');$('#pendingBadge').textContent=pending.length;
  $('#pendingPreview').innerHTML=pending.length?pending.slice(0,4).map(item=>`<div class="preview-driver"><span>${escapeHtml(item.name.charAt(0))}</span><div><b>${escapeHtml(item.name)}</b><small>${escapeHtml(item.vehicle_name)} · ${escapeHtml(item.governorate)}</small></div><b>بانتظار التدقيق</b></div>`).join(''):'<div class="empty-state"><span>✓</span><b>ماكو طلبات معلقة</b></div>';
  renderApplications();
}
const statuses={pending:['قيد التدقيق','pending'],approved:['مقبول','completed'],rejected:['مرفوض','cancelled']};
function renderApplications(){
  const filter=$('#applicationFilter').value;const list=filter==='all'?applications:applications.filter(a=>a.status===filter);
  $('#applicationsGrid').innerHTML=list.length?list.map(item=>`<article class="application-card">
    <div class="application-head"><span class="application-avatar">${escapeHtml(item.name.charAt(0))}</span><div><b>${escapeHtml(item.name)}</b><small>${escapeHtml(item.phone)} · ${new Date(item.created_at).toLocaleDateString('ar-IQ')}</small></div><span class="status-badge status-${statuses[item.status][1]} application-status">${statuses[item.status][0]}</span></div>
    <div class="vehicle-details"><span>المحافظة<b>${escapeHtml(item.governorate)}</b></span><span>إجازة السوق<b>${escapeHtml(item.license_number)}</b></span><span>السيارة واللون<b>${escapeHtml(item.vehicle_name)} · ${escapeHtml(item.vehicle_color)}</b></span><span>رقم السيارة<b>${escapeHtml(item.vehicle_number)}</b></span></div>
    <div class="documents"><button class="document-button" onclick="openDocument('${item.id_card_url}')">🪪 الهوية</button><button class="document-button" onclick="openDocument('${item.license_url}')">📄 الإجازة</button><button class="document-button" onclick="openDocument('${item.vehicle_doc_url}')">🚘 السنوية</button><button class="document-button" onclick="openDocument('${item.selfie_url}')">🤳 الصورة الحية</button></div>
    ${item.status==='pending'?`<textarea class="review-note" id="note-${item.id}" placeholder="ملاحظة للسائق عند الرفض (اختياري)"></textarea><div class="review-actions"><button class="approve-button" onclick="reviewDriver(${item.id},'approved')">✓ قبول السائق</button><button class="reject-button" onclick="reviewDriver(${item.id},'rejected')">رفض الطلب</button></div>`:`${item.review_notes?`<p class="review-note">ملاحظة الإدارة: ${escapeHtml(item.review_notes)}</p>`:''}`}
  </article>`).join(''):'<div class="empty-state"><span>♙</span><b>لا توجد طلبات بهذه الحالة</b></div>';
}
$('#applicationFilter').addEventListener('change',renderApplications);
window.reviewDriver=async(id,status)=>{
  if(!confirm(status==='approved'?'متأكد من مطابقة المستمسكات وقبول السائق؟':'متأكد من رفض الطلب؟'))return;
  const note=$(`#note-${id}`)?.value||'';const response=await fetch(`/api/admin/driver-applications/${id}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({status,review_notes:note})});const result=await response.json();if(!response.ok)return toast(result.error);toast(result.message);await Promise.all([loadApplications(),loadStats()]);
};
window.openDocument=url=>{const modal=$('#documentModal'),image=$('#documentImage'),pdf=$('#documentPdf');if(url.toLowerCase().includes('format=pdf')){pdf.src=url;pdf.style.display='block';image.style.display='none'}else{image.src=url;image.style.display='block';pdf.style.display='none'}modal.hidden=false};
$('#closeDocument').addEventListener('click',()=>{$('#documentModal').hidden=true;$('#documentImage').src='';$('#documentPdf').src=''});

async function loadRides(){
  const response=await fetch('/api/rides');if(!response.ok)return;const rides=await response.json();
  $('#ownerRidesTable').innerHTML=rides.length?rides.map(ride=>`<tr><td><b>#${ride.id}</b><small>${new Date(ride.created_at).toLocaleString('ar-IQ')}</small></td><td>${escapeHtml(ride.rider_name)}<small>${escapeHtml(ride.phone)}</small></td><td>${escapeHtml(ride.pickup_name)}<small>إلى ${escapeHtml(ride.dropoff_name)}</small></td><td>${escapeHtml(ride.driver_name||'غير محدد')}</td><td><b>${formatMoney(ride.price)}</b></td><td><span class="status-badge status-${ride.status}">${ride.status_label}</span></td></tr>`).join(''):'<tr><td colspan="6"><div class="empty-state">لا توجد رحلات</div></td></tr>';
}
$('#ownerRefresh').addEventListener('click',()=>Promise.all([loadRides(),loadStats()]));
$('#ownerDate').textContent=new Intl.DateTimeFormat('ar-IQ',{weekday:'long',day:'numeric',month:'long',year:'numeric'}).format(new Date());
checkOwner();
