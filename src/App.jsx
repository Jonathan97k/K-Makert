import { useEffect, useMemo, useState } from 'react'
import { supabase, isSupabaseConfigured } from './lib/supabase'
import { Search, ShoppingBag, Menu, X, Plus, Minus, ArrowRight, ChevronDown, MapPin, ShieldCheck, Truck, Store, Sparkles, Heart, SlidersHorizontal, MessageCircle, PackageCheck } from 'lucide-react'

const demoProducts = [
  { id: 'KM-001', name: 'Premium Basmati Rice', category: 'Groceries', price: 28500, oldPrice: 32000, supplier: 'Demo Supplier A', unit: '5 kg bag', image: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=900&q=85', tag: 'Popular' },
  { id: 'KM-002', name: 'Sunflower Cooking Oil', category: 'Groceries', price: 14500, supplier: 'Demo Supplier B', unit: '2 litres', image: 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=900&q=85', tag: 'Everyday pick' },
  { id: 'KM-003', name: 'Wireless Headphones', category: 'Electronics', price: 42000, supplier: 'Demo Supplier C', unit: '1 piece', image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=900&q=85', tag: 'New' },
  { id: 'KM-004', name: 'Classic Everyday Sneakers', category: 'Fashion', price: 55000, supplier: 'Demo Supplier A', unit: 'Pair', image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=900&q=85', tag: 'Trending' },
  { id: 'KM-005', name: 'Portable Solar Lantern', category: 'Home & Living', price: 38000, supplier: 'Demo Supplier D', unit: '1 piece', image: 'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=900&q=85', tag: 'Useful find' },
  { id: 'KM-006', name: 'Insulated Water Bottle', category: 'Home & Living', price: 18500, supplier: 'Demo Supplier B', unit: '750 ml', image: 'https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=900&q=85', tag: 'Staff pick' },
  { id: 'KM-007', name: 'Smart Fitness Watch', category: 'Electronics', price: 68000, supplier: 'Demo Supplier C', unit: '1 piece', image: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=900&q=85', tag: 'Popular' },
  { id: 'KM-008', name: 'Everyday Tote Bag', category: 'Fashion', price: 22000, supplier: 'Demo Supplier D', unit: '1 piece', image: 'https://images.unsplash.com/photo-1590874103328-eac38a683ce7?w=900&q=85', tag: 'New' },
]
const categories = ['All items', 'Groceries', 'Electronics', 'Fashion', 'Home & Living']
const money = value => 'MWK ' + Number(value).toLocaleString('en-US')
const whatsappNumber = import.meta.env.VITE_WHATSAPP_NUMBER || ''
const contactEmail = import.meta.env.VITE_CONTACT_EMAIL || 'info.kelnix@gmail.com'

export default function App() {
  const [category, setCategory] = useState('All items')
  const [query, setQuery] = useState('')
  const [cart, setCart] = useState({})
  const [cartOpen, setCartOpen] = useState(false)
  const [mobileMenu, setMobileMenu] = useState(false)
  const [saved, setSaved] = useState([])
  const [sort, setSort] = useState('featured')
  const [notice, setNotice] = useState('')
  const [products, setProducts] = useState(demoProducts)
  const [user, setUser] = useState(null)
  const [accountOpen, setAccountOpen] = useState(false)
  const [supplierOpen, setSupplierOpen] = useState(false)
  const [authMode, setAuthMode] = useState('signin')
  const [authBusy, setAuthBusy] = useState(false)
  const [authForm, setAuthForm] = useState({email:'',password:'',full_name:'',phone:''})
  const [supplierForm, setSupplierForm] = useState({business_name:'',contact_name:'',phone:'',email:'',district:'',address:'',description:''})
  const [supplierAccount, setSupplierAccount] = useState(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [adminSuppliers, setAdminSuppliers] = useState([])
  const [adminProducts, setAdminProducts] = useState([])
  const [adminOrders, setAdminOrders] = useState([])
  const [adminCustomers, setAdminCustomers] = useState([])
  const [adminPayments, setAdminPayments] = useState([])
  const [adminProfit, setAdminProfit] = useState([])
  const [dashboardOpen, setDashboardOpen] = useState(false)
  const [myProducts, setMyProducts] = useState([])
  const [productForm, setProductForm] = useState({name:'',category:'Groceries',description:'',unit:'piece',cost_price:'',selling_price:'',stock_quantity:'',image_url:''})

  useEffect(() => {
    if (!isSupabaseConfigured) return
    let alive = true
    supabase.auth.getSession().then(({data}) => { if (alive) setUser(data.session?.user || null) })
    const {data:{subscription}} = supabase.auth.onAuthStateChange((_event, session) => setUser(session?.user || null))
    supabase.from('products').select('id,name,description,category,unit,image_url,selling_price,stock_quantity,suppliers(business_name)').eq('status','active').order('created_at',{ascending:false}).then(({data,error}) => {
      if (!alive || error || !data?.length) return
      setProducts(data.map(p=>({id:p.id,name:p.name,category:p.category,price:Number(p.selling_price),supplier:p.suppliers?.business_name || 'Marketplace supplier',unit:p.unit || 'piece',image:p.image_url || 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=900&q=85',tag:'Supplier listing'})))
    })
    return () => { alive=false; subscription.unsubscribe() }
  }, [])

  useEffect(() => {
    if (!user || !isSupabaseConfigured) { setSupplierAccount(null); setMyProducts([]); setIsAdmin(false); return }
    let alive = true
    supabase.from('profiles').select('role').eq('id',user.id).maybeSingle().then(({data})=>{if(alive)setIsAdmin(data?.role==='admin')})
    supabase.from('suppliers').select('*').eq('owner_id',user.id).maybeSingle().then(({data}) => {
      if (!alive) return
      setSupplierAccount(data || null)
      if (data?.id) supabase.from('products').select('*').eq('supplier_id',data.id).order('created_at',{ascending:false}).then(({data:rows})=>{if(alive)setMyProducts(rows||[])})
    })
    return () => { alive=false }
  }, [user])

  const loadAdminData = async () => {
    const [s,p,o,cust,pay,ledger] = await Promise.all([
      supabase.from('suppliers').select('*').order('created_at',{ascending:false}),
      supabase.from('products').select('*,suppliers(business_name)').order('created_at',{ascending:false}),
      supabase.from('orders').select('*').order('created_at',{ascending:false}).limit(100),
      supabase.from('profiles').select('id,full_name,phone,role,created_at').eq('role','customer').order('created_at',{ascending:false}).limit(100),
      supabase.from('payments').select('*').order('created_at',{ascending:false}).limit(100),
      supabase.from('profit_ledger').select('*').order('created_at',{ascending:false}).limit(100)
    ])
    const firstError=s.error||p.error||o.error||cust.error||pay.error||ledger.error
    if(firstError){setNotice(firstError.message||'Could not load admin data.');return}
    setAdminSuppliers(s.data||[]);setAdminProducts(p.data||[]);setAdminOrders(o.data||[]);setAdminCustomers(cust.data||[]);setAdminPayments(pay.data||[]);setAdminProfit(ledger.data||[])
  }
  const copySupplierInvite = async () => {
    const link = window.location.origin + '/#suppliers'
    try { await navigator.clipboard.writeText(link); setNotice('Supplier application link copied. Share it with suppliers.'); }
    catch { setNotice('Supplier application link: ' + link); }
  }

  const openDashboard = async () => {
    setDashboardOpen(true)
    if (!user || !isSupabaseConfigured) return
    const {data,error} = await supabase.from('profiles').select('role').eq('id',user.id).maybeSingle()
    if (error) { setNotice('Could not verify administrator access: ' + error.message); return }
    const admin = data?.role === 'admin'
    setIsAdmin(admin)
    if (admin) await loadAdminData()
  }

  const updateAdminRecord = async (table,id,values) => {
    const {error}=await supabase.from(table).update(values).eq('id',id)
    if(error){setNotice(error.message);return}
    setNotice('Record updated.')
    loadAdminData()
  }

  const submitProduct = async (event) => {
    event.preventDefault()
    if (!supplierAccount || supplierAccount.status !== 'approved') return
    setAuthBusy(true)
    try {
      const payload = {...productForm,supplier_id:supplierAccount.id,cost_price:Number(productForm.cost_price||0),selling_price:Number(productForm.selling_price),stock_quantity:Number(productForm.stock_quantity||0),status:'pending'}
      const {data,error} = await supabase.from('products').insert(payload).select().single()
      if (error) throw error
      setMyProducts(rows=>[data,...rows]); setProductForm({name:'',category:'Groceries',description:'',unit:'piece',cost_price:'',selling_price:'',stock_quantity:'',image_url:''})
      setNotice('Product submitted for admin review. It will appear in the public catalogue after approval.')
    } catch(error) { setNotice(error.message || 'Could not submit product.') }
    finally { setAuthBusy(false) }
  }

  const submitAuth = async (event) => {
    event.preventDefault(); setAuthBusy(true)
    try {
      const result = authMode === 'signup'
        ? await supabase.auth.signUp({email:authForm.email,password:authForm.password,options:{data:{full_name:authForm.full_name,phone:authForm.phone}}})
        : await supabase.auth.signInWithPassword({email:authForm.email,password:authForm.password})
      if (result.error) throw result.error
      if (authMode === 'signup' && !result.data.session) setNotice('Account created. Check your email to confirm your address, then sign in.')
      else setNotice(authMode === 'signup' ? 'Account created successfully.' : 'Welcome back.')
      setAccountOpen(false)
    } catch(error) { setNotice(error.message || 'Unable to complete sign in.') }
    finally { setAuthBusy(false) }
  }

  const submitSupplier = async (event) => {
    event.preventDefault()
    if (!user) { setSupplierOpen(false); setAuthMode('signin'); setAccountOpen(true); setNotice('Please sign in or create an account before applying as a supplier.'); return }
    setAuthBusy(true)
    try {
      const {error} = await supabase.from('suppliers').insert({...supplierForm,owner_id:user.id,status:'pending'})
      if (error) throw error
      setSupplierOpen(false); setNotice('Supplier application submitted. Kelnix will review it before approval.')
    } catch(error) { setNotice(error.message || 'Supplier application could not be submitted.') }
    finally { setAuthBusy(false) }
  }

  const filtered = useMemo(() => {
    let list = products.filter(p => (category === 'All items' || p.category === category) && (p.name + ' ' + p.category + ' ' + p.supplier).toLowerCase().includes(query.toLowerCase()))
    if (sort === 'low') list = [...list].sort((a,b) => a.price-b.price)
    if (sort === 'high') list = [...list].sort((a,b) => b.price-a.price)
    return list
  }, [category, query, sort, products])
  const cartItems = products.filter(p => cart[p.id]).map(p => ({...p, quantity: cart[p.id]}))
  const count = cartItems.reduce((n,p) => n + p.quantity, 0)
  const total = cartItems.reduce((n,p) => n + p.price*p.quantity, 0)
  const add = id => setCart(old => ({...old, [id]: (old[id] || 0) + 1}))
  const change = (id, amount) => setCart(old => { const next = {...old}; next[id] = (next[id] || 0) + amount; if (next[id] <= 0) delete next[id]; return next })
  const order = () => {
    if (!cartItems.length) return
    if (!whatsappNumber) { setNotice('WhatsApp checkout is not connected yet. Add VITE_WHATSAPP_NUMBER in the project settings to activate orders.'); return }
    const message = 'Hello Kelnix Marketplace, I would like to order:\n' + cartItems.map(p => '• ' + p.name + ' x ' + p.quantity + ' — ' + money(p.price*p.quantity)).join('\n') + '\nTotal: ' + money(total) + '\nPlease confirm availability and delivery options.'
    window.open('https://wa.me/' + whatsappNumber.replace(/\D/g,'') + '?text=' + encodeURIComponent(message), '_blank', 'noopener,noreferrer')
  }

  return <div className="app">
    <div className="topline"><span><Sparkles size={13}/> One marketplace. Many trusted suppliers.</span><span className="topline-right">Shopping made simpler across Malawi <span className="dot">•</span> MWK</span></div>
    <header className="header">
      <a className="brand" href="#"><span className="brand-mark">K</span><span>KELNIX<span className="brand-light">MARKETPLACE</span></span></a>
      <div className="searchbar"><Search size={18}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search products, categories and more..."/><kbd>⌘ K</kbd></div>
      <nav className={mobileMenu ? 'nav nav-open' : 'nav'}><a href="#shop" onClick={()=>setMobileMenu(false)}>Shop</a><a href="#how" onClick={()=>setMobileMenu(false)}>How it works</a><a href="#suppliers" onClick={()=>setMobileMenu(false)}>Sell with us</a></nav>
      <div className="header-actions">{user&&<button className="account-button" onClick={openDashboard}>Dashboard</button>}<button className="account-button" onClick={()=>user ? supabase.auth.signOut() : (setAuthMode('signin'),setAccountOpen(true))}>{user ? 'Sign out' : 'Sign in'}</button><button className="icon-button" aria-label="Saved items" onClick={()=>setNotice('Saved items: '+saved.length)}><Heart size={19}/></button><button className="cart-button" onClick={()=>setCartOpen(true)}><ShoppingBag size={18}/><span>Cart</span><b>{count}</b></button><button className="mobile-toggle" onClick={()=>setMobileMenu(!mobileMenu)} aria-label="Toggle menu">{mobileMenu?<X/>:<Menu/>}</button></div>
    </header>
    <main>
      <section className="hero">
        <div className="hero-copy"><div className="eyebrow"><span className="eyebrow-line"/> THE MARKETPLACE THAT BRINGS IT ALL TOGETHER</div><h1>Good finds.<br/><em>Better shopping.</em></h1><p>Discover products from different suppliers, compare your options and shop with confidence — all in one place.</p><div className="hero-actions"><a className="primary-button" href="#shop">Explore marketplace <ArrowRight size={17}/></a><a className="text-link" href="#how">How it works <ArrowRight size={15}/></a></div><div className="hero-proof"><div className="proof-avatars"><span>KM</span><span>+</span><span>MW</span></div><span>Many suppliers. One easy checkout.</span></div></div>
        <div className="hero-visual"><div className="hero-image-main"><img src="https://images.unsplash.com/photo-1542838132-92c53300491e?w=1100&q=90" alt="Fresh market shopping selection"/></div><div className="floating-card"><span className="floating-icon"><PackageCheck size={18}/></span><span><b>More choice, one place</b><small>Products from multiple sellers</small></span></div><div className="hero-sticker">SHOP<br/>SMARTER<span>✳</span></div></div>
      </section>
      <section className="benefits"><div><span className="benefit-icon"><Store size={19}/></span><span><b>Multiple suppliers</b><small>More choice in one place</small></span></div><div><span className="benefit-icon"><ShieldCheck size={19}/></span><span><b>Supplier-aware listings</b><small>Know who you're buying from</small></span></div><div><span className="benefit-icon"><Truck size={19}/></span><span><b>Delivery coordination</b><small>Confirm options when ordering</small></span></div><div><span className="benefit-icon"><MessageCircle size={19}/></span><span><b>Easy WhatsApp orders</b><small>Talk to us before you pay</small></span></div></section>
      <section className="shop-section" id="shop"><div className="section-heading"><div><div className="eyebrow">THE MARKETPLACE</div><h2>Find your next <em>favourite.</em></h2><p>Browse a growing selection from different suppliers.</p></div><button className="filter-button" onClick={()=>setSort(sort==='featured'?'low':sort==='low'?'high':'featured')}><SlidersHorizontal size={16}/> Sort: {sort==='featured'?'Featured':sort==='low'?'Price low–high':'Price high–low'} <ChevronDown size={14}/></button></div>
        <div className="category-row">{categories.map(c=><button key={c} className={category===c?'category active':'category'} onClick={()=>setCategory(c)}>{c}</button>)}</div>
        <div className="demo-notice"><span className="demo-dot"/> {products === demoProducts ? 'Preview catalogue — sample products and prices only. Live supplier listings will appear here when approved.' : 'Live catalogue — showing approved supplier products.'}</div>
        <div className="product-grid">{filtered.map(p=><article className="product-card" key={p.id}><div className="product-image"><img src={p.image} alt={p.name} loading="lazy"/><span className="product-tag">{p.tag}</span><button className={saved.includes(p.id)?'save-button saved':'save-button'} aria-label="Save product" onClick={()=>setSaved(old=>old.includes(p.id)?old.filter(x=>x!==p.id):[...old,p.id])}><Heart size={17} fill={saved.includes(p.id)?'currentColor':'none'}/></button><button className="quick-add" onClick={()=>add(p.id)}><Plus size={17}/> Add</button></div><div className="product-info"><div className="product-category">{p.category}</div><h3>{p.name}</h3><div className="product-unit">{p.unit}</div><div className="product-bottom"><div><b>{money(p.price)}</b>{p.oldPrice&&<del>{money(p.oldPrice)}</del>}</div><span className="supplier-label"><Store size={12}/>{p.supplier}</span></div></div></article>)}</div>
        {!filtered.length&&<div className="empty-state"><Search size={25}/><h3>No products found</h3><p>Try another search or choose a different category.</p><button className="text-link" onClick={()=>{setQuery('');setCategory('All items')}}>Clear filters <ArrowRight size={15}/></button></div>}
        <div className="view-all"><span>Showing {filtered.length} sample listings</span><a href="#suppliers">Are you a supplier? List your products <ArrowRight size={15}/></a></div>
      </section>
      <section className="how-section" id="how"><div className="how-intro"><div className="eyebrow">SIMPLE BY DESIGN</div><h2>From browsing<br/>to <em>your doorstep.</em></h2><p>We bring different suppliers together so you can discover more without jumping between stores.</p></div><div className="steps"><div className="step"><span>01</span><div><b>Discover</b><p>Browse products from multiple suppliers in one catalogue.</p></div></div><div className="step"><span>02</span><div><b>Choose</b><p>Add what you need to your basket and review your order.</p></div></div><div className="step"><span>03</span><div><b>Confirm</b><p>Send your order on WhatsApp. We'll confirm stock, payment and delivery.</p></div></div></div></section>
      <section className="supplier-cta" id="suppliers"><div className="supplier-icon"><Store size={25}/></div><div><div className="eyebrow">GROW WITH KELNIX</div><h2>Have products to sell?</h2><p>Join a marketplace built to help suppliers reach more customers. Share your catalogue and let us help you get discovered.</p></div><button className="light-button" onClick={()=>{setSupplierOpen(true);setSupplierForm(f=>({...f,email:user?.email||f.email}))}}>Become a supplier <ArrowRight size={17}/></button><a style={{display:'none'}} className="light-button" href={whatsappNumber?'https://wa.me/'+whatsappNumber.replace(/\D/g,'')+'?text='+encodeURIComponent('Hello Kelnix, I am interested in becoming a marketplace supplier.'):'#'} onClick={e=>{if(!whatsappNumber){e.preventDefault();setNotice('Supplier onboarding contact is not connected yet. Add VITE_WHATSAPP_NUMBER to activate it.')}}}>Become a supplier <ArrowRight size={17}/></a></section>
    </main>
    <footer><a className="brand footer-brand" href="#"><span className="brand-mark">K</span><span>KELNIX<span className="brand-light">MARKETPLACE</span></span></a><span>One marketplace. Many possibilities.</span><a href={"mailto:"+contactEmail}>{contactEmail}</a><span>Built by <b>kelnix</b></span></footer>
    {cartOpen&&<div className="drawer-backdrop" onClick={()=>setCartOpen(false)}><aside className="cart-drawer" onClick={e=>e.stopPropagation()}><div className="drawer-head"><div><span className="eyebrow">YOUR BASKET</span><h2>Your cart <small>({count})</small></h2></div><button className="icon-button" onClick={()=>setCartOpen(false)}><X/></button></div>{cartItems.length?<><div className="cart-list">{cartItems.map(p=><div className="cart-item" key={p.id}><img src={p.image} alt=""/><div className="cart-item-info"><b>{p.name}</b><small>{money(p.price)}</small><div className="qty-control"><button onClick={()=>change(p.id,-1)}><Minus size={13}/></button><span>{p.quantity}</span><button onClick={()=>change(p.id,1)}><Plus size={13}/></button></div></div><strong>{money(p.price*p.quantity)}</strong></div>)}</div><div className="cart-total"><span>Estimated total</span><b>{money(total)}</b></div><p className="cart-note">Final availability, delivery fees and payment details will be confirmed before your order is accepted.</p><button className="checkout-button" onClick={order}>Continue on WhatsApp <ArrowRight size={17}/></button></>:<div className="cart-empty"><ShoppingBag size={32}/><h3>Your basket is waiting</h3><p>Add a few things you love and they'll show up here.</p><button className="primary-button" onClick={()=>setCartOpen(false)}>Explore products <ArrowRight size={16}/></button></div>}</aside></div>}
    {dashboardOpen&&<div className="modal-backdrop" onClick={()=>setDashboardOpen(false)}><section className="account-modal supplier-modal dashboard-modal" onClick={e=>e.stopPropagation()}><button className="modal-close" onClick={()=>setDashboardOpen(false)}><X/></button><div className="eyebrow">SUPPLIER WORKSPACE</div><h2>My dashboard</h2>{isAdmin?<><div className="admin-overview"><div className="admin-overview-head"><div><div className="eyebrow">MARKETPLACE CONTROL CENTRE</div><h3>Business overview</h3></div><span className="status-pill approved">Live data</span></div><div className="admin-kpis"><div><small>Customers</small><b>{adminCustomers.length}</b></div><div><small>Approved suppliers</small><b>{adminSuppliers.filter(x=>x.status==='approved').length}</b><em>{adminSuppliers.filter(x=>x.status==='pending').length} pending</em></div><div><small>Active products</small><b>{adminProducts.filter(x=>x.status==='active').length}</b><em>{adminProducts.filter(x=>x.status==='pending').length} pending</em></div><div><small>Total orders</small><b>{adminOrders.length}</b><em>{adminOrders.filter(x=>x.status==='pending').length} pending</em></div><div><small>Order value</small><b>{money(adminOrders.reduce((n,x)=>n+Number(x.total||0),0))}</b><em>Recorded orders</em></div><div><small>Recorded net profit</small><b>{money(adminProfit.reduce((n,x)=>n+Number(x.net_profit||0),0))}</b><em>Profit ledger only</em></div></div></div><div className="admin-toolbar"><button className="admin-action" onClick={()=>loadAdminData()}><span>↻</span> Refresh data</button><button className="admin-action primary" onClick={copySupplierInvite}>Copy supplier signup link</button><button className="admin-action" onClick={()=>document.getElementById('admin-suppliers')?.scrollIntoView({behavior:'smooth'})}>Suppliers</button><button className="admin-action" onClick={()=>document.getElementById('admin-products')?.scrollIntoView({behavior:'smooth'})}>Products</button><button className="admin-action" onClick={()=>document.getElementById('admin-orders')?.scrollIntoView({behavior:'smooth'})}>Orders</button></div><div className="status-panel"><b>Administrator access</b><span className="status-pill approved">Admin</span><small>Review suppliers, approve products and monitor marketplace orders.</small></div><h3 id="admin-customers">Customers ({adminCustomers.length})</h3>{adminCustomers.length===0&&<div className="admin-empty"><b>No customer accounts yet</b><p>Registered customers will appear here.</p></div>}{adminCustomers.map(x=><div className="dashboard-product" key={x.id}><span><b>{x.full_name||'Customer'}</b><small>{x.phone||'No phone supplied'}</small></span><small>{new Date(x.created_at).toLocaleDateString()}</small></div>)}<h3 id="admin-suppliers">Supplier applications ({adminSuppliers.length})</h3>{adminSuppliers.length===0&&<div className="admin-empty"><b>No supplier applications yet</b><p>Share your supplier signup link to start receiving applications.</p><button className="admin-action primary" onClick={copySupplierInvite}>Copy supplier signup link</button></div>}{adminSuppliers.map(s=><div className="dashboard-product" key={s.id}><span><b>{s.business_name}</b><small>{s.contact_name} · {s.phone} · {s.district||'District not set'}</small></span><span><span className={'status-pill '+s.status}>{s.status}</span>{s.status==='pending'&&<><button className="text-link" onClick={()=>updateAdminRecord('suppliers',s.id,{status:'approved'})}>Approve</button><button className="text-link" onClick={()=>updateAdminRecord('suppliers',s.id,{status:'rejected'})}>Reject</button></>}</span></div>)}<h3 id="admin-products">Product review ({adminProducts.filter(p=>p.status==='pending').length} pending)</h3>{adminProducts.length===0&&<div className="admin-empty"><b>No products submitted yet</b><p>Approved suppliers' product submissions will appear here for review.</p></div>}{adminProducts.map(p=><div className="dashboard-product" key={p.id}><span><b>{p.name}</b><small>{p.suppliers?.business_name||'Supplier'} · {money(p.selling_price)}</small></span><span><span className={'status-pill '+p.status}>{p.status}</span>{p.status==='pending'&&<><button className="text-link" onClick={()=>updateAdminRecord('products',p.id,{status:'active'})}>Approve</button><button className="text-link" onClick={()=>updateAdminRecord('products',p.id,{status:'rejected'})}>Reject</button></>}</span></div>)}<h3 id="admin-orders">Recent orders ({adminOrders.length})</h3>{adminOrders.length===0&&<div className="admin-empty"><b>No marketplace orders yet</b><p>Customer orders will appear here when shoppers place them.</p></div>}{adminOrders.map(o=><div className="dashboard-product" key={o.id}><span><b>{o.order_number||o.id.slice(0,8)}</b><small>{o.customer_name||'Customer'} · {money(o.total)} · {o.payment_status||'unpaid'}</small></span><span><span className={'status-pill '+o.status}>{o.status}</span><select aria-label="Update order status" value={o.status} onChange={e=>updateAdminRecord('orders',o.id,{status:e.target.value})}><option value="pending">Pending</option><option value="confirmed">Confirmed</option><option value="processing">Processing</option><option value="ready">Ready</option><option value="dispatched">Dispatched</option><option value="delivered">Delivered</option><option value="cancelled">Cancelled</option></select></span></div>)}<h3 id="admin-payments">Payments ({adminPayments.length})</h3>{adminPayments.length===0&&<div className="admin-empty"><b>No payment records yet</b><p>Payment records appear here after payment integration.</p></div>}{adminPayments.map(x=><div className="dashboard-product" key={x.id}><span><b>{x.provider} · {money(x.amount)}</b><small>{x.provider_reference||x.order_id}</small></span><span className={'status-pill '+x.status}>{x.status}</span></div>)}<h3 id="admin-profit">Profit & reports ({adminProfit.length} entries)</h3>{adminProfit.length===0&&<div className="admin-empty"><b>No profit entries recorded</b><p>Only recorded ledger entries are included in profit totals.</p></div>}{adminProfit.map(x=><div className="dashboard-product" key={x.id}><span><b>{money(x.net_profit)} net profit</b><small>Gross {money(x.gross_amount)} · Supplier cost {money(x.supplier_cost)} · Platform fee {money(x.platform_fee)}</small></span><small>{new Date(x.created_at).toLocaleDateString()}</small></div>)}</>:!supplierAccount?<><p>You have not submitted a supplier application yet.</p><button className="checkout-button" onClick={()=>{setDashboardOpen(false);setSupplierOpen(true)}}>Apply to become a supplier</button></>:<><div className="status-panel"><b>{supplierAccount.business_name}</b><span className={'status-pill '+supplierAccount.status}>{supplierAccount.status}</span><small>{supplierAccount.status==='approved'?'Your supplier account is approved. Products you submit will be reviewed before publishing.':'Your application is awaiting Kelnix admin review.'}</small></div>{supplierAccount.status==='approved'&&<><h3>Add a product</h3><form onSubmit={submitProduct}><input required placeholder="Product name" value={productForm.name} onChange={e=>setProductForm({...productForm,name:e.target.value})}/><select value={productForm.category} onChange={e=>setProductForm({...productForm,category:e.target.value})}><option>Groceries</option><option>Electronics</option><option>Fashion</option><option>Home & Living</option><option>Health & Beauty</option><option>Other</option></select><textarea placeholder="Description" value={productForm.description} onChange={e=>setProductForm({...productForm,description:e.target.value})}/><input placeholder="Unit (e.g. 1 piece, 5 kg bag)" value={productForm.unit} onChange={e=>setProductForm({...productForm,unit:e.target.value})}/><input required type="number" min="0" step="0.01" placeholder="Your cost price (MWK)" value={productForm.cost_price} onChange={e=>setProductForm({...productForm,cost_price:e.target.value})}/><input required type="number" min="0" step="0.01" placeholder="Selling price (MWK)" value={productForm.selling_price} onChange={e=>setProductForm({...productForm,selling_price:e.target.value})}/><input type="number" min="0" step="1" placeholder="Stock quantity" value={productForm.stock_quantity} onChange={e=>setProductForm({...productForm,stock_quantity:e.target.value})}/><input type="url" placeholder="Product image URL (optional)" value={productForm.image_url} onChange={e=>setProductForm({...productForm,image_url:e.target.value})}/><button className="checkout-button" disabled={authBusy}>{authBusy?'Submitting…':'Submit product for approval'}</button></form></>}<h3>Your submitted products</h3>{myProducts.length?myProducts.map(p=><div className="dashboard-product" key={p.id}><span><b>{p.name}</b><small>{money(p.selling_price)} · Stock {p.stock_quantity}</small></span><span className={'status-pill '+p.status}>{p.status}</span></div>):<p>No products submitted yet.</p>}</>}</section></div>}
    {accountOpen&&<div className="modal-backdrop" onClick={()=>setAccountOpen(false)}><section className="account-modal" onClick={e=>e.stopPropagation()}><button className="modal-close" onClick={()=>setAccountOpen(false)}><X/></button><div className="eyebrow">KELNIX ACCOUNT</div><h2>{authMode==='signin'?'Welcome back':'Create your account'}</h2><p>Sign in to manage your marketplace activity.</p><form onSubmit={submitAuth}>{authMode==='signup'&&<><input required placeholder="Full name" value={authForm.full_name} onChange={e=>setAuthForm({...authForm,full_name:e.target.value})}/><input placeholder="Phone number" value={authForm.phone} onChange={e=>setAuthForm({...authForm,phone:e.target.value})}/></>}<input required type="email" placeholder="Email address" value={authForm.email} onChange={e=>setAuthForm({...authForm,email:e.target.value})}/><input required minLength="8" type="password" placeholder="Password (at least 8 characters)" value={authForm.password} onChange={e=>setAuthForm({...authForm,password:e.target.value})}/><button className="checkout-button" disabled={authBusy||!isSupabaseConfigured}>{authBusy?'Please wait…':authMode==='signin'?'Sign in':'Create account'}</button></form><button className="modal-switch" onClick={()=>setAuthMode(authMode==='signin'?'signup':'signin')}>{authMode==='signin'?'New to Kelnix? Create an account':'Already registered? Sign in'}</button></section></div>}
    {supplierOpen&&<div className="modal-backdrop" onClick={()=>setSupplierOpen(false)}><section className="account-modal supplier-modal" onClick={e=>e.stopPropagation()}><button className="modal-close" onClick={()=>setSupplierOpen(false)}><X/></button><div className="eyebrow">SELL WITH KELNIX</div><h2>Supplier application</h2><p>Submit your business details. Applications are reviewed before products can go live.</p><form onSubmit={submitSupplier}><input required placeholder="Business name" value={supplierForm.business_name} onChange={e=>setSupplierForm({...supplierForm,business_name:e.target.value})}/><input required placeholder="Contact person's name" value={supplierForm.contact_name} onChange={e=>setSupplierForm({...supplierForm,contact_name:e.target.value})}/><input required placeholder="Phone number" value={supplierForm.phone} onChange={e=>setSupplierForm({...supplierForm,phone:e.target.value})}/><input type="email" placeholder="Business email" value={supplierForm.email} onChange={e=>setSupplierForm({...supplierForm,email:e.target.value})}/><input placeholder="District" value={supplierForm.district} onChange={e=>setSupplierForm({...supplierForm,district:e.target.value})}/><input placeholder="Address / location" value={supplierForm.address} onChange={e=>setSupplierForm({...supplierForm,address:e.target.value})}/><textarea placeholder="Tell us about your products" value={supplierForm.description} onChange={e=>setSupplierForm({...supplierForm,description:e.target.value})}/><button className="checkout-button" disabled={authBusy}>{authBusy?'Submitting…':'Submit application'}</button></form></section></div>}
    {notice&&<div className="toast"><span>{notice}</span><button onClick={()=>setNotice('')}><X size={16}/></button></div>}
  </div>
}
