import { useState } from 'react'
import { supabase, isSupabaseConfigured } from './lib/supabase'
import { ArrowRight, ShieldCheck, Code2, Gamepad2, Database, LockKeyhole, Search, CheckCircle2, Menu, X, FileCode2, Handshake, BadgeCheck, Send, Github, Globe2, Layers3 } from 'lucide-react'

const initialForm = { full_name:'', email:'', organisation:'', country:'Malawi', asset_type:'Private software repository', technologies:'', repository_url:'', repository_size:'', message:'', rights_confirmed:false, website:'' }

export default function App() {
  const [leadType, setLeadType] = useState('buyer_interest')
  const [form, setForm] = useState(initialForm)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [mobileOpen, setMobileOpen] = useState(false)
  const [sent, setSent] = useState(false)
  const update = (key,value) => setForm(old=>({...old,[key]:value}))
  const choose = type => { setLeadType(type); setSent(false); document.getElementById('contact')?.scrollIntoView({behavior:'smooth'}) }
  const submit = async e => {
    e.preventDefault()
    if (form.website) return
    if (!isSupabaseConfigured) { setNotice('Enquiry submission is temporarily unavailable. Please email info.kelnix@gmail.com.'); return }
    if (leadType === 'seller_application' && !form.rights_confirmed) { setNotice('Please confirm that you have the rights to offer this repository or asset.'); return }
    setBusy(true); setNotice('')
    try {
      const {data:{user}} = await supabase.auth.getUser()
      const payload = {
        lead_type:leadType, full_name:form.full_name.trim(), email:form.email.trim(),
        organisation:form.organisation.trim() || null, country:form.country.trim() || 'Not specified',
        asset_type:form.asset_type, technologies:form.technologies.trim() || null,
        repository_url:form.repository_url.trim() || null, repository_size:form.repository_size || null,
        message:form.message.trim(), rights_confirmed:leadType === 'seller_application' ? form.rights_confirmed : false,
        user_id:user?.id || null
      }
      const {error} = await supabase.from('marketplace_leads').insert(payload)
      if (error) throw error
      setSent(true); setForm(initialForm)
    } catch (err) { setNotice(err.message || 'We could not submit your enquiry. Please try again.') }
    finally { setBusy(false) }
  }

  return <div className="site-shell">
    <div className="announcement"><span className="status-dot"/> <span>PRE-LAUNCH PREVIEW</span><i/> Building a trusted marketplace for software assets and technical data</div>
    <header className="site-header">
      <a className="brand" href="#top" aria-label="KELNIX home"><span className="brand-symbol">K</span><span>KELNIX<small>CODE & DATA EXCHANGE</small></span></a>
      <button className="mobile-menu" onClick={()=>setMobileOpen(v=>!v)} aria-label="Toggle navigation">{mobileOpen?<X/>:<Menu/>}</button>
      <nav className={mobileOpen?'nav nav-open':'nav'}><a href="#marketplace" onClick={()=>setMobileOpen(false)}>Marketplace</a><a href="#standards" onClick={()=>setMobileOpen(false)}>Trust & verification</a><a href="#process" onClick={()=>setMobileOpen(false)}>How it works</a></nav>
      <a className="header-cta" href="#contact">Talk to KELNIX <ArrowRight size={15}/></a>
    </header>

    <main id="top">
      <section className="hero">
        <div className="hero-copy">
          <div className="eyebrow"><span/> PRIVATE CODE. VERIFIED RIGHTS. CLEAR LICENSING.</div>
          <h1>Where valuable<br/><em>software assets</em><br/>find their next use.</h1>
          <p className="hero-lead">A curated exchange connecting organisations seeking private software repositories, game-development projects and technical datasets with the people who have the rights to license them.</p>
          <div className="hero-actions"><a className="btn-primary" href="#marketplace">Explore the exchange <ArrowRight size={17}/></a><button className="btn-secondary" onClick={()=>choose('seller_application')}>Offer an asset <ArrowRight size={16}/></button></div>
          <div className="hero-assurance"><ShieldCheck size={17}/> Enquiries first. Every asset reviewed before any transaction.</div>
        </div>
        <div className="hero-art" aria-label="Abstract software repository visual">
          <div className="orb orb-one"/><div className="orb orb-two"/>
          <div className="code-window"><div className="window-top"><div><b/><b/><b/></div><span>repository / overview</span><span className="window-private"><LockKeyhole size={12}/> PRIVATE</span></div>
            <div className="code-body"><div className="file-tree"><span><Layers3 size={14}/> project-root</span><span className="indent">▸ src</span><span className="indent">▸ assets</span><span className="indent">▸ tests</span><span className="indent">▸ docs</span><span><FileCode2 size={14}/> README.md</span></div>
              <div className="code-lines"><span className="code-muted">01</span><span className="code-purple">export</span> <span className="code-blue">const</span> project = {'{'}</div><div className="code-lines"><span className="code-muted">02</span> &nbsp; <span className="code-green">type</span>: <span className="code-yellow">'game-development'</span>,</div><div className="code-lines"><span className="code-muted">03</span> &nbsp; <span className="code-green">access</span>: <span className="code-yellow">'private'</span>,</div><div className="code-lines"><span className="code-muted">04</span> &nbsp; <span className="code-green">licensing</span>: <span className="code-yellow">'review-first'</span>,</div><div className="code-lines"><span className="code-muted">05</span> {'}'}</div>
              <div className="repo-metrics"><div><b>01</b><small>Rights review</small></div><div><b>02</b><small>Technical review</small></div><div><b>03</b><small>Licence terms</small></div></div>
            </div>
          </div>
          <div className="floating-proof"><span><ShieldCheck size={17}/></span><div><b>Review before release</b><small>Private by default</small></div></div>
          <div className="hero-caption">A more responsible way to source software assets.</div>
        </div>
      </section>

      <section className="trust-strip"><div><LockKeyhole/><span><b>Private by design</b><small>No public repository uploads</small></span></div><div><BadgeCheck/><span><b>Rights-led review</b><small>Ownership and licence checks</small></span></div><div><Handshake/><span><b>Human-led matching</b><small>Enquiries reviewed by our team</small></span></div><div><Globe2/><span><b>Built for global exchange</b><small>Buyers and sellers across markets</small></span></div></section>

      <section className="section marketplace" id="marketplace">
        <div className="section-intro"><div className="eyebrow">THE EXCHANGE</div><h2>Technical assets.<br/><em>Real-world value.</em></h2><p>We are building a structured route for organisations to discover, evaluate and license software assets and technical data — with clear permission and review at every stage.</p></div>
        <div className="asset-grid">
          <article className="asset-card"><div className="asset-icon"><Code2/></div><span className="asset-kicker">01 / SOFTWARE</span><h3>Private code repositories</h3><p>Established software projects with meaningful development history, documentation, tests and clear licensing rights.</p><div className="asset-tags"><span>Source code</span><span>Commit history</span><span>Engineering projects</span></div></article>
          <article className="asset-card"><div className="asset-icon"><Gamepad2/></div><span className="asset-kicker">02 / GAME DEVELOPMENT</span><h3>Game projects & assets</h3><p>Unity, Unreal Engine and other game-development repositories, tools, systems and associated assets.</p><div className="asset-tags"><span>Unity</span><span>Unreal Engine</span><span>Game systems</span></div></article>
          <article className="asset-card"><div className="asset-icon"><Database/></div><span className="asset-kicker">03 / TECHNICAL DATA</span><h3>Technical datasets</h3><p>Lawfully sourced, documented technical datasets and supporting materials suitable for approved research and development uses.</p><div className="asset-tags"><span>Documentation</span><span>Provenance</span><span>Usage rights</span></div></article>
        </div>
        <div className="catalogue-note"><span className="note-icon"><Search size={17}/></span><div><b>Curated catalogue is being prepared</b><p>There are no public listings or sample assets at this stage. We will publish opportunities only after the owner, rights and listing details have been reviewed.</p></div><span className="preview-pill">PRE-LAUNCH</span></div>
      </section>

      <section className="standards-section" id="standards"><div className="standards-inner"><div className="section-intro"><div className="eyebrow">TRUST IS THE PRODUCT</div><h2>Access should be<br/><em>earned, not assumed.</em></h2><p>Private repositories can contain confidential code, contributor work and third-party dependencies. KELNIX will not treat a link or seller statement alone as proof of transferable rights.</p></div>
        <div className="standard-list"><div><span>01</span><section><b>Ownership & authority</b><p>Confirm who controls the repository and whether they can grant the proposed licence.</p></section></div><div><span>02</span><section><b>Technical & provenance review</b><p>Assess project history, authorship signals, dependencies, documentation and buyer requirements.</p></section></div><div><span>03</span><section><b>Licence scope in writing</b><p>Agree permitted use, exclusivity, transfer limits, warranties and restrictions before any handover.</p></section></div><div><span>04</span><section><b>Controlled delivery</b><p>Release approved materials only after the relevant agreement and verified payment conditions are satisfied.</p></section></div></div>
      </div></section>

      <section className="section process-section" id="process"><div className="center-heading"><div className="eyebrow">A CONTROLLED PROCESS</div><h2>From first enquiry<br/><em>to responsible licensing.</em></h2></div><div className="process-grid"><article><span>01</span><h3>Tell us what you need</h3><p>Buyers describe the technology, project profile, intended use and requirements.</p></article><article><span>02</span><h3>Submit for review</h3><p>Sellers provide a high-level description and evidence of their authority to license.</p></article><article><span>03</span><h3>Review & match</h3><p>KELNIX assesses fit, provenance and rights before arranging controlled discussions.</p></article><article><span>04</span><h3>Agree & transact</h3><p>Licence, payment, settlement and secure delivery follow only once operational checks are complete.</p></article></div></section>

      <section className="cta-band"><div><div className="eyebrow">BE PART OF THE EXCHANGE</div><h2>Looking to source or license<br/><em>something valuable?</em></h2><p>Start with a confidential, no-obligation enquiry. Do not send private source code or credentials through this form.</p></div><div className="cta-buttons"><button className="btn-light" onClick={()=>choose('buyer_interest')}>I am looking to acquire <ArrowRight size={16}/></button><button className="btn-outline-light" onClick={()=>choose('seller_application')}>I have an asset to offer <ArrowRight size={16}/></button></div></section>

      <section className="section contact-section" id="contact"><div className="contact-copy"><div className="eyebrow">START A CONVERSATION</div><h2>Let’s understand<br/><em>what you’re looking for.</em></h2><p>Share a high-level description. Our team will review your enquiry and follow up using the contact details you provide.</p><div className="contact-email"><Send size={16}/> info.kelnix@gmail.com</div><div className="privacy-reminder"><LockKeyhole size={17}/><span><b>Keep confidential materials private.</b><small>Do not paste source code, access tokens, passwords or private download links into this form.</small></span></div></div>
        <div className="form-panel"><div className="form-tabs"><button className={leadType==='buyer_interest'?'selected':''} onClick={()=>{setLeadType('buyer_interest');setSent(false)}}>I’m a buyer</button><button className={leadType==='seller_application'?'selected':''} onClick={()=>{setLeadType('seller_application');setSent(false)}}>I’m a seller</button></div>
          {sent ? <div className="success-state"><span><CheckCircle2 size={28}/></span><h3>Enquiry received.</h3><p>Thank you for contacting KELNIX. Your details have been securely submitted for review. We will follow up by email.</p><button onClick={()=>setSent(false)}>Submit another enquiry</button></div> :
          <form onSubmit={submit}>
            <div className="form-heading"><h3>{leadType==='buyer_interest'?'Tell us what you need':'Tell us about your asset'}</h3><p>{leadType==='buyer_interest'?'Help us understand the repository or dataset you are looking to license.':'Start with a high-level description. Do not share private code or credentials.'}</p></div>
            <div className="field-row"><label>Full name<input required minLength="2" maxLength="120" value={form.full_name} onChange={e=>update('full_name',e.target.value)} placeholder="Your name"/></label><label>Work email<input type="email" required maxLength="254" value={form.email} onChange={e=>update('email',e.target.value)} placeholder="you@company.com"/></label></div>
            <div className="field-row"><label>Organisation <small>Optional</small><input maxLength="160" value={form.organisation} onChange={e=>update('organisation',e.target.value)} placeholder="Company or studio"/></label><label>Country<input maxLength="100" value={form.country} onChange={e=>update('country',e.target.value)} placeholder="Country"/></label></div>
            <label>Asset category<select value={form.asset_type} onChange={e=>update('asset_type',e.target.value)}><option>Private software repository</option><option>Unity game project</option><option>Unreal Engine project</option><option>Other game-development assets</option><option>Technical dataset</option><option>Developer tools or libraries</option><option>Other technical asset</option></select></label>
            <label>Technologies / requirements <small>Optional</small><input maxLength="500" value={form.technologies} onChange={e=>update('technologies',e.target.value)} placeholder="e.g. C#, Unity, Unreal Engine, Python"/></label>
            {leadType==='seller_application' && <><label>Repository or portfolio link <small>Optional — public profile only</small><input type="url" maxLength="500" value={form.repository_url} onChange={e=>update('repository_url',e.target.value)} placeholder="https://github.com/your-profile"/></label><label>Project scale <select value={form.repository_size} onChange={e=>update('repository_size',e.target.value)}><option value="">Select if known</option><option>Under 100 commits</option><option>100–499 commits</option><option>500–999 commits</option><option>1,000+ commits</option><option>Not sure</option></select></label><label className="rights-check"><input type="checkbox" checked={form.rights_confirmed} onChange={e=>update('rights_confirmed',e.target.checked)}/><span>I confirm that I own or am authorised to represent this asset and have the right to discuss licensing it. I understand this is an initial enquiry, not acceptance or verification by KELNIX.</span></label></>}
            <label>{leadType==='buyer_interest'?'What are your requirements?':'Project overview'}<textarea required minLength="10" maxLength="5000" rows="4" value={form.message} onChange={e=>update('message',e.target.value)} placeholder={leadType==='buyer_interest'?'Describe the type of project, intended use, timeline and key requirements…':'Describe the project, development history, your role and the rights you believe you can license…'}/></label>
            <div className="honeypot" aria-hidden="true"><label>Leave this field empty<input tabIndex="-1" autoComplete="off" value={form.website} onChange={e=>update('website',e.target.value)}/></label></div>
            {notice&&<div className="form-error" role="alert">{notice}</div>}
            <button className="submit-button" type="submit" disabled={busy}>{busy?'Submitting securely…':'Send confidential enquiry'} <ArrowRight size={16}/></button>
            <p className="form-footnote"><LockKeyhole size={13}/> Your enquiry is private to KELNIX. Do not submit confidential source files or credentials.</p>
          </form>}
        </div>
      </section>
    </main>
    <footer className="footer"><div className="brand footer-brand"><span className="brand-symbol">K</span><span>KELNIX<small>CODE & DATA EXCHANGE</small></span></div><p>Connecting valuable software assets with responsible licensing opportunities.</p><div className="footer-links"><a href="#standards">Trust standards</a><a href="#process">How it works</a><a href="mailto:info.kelnix@gmail.com">Contact</a></div><small>© {new Date().getFullYear()} KELNIX. All rights reserved. <span>Preview phase — transactions are not yet enabled.</span></small></footer>
  </div>
}
