import {
  AlertTriangle,
  BadgeCheck,
  BarChart3,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  DatabaseZap,
  FileText,
  Gauge,
  History,
  Inbox,
  PackageCheck,
  RotateCcw,
  SearchCheck,
  Send,
  ShieldAlert,
  Sparkles,
  XCircle,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { useEffect, useMemo, useState } from 'react'
import './App.css'

type OrderStatus = 'new' | 'review' | 'approved' | 'sent' | 'held'
type ValidationSeverity = 'info' | 'warning' | 'blocker'

type ExtractedField = {
  label: string
  key: string
  value: string
  confidence: number
  sourceText?: string
}

type OrderLine = {
  sku: string
  description: string
  quantity: number
  unitPrice: number
  extractedSku?: string
}

type ValidationIssue = {
  id: string
  title: string
  detail: string
  severity: ValidationSeverity
  resolved: boolean
}

type ActivityEvent = {
  id: string
  time: string
  message: string
}

type Customer = {
  id: string
  name: string
  dealerCode: string
  shipTo: string
  creditStatus: 'clear' | 'hold'
}

type Part = {
  sku: string
  description: string
  listPrice: number
  active: boolean
}

type Order = {
  id: string
  source: 'Email PDF' | 'Dealer Portal' | 'Spreadsheet' | 'EDI'
  receivedAt: string
  customerId: string
  customerName: string
  dealerCode: string
  poNumber: string
  orderType: 'Parts' | 'Truck configuration' | 'Service'
  confidence: number
  status: OrderStatus
  fields: ExtractedField[]
  lines: OrderLine[]
  issues: ValidationIssue[]
  sourceDocument: string
  activity: ActivityEvent[]
}

const STORAGE_KEY = 'raymond-order-input-demo-v1'

const customers: Customer[] = [
  {
    id: 'cust-northline',
    name: 'Northline Distribution Services',
    dealerCode: 'D-1048',
    shipTo: '455 Warehouse Way, Scranton, PA 18505',
    creditStatus: 'clear',
  },
  {
    id: 'cust-lakefront',
    name: 'Lakefront Cold Storage',
    dealerCode: 'D-2190',
    shipTo: '82 Freezer Dock Rd, Buffalo, NY 14203',
    creditStatus: 'clear',
  },
  {
    id: 'cust-ironvale',
    name: 'Ironvale Manufacturing',
    dealerCode: 'D-4412',
    shipTo: '1900 Assembly Pkwy, Erie, PA 16501',
    creditStatus: 'hold',
  },
  {
    id: 'cust-metro',
    name: 'MetroLift Dealer Group',
    dealerCode: 'D-8870',
    shipTo: '23 Fleet Center Dr, Newark, NJ 07114',
    creditStatus: 'clear',
  },
]

const parts: Part[] = [
  { sku: 'BLT-200-77', description: 'Load wheel bolt kit', listPrice: 42, active: true },
  { sku: 'WHL-900-12', description: 'Poly drive tire assembly', listPrice: 318, active: true },
  { sku: 'SNS-410-02', description: 'Mast height sensor', listPrice: 186, active: true },
  { sku: 'BAT-LFP-24', description: 'Lithium-ion battery pack 24V', listPrice: 2890, active: true },
  { sku: 'CTRL-552-8', description: 'Traction controller module', listPrice: 1240, active: true },
  { sku: 'KIT-OPR-36', description: 'Orderpicker rail guide kit', listPrice: 760, active: false },
]

const initialOrders: Order[] = [
  {
    id: 'ORD-7841',
    source: 'Email PDF',
    receivedAt: '2026-06-16T08:12:00-04:00',
    customerId: 'cust-northline',
    customerName: 'Northline Distribution Services',
    dealerCode: 'D-1048',
    poNumber: 'PO-44820',
    orderType: 'Parts',
    confidence: 96,
    status: 'new',
    fields: [
      field('Customer', 'customerName', 'Northline Distribution Services', 98),
      field('Dealer code', 'dealerCode', 'D-1048', 99),
      field('PO number', 'poNumber', 'PO-44820', 97),
      field('Ship-to', 'shipTo', '455 Warehouse Way, Scranton, PA 18505', 95),
      field('Requested date', 'requestedDate', '2026-06-21', 94),
    ],
    lines: [
      { sku: 'BLT-200-77', description: 'Load wheel bolt kit', quantity: 12, unitPrice: 42 },
      { sku: 'SNS-410-02', description: 'Mast height sensor', quantity: 4, unitPrice: 186 },
    ],
    issues: [
      issue('i-1', 'Customer matched', 'Dealer code and ship-to match the customer master.', 'info', true),
    ],
    sourceDocument:
      'Email from orders@northline.example\nSubject: PO-44820 replacement parts\n\nPlease process attached PO for 12 BLT-200-77 bolt kits and 4 SNS-410-02 mast height sensors. Ship to Scranton DC.',
    activity: [event('AI extraction completed with 96% confidence.')],
  },
  {
    id: 'ORD-7842',
    source: 'Dealer Portal',
    receivedAt: '2026-06-16T08:28:00-04:00',
    customerId: 'cust-lakefront',
    customerName: 'Lakefront Cold Storage',
    dealerCode: 'D-2190',
    poNumber: 'PO-77219',
    orderType: 'Parts',
    confidence: 92,
    status: 'review',
    fields: [
      field('Customer', 'customerName', 'Lakefront Cold Storage', 96),
      field('Dealer code', 'dealerCode', 'D-2190', 95),
      field('PO number', 'poNumber', 'PO-77219', 94),
      field('Ship-to', 'shipTo', '82 Freezer Dock Rd, Buffalo, NY 14203', 93),
    ],
    lines: [{ sku: 'WHL-900-12', description: 'Poly drive tire assembly', quantity: 6, unitPrice: 318 }],
    issues: [
      issue('i-2', 'Possible duplicate PO', 'PO-77219 was submitted yesterday for the same dealer.', 'blocker', false),
    ],
    sourceDocument:
      'Dealer portal order\nDealer: D-2190\nPO: PO-77219\nLine: WHL-900-12, qty 6\nNotes: replenish freezer fleet tires',
    activity: [event('Duplicate PO rule flagged this order for review.')],
  },
  {
    id: 'ORD-7843',
    source: 'Spreadsheet',
    receivedAt: '2026-06-16T09:03:00-04:00',
    customerId: 'cust-metro',
    customerName: 'MetroLift Dealer Group',
    dealerCode: 'D-8870',
    poNumber: 'PO-33078',
    orderType: 'Parts',
    confidence: 88,
    status: 'review',
    fields: [
      field('Customer', 'customerName', 'MetroLift Dealer Group', 91),
      field('Dealer code', 'dealerCode', 'D-8870', 93),
      field('PO number', 'poNumber', 'PO-33078', 90),
      field('Ship-to', 'shipTo', '23 Fleet Center Dr, Newark, NJ 07114', 92),
    ],
    lines: [
      {
        sku: 'KIT-OPR-36',
        extractedSku: 'KIT-OPR-3G',
        description: 'Orderpicker rail guide kit',
        quantity: 2,
        unitPrice: 760,
      },
    ],
    issues: [
      issue('i-3', 'Invalid or inactive part', 'Extracted SKU KIT-OPR-3G does not match an active part.', 'blocker', false),
    ],
    sourceDocument:
      'Uploaded XLSX rows\nPO-33078 | MetroLift Dealer Group | KIT-OPR-3G | 2 | rail guide kit',
    activity: [event('Part validation could not confirm one line item.')],
  },
  {
    id: 'ORD-7844',
    source: 'Email PDF',
    receivedAt: '2026-06-16T09:34:00-04:00',
    customerId: 'cust-northline',
    customerName: 'Northline Distribution Services',
    dealerCode: 'D-1048',
    poNumber: 'PO-44831',
    orderType: 'Parts',
    confidence: 90,
    status: 'review',
    fields: [
      field('Customer', 'customerName', 'Northline Distribution Services', 94),
      field('Dealer code', 'dealerCode', 'D-1048', 98),
      field('PO number', 'poNumber', 'PO-44831', 93),
      field('Ship-to', 'shipTo', '455 Warehouse Way, Scranton, PA 18505', 96),
    ],
    lines: [{ sku: 'CTRL-552-8', description: 'Traction controller module', quantity: 1, unitPrice: 1180 }],
    issues: [
      issue('i-4', 'Pricing mismatch', 'Extracted unit price is $1,180; current list price is $1,240.', 'warning', false),
    ],
    sourceDocument:
      'PO-44831\nCTRL-552-8 traction controller module, qty 1, unit price 1180.00\nRequested delivery: expedite',
    activity: [event('Pricing rule found a variance against list price.')],
  },
  {
    id: 'ORD-7845',
    source: 'Email PDF',
    receivedAt: '2026-06-16T10:10:00-04:00',
    customerId: 'cust-ironvale',
    customerName: 'Ironvale Manufacturing',
    dealerCode: 'D-4412',
    poNumber: 'PO-90112',
    orderType: 'Service',
    confidence: 84,
    status: 'review',
    fields: [
      field('Customer', 'customerName', 'Ironvale Manufacturing', 89),
      field('Dealer code', 'dealerCode', 'D-4412', 92),
      field('PO number', 'poNumber', 'PO-90112', 90),
      field('Ship-to', 'shipTo', '', 22, 'Ship address field blank on attached form'),
    ],
    lines: [{ sku: 'BAT-LFP-24', description: 'Lithium-ion battery pack 24V', quantity: 1, unitPrice: 2890 }],
    issues: [
      issue('i-5', 'Missing ship-to address', 'Ship-to could not be extracted from the document.', 'blocker', false),
      issue('i-6', 'Credit hold', 'Customer master shows credit hold; finance release required.', 'warning', false),
    ],
    sourceDocument:
      'Scanned PO image\nIronvale Manufacturing\nPO-90112\nBAT-LFP-24 qty 1\nShip-to: [blank / unreadable]',
    activity: [event('Low-confidence ship-to field sent to exception queue.')],
  },
  {
    id: 'ORD-7846',
    source: 'Email PDF',
    receivedAt: '2026-06-16T10:41:00-04:00',
    customerId: 'cust-lakefront',
    customerName: 'Lakefront Cold Storage',
    dealerCode: 'D-2190',
    poNumber: 'PO-77244',
    orderType: 'Truck configuration',
    confidence: 79,
    status: 'review',
    fields: [
      field('Customer', 'customerName', 'Lakefront Cold Storage', 94),
      field('Dealer code', 'dealerCode', 'D-2190', 92),
      field('PO number', 'poNumber', 'PO-77244', 88),
      field('Truck model', 'truckModel', 'Reach truck, freezer package, lithium power', 74),
    ],
    lines: [{ sku: 'CONFIG-RCH-FRZ', description: 'Custom reach truck freezer configuration', quantity: 3, unitPrice: 41800 }],
    issues: [
      issue('i-7', 'Custom configuration review', 'Truck configuration requires engineering/order management approval.', 'warning', false),
      issue('i-8', 'Low confidence option set', 'Freezer package and power option were extracted at 74% confidence.', 'warning', false),
    ],
    sourceDocument:
      'Email body\nNeed quote/order entry for 3 reach trucks, freezer package, lithium power, cold storage spec. PO-77244 attached.',
    activity: [event('Custom configuration routed to review lane.')],
  },
  {
    id: 'ORD-7847',
    source: 'EDI',
    receivedAt: '2026-06-16T11:02:00-04:00',
    customerId: 'cust-metro',
    customerName: 'MetroLift Dealer Group',
    dealerCode: 'D-8870',
    poNumber: 'PO-33102',
    orderType: 'Parts',
    confidence: 99,
    status: 'approved',
    fields: [
      field('Customer', 'customerName', 'MetroLift Dealer Group', 99),
      field('Dealer code', 'dealerCode', 'D-8870', 99),
      field('PO number', 'poNumber', 'PO-33102', 99),
      field('Ship-to', 'shipTo', '23 Fleet Center Dr, Newark, NJ 07114', 99),
    ],
    lines: [
      { sku: 'WHL-900-12', description: 'Poly drive tire assembly', quantity: 10, unitPrice: 318 },
      { sku: 'BLT-200-77', description: 'Load wheel bolt kit', quantity: 20, unitPrice: 42 },
    ],
    issues: [issue('i-9', 'EDI validation passed', 'Structured inbound order matched all required master data.', 'info', true)],
    sourceDocument:
      'EDI 850\nBEG*00*SA*PO-33102\nN1*ST*MetroLift Dealer Group\nPO1*1*10*EA*318*VN*WHL-900-12',
    activity: [event('Approved by automation rules.')],
  },
]

function field(label: string, key: string, value: string, confidence: number, sourceText?: string): ExtractedField {
  return { label, key, value, confidence, sourceText }
}

function issue(
  id: string,
  title: string,
  detail: string,
  severity: ValidationSeverity,
  resolved: boolean,
): ValidationIssue {
  return { id, title, detail, severity, resolved }
}

function event(message: string): ActivityEvent {
  return { id: crypto.randomUUID(), time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), message }
}

function ageLabel(iso: string) {
  const minutes = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60000))
  if (minutes < 60) return `${minutes}m`
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`
}

function currency(value: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value)
}

function statusLabel(status: OrderStatus) {
  return {
    new: 'New',
    review: 'Needs review',
    approved: 'Approved',
    sent: 'Sent to ERP',
    held: 'Held',
  }[status]
}

function severityIcon(severity: ValidationSeverity) {
  if (severity === 'blocker') return <ShieldAlert size={16} />
  if (severity === 'warning') return <AlertTriangle size={16} />
  return <BadgeCheck size={16} />
}

function App() {
  const [orders, setOrders] = useState<Order[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    return saved ? JSON.parse(saved) : initialOrders
  })
  const [selectedId, setSelectedId] = useState(orders[0]?.id ?? '')

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(orders))
  }, [orders])

  const selected = orders.find((order) => order.id === selectedId) ?? orders[0]

  const metrics = useMemo(() => {
    const total = orders.length
    const sentOrApproved = orders.filter((order) => ['approved', 'sent'].includes(order.status)).length
    const unresolved = orders.flatMap((order) => order.issues).filter((item) => !item.resolved)
    const blockers = unresolved.filter((item) => item.severity === 'blocker').length
    return {
      automationRate: Math.round((sentOrApproved / total) * 100),
      processed: sentOrApproved,
      exceptionRate: Math.round((orders.filter((order) => order.issues.some((item) => !item.resolved)).length / total) * 100),
      savedHours: (total * 0.32).toFixed(1),
      backlog: Math.max(0, unresolved.length - blockers),
    }
  }, [orders])

  const updateOrder = (id: string, updater: (order: Order) => Order) => {
    setOrders((current) => current.map((order) => (order.id === id ? updater(order) : order)))
  }

  const unresolvedBlocker = selected?.issues.some((item) => item.severity === 'blocker' && !item.resolved)

  const setStatus = (status: OrderStatus, message: string) => {
    if (!selected) return
    updateOrder(selected.id, (order) => ({
      ...order,
      status,
      activity: [event(message), ...order.activity],
    }))
  }

  const resolveIssue = (issueId: string) => {
    if (!selected) return
    updateOrder(selected.id, (order) => ({
      ...order,
      issues: order.issues.map((item) => (item.id === issueId ? { ...item, resolved: true } : item)),
      activity: [event('Exception marked resolved by reviewer.'), ...order.activity],
    }))
  }

  const editField = (key: string, value: string) => {
    if (!selected) return
    updateOrder(selected.id, (order) => ({
      ...order,
      fields: order.fields.map((fieldItem) =>
        fieldItem.key === key ? { ...fieldItem, value, confidence: Math.max(fieldItem.confidence, 98) } : fieldItem,
      ),
      activity: [event(`Reviewer updated ${key}.`), ...order.activity],
    }))
  }

  const resetDemo = () => {
    localStorage.removeItem(STORAGE_KEY)
    setOrders(initialOrders)
    setSelectedId(initialOrders[0].id)
  }

  if (!selected) return null

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Material handling order operations</p>
          <h1>Order input automation console</h1>
        </div>
        <button className="ghost-button" type="button" onClick={resetDemo} title="Reset demo data">
          <RotateCcw size={17} />
          Reset
        </button>
      </header>

      <section className="metrics-grid" aria-label="Operations dashboard">
        <Metric icon={<Gauge />} label="Automation rate" value={`${metrics.automationRate}%`} detail="Approved or ERP-ready" />
        <Metric icon={<ClipboardCheck />} label="Processed today" value={`${metrics.processed}/${orders.length}`} detail="Orders cleared" />
        <Metric icon={<AlertTriangle />} label="Exception rate" value={`${metrics.exceptionRate}%`} detail="Needs human review" />
        <Metric icon={<Clock3 />} label="Touch time saved" value={`${metrics.savedHours}h`} detail="Estimated daily lift" />
        <Metric icon={<BarChart3 />} label="Backlog risk" value={`${metrics.backlog}`} detail="Non-blocking open items" />
      </section>

      <section className="workspace">
        <aside className="queue-panel" aria-label="Order queue">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Inbound queue</p>
              <h2>Orders</h2>
            </div>
            <Inbox size={20} />
          </div>
          <div className="queue-list">
            {orders.map((order) => {
              const openIssues = order.issues.filter((item) => !item.resolved).length
              return (
                <button
                  className={`queue-item ${selected.id === order.id ? 'selected' : ''}`}
                  type="button"
                  key={order.id}
                  onClick={() => setSelectedId(order.id)}
                >
                  <span className={`status-pill ${order.status}`}>{statusLabel(order.status)}</span>
                  <strong>{order.poNumber}</strong>
                  <span>{order.customerName}</span>
                  <div className="queue-meta">
                    <span>{order.source}</span>
                    <span>{ageLabel(order.receivedAt)}</span>
                    <span>{order.confidence}%</span>
                    <span>{openIssues} exceptions</span>
                  </div>
                </button>
              )
            })}
          </div>
        </aside>

        <section className="review-panel">
          <div className="review-header">
            <div>
              <p className="eyebrow">{selected.orderType}</p>
              <h2>{selected.customerName}</h2>
              <p className="muted">{selected.poNumber} · {selected.dealerCode} · {selected.source}</p>
            </div>
            <span className={`status-pill large ${selected.status}`}>{statusLabel(selected.status)}</span>
          </div>

          <div className="review-grid">
            <article className="document-card">
              <div className="section-title">
                <FileText size={18} />
                Source document
              </div>
              <pre>{selected.sourceDocument}</pre>
            </article>

            <article className="fields-card">
              <div className="section-title">
                <Sparkles size={18} />
                AI extraction
              </div>
              <div className="field-list">
                {selected.fields.map((item) => (
                  <label className="field-row" key={item.key}>
                    <span>
                      {item.label}
                      <small>{item.confidence}% confidence</small>
                    </span>
                    <input value={item.value} onChange={(event) => editField(item.key, event.target.value)} />
                  </label>
                ))}
              </div>
            </article>
          </div>

          <article className="line-card">
            <div className="section-title">
              <PackageCheck size={18} />
              Line items
            </div>
            <div className="line-table">
              <div className="line-head">
                <span>SKU</span>
                <span>Description</span>
                <span>Qty</span>
                <span>Unit</span>
              </div>
              {selected.lines.map((line) => (
                <div className="line-row" key={`${line.sku}-${line.description}`}>
                  <span>{line.extractedSku ?? line.sku}</span>
                  <span>{line.description}</span>
                  <span>{line.quantity}</span>
                  <span>{currency(line.unitPrice)}</span>
                </div>
              ))}
            </div>
          </article>
        </section>

        <aside className="validation-panel" aria-label="Validation panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">ERP readiness</p>
              <h2>Validation</h2>
            </div>
            <SearchCheck size={20} />
          </div>

          <div className="master-data">
            <MasterCheck label="Customer master" value={customers.find((item) => item.id === selected.customerId)?.name ?? 'No match'} />
            <MasterCheck label="Credit status" value={customers.find((item) => item.id === selected.customerId)?.creditStatus ?? 'unknown'} />
            <MasterCheck label="Active parts" value={`${selected.lines.filter((line) => parts.some((part) => part.sku === line.sku && part.active)).length}/${selected.lines.length}`} />
          </div>

          <div className="issue-list">
            {selected.issues.map((item) => (
              <div className={`issue ${item.severity} ${item.resolved ? 'resolved' : ''}`} key={item.id}>
                <div className="issue-top">
                  {severityIcon(item.severity)}
                  <strong>{item.title}</strong>
                </div>
                <p>{item.detail}</p>
                {!item.resolved ? (
                  <button type="button" className="text-button" onClick={() => resolveIssue(item.id)}>
                    Mark resolved
                  </button>
                ) : (
                  <span className="resolved-label">Resolved</span>
                )}
              </div>
            ))}
          </div>

          <div className="action-stack">
            <button className="primary-button" type="button" onClick={() => setStatus('approved', 'Order approved for ERP staging.')} disabled={unresolvedBlocker}>
              <CheckCircle2 size={17} />
              Approve
            </button>
            <button className="primary-button dark" type="button" onClick={() => setStatus('sent', 'Order sent to ERP staging queue.')} disabled={unresolvedBlocker}>
              <Send size={17} />
              Send to ERP
            </button>
            <button className="secondary-button" type="button" onClick={() => setStatus('held', 'Order placed on hold for follow-up.')}>
              <XCircle size={17} />
              Hold / reject
            </button>
          </div>

          <div className="activity-card">
            <div className="section-title">
              <History size={18} />
              Activity
            </div>
            {selected.activity.map((item) => (
              <p key={item.id}>
                <span>{item.time}</span>
                {item.message}
              </p>
            ))}
          </div>
        </aside>
      </section>
    </main>
  )
}

function Metric({ icon, label, value, detail }: { icon: ReactNode; label: string; value: string; detail: string }) {
  return (
    <article className="metric-card">
      <div className="metric-icon">{icon}</div>
      <div>
        <p>{label}</p>
        <strong>{value}</strong>
        <span>{detail}</span>
      </div>
    </article>
  )
}

function MasterCheck({ label, value }: { label: string; value: string }) {
  return (
    <div className="master-check">
      <DatabaseZap size={16} />
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

export default App
