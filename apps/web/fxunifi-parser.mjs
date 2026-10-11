// Parse the observed server-rendered pages without executing remote scripts.
export function decodeHtml(value) {
  return String(value ?? '').replace(/&(#x[\da-f]+|#\d+|amp|quot|apos|lt|gt|nbsp);/gi, (all,key) => {
    const named={ amp:'&', quot:'"', apos:"'", lt:'<', gt:'>', nbsp:' ' };
    if (key[0] !== '#') return named[key.toLowerCase()] ?? all;
    const point=key[1].toLowerCase()==='x'?parseInt(key.slice(2),16):parseInt(key.slice(1),10);
    return point>0 && point<=0x10ffff ? String.fromCodePoint(point) : '';
  });
}
export const cleanText = value => decodeHtml(String(value ?? '').replace(/<[^>]*>/g,' ')).replace(/\s+/g,' ').trim();
export function parseHtml(html) {
  const root={ tag:'#document', attrs:{}, children:[], parent:null };
  const stack=[root];
  const source=html.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,'');
  const voidTags=new Set(['area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr']);
  for (const match of source.matchAll(/<!--[\s\S]*?-->|<![^>]*>|<\/?[a-z][^>]*>|[^<]+/gi)) {
    const token=match[0];
    if (token.startsWith('<!')) continue;
    if (token.startsWith('</')) {
      const tag=token.match(/^<\/([\w-]+)/)?.[1].toLowerCase();
      const index=stack.findLastIndex(node=>node.tag===tag); if(index>0) stack.length=index;
    } else if (token.startsWith('<')) {
      const tag=token.match(/^<([\w-]+)/)?.[1].toLowerCase(); if(!tag) continue;
      const attrs={};
      for (const attribute of token.slice(tag.length+1).matchAll(/([\w:-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)) attrs[attribute[1].toLowerCase()]=decodeHtml(attribute[2]??attribute[3]??attribute[4]??'');
      const parent=stack.at(-1); const node={ tag, attrs, children:[], parent }; parent.children.push(node);
      if(!voidTags.has(tag) && !/\/\s*>$/.test(token)) stack.push(node);
    } else stack.at(-1).children.push(decodeHtml(token));
  }
  return root;
}
export function nodes(root, predicate) {
  const result=[];
  const visit=node=>{ if(typeof node==='string')return; if(predicate(node))result.push(node); for(const child of node.children)visit(child); };
  visit(root); return result;
}
export const textOf = node => typeof node==='string'?node:node.children.map(textOf).join(' ').replace(/\s+/g,' ').trim();
const hasClass=(node,name)=>node.attrs.class?.split(/\s+/).includes(name);
const number=value=>{ const text=cleanText(value).replace(/[$,\s]/g,''); return /^-?\d+(?:\.\d+)?$/.test(text)?Number(text):null; };
const exact=(doc,label)=>nodes(doc,node=>['span','p','h4','h6'].includes(node.tag) && textOf(node)===label)[0];
function labeled(doc,label,tag) {
  const node=exact(doc,label); if(!node)return null;
  return nodes(node.parent,n=>n.tag===tag).map(textOf)[0] ?? null;
}
export function parseDashboard(html, expectedUsername) {
  const doc=parseHtml(html);
  const input=name=>nodes(doc,node=>node.tag==='input' && node.attrs.name===name)[0]?.attrs.value || '';
  const referralLinks={ left:input('leftlink'), right:input('rightlink') };
  const usernames=nodes(doc,node=>hasClass(node,'info-content')).flatMap(node=>nodes(node,n=>n.tag==='span')).map(textOf);
  if(!usernames.includes(expectedUsername)) throw new Error('Authenticated FXUNIFI profile does not match the configured username.');
  const welcome=nodes(doc,node=>node.tag==='h6' && /welcome back/i.test(textOf(node)))[0];
  const profile={ username:expectedUsername, fullName:welcome?nodes(welcome.parent,node=>node.tag==='p').map(textOf)[0]||'':'', rank:labeled(doc,'Rank','h7') };
  for(const [key,label] of [['memberSince','Member Since'],['activeSince','Active Since'],['sponsorUsername','Sponsor'],['level','Level Opened']]) profile[key]=labeled(doc,label,'h6');
  profile.level=number(profile.level);
  const contact=className=>nodes(doc,node=>node.tag==='i' && hasClass(node,className))[0]?.parent.parent;
  profile.email=contact('ri-mail-line')?textOf(contact('ri-mail-line')):'';
  profile.phone=contact('ri-phone-line')?textOf(contact('ri-phone-line')):'';
  profile.location=contact('ri-map-pin-line')?textOf(contact('ri-map-pin-line')):'';
  const wallet={ capital:number(labeled(doc,'My Capital','h3')), totalInvested:number(labeled(doc,'Total Invested','h6')), totalProfit:number(labeled(doc,'Total Profit','h3')), totalEarned:number(labeled(doc,'Total Earned','h6')), availableBalance:number(labeled(doc,'Earning Balance','h5')), totalWithdrawn:null };
  const profitLabel=exact(doc,'Total Profit');
  let profitCard=profitLabel; while(profitCard && !hasClass(profitCard,'card'))profitCard=profitCard.parent;
  if(profitCard) wallet.totalWithdrawn=number(labeled(profitCard,'Withdrawn','h6'));
  if(Object.values(wallet).some(value=>value===null)) throw new Error('FXUNIFI wallet layout changed. No balances were replaced.');
  const metric=label=>labeled(doc,label,'h4');
  const count=label=>{const match=metric(label)?.match(/^(\d+)(?:.*out of (\d+))?/);return match?{ active:Number(match[1]),total:Number(match[2]??match[1])}:null;};
  const referrals=count('Total Referrals'),team=count('Total Team');
  const providerMetrics={};
  for(const [key,label] of [['matchingBonus','Matching Bonus'],['profitShare','Profit Share'],['teamLevel','Team Level'],['referralBonus','Referral Bonus'],['rewardsBonus','Rewards Bonus']]) providerMetrics[key]=number(labeled(doc,label,'h5'));
  return { profile,wallet,referralLinks,stats:{ totalReferrals:referrals?.total??null, activeReferrals:referrals?.active??null, totalTeam:team?.total??null, activeTeam:team?.active??null },providerMetrics };
}
export function parseProfile(html) {
  const doc=parseHtml(html); const input=name=>nodes(doc,node=>node.tag==='input' && node.attrs.name===name)[0]?.attrs.value||'';
  const country=nodes(doc,node=>node.tag==='select'&&node.attrs.name==='country')[0];
  const selected=country?nodes(country,node=>node.tag==='option'&&'selected' in node.attrs)[0]:null;
  return { fullName:input('name'),phone:input('mobile'),email:input('email'),location:[input('city'),selected?textOf(selected):''].filter(Boolean).join(', ') };
}
export function parseMembers(rows,side,owner) {
  if(!Array.isArray(rows))throw new Error('FXUNIFI team response changed.');
  return rows.map(row=>{
    if(!row.user_id || !row.id)throw new Error('FXUNIFI team member is missing an identity.');
    return { id:String(row.id),externalMemberId:String(row.id),username:cleanText(row.user_id),name:cleanText(row.user_name),side,
      parentUsername:cleanText(row.uplineid),sponsorUsername:cleanText(row.sponsorid),status:Number(row.user_plan)>0?'ACTIVE':'INACTIVE',
      pv:number(row.user_bv),level:null,memberSince:row.user_regdate,location:cleanText(row.user_city) };
  });
}
export function buildTree(members,profile,sourceHtml='') {
  const root={ id:'local-fxunifi',username:profile.username,name:profile.fullName||profile.username,status:'ACTIVE',side:'root',pv:0,children:[] };
  const lookup=new Map(members.map(member=>[member.username,{ ...member,children:[] }]));
  const displayed = sourceHtml ? nodes(parseHtml(sourceHtml),node=>node.tag==='img'&&node.attrs.alt&&node.parent.attrs['data-url']?.startsWith('members/stats/')).map(node=>node.attrs.alt.trim()) : [];
  const order = new Map(displayed.map((username,index)=>[username,index]));
  let detached=0;
  for(const node of lookup.values()) {
    const parent=node.parentUsername===root.username?root:lookup.get(node.parentUsername);
    if(!parent || parent===node || (parent!==root && parent.side!==node.side)) {detached++;continue;}
    let ancestor=parent;const seen=new Set([node.username]);let cycle=false;
    while(ancestor!==root && ancestor){if(seen.has(ancestor.username)){cycle=true;break;}seen.add(ancestor.username);ancestor=ancestor.parentUsername===root.username?root:lookup.get(ancestor.parentUsername);}
    if(cycle){detached++;continue;}
    parent.children.push(node);
  }
  const visit=(node,depth)=>{node.level=depth;node.children.sort((a,b)=>(order.get(a.username)??Infinity)-(order.get(b.username)??Infinity));for(const child of node.children)visit(child,depth+1);}; visit(root,0);
  const count=node=>1+node.children.reduce((sum,child)=>sum+count(child),0);
  return { root,stats:{ totalMembers:members.length,activeMembers:members.filter(member=>member.status==='ACTIVE').length },truncated:count(root)-1<members.length,detached };
}
export function parseStatement(rows,ownerId) {
  if(!Array.isArray(rows))throw new Error('FXUNIFI statement response changed.');
  return rows.flatMap((row,index)=>{
    const debit=String(row.p_from)===String(ownerId),credit=String(row.m_id)===String(ownerId);
    const description=cleanText(row.reference);
    const creditType=/referral|matching|level|binary/i.test(description)?'COMMISSION':/reward/i.test(description)?'BONUS':/profit|earning|sharing/i.test(description)?'EARNINGS':'CREDIT';
    const base={ status:String(row.p_status)==='1'?'COMPLETED':'PENDING',currency:'USD',reference:description,description,createdAt:row.p_date,source:'FXUNIFI account statement' };
    const result=[];
    if(debit){const amount=number(row.p_amount);if(amount===null)throw new Error('Invalid FXUNIFI debit amount.');result.push({...base,id:`statement-${index}-debit`,type:/withdraw/i.test(description)?'WITHDRAWAL':'DEBIT',amount});}
    if(credit){const amount=number(row.p_amt);if(amount===null)throw new Error('Invalid FXUNIFI credit amount.');result.push({...base,id:`statement-${index}-credit`,type:creditType,amount});}
    return result;
  });
}

export function parsePayments(rows) {
  if(!Array.isArray(rows))throw new Error('FXUNIFI withdrawal response changed.');
  return rows.map(row=>({ id:String(row.p_id),amount:number(row.p_amount),createdAt:row.p_date,status:String(row.p_status)==='1'?'COMPLETED':'PENDING',reference:cleanText(row.p_txnid),currency:'USD' }));
}
export function parseFunds(html) {
  const doc=parseHtml(html); const table=nodes(doc,node=>node.tag==='table'&&nodes(node,n=>n.tag==='th'&&textOf(n)==='Contract No.').length)[0];
  if(!table)throw new Error('FXUNIFI deposit history layout changed.');
  return nodes(table,node=>node.tag==='tr').flatMap(row=>{
    const cells=row.children.filter(node=>typeof node!=='string'&&node.tag==='td').map(textOf);
    if(cells.length!==6)return [];
    return [{ id:cells[1],reference:cells[1],createdAt:cells[2],description:cells[3],amount:number(cells[4]),status:cells[5],currency:'USD' }];
  });
}
