import { useMemo, useState } from 'react'
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

export default function App() {
  const [category, setCategory] = useState('All items')
  const [query, setQuery] = useState('')
  const [cart, setCart] = useState({})
  const [cartOpen, setCartOpen] = useState(false)
  const [mobileMenu, setMobileMenu] = useState(false)
  const [saved, setSaved] = useState([])
  const [sort, setSort] = useState('featured')
  const [notice, setNotice] = useState('')

  const filtered = useMemo(() => {
    let list = demoProducts.filter(p => (category === 'All items' || p.category === category) && (p.name + ' ' + p.category + ' ' + p.supplier).toLowerCase().includes(query.toLowerCase()))
    if (sort === 'low') list = [...list].sort((a,b) => a.price-b.price)
    if (sort === 'high') list = [...list].sort((a,b) => b.price-a.price)
    return list
  }, [category, query, sort])
  const cartItems = demoProducts.filter(p => cart[p.id]).map(p => ({...p, quantity: cart[p.id]}))
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
      <div className="header-actions"><button className="icon-button" aria-label="Saved items" onClick={()=>setNotice('Saved items: '+saved.length)}><Heart size={19}/></button><button className="cart-button" onClick={()=>setCartOpen(true)}><ShoppingBag size={18}/><span>Cart</span><b>{count}</b></button><button className="mobile-toggle" onClick={()=>setMobileMenu(!mobileMenu)} aria-label="Toggle menu">{mobileMenu?<X/>:<Menu/>}</button></div>
    </header>
    <main>
      <section className="hero">
        <div className="hero-copy"><div className="eyebrow"><span className="eyebrow-line"/> THE MARKETPLACE THAT BRINGS IT ALL TOGETHER</div><h1>Good finds.<br/><em>Better shopping.</em></h1><p>Discover products from different suppliers, compare your options and shop with confidence — all in one place.</p><div className="hero-actions"><a className="primary-button" href="#shop">Explore marketplace <ArrowRight size={17}/></a><a className="text-link" href="#how">How it works <ArrowRight size={15}/></a></div><div className="hero-proof"><div className="proof-avatars"><span>KM</span><span>+</span><span>MW</span></div><span>Many suppliers. One easy checkout.</span></div></div>
        <div className="hero-visual"><div className="hero-image-main"><img src="https://images.unsplash.com/photo-1542838132-92c53300491e?w=1100&q=90" alt="Fresh market shopping selection"/></div><div className="floating-card"><span className="floating-icon"><PackageCheck size={18}/></span><span><b>More choice, one place</b><small>Products from multiple sellers</small></span></div><div className="hero-sticker">SHOP<br/>SMARTER<span>✳</span></div></div>
      </section>
      <section className="benefits"><div><span className="benefit-icon"><Store size={19}/></span><span><b>Multiple suppliers</b><small>More choice in one place</small></span></div><div><span className="benefit-icon"><ShieldCheck size={19}/></span><span><b>Supplier-aware listings</b><small>Know who you're buying from</small></span></div><div><span className="benefit-icon"><Truck size={19}/></span><span><b>Delivery coordination</b><small>Confirm options when ordering</small></span></div><div><span className="benefit-icon"><MessageCircle size={19}/></span><span><b>Easy WhatsApp orders</b><small>Talk to us before you pay</small></span></div></section>
      <section className="shop-section" id="shop"><div className="section-heading"><div><div className="eyebrow">THE MARKETPLACE</div><h2>Find your next <em>favourite.</em></h2><p>Browse a growing selection from different suppliers.</p></div><button className="filter-button" onClick={()=>setSort(sort==='featured'?'low':sort==='low'?'high':'featured')}><SlidersHorizontal size={16}/> Sort: {sort==='featured'?'Featured':sort==='low'?'Price low–high':'Price high–low'} <ChevronDown size={14}/></button></div>
        <div className="category-row">{categories.map(c=><button key={c} className={category===c?'category active':'category'} onClick={()=>setCategory(c)}>{c}</button>)}</div>
        <div className="demo-notice"><span className="demo-dot"/> Preview catalogue — sample products and prices only. Real supplier listings will replace these before launch.</div>
        <div className="product-grid">{filtered.map(p=><article className="product-card" key={p.id}><div className="product-image"><img src={p.image} alt={p.name} loading="lazy"/><span className="product-tag">{p.tag}</span><button className={saved.includes(p.id)?'save-button saved':'save-button'} aria-label="Save product" onClick={()=>setSaved(old=>old.includes(p.id)?old.filter(x=>x!==p.id):[...old,p.id])}><Heart size={17} fill={saved.includes(p.id)?'currentColor':'none'}/></button><button className="quick-add" onClick={()=>add(p.id)}><Plus size={17}/> Add</button></div><div className="product-info"><div className="product-category">{p.category}</div><h3>{p.name}</h3><div className="product-unit">{p.unit}</div><div className="product-bottom"><div><b>{money(p.price)}</b>{p.oldPrice&&<del>{money(p.oldPrice)}</del>}</div><span className="supplier-label"><Store size={12}/>{p.supplier}</span></div></div></article>)}</div>
        {!filtered.length&&<div className="empty-state"><Search size={25}/><h3>No products found</h3><p>Try another search or choose a different category.</p><button className="text-link" onClick={()=>{setQuery('');setCategory('All items')}}>Clear filters <ArrowRight size={15}/></button></div>}
        <div className="view-all"><span>Showing {filtered.length} sample listings</span><a href="#suppliers">Are you a supplier? List your products <ArrowRight size={15}/></a></div>
      </section>
      <section className="how-section" id="how"><div className="how-intro"><div className="eyebrow">SIMPLE BY DESIGN</div><h2>From browsing<br/>to <em>your doorstep.</em></h2><p>We bring different suppliers together so you can discover more without jumping between stores.</p></div><div className="steps"><div className="step"><span>01</span><div><b>Discover</b><p>Browse products from multiple suppliers in one catalogue.</p></div></div><div className="step"><span>02</span><div><b>Choose</b><p>Add what you need to your basket and review your order.</p></div></div><div className="step"><span>03</span><div><b>Confirm</b><p>Send your order on WhatsApp. We'll confirm stock, payment and delivery.</p></div></div></div></section>
      <section className="supplier-cta" id="suppliers"><div className="supplier-icon"><Store size={25}/></div><div><div className="eyebrow">GROW WITH KELNIX</div><h2>Have products to sell?</h2><p>Join a marketplace built to help suppliers reach more customers. Share your catalogue and let us help you get discovered.</p></div><a className="light-button" href={whatsappNumber?'https://wa.me/'+whatsappNumber.replace(/\D/g,'')+'?text='+encodeURIComponent('Hello Kelnix, I am interested in becoming a marketplace supplier.'):'#'} onClick={e=>{if(!whatsappNumber){e.preventDefault();setNotice('Supplier onboarding contact is not connected yet. Add VITE_WHATSAPP_NUMBER to activate it.')}}}>Become a supplier <ArrowRight size={17}/></a></section>
    </main>
    <footer><a className="brand footer-brand" href="#"><span className="brand-mark">K</span><span>KELNIX<span className="brand-light">MARKETPLACE</span></span></a><span>One marketplace. Many possibilities.</span><span>Built by <b>kelnix</b></span></footer>
    {cartOpen&&<div className="drawer-backdrop" onClick={()=>setCartOpen(false)}><aside className="cart-drawer" onClick={e=>e.stopPropagation()}><div className="drawer-head"><div><span className="eyebrow">YOUR BASKET</span><h2>Your cart <small>({count})</small></h2></div><button className="icon-button" onClick={()=>setCartOpen(false)}><X/></button></div>{cartItems.length?<><div className="cart-list">{cartItems.map(p=><div className="cart-item" key={p.id}><img src={p.image} alt=""/><div className="cart-item-info"><b>{p.name}</b><small>{money(p.price)}</small><div className="qty-control"><button onClick={()=>change(p.id,-1)}><Minus size={13}/></button><span>{p.quantity}</span><button onClick={()=>change(p.id,1)}><Plus size={13}/></button></div></div><strong>{money(p.price*p.quantity)}</strong></div>)}</div><div className="cart-total"><span>Estimated total</span><b>{money(total)}</b></div><p className="cart-note">Final availability, delivery fees and payment details will be confirmed before your order is accepted.</p><button className="checkout-button" onClick={order}>Continue on WhatsApp <ArrowRight size={17}/></button></>:<div className="cart-empty"><ShoppingBag size={32}/><h3>Your basket is waiting</h3><p>Add a few things you love and they'll show up here.</p><button className="primary-button" onClick={()=>setCartOpen(false)}>Explore products <ArrowRight size={16}/></button></div>}</aside></div>}
    {notice&&<div className="toast"><span>{notice}</span><button onClick={()=>setNotice('')}><X size={16}/></button></div>}
  </div>
}
